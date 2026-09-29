const test = require("node:test");
const assert = require("node:assert");
const content = require("../src/content.js");

test("every demo has the fixed sections", () => {
  content.order.forEach((id) => {
    const demo = content.demos[id];
    assert.ok(demo.title && demo.problemLine && demo.tour);
    assert.ok(demo.tryIt.length >= 2 && demo.tryIt.length <= 4, id + " needs 2 to 4 steps");
  });
});

test("demos with fix switches list issues, fixes and a trade-off", () => {
  content.order.slice(0, 6).forEach((id) => {
    const demo = content.demos[id];
    assert.ok(demo.issues.length >= 4);
    assert.ok(demo.fixes.length >= 6);
    assert.ok(demo.tradeoff);
    assert.strictEqual(new Set(demo.fixes.map((fix) => fix.key)).size, demo.fixes.length);
  });
});

test("fix counts match the content", () => {
  const counts = content.order.slice(0, 6).map((id) => content.demos[id].fixes.length);
  assert.deepStrictEqual(counts, [6, 10, 6, 8, 6, 8]);
});

test("q7 has five cards", () => {
  assert.strictEqual(content.demos.q7.cards.length, 5);
});

test("q1 caption reads naturally", () => {
  const text = content.captions.q1({ students: 1500, running: 1, slots: 1, loadPercent: 240, status: "down", tryAgain: 0, backlog: 0, playing: false });
  assert.match(text, /240 percent/);
  assert.match(text, /down/);
});
