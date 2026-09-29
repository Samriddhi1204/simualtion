const test = require("node:test");
const assert = require("node:assert");
const q1 = require("../src/sim/q1-load.js");

function configWith(changes, fixes) {
  const config = q1.defaultConfig();
  Object.assign(config, changes);
  Object.assign(config.fixes, fixes);
  return config;
}

function peak(config) {
  return q1.summary(config).loadPercent;
}

test("load rises with the number of students", () => {
  assert.ok(peak(configWith({ students: 500 })) < peak(configWith({ students: 1500 })));
  assert.ok(peak(configWith({ students: 100 })) < peak(configWith({ students: 500 })));
});

test("the default situation overloads the only server", () => {
  const result = q1.summary(q1.defaultConfig());
  assert.ok(result.loadPercent > 100);
  assert.strictEqual(result.status, "down");
});

test("each fix lowers the peak load on its own", () => {
  const baseline = peak(q1.defaultConfig());
  q1.FIX_KEYS.forEach((key) => {
    const lowered = peak(configWith({}, { [key]: true }));
    assert.ok(lowered < baseline, key + " should lower the load");
  });
});

test("all fixes together keep the site healthy", () => {
  const fixes = Object.fromEntries(q1.FIX_KEYS.map((key) => [key, true]));
  const result = q1.summary(configWith({}, fixes));
  assert.strictEqual(result.status, "ok");
});

test("load balancer capacity scales with running servers", () => {
  const single = q1.capacityUnits(configWith({}, {}));
  const balanced = q1.capacityUnits(configWith({}, { loadBalancer: true }));
  assert.strictEqual(balanced, single * q1.LOAD_BALANCER_SERVERS);
  const afterKill = q1.capacityUnits(configWith({ killed: 1 }, { loadBalancer: true }));
  assert.strictEqual(afterKill, single);
});

test("killing one of two servers keeps a light site up", () => {
  const config = configWith({ students: 100, killed: 1 }, { loadBalancer: true });
  assert.notStrictEqual(q1.summary(config).status, "down");
  assert.strictEqual(q1.summary(config).serversRunning, 1);
});

test("killing the only server gives Down", () => {
  const config = configWith({ students: 100, killed: 1 }, {});
  assert.strictEqual(q1.summary(config).status, "down");
});

test("rate limiting counts rejected requests", () => {
  assert.strictEqual(q1.summary(q1.defaultConfig()).tryAgainCount, 0);
  assert.ok(q1.summary(configWith({}, { rateLimit: true })).tryAgainCount > 0);
});

test("staggered slots have equal length and share the students", () => {
  const config = configWith({ slots: 5 }, { staggered: true });
  const bands = q1.slotBands(config);
  assert.strictEqual(bands.length, 5);
  const lengths = new Set(bands.map((band) => band.end - band.start));
  assert.strictEqual(lengths.size, 1);
  assert.strictEqual(q1.slotStudents(config).reduce((a, b) => a + b, 0), 1500);
});

test("slots ignored when staggered deadlines are off", () => {
  assert.strictEqual(q1.slotBands(configWith({ slots: 4 }, {})).length, 1);
});

test("background queue drains a backlog", () => {
  const points = q1.timeline(configWith({}, { queue: true }));
  const last = points[points.length - 1];
  assert.ok(Math.max(...points.map((point) => point.backlog)) > 0);
  assert.ok(last.backlog <= Math.max(...points.map((point) => point.backlog)));
});

test("rotating slots moves the first group to the last slot", () => {
  assert.deepStrictEqual(q1.rotateSlotOrder(["A", "B", "C"]), ["B", "C", "A"]);
});
