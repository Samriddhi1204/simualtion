const test = require("node:test");
const assert = require("node:assert");
const { createClock, formatClockTime, scaleLabel, formatDuration } = require("../src/sim/clock.js");

test("ten simulated minutes take six real seconds at 1x", () => {
  const clock = createClock();
  clock.advance(6000);
  assert.strictEqual(Math.round(clock.now()), 600);
});

test("speed multiplies the pace", () => {
  const clock = createClock();
  clock.setSpeed(20);
  clock.advance(300);
  assert.strictEqual(Math.round(clock.now()), 600);
});

test("pause stops time", () => {
  const clock = createClock();
  clock.pause();
  clock.advance(5000);
  assert.strictEqual(clock.now(), 0);
  clock.resume();
  clock.advance(1000);
  assert.ok(clock.now() > 0);
});

test("invalid speed is ignored", () => {
  const clock = createClock();
  clock.setSpeed(3);
  assert.strictEqual(clock.speed(), 1);
});

test("labels and formats", () => {
  assert.strictEqual(scaleLabel(1), "10 min (simulated) = 6 s here");
  assert.strictEqual(scaleLabel(5), "10 min (simulated) = 1.2 s here");
  assert.strictEqual(formatClockTime(132), "21:02:12");
  assert.strictEqual(formatDuration(130), "2 min 10 s");
});
