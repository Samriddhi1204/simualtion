(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SimPrng = factory();
})(this, function () {
  function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function intBetween(random, min, max) {
    return min + Math.floor(random() * (max - min + 1));
  }

  function pick(random, list) {
    return list[Math.floor(random() * list.length)];
  }

  function shuffle(random, list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const held = copy[i];
      copy[i] = copy[j];
      copy[j] = held;
    }
    return copy;
  }

  return { mulberry32, intBetween, pick, shuffle };
});
