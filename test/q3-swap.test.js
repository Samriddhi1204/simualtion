const test = require("node:test");
const assert = require("node:assert");
const q3 = require("../src/sim/q3-swap.js");

test("same-name uploads collide without the fix", () => {
  const uploads = q3.simultaneousUploads();
  const folder = q3.saveFiles(uploads, false);
  assert.strictEqual(Object.keys(folder).length, 1);
  const view = q3.teacherView(uploads, folder, false);
  assert.strictEqual(view[0].sees, "Meera");
  assert.strictEqual(view[0].correct, false);
});

test("unique names never collide", () => {
  const uploads = q3.simultaneousUploads();
  const folder = q3.saveFiles(uploads, true);
  assert.strictEqual(Object.keys(folder).length, 2);
  assert.ok(q3.teacherView(uploads, folder, true).every((row) => row.correct));
  assert.match(Object.keys(folder)[0], /^S-101_A7_\d+\.pdf$/);
});

test("the unique rule rejects a duplicate student, assignment and attempt", () => {
  const records = [];
  const record = { studentId: "S-101", assignmentId: "A7", attempt: 1 };
  assert.ok(q3.insertRecord(records, record, true).accepted);
  assert.strictEqual(q3.insertRecord(records, { ...record }, true).accepted, false);
  assert.strictEqual(records.length, 1);
  assert.ok(q3.insertRecord(records, { ...record, attempt: 2 }, true).accepted);
});

test("without the unique rule a duplicate record is stored", () => {
  const records = [];
  const record = { studentId: "S-101", assignmentId: "A7", attempt: 1 };
  q3.insertRecord(records, record, false);
  assert.ok(q3.insertRecord(records, { ...record }, false).accepted);
  assert.strictEqual(records.length, 2);
});

test("lookup by assignment only returns the first record for both", () => {
  const rows = q3.lookupByAssignment(q3.simultaneousUploads(), { lookupBoth: false });
  assert.deepStrictEqual(rows.map((row) => row.sees), ["Aarav", "Aarav"]);
  assert.strictEqual(rows[1].correct, false);
});

test("lookup by both ids returns each student's own record", () => {
  const rows = q3.lookupByAssignment(q3.simultaneousUploads(), { lookupBoth: true });
  assert.ok(rows.every((row) => row.correct));
});

test("prisma step is labelled in the lookup steps", () => {
  assert.match(q3.lookupSteps({ prisma: true, lookupBoth: true })[0], /Prisma/);
  assert.doesNotMatch(q3.lookupSteps({ prisma: false, lookupBoth: false })[0], /Prisma/);
});

test("a shared variable is overwritten between two requests", () => {
  const requests = q3.simultaneousUploads();
  const shared = q3.sharedVariableRun(requests, false);
  assert.strictEqual(shared.saved[0].correct, false);
  assert.ok(q3.sharedVariableRun(requests, true).saved.every((row) => row.correct));
});

test("a cache keyed by assignment serves one student's data to another", () => {
  const requests = q3.simultaneousUploads();
  assert.strictEqual(q3.cacheServe(requests, false)[1].sees, "Aarav");
  assert.ok(q3.cacheServe(requests, true).every((row) => row.correct));
});

test("the one-step claim lets exactly one evaluator win", () => {
  const atomic = q3.runEvaluators(["Evaluator 1", "Evaluator 2"], true);
  assert.deepStrictEqual(atomic.document.markedBy, ["Evaluator 1"]);
  const racing = q3.runEvaluators(["Evaluator 1", "Evaluator 2"], false);
  assert.strictEqual(racing.document.markedBy.length, 2);
});

test("already marked documents are skipped", () => {
  const { document } = q3.runEvaluators(["Evaluator 1"], true);
  assert.ok(q3.lateEvaluatorSkips(document));
});
