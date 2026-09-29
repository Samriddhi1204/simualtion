(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SimQ1 = factory();
})(this, function () {
  const BASE_CAPACITY_UNITS = 8000;
  const HEAVY_COST = 10;
  const LIGHT_COST = 2;
  const SLOW_QUERY_COST = 6;
  const INDEXED_QUERY_COST = 1;
  const SERVICE_MS_PER_UNIT = 10;
  const WINDOW_MINUTES = 60;
  const BUNCH_MINUTES = 10;
  const SLOT_GAP_MINUTES = 10;
  const LAST_MINUTE_SHARE = 0.85;
  const REMINDER_SHARE = 0.5;
  const REQUESTS_PER_STUDENT = 3;
  const STUDENTS_PER_SCRIPT = 300;
  const SCRIPT_REQUESTS_PER_MINUTE = 150;
  const RATE_LIMIT_PER_MINUTE = 60;
  const BACKGROUND_UNITS_PER_MINUTE = 600;
  const LOAD_BALANCER_SERVERS = 2;
  const SLOW_LOAD_PERCENT = 70;
  const DOWN_LOAD_PERCENT = 100;
  const MAX_SLOTS = 5;
  const FIX_KEYS = ["rateLimit", "loadBalancer", "queue", "index", "staggered", "reminders"];

  function noFixes() {
    return { rateLimit: false, loadBalancer: false, queue: false, index: false, staggered: false, reminders: false };
  }

  function defaultConfig() {
    return { students: 1500, slots: 5, killed: 0, fixes: noFixes() };
  }

  function totalServers(config) {
    return config.fixes.loadBalancer ? LOAD_BALANCER_SERVERS : 1;
  }

  function serversRunning(config) {
    return Math.max(0, totalServers(config) - config.killed);
  }

  function capacityUnits(config) {
    return BASE_CAPACITY_UNITS * serversRunning(config);
  }

  function costPerRequest(config) {
    const requestCost = config.fixes.queue ? LIGHT_COST : HEAVY_COST;
    const queryCost = config.fixes.index ? INDEXED_QUERY_COST : SLOW_QUERY_COST;
    return requestCost + queryCost;
  }

  function activeSlots(config) {
    if (!config.fixes.staggered) return 1;
    return Math.min(MAX_SLOTS, Math.max(1, config.slots));
  }

  function slotStudents(config) {
    const count = activeSlots(config);
    const base = Math.floor(config.students / count);
    const remainder = config.students % count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  function slotBands(config) {
    return slotStudents(config).map((students, index) => {
      const start = index * (WINDOW_MINUTES + SLOT_GAP_MINUTES);
      return { slot: index + 1, students, start, end: start + WINDOW_MINUTES };
    });
  }

  function timelineMinutes(config) {
    const bands = slotBands(config);
    return bands[bands.length - 1].end;
  }

  function bunchShare(config) {
    return config.fixes.reminders ? REMINDER_SHARE : LAST_MINUTE_SHARE;
  }

  function slotArrivals(students, share) {
    const earlyMinutes = WINDOW_MINUTES - BUNCH_MINUTES;
    const earlyRate = (students * (1 - share)) / earlyMinutes;
    const bunchRate = (students * share) / BUNCH_MINUTES;
    return Array.from({ length: WINDOW_MINUTES }, (_, minute) => (minute < earlyMinutes ? earlyRate : bunchRate));
  }

  function scriptsFor(students) {
    return students > 0 ? Math.ceil(students / STUDENTS_PER_SCRIPT) : 0;
  }

  function arrivals(config) {
    const minutes = new Array(timelineMinutes(config)).fill(0);
    const share = bunchShare(config);
    slotBands(config).forEach((band) => {
      slotArrivals(band.students, share).forEach((value, offset) => {
        minutes[band.start + offset] += value;
      });
    });
    return minutes;
  }

  function scriptRequestsRaw(config) {
    const minutes = new Array(timelineMinutes(config)).fill(0);
    slotBands(config).forEach((band) => {
      const perMinute = scriptsFor(band.students) * SCRIPT_REQUESTS_PER_MINUTE;
      for (let minute = band.end - BUNCH_MINUTES; minute < band.end; minute++) minutes[minute] += perMinute;
    });
    return minutes;
  }

  function scriptRequestsAllowed(config, raw) {
    if (!config.fixes.rateLimit) return raw;
    const allowedShare = Math.min(1, RATE_LIMIT_PER_MINUTE / SCRIPT_REQUESTS_PER_MINUTE);
    return raw.map((value) => value * allowedShare);
  }

  function loadPercentFor(units, capacity) {
    return capacity > 0 ? (units / capacity) * 100 : 0;
  }

  function timeline(config) {
    const capacity = capacityUnits(config);
    const cost = costPerRequest(config);
    const arrived = arrivals(config);
    const raw = scriptRequestsRaw(config);
    const allowed = scriptRequestsAllowed(config, raw);
    let backlog = 0;
    return arrived.map((students, minute) => {
      const wanted = students * REQUESTS_PER_STUDENT + raw[minute];
      const served = students * REQUESTS_PER_STUDENT + allowed[minute];
      const backgroundUnits = config.fixes.queue ? students * (HEAVY_COST - LIGHT_COST) : 0;
      backlog = Math.max(0, backlog + backgroundUnits - BACKGROUND_UNITS_PER_MINUTE);
      return {
        minute,
        wanted,
        served,
        rejected: wanted - served,
        loadPercent: loadPercentFor(served * cost, capacity),
        backlog
      };
    });
  }

  function statusFor(config, loadPercent) {
    if (serversRunning(config) === 0 || loadPercent > DOWN_LOAD_PERCENT) return "down";
    return loadPercent >= SLOW_LOAD_PERCENT ? "slow" : "ok";
  }

  function averageResponseMs(config, loadPercent) {
    if (statusFor(config, loadPercent) === "down") return null;
    const utilisation = Math.min(loadPercent / 100, 0.98);
    return Math.round((costPerRequest(config) * SERVICE_MS_PER_UNIT) / (1 - utilisation));
  }

  function statusAt(config, point) {
    const loadPercent = point ? point.loadPercent : 0;
    return {
      loadPercent,
      status: statusFor(config, loadPercent),
      averageMs: averageResponseMs(config, loadPercent),
      backlog: point ? point.backlog : 0
    };
  }

  function summary(config) {
    const points = timeline(config);
    const peak = points.reduce((best, point) => (point.loadPercent > best.loadPercent ? point : best), points[0]);
    return {
      ...statusAt(config, peak),
      peakMinute: peak.minute,
      tryAgainCount: Math.round(points.reduce((sum, point) => sum + point.rejected, 0)),
      peakBacklog: Math.round(Math.max(...points.map((point) => point.backlog))),
      serversRunning: serversRunning(config),
      totalServers: totalServers(config),
      slots: activeSlots(config)
    };
  }

  function rotateSlotOrder(order) {
    return order.slice(1).concat(order[0]);
  }

  return {
    BASE_CAPACITY_UNITS,
    BUNCH_MINUTES,
    LAST_MINUTE_SHARE,
    LOAD_BALANCER_SERVERS,
    MAX_SLOTS,
    RATE_LIMIT_PER_MINUTE,
    REQUESTS_PER_STUDENT,
    WINDOW_MINUTES,
    FIX_KEYS,
    noFixes,
    defaultConfig,
    totalServers,
    serversRunning,
    capacityUnits,
    costPerRequest,
    activeSlots,
    slotStudents,
    slotBands,
    timelineMinutes,
    arrivals,
    timeline,
    statusAt,
    statusFor,
    summary,
    rotateSlotOrder
  };
});
