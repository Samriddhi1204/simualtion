(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root.SimPrng || require("./prng.js"));
  else root.SimQ7 = factory(root.SimPrng);
})(this, function (prng) {
  const DEADLINE_SECONDS = 600;
  const DOUBLE_CLICK_SECONDS = 3;
  const SEAT_CONFIRM_SECONDS = 120;
  const LINK_LIFETIME_SECONDS = 300;
  const SLOT_MINUTES = 60;
  const ROLES = ["student", "teacher", "liveHelp"];
  const ROLE_TABLE = [
    { role: "student", label: "Student", own: true, others: false, marks: false },
    { role: "teacher", label: "Teacher", own: true, others: true, marks: true },
    { role: "liveHelp", label: "Live-help teacher", own: false, others: false, marks: true }
  ];
  const SNIPPETS = ["missing units", "good approach", "show your steps"];

  function createSubmissionBox() {
    return { deadline: DEADLINE_SECONDS, attempts: [], rejected: 0, disabled: false };
  }

  function recordAttempt(state, time) {
    state.attempts.push({ attempt: state.attempts.length + 1, time });
  }

  function submit(state, fixed, time, kind) {
    if (!fixed) {
      recordAttempt(state, time);
      return { accepted: true };
    }
    if (kind === "click" && state.disabled) {
      state.rejected += 1;
      return { accepted: false, reason: "Duplicate rejected: the button is disabled after the first click" };
    }
    state.disabled = kind === "click";
    recordAttempt(state, time);
    return { accepted: true };
  }

  function countedAttempt(state) {
    const onTime = state.attempts.filter((item) => item.time <= state.deadline);
    return onTime.length ? onTime[onTime.length - 1] : null;
  }

  function gradedCopy(state, fixed) {
    if (fixed) return countedAttempt(state);
    return state.attempts[0] || null;
  }

  function teacherSees(state, fixed) {
    if (!fixed) return state.attempts.slice();
    const counted = countedAttempt(state);
    return counted ? [counted] : [];
  }

  function judgeDeadline(input, fixed) {
    const finish = input.actualStart + input.uploadSeconds;
    if (!fixed) {
      const deviceFinish = finish + input.clockShift;
      return { onTime: deviceFinish <= 0, basis: "device clock at finish", shownTime: deviceFinish };
    }
    return { onTime: input.actualStart <= 0, basis: "server time of upload start", shownTime: input.actualStart, finish };
  }

  function rotateOrder(order, times) {
    const shift = times % order.length;
    return order.slice(shift).concat(order.slice(0, shift));
  }

  function slotSchedule(groups, assignmentIndex) {
    return rotateOrder(groups, assignmentIndex).map((group, index) => ({
      group,
      start: index * SLOT_MINUTES,
      end: (index + 1) * SLOT_MINUTES
    }));
  }

  function createSeatCase() {
    return {
      now: 0,
      holder: { name: "Kabir", noShows: 0 },
      confirmed: false,
      released: false,
      waiting: [
        { name: "Isha", noShows: 0 },
        { name: "Dev", noShows: 1 },
        { name: "Riya", noShows: 0 }
      ]
    };
  }

  function waitingOrder(state, fixed) {
    if (!fixed) return state.waiting.slice();
    return state.waiting.slice().sort((a, b) => a.noShows - b.noShows);
  }

  function advanceSeat(state, seconds, fixed) {
    state.now += seconds;
    if (!fixed || state.released || state.confirmed || state.now < SEAT_CONFIRM_SECONDS) return;
    const order = waitingOrder(state, fixed);
    const next = order[0];
    state.waiting = order.slice(1);
    state.holder.noShows += 1;
    state.waiting.push(state.holder);
    state.holder = next;
    state.released = true;
  }

  function wastedSeconds(state, fixed) {
    if (fixed || state.confirmed) return 0;
    return state.now;
  }

  function canAccess(role, viewerId, ownerId, fixed) {
    if (!fixed) return true;
    const rule = ROLE_TABLE.find((row) => row.role === role);
    return viewerId === ownerId ? rule.own : rule.others;
  }

  function openHomework(request, fixed) {
    const allowed = canAccess(request.role, request.viewerId, request.requestedId, fixed);
    return {
      allowed,
      message: allowed ? "Homework of " + request.requestedId + " opened" : "Access denied for this role"
    };
  }

  function leaderboardName(student, fixed) {
    return fixed ? student.initials : student.name;
  }

  function logLine(student, fixed) {
    if (fixed) return "GET homework for " + student.id;
    return "GET homework for " + student.name + " " + student.email;
  }

  function createLink(now) {
    return { expiresAt: now + LINK_LIFETIME_SECONDS };
  }

  function linkSecondsLeft(link, now) {
    return Math.max(0, link.expiresAt - now);
  }

  function createQueue(seed) {
    const random = prng.mulberry32(seed || 7);
    const kinds = ["ok", "ok", "blank", "ok", "duplicate", "ok", "late", "ok", "ok", "ok"];
    return kinds.map((kind, index) => ({
      id: "sub-" + (3001 + index),
      hoursLeft: prng.intBetween(random, 1, 48),
      kind,
      snippet: null
    }));
  }

  function orderQueue(subs, fixed, seed) {
    if (fixed) return subs.slice().sort((a, b) => a.hoursLeft - b.hoursLeft);
    return prng.shuffle(prng.mulberry32(seed || 7), subs);
  }

  function autoFlag(sub) {
    return sub.kind === "ok" ? null : sub.kind;
  }

  function splitFlagged(subs, fixed) {
    if (!fixed) return { toTeacher: subs.slice(), flagged: [] };
    return { toTeacher: subs.filter((sub) => !autoFlag(sub)), flagged: subs.filter((sub) => autoFlag(sub)) };
  }

  function nextGrader(teacherAbsent, fixed) {
    if (!teacherAbsent) return "Teacher";
    return fixed ? "Live-help teacher (backup access)" : null;
  }

  function commonMistakes(graded) {
    const counts = {};
    graded.filter((sub) => sub.snippet).forEach((sub) => {
      counts[sub.snippet] = (counts[sub.snippet] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([snippet, count]) => ({ snippet, count }))
      .sort((a, b) => b.count - a.count);
  }

  function spreadLoad(total, slots) {
    const base = Math.floor(total / slots);
    return Array.from({ length: slots }, (_, index) => base + (index < total % slots ? 1 : 0));
  }

  return {
    DEADLINE_SECONDS,
    DOUBLE_CLICK_SECONDS,
    SEAT_CONFIRM_SECONDS,
    LINK_LIFETIME_SECONDS,
    ROLES,
    ROLE_TABLE,
    SNIPPETS,
    createSubmissionBox,
    submit,
    countedAttempt,
    gradedCopy,
    teacherSees,
    judgeDeadline,
    rotateOrder,
    slotSchedule,
    createSeatCase,
    waitingOrder,
    advanceSeat,
    wastedSeconds,
    canAccess,
    openHomework,
    leaderboardName,
    logLine,
    createLink,
    linkSecondsLeft,
    createQueue,
    orderQueue,
    autoFlag,
    splitFlagged,
    nextGrader,
    commonMistakes,
    spreadLoad
  };
});
