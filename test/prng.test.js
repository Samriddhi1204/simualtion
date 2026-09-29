const test = require("node:test");
const assert = require("node:assert");
const { mulberry32, shuffle, intBetween } = require("../src/sim/prng.js");

function draw(seed, count) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, random);
}

test("same seed gives the same sequence", () => {
  assert.deepStrictEqual(draw(42, 20), draw(42, 20));
});

test("different seeds give different sequences", () => {
  assert.notDeepStrictEqual(draw(1, 5), draw(2, 5));
});

test("values stay between 0 and 1", () => {
  draw(7, 500).forEach((value) => assert.ok(value >= 0 && value < 1));
});

test("shuffle keeps every item and is repeatable", () => {
  const list = [1, 2, 3, 4, 5, 6];
  const first = shuffle(mulberry32(9), list);
  assert.deepStrictEqual(first.slice().sort(), list);
  assert.deepStrictEqual(first, shuffle(mulberry32(9), list));
});

test("intBetween stays in range", () => {
  const random = mulberry32(3);
  for (let i = 0; i < 200; i++) {
    const value = intBetween(random, 5, 8);
    assert.ok(value >= 5 && value <= 8);
  }
});
