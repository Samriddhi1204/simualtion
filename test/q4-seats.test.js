const test = require("node:test");
const assert = require("node:assert");
const q4 = require("../src/sim/q4-seats.js");

function sessionWith(keys) {
  const state = q4.createSession(3);
  const fixes = q4.noFixes();
  keys.forEach((key) => (fixes[key] = true));
  q4.setFixes(state, fixes);
  return state;
}

function pair(state) {
  return [q4.findStudent(state, "S-101"), q4.findStudent(state, "S-102")];
}

test("without the fix two simultaneous joins exceed capacity", () => {
  const state = sessionWith([]);
  q4.fillTo(state, 19);
  const outcomes = q4.joinBatch(state, pair(state), true);
  assert.ok(outcomes.every((item) => item.outcome === "seated"));
  assert.strictEqual(state.seats.length, 21);
  assert.strictEqual(q4.overCapacity(state), 1);
});

test("with the fix exactly one wins and the other is waitlisted", () => {
  const state = sessionWith(["reserve", "waitingList"]);
  q4.fillTo(state, 19);
  const outcomes = q4.joinBatch(state, pair(state), true);
  assert.deepStrictEqual(outcomes.map((item) => item.outcome), ["seated", "waitlisted"]);
  assert.strictEqual(state.seats.length, 20);
  assert.strictEqual(outcomes[1].position, 1);
});

test("without a waiting list the extra student is turned away", () => {
  const state = sessionWith(["reserve"]);
  q4.fillTo(state, 19);
  const outcomes = q4.joinBatch(state, pair(state), true);
  assert.strictEqual(outcomes[1].outcome, "turned away");
});

test("two groups of twenty overflow without the fix and fit with it", () => {
  const roster = q4.createRoster(3);
  const groups = roster.slice(0, 40);
  const broken = sessionWith([]);
  q4.joinBatch(broken, groups, true);
  assert.strictEqual(broken.seats.length, 40);
  const fixed = sessionWith(["reserve", "waitingList"]);
  q4.joinBatch(fixed, groups, true);
  assert.strictEqual(fixed.seats.length, 20);
  assert.strictEqual(fixed.waiting.length, 20);
});

test("unauthenticated join is refused when authenticate is on", () => {
  const visitor = { id: "visitor", name: "Visitor", marks: [50, 50, 50] };
  const on = sessionWith(["authenticate"]);
  assert.strictEqual(q4.joinBatch(on, [visitor], false)[0].message, "Log in to join");
  assert.strictEqual(on.seats.length, 0);
  const off = sessionWith([]);
  assert.strictEqual(q4.joinBatch(off, [visitor], false)[0].outcome, "seated");
});

test("capacity only changes when it is a setting", () => {
  const fixed = sessionWith(["capacity"]);
  assert.ok(q4.setCapacity(fixed, 30));
  assert.strictEqual(fixed.capacity, 30);
  const hardCoded = sessionWith([]);
  assert.strictEqual(q4.setCapacity(hardCoded, 30), false);
  assert.strictEqual(hardCoded.capacity, 20);
});

test("a freed seat moves the first waiting student up", () => {
  const state = sessionWith(["reserve", "waitingList"]);
  q4.fillTo(state, 20);
  const [first, second] = pair(state);
  q4.joinBatch(state, [first, second], true);
  assert.deepStrictEqual(state.waiting.map((entry) => entry.student.id), ["S-101", "S-102"]);
  q4.freeSeat(state, state.seats[0].student.id);
  assert.ok(state.seats.some((seat) => seat.student.id === "S-101"));
  assert.strictEqual(state.waiting.length, 1);
});

test("no-show release promotes the next waiting student", () => {
  const state = sessionWith(["reserve", "waitingList", "noShow"]);
  const [first, second] = pair(state);
  q4.fillTo(state, 20);
  state.seats.forEach((seat) => (seat.confirmed = true));
  state.seats[0].confirmed = false;
  q4.joinBatch(state, [first], true);
  assert.strictEqual(state.waiting.length, 1);
  q4.advance(state, q4.CONFIRM_SECONDS - 1);
  assert.strictEqual(state.waiting.length, 1);
  q4.advance(state, 2);
  assert.strictEqual(state.waiting.length, 0);
  assert.ok(state.seats.some((seat) => seat.student.id === first.id));
  assert.ok(second);
});

test("selection chooses the weakest recent marks and rotates", () => {
  const state = sessionWith(["selection", "waitingList"]);
  const weak = { id: "W", name: "Weak", marks: [40, 40, 40] };
  const mid = { id: "M", name: "Mid", marks: [55, 55, 55] };
  const strong = { id: "S", name: "Strong", marks: [90, 90, 90] };
  state.capacity = 0;
  q4.joinBatch(state, [strong, mid, weak], true);
  assert.strictEqual(q4.chooseNextWaiting(state).student.id, "W");
  state.priorityCount.W = 1;
  assert.strictEqual(q4.chooseNextWaiting(state).student.id, "M");
});

test("without selection the waiting list is first come first served", () => {
  const state = sessionWith(["waitingList"]);
  const weak = { id: "W", name: "Weak", marks: [40, 40, 40] };
  const strong = { id: "S", name: "Strong", marks: [90, 90, 90] };
  state.capacity = 0;
  q4.joinBatch(state, [strong, weak], true);
  assert.strictEqual(q4.chooseNextWaiting(state).student.id, "S");
});

test("load balancing spreads join requests over several servers", () => {
  assert.deepStrictEqual(q4.serverShares(sessionWith([]), 10), [10]);
  assert.deepStrictEqual(q4.serverShares(sessionWith(["balancing"]), 10), [4, 3, 3]);
});

test("listen only is offered to waiting students when on", () => {
  const state = sessionWith(["waitingList", "listenOnly"]);
  state.capacity = 0;
  q4.joinBatch(state, [q4.findStudent(state, "S-101")], true);
  assert.ok(q4.setListenOnly(state, "S-101"));
  assert.ok(state.waiting[0].listenOnly);
});
