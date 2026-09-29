const test = require("node:test");
const assert = require("node:assert");
const q5 = require("../src/sim/q5-verify.js");

function fixesWith(keys) {
  const fixes = q5.noFixes();
  keys.forEach((key) => (fixes[key] = true));
  return fixes;
}

function preset(name) {
  return q5.FILE_PRESETS.find((file) => file.name === name);
}

test("without checks every preset is accepted", () => {
  q5.FILE_PRESETS.forEach((file) => assert.ok(q5.checkFile(file, q5.noFixes()).accepted));
});

test("with checks only the valid pdf is accepted", () => {
  const fixes = fixesWith(["fileChecks"]);
  const results = Object.fromEntries(q5.FILE_PRESETS.map((file) => [file.name, q5.checkFile(file, fixes)]));
  assert.ok(results["report.pdf"].accepted);
  assert.match(results["empty.pdf"].reason, /empty/);
  assert.match(results["huge.pdf"].reason, /size limit/);
  assert.match(results["notes.txt"].reason, /PDF/);
  assert.match(results["corrupted.pdf"].reason, /corrupted/);
  ["empty.pdf", "huge.pdf", "notes.txt", "corrupted.pdf"].forEach((name) => assert.strictEqual(results[name].accepted, false));
});

test("summary carries name, assignment, file name, size and time", () => {
  const summary = q5.prepareSummary(preset("report.pdf"), 120);
  assert.deepStrictEqual(Object.keys(summary), ["name", "assignment", "fileName", "sizeKb", "time"]);
});

test("receipt is issued with an id and time only when on", () => {
  const withReceipt = q5.submitFile(q5.createStudentSide(), preset("report.pdf"), fixesWith(["receipt"]), 50);
  assert.match(withReceipt.receipt.id, /^sub-\d+$/);
  assert.strictEqual(withReceipt.receipt.time, 50);
  const without = q5.submitFile(q5.createStudentSide(), preset("report.pdf"), q5.noFixes(), 50);
  assert.strictEqual(without.receipt, null);
});

test("duplicate detection flags the same file only when on", () => {
  const side = q5.createStudentSide();
  const fixes = fixesWith(["duplicate"]);
  q5.submitFile(side, preset("report.pdf"), fixes, 1);
  assert.strictEqual(q5.submitFile(side, preset("report.pdf"), fixes, 2).status, "duplicate");
  const silent = q5.createStudentSide();
  q5.submitFile(silent, preset("report.pdf"), q5.noFixes(), 1);
  assert.strictEqual(q5.submitFile(silent, preset("report.pdf"), q5.noFixes(), 2).status, "saved");
  assert.strictEqual(silent.submissions.length, 2);
});

test("history rows record who, when, old and new value", () => {
  const book = q5.createGradebook();
  const fixes = fixesWith(["history"]);
  q5.saveScore(book, "sub-1901", 70, "Teacher", 10, fixes);
  q5.saveScore(book, "sub-1901", 75, "Teacher", 20, fixes);
  const rows = q5.historyFor(book, "sub-1901");
  assert.deepStrictEqual(rows[0], { id: "sub-1901", who: "Teacher", when: 10, oldValue: null, newValue: 70 });
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1].oldValue, 70);
});

test("without history the score is saved and nothing is recorded", () => {
  const book = q5.createGradebook();
  q5.saveScore(book, "sub-1901", 70, "Teacher", 10, q5.noFixes());
  assert.strictEqual(book.submissions[0].score, 70);
  assert.strictEqual(book.history.length, 0);
});

test("input points turn checked with their fix", () => {
  assert.ok(q5.inputPoints(q5.noFixes()).every((point) => !point.checked));
  assert.ok(q5.inputPoints(fixesWith(q5.FIX_KEYS)).every((point) => point.checked));
});
