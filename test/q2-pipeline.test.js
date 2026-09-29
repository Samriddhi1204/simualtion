const test = require("node:test");
const assert = require("node:assert");
const q2 = require("../src/sim/q2-pipeline.js");

function pipelineWith(keys) {
  const state = q2.createPipeline(5);
  const fixes = q2.noFixes();
  keys.forEach((key) => (fixes[key] = true));
  q2.setFixes(state, fixes);
  return state;
}

function run(state, seconds) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 5) q2.tick(state, 5);
}

test("a submission moves unmarked, evaluating, marked in that order", () => {
  const state = pipelineWith(["status", "logging"]);
  const card = q2.submit(state, "ok");
  const seen = [card.status];
  for (let i = 0; i < 40; i++) {
    q2.tick(state, 5);
    if (seen[seen.length - 1] !== card.status) seen.push(card.status);
  }
  assert.deepStrictEqual(seen, ["unmarked", "evaluating", "marked"]);
});

test("a marked item is never picked up again", () => {
  const state = pipelineWith(["status", "logging"]);
  const card = q2.submit(state, "ok");
  run(state, 400);
  assert.strictEqual(card.status, "marked");
  const pickups = () => card.trail.filter((entry) => entry.step === "picked up").length;
  assert.strictEqual(pickups(), 1);
  run(state, 2000);
  assert.strictEqual(pickups(), 1);
});

test("a crashed card is returned to unmarked after ten minutes with auto-recovery", () => {
  const state = pipelineWith(["status", "recovery", "oneJob"]);
  const card = q2.submit(state, "ok");
  q2.tick(state, 5);
  assert.strictEqual(card.column, "evaluating");
  q2.crashServer(state);
  run(state, q2.RECOVERY_SECONDS - 20);
  assert.strictEqual(card.column, "evaluating");
  run(state, 60);
  assert.strictEqual(card.attempts, 1);
  run(state, 300);
  assert.strictEqual(card.status, "marked");
});

test("without auto-recovery a crashed card stays in evaluating forever", () => {
  const state = pipelineWith([]);
  const card = q2.submit(state, "ok");
  q2.tick(state, 5);
  q2.crashServer(state);
  run(state, 20000);
  assert.strictEqual(card.column, "evaluating");
});

test("a corrupted file is rejected at upload when checks are on", () => {
  const state = pipelineWith(["uploadChecks"]);
  const card = q2.submit(state, "corrupted");
  assert.strictEqual(card.column, "rejected");
  assert.ok(card.reason);
  assert.strictEqual(q2.queueStats(state).occupied, 0);
});

test("a corrupted file blocks the cards behind it when checks are off", () => {
  const state = pipelineWith([]);
  const bad = q2.submit(state, "corrupted");
  const behind = q2.submit(state, "ok");
  run(state, 1000);
  assert.strictEqual(bad.column, "evaluating");
  assert.strictEqual(behind.column, "queue");
});

test("one job per student lets the cards behind a stuck one finish", () => {
  const state = pipelineWith(["oneJob"]);
  q2.submit(state, "corrupted");
  const behind = q2.submit(state, "ok");
  run(state, 1000);
  assert.strictEqual(behind.status, "marked");
});

test("queue full drops extra cards silently without fixes", () => {
  const state = pipelineWith([]);
  for (let i = 0; i < q2.QUEUE_LIMIT + 3; i++) q2.submit(state, "ok");
  assert.strictEqual(q2.queueStats(state).dropped, 3);
  assert.strictEqual(state.cards.filter((card) => card.message === "Submitted" && card.column === "dropped").length, 3);
});

test("queue size fix keeps the same burst from being dropped", () => {
  const state = pipelineWith(["queueSize"]);
  for (let i = 0; i < q2.QUEUE_LIMIT + 3; i++) q2.submit(state, "ok");
  assert.strictEqual(q2.queueStats(state).dropped, 0);
});

test("queue check shows an error instead of a false submitted", () => {
  const silent = pipelineWith([]);
  q2.setQueueingBroken(silent, true);
  const falseSubmitted = q2.submit(silent, "ok");
  assert.strictEqual(falseSubmitted.message, "Submitted");
  assert.strictEqual(falseSubmitted.column, "received");

  const checked = pipelineWith(["queueCheck"]);
  q2.setQueueingBroken(checked, true);
  assert.match(q2.submit(checked, "ok").message, /Error/);
});

test("logging writes a line for every step with the submission id", () => {
  const state = pipelineWith(["logging"]);
  const card = q2.submit(state, "ok");
  run(state, 400);
  const steps = q2.takeEvents(state).map((event) => event.text);
  assert.deepStrictEqual(steps.map((text) => text.split(" ")[0]), Array(5).fill(card.id));
  assert.strictEqual(steps.length, 5);
});

test("logging off writes nothing and gives no trail", () => {
  const state = pipelineWith([]);
  const card = q2.submit(state, "ok");
  run(state, 400);
  assert.strictEqual(q2.takeEvents(state).length, 0);
  assert.strictEqual(q2.cardTrail(state, card.id).length, 0);
});

test("diagnosis follows the last step reached", () => {
  const stuckQueue = pipelineWith(["logging"]);
  q2.setQueueingBroken(stuckQueue, true);
  const saved = q2.submit(stuckQueue, "ok");
  assert.match(q2.diagnose(q2.cardTrail(stuckQueue, saved.id)), /queueing problem/);

  const crashed = pipelineWith(["logging"]);
  const card = q2.submit(crashed, "corrupted");
  q2.tick(crashed, 5);
  assert.match(q2.diagnose(q2.cardTrail(crashed, card.id)), /crash or error/);
});

test("results table moves marked cards out of the queue", () => {
  const withTable = pipelineWith(["resultsTable"]);
  const without = pipelineWith([]);
  [withTable, without].forEach((state) => {
    q2.submit(state, "ok");
    run(state, 300);
  });
  assert.strictEqual(withTable.cards[0].column, "marked");
  assert.strictEqual(without.cards[0].column, "queue");
});

test("pending too long list shows stuck cards only when on", () => {
  const on = pipelineWith(["pendingList"]);
  const off = pipelineWith([]);
  [on, off].forEach((state) => {
    q2.submit(state, "corrupted");
    run(state, q2.RECOVERY_SECONDS + 60);
  });
  assert.strictEqual(q2.pendingTooLong(on).length, 1);
  assert.strictEqual(q2.pendingTooLong(off).length, 0);
});

test("teacher marks the next unmarked card", () => {
  const state = pipelineWith([]);
  q2.setQueueingBroken(state, false);
  q2.submit(state, "ok");
  const proposal = q2.proposeMark(state);
  assert.ok(proposal.score >= 40);
  assert.ok(q2.teacherMark(state, proposal.id, proposal.score));
  assert.strictEqual(state.cards[0].status, "marked");
  assert.strictEqual(q2.teacherMark(state, proposal.id, 50), false);
});

test("more processors drain the queue faster", () => {
  const one = pipelineWith([]);
  const many = pipelineWith([]);
  q2.addProcessor(many);
  q2.addProcessor(many);
  [one, many].forEach((state) => {
    for (let i = 0; i < 5; i++) q2.submit(state, "ok");
    run(state, 200);
  });
  const marked = (state) => state.cards.filter((card) => card.status === "marked").length;
  assert.ok(marked(many) > marked(one));
});
