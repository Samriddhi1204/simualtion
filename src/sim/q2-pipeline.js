(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root.SimPrng || require("./prng.js"));
  else root.SimQ2 = factory(root.SimPrng);
})(this, function (prng) {
  const EVALUATION_SECONDS = 90;
  const RECOVERY_SECONDS = 600;
  const QUEUE_LIMIT = 6;
  const WATCHED_QUEUE_LIMIT = 20;
  const MAX_PROCESSORS = 4;
  const FIRST_NUMBER = 1041;
  const FIX_KEYS = [
    "status",
    "logging",
    "recovery",
    "queueCheck",
    "uploadChecks",
    "queueSize",
    "resultsTable",
    "oneJob",
    "pendingList",
    "popup"
  ];
  const OPEN_COLUMNS = ["received", "queue", "evaluating"];

  function noFixes() {
    return Object.fromEntries(FIX_KEYS.map((key) => [key, false]));
  }

  function createPipeline(seed) {
    return {
      fixes: noFixes(),
      now: 0,
      nextNumber: FIRST_NUMBER,
      cards: [],
      processors: 1,
      queueingBroken: false,
      dropped: 0,
      events: [],
      random: prng.mulberry32(seed || 11)
    };
  }

  function setFixes(state, fixes) {
    state.fixes = { ...fixes };
  }

  function record(state, card, step, type, text) {
    card.trail.push({ time: state.now, step });
    if (state.fixes.logging) state.events.push({ time: state.now, type, id: card.id, text: card.id + " " + text });
  }

  function newCard(state, file) {
    const card = {
      id: "sub-" + state.nextNumber++,
      file,
      column: "received",
      status: "unmarked",
      submittedAt: state.now,
      queuedAt: null,
      startedAt: null,
      frozen: false,
      attempts: 0,
      message: "Submitted",
      failed: false,
      reason: null,
      score: null,
      trail: []
    };
    state.cards.push(card);
    return card;
  }

  function queueLimit(state) {
    return state.fixes.queueSize ? WATCHED_QUEUE_LIMIT : QUEUE_LIMIT;
  }

  function occupied(state) {
    return state.cards.filter((card) => card.column === "queue").length;
  }

  function reject(state, card, file) {
    card.column = "rejected";
    card.reason = file === "empty" ? "Empty PDF" : "Corrupted PDF";
    card.message = "Rejected: " + card.reason;
    record(state, card, "rejected", "error", "rejected at upload: " + card.reason);
  }

  function failToQueue(state, card, reason, silentColumn) {
    if (!state.fixes.queueCheck) {
      card.column = silentColumn;
      return;
    }
    card.failed = true;
    card.column = "received";
    card.message = "Error: not queued, please try again";
    record(state, card, "queue failed", "error", "queueing failed: " + reason);
  }

  function enqueue(state, card) {
    card.column = "queue";
    card.status = "unmarked";
    card.queuedAt = state.now;
    record(state, card, "queued", "info", "queued");
  }

  function submit(state, file) {
    const card = newCard(state, file);
    record(state, card, "received", "info", "received");
    if (state.fixes.uploadChecks && file !== "ok") {
      reject(state, card, file);
      return card;
    }
    record(state, card, "saved", "info", "saved");
    if (state.queueingBroken) {
      failToQueue(state, card, "queue unreachable", "received");
    } else if (occupied(state) >= queueLimit(state)) {
      state.dropped += 1;
      failToQueue(state, card, "queue full", "dropped");
    } else {
      enqueue(state, card);
    }
    return card;
  }

  function nextUnmarked(state) {
    const waiting = state.cards.filter((card) => card.column === "queue" && card.status === "unmarked");
    return waiting.sort((a, b) => a.queuedAt - b.queuedAt)[0] || null;
  }

  function isBlocked(state) {
    return !state.fixes.oneJob && state.cards.some((card) => card.frozen);
  }

  function busyProcessors(state) {
    return state.cards.filter((card) => card.column === "evaluating" && !card.frozen).length;
  }

  function startEvaluating(state, card) {
    card.column = "evaluating";
    card.status = "evaluating";
    card.startedAt = state.now;
    record(state, card, "picked up", "info", "picked up, evaluating");
    if (card.file === "corrupted") card.frozen = true;
  }

  function startPickups(state) {
    if (isBlocked(state)) return;
    while (busyProcessors(state) < state.processors) {
      const next = nextUnmarked(state);
      if (!next) return;
      startEvaluating(state, next);
    }
  }

  function finishMarking(state, card, score) {
    card.status = "marked";
    card.score = score;
    card.column = state.fixes.resultsTable ? "marked" : "queue";
    record(state, card, "marked", "ok", "marked " + score);
  }

  function finishEvaluations(state) {
    state.cards
      .filter((card) => card.column === "evaluating" && !card.frozen)
      .filter((card) => state.now - card.startedAt >= EVALUATION_SECONDS)
      .forEach((card) => finishMarking(state, card, scoreFor(state)));
  }

  function scoreFor(state) {
    return prng.intBetween(state.random, 40, 99);
  }

  function recoverStuck(state) {
    if (!state.fixes.recovery) return;
    state.cards
      .filter((card) => card.column === "evaluating" && state.now - card.startedAt >= RECOVERY_SECONDS)
      .forEach((card) => {
        card.column = "queue";
        card.status = "unmarked";
        card.frozen = false;
        card.startedAt = null;
        card.queuedAt = state.now;
        card.attempts += 1;
        record(state, card, "recovered", "warn", "stuck in evaluating for 10 minutes, back to unmarked");
      });
  }

  function tick(state, seconds) {
    state.now += seconds;
    recoverStuck(state);
    finishEvaluations(state);
    startPickups(state);
  }

  function crashServer(state) {
    const target = state.cards.find((card) => card.column === "evaluating" && !card.frozen);
    if (!target) return false;
    target.frozen = true;
    return true;
  }

  function setQueueingBroken(state, broken) {
    state.queueingBroken = broken;
  }

  function addProcessor(state) {
    if (state.processors >= MAX_PROCESSORS) return false;
    state.processors += 1;
    return true;
  }

  function proposeMark(state) {
    const card = nextUnmarked(state);
    if (!card) return null;
    if (card.score === null) card.proposedScore = scoreFor(state);
    return { id: card.id, score: card.proposedScore };
  }

  function teacherMark(state, id, score) {
    const card = state.cards.find((item) => item.id === id);
    if (!card || card.column !== "queue" || card.status !== "unmarked") return false;
    finishMarking(state, card, score);
    return true;
  }

  function secondsInEvaluating(state, card) {
    return card.column === "evaluating" ? state.now - card.startedAt : 0;
  }

  function pendingTooLong(state) {
    if (!state.fixes.pendingList) return [];
    return state.cards.filter(
      (card) => OPEN_COLUMNS.includes(card.column) && !card.failed && state.now - card.submittedAt >= RECOVERY_SECONDS
    );
  }

  function cardTrail(state, id) {
    const card = state.cards.find((item) => item.id === id);
    return card && state.fixes.logging ? card.trail : [];
  }

  function diagnose(trail) {
    if (trail.length === 0) return "No log lines exist for this submission. Turn on step-by-step logging to search the logs for its ID.";
    const last = trail[trail.length - 1].step;
    const verdicts = {
      received: "Received but never saved: check the upload step.",
      saved: "Saved but never queued: this is a queueing problem.",
      "queue failed": "Saved but queueing failed: the student was shown an error.",
      queued: "Queued and waiting to be picked up.",
      "picked up": "Started evaluating and stopped: this is a crash or error.",
      recovered: "It was stuck in evaluating and went back to unmarked.",
      marked: "Finished normally.",
      rejected: "Rejected at upload, so it never entered the queue."
    };
    return verdicts[last];
  }

  function takeEvents(state) {
    const events = state.events;
    state.events = [];
    return events;
  }

  function queueStats(state) {
    return {
      waiting: state.cards.filter((card) => card.column === "queue" && card.status === "unmarked").length,
      occupied: occupied(state),
      limit: queueLimit(state),
      processors: state.processors,
      dropped: state.dropped
    };
  }

  return {
    EVALUATION_SECONDS,
    RECOVERY_SECONDS,
    QUEUE_LIMIT,
    WATCHED_QUEUE_LIMIT,
    MAX_PROCESSORS,
    FIX_KEYS,
    noFixes,
    createPipeline,
    setFixes,
    submit,
    tick,
    crashServer,
    setQueueingBroken,
    addProcessor,
    proposeMark,
    teacherMark,
    secondsInEvaluating,
    pendingTooLong,
    cardTrail,
    diagnose,
    takeEvents,
    queueStats
  };
});
