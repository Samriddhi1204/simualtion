const test = require("node:test");
const assert = require("node:assert");
const q7 = require("../src/sim/q7-other.js");

test("a double click saves two copies without the fix and the teacher grades the older one", () => {
  const box = q7.createSubmissionBox();
  q7.submit(box, false, 10, "click");
  q7.submit(box, false, 10.5, "click");
  assert.strictEqual(box.attempts.length, 2);
  assert.strictEqual(q7.gradedCopy(box, false).attempt, 1);
});

test("with the fix the second click is rejected", () => {
  const box = q7.createSubmissionBox();
  assert.ok(q7.submit(box, true, 10, "click").accepted);
  assert.strictEqual(q7.submit(box, true, 10.5, "click").accepted, false);
  assert.strictEqual(box.attempts.length, 1);
  assert.strictEqual(box.rejected, 1);
});

test("the latest attempt before the deadline is counted and older ones are kept", () => {
  const box = q7.createSubmissionBox();
  q7.submit(box, true, 10, "click");
  q7.submit(box, true, 200, "resubmit");
  q7.submit(box, true, q7.DEADLINE_SECONDS + 50, "resubmit");
  assert.strictEqual(box.attempts.length, 3);
  assert.strictEqual(q7.countedAttempt(box).attempt, 2);
  assert.deepStrictEqual(q7.teacherSees(box, true).map((item) => item.attempt), [2]);
});

test("the device clock hides a late upload without the fix", () => {
  const cheat = { actualStart: 180, uploadSeconds: 20, clockShift: -600 };
  assert.ok(q7.judgeDeadline(cheat, false).onTime);
  assert.strictEqual(q7.judgeDeadline(cheat, true).onTime, false);
});

test("slow internet makes an on-time student look late without the fix", () => {
  const slow = { actualStart: -30, uploadSeconds: 120, clockShift: 0 };
  assert.strictEqual(q7.judgeDeadline(slow, false).onTime, false);
  assert.ok(q7.judgeDeadline(slow, true).onTime);
});

test("slots have equal length and rotate across assignments", () => {
  const groups = ["A", "B", "C"];
  const first = q7.slotSchedule(groups, 0);
  const second = q7.slotSchedule(groups, 1);
  assert.strictEqual(new Set(first.map((slot) => slot.end - slot.start)).size, 1);
  assert.notStrictEqual(first[2].group, second[2].group);
});

test("an unconfirmed seat is wasted without the fix and released with it", () => {
  const broken = q7.createSeatCase();
  q7.advanceSeat(broken, 130, false);
  assert.strictEqual(broken.holder.name, "Kabir");
  assert.strictEqual(q7.wastedSeconds(broken, false), 130);
  const fixed = q7.createSeatCase();
  q7.advanceSeat(fixed, 130, true);
  assert.strictEqual(fixed.holder.name, "Isha");
  assert.ok(fixed.released);
});

test("repeated no-shows get lower priority", () => {
  const state = q7.createSeatCase();
  assert.deepStrictEqual(q7.waitingOrder(state, true).map((entry) => entry.name), ["Isha", "Riya", "Dev"]);
});

test("changing the student id opens another homework only without the fix", () => {
  const request = { role: "student", viewerId: "S-101", requestedId: "S-102" };
  assert.ok(q7.openHomework(request, false).allowed);
  assert.strictEqual(q7.openHomework(request, true).allowed, false);
  assert.ok(q7.openHomework({ ...request, requestedId: "S-101" }, true).allowed);
  assert.ok(q7.openHomework({ ...request, role: "teacher" }, true).allowed);
  assert.strictEqual(q7.openHomework({ ...request, role: "liveHelp" }, true).allowed, false);
});

test("names and emails leak into leaderboards and logs only without the fix", () => {
  const student = { id: "S-102", name: "Meera Iyer", initials: "M.I.", email: "meera@example.org" };
  assert.strictEqual(q7.leaderboardName(student, false), "Meera Iyer");
  assert.strictEqual(q7.leaderboardName(student, true), "M.I.");
  assert.match(q7.logLine(student, false), /meera@example.org/);
  assert.doesNotMatch(q7.logLine(student, true), /Meera|@/);
});

test("short-lived links expire", () => {
  const link = q7.createLink(100);
  assert.strictEqual(q7.linkSecondsLeft(link, 100), q7.LINK_LIFETIME_SECONDS);
  assert.strictEqual(q7.linkSecondsLeft(link, 100 + q7.LINK_LIFETIME_SECONDS + 10), 0);
});

test("the queue is sorted by deadline only with the fix", () => {
  const subs = q7.createQueue(7);
  const sorted = q7.orderQueue(subs, true).map((sub) => sub.hoursLeft);
  assert.deepStrictEqual(sorted, sorted.slice().sort((a, b) => a - b));
  assert.deepStrictEqual(q7.orderQueue(subs, false, 7), q7.orderQueue(subs, false, 7));
});

test("late, blank and duplicate files are flagged before the teacher", () => {
  const subs = q7.createQueue(7);
  const split = q7.splitFlagged(subs, true);
  assert.ok(split.flagged.length > 0);
  assert.ok(split.toTeacher.every((sub) => q7.autoFlag(sub) === null));
  assert.strictEqual(q7.splitFlagged(subs, false).flagged.length, 0);
});

test("grading stops without the teacher unless there is backup access", () => {
  assert.strictEqual(q7.nextGrader(true, false), null);
  assert.match(q7.nextGrader(true, true), /backup/);
  assert.strictEqual(q7.nextGrader(false, false), "Teacher");
});

test("common mistakes count the applied snippets", () => {
  const graded = [{ snippet: "missing units" }, { snippet: "good approach" }, { snippet: "missing units" }, { snippet: null }];
  assert.deepStrictEqual(q7.commonMistakes(graded)[0], { snippet: "missing units", count: 2 });
});

test("staggered deadlines spread the load", () => {
  assert.deepStrictEqual(q7.spreadLoad(10, 3), [4, 3, 3]);
});
