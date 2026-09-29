(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SimClock = factory();
})(this, function () {
  const SIM_SECONDS_PER_REAL_SECOND = 100;
  const SPEEDS = [1, 5, 20];
  const DAY_START_SECONDS = 21 * 3600;
  const REFERENCE_SIM_MINUTES = 10;

  function pad(value) {
    return String(Math.floor(value)).padStart(2, "0");
  }

  function formatClockTime(simSeconds) {
    const total = Math.floor(DAY_START_SECONDS + simSeconds) % 86400;
    return pad(total / 3600) + ":" + pad((total % 3600) / 60) + ":" + pad(total % 60);
  }

  function formatDuration(simSeconds) {
    const total = Math.max(0, Math.round(simSeconds));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    if (minutes === 0) return seconds + " s";
    return seconds === 0 ? minutes + " min" : minutes + " min " + seconds + " s";
  }

  function realSecondsFor(simMinutes, speed) {
    return (simMinutes * 60) / (SIM_SECONDS_PER_REAL_SECOND * speed);
  }

  function scaleLabel(speed) {
    const real = +realSecondsFor(REFERENCE_SIM_MINUTES, speed).toFixed(1);
    return REFERENCE_SIM_MINUTES + " min (simulated) = " + real + " s here";
  }

  function createClock() {
    let now = 0;
    let speed = 1;
    let paused = false;
    return {
      now: () => now,
      speed: () => speed,
      isPaused: () => paused,
      setSpeed(value) {
        if (SPEEDS.includes(value)) speed = value;
      },
      pause() {
        paused = true;
      },
      resume() {
        paused = false;
      },
      advance(realMilliseconds) {
        if (paused) return 0;
        const delta = (realMilliseconds / 1000) * SIM_SECONDS_PER_REAL_SECOND * speed;
        now += delta;
        return delta;
      },
      skip(simSeconds) {
        now += simSeconds;
      },
      reset() {
        now = 0;
      }
    };
  }

  return {
    SIM_SECONDS_PER_REAL_SECOND,
    SPEEDS,
    createClock,
    formatClockTime,
    formatDuration,
    realSecondsFor,
    scaleLabel
  };
});
