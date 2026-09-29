const test = require("node:test");
const assert = require("node:assert");
const q6 = require("../src/sim/q6-leaderboard.js");

const board = q6.createBoard(6);

test("the board holds 1,500 students and is repeatable", () => {
  assert.strictEqual(board.students.length, 1500);
  assert.deepStrictEqual(q6.createBoard(6).students[10], board.students[10]);
});

test("ranks count only evaluated students", () => {
  const list = q6.rankedList(board, 640);
  assert.strictEqual(list.length, 640);
  assert.deepStrictEqual(list.map((row) => row.rank).slice(0, 3), [1, 2, 3]);
  const own = q6.yourRank(board, 640);
  assert.strictEqual(own.of, 640);
  assert.ok(own.rank >= 1 && own.rank <= 640);
});

test("ties are broken by finishing time", () => {
  const tie = q6.tieExample(board, 640);
  assert.strictEqual(tie.first.student.marks, tie.second.student.marks);
  assert.ok(tie.first.student.finishSeconds < tie.second.student.finishSeconds);
  assert.strictEqual(tie.second.rank, tie.first.rank + 1);
});

test("without the time tiebreak equal marks fall back to id order", () => {
  const list = q6.rankedList(board, 1500, { tieBreak: "id" });
  for (let i = 1; i < list.length; i++) {
    if (list[i].student.marks === list[i - 1].student.marks) assert.ok(list[i - 1].student.id < list[i].student.id);
  }
});

test("progress and rank lines use the required wording", () => {
  assert.strictEqual(q6.progressLine(640, 1500), "Evaluated: 640 of 1,500");
  assert.strictEqual(q6.rankLine({ rank: 212, of: 640 }), "Your rank: 212 of 640 evaluated");
});

test("own status moves submitted, under review, evaluated", () => {
  assert.strictEqual(q6.ownStatus(board, 0), "submitted");
  const seen = [];
  for (let count = 0; count <= 40; count++) {
    const status = q6.ownStatus(board, count);
    if (seen[seen.length - 1] !== status) seen.push(status);
  }
  assert.deepStrictEqual(seen, ["submitted", "under review", "evaluated"]);
});

test("no rank until your own work is evaluated", () => {
  assert.strictEqual(q6.yourRank(board, 5), null);
  assert.notStrictEqual(q6.yourRank(board, 40), null);
});

test("batch and global ranks differ and the batch is smaller", () => {
  const global = q6.yourRank(board, 1500, { scope: "global" });
  const batch = q6.yourRank(board, 1500, { scope: "batch" });
  assert.strictEqual(global.of, 1500);
  assert.strictEqual(batch.of, q6.DEFAULT_BATCH_SIZE);
  assert.ok(batch.rank <= global.rank);
});

test("rank change reports direction and amount", () => {
  assert.deepStrictEqual(q6.rankChange(212, 215), { direction: "down", amount: 3 });
  assert.deepStrictEqual(q6.rankChange(212, 200), { direction: "up", amount: 12 });
  assert.deepStrictEqual(q6.rankChange(null, 200), { direction: "same", amount: 0 });
});

test("loading takes longer for all rows than for a page", () => {
  assert.ok(q6.loadDelayMs(1500, false) > q6.loadDelayMs(1500, true));
  assert.strictEqual(q6.loadDelayMs(1500, false), 3000);
});

test("nicknames hide real names", () => {
  const student = board.students[0];
  assert.strictEqual(q6.displayName(student, false), student.name);
  assert.match(q6.displayName(student, true), /^[A-Z]\.[A-Z]\.$/);
});

test("pages and jump to rank", () => {
  assert.strictEqual(q6.pageCount(1500), 60);
  assert.strictEqual(q6.pageOfRank(212), 8);
});
