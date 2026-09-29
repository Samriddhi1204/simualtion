(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root.SimPrng || require("./prng.js"));
  else root.SimQ4 = factory(root.SimPrng);
})(this, function (prng) {
  const DEFAULT_CAPACITY = 20;
  const CONFIRM_SECONDS = 120;
  const ROTATION_PENALTY = 20;
  const SERVERS_WITH_BALANCER = 3;
  const FIX_KEYS = ["authenticate", "reserve", "capacity", "waitingList", "selection", "balancing", "listenOnly", "noShow"];
  const FIRST_NAMES = [
    "Aarav", "Meera", "Kabir", "Isha", "Riya", "Vivaan", "Anaya", "Dev", "Tara", "Nikhil", "Sana", "Arjun",
    "Diya", "Rohan", "Zara", "Kian", "Naina", "Yash", "Pari", "Om", "Lila", "Veer", "Mira", "Ansh", "Esha",
    "Reyansh", "Kavya", "Ishaan", "Nisha", "Aditya", "Sara", "Rudra", "Tanvi", "Neel", "Ira", "Samar", "Anvi",
    "Viraj", "Myra", "Advik", "Prisha", "Kunal", "Aisha", "Harsh", "Rhea", "Jay", "Ritu", "Laksh"
  ];

  function noFixes() {
    return Object.fromEntries(FIX_KEYS.map((key) => [key, false]));
  }

  function createRoster(seed) {
    const random = prng.mulberry32(seed || 4);
    return FIRST_NAMES.map((name, index) => ({
      id: "S-" + (101 + index),
      name,
      marks: [prng.intBetween(random, 35, 95), prng.intBetween(random, 35, 95), prng.intBetween(random, 35, 95)]
    }));
  }

  function averageMarks(student) {
    return student.marks.reduce((sum, mark) => sum + mark, 0) / student.marks.length;
  }

  function createSession(seed) {
    return {
      capacity: DEFAULT_CAPACITY,
      fixes: noFixes(),
      now: 0,
      roster: createRoster(seed),
      seats: [],
      waiting: [],
      turnedAway: [],
      priorityCount: {},
      events: []
    };
  }

  function setFixes(state, fixes) {
    state.fixes = { ...fixes };
  }

  function note(state, type, text) {
    state.events.push({ time: state.now, type, text });
  }

  function takeEvents(state) {
    const events = state.events;
    state.events = [];
    return events;
  }

  function isInSession(state, student) {
    return state.seats.some((seat) => seat.student.id === student.id) || state.waiting.some((entry) => entry.student.id === student.id);
  }

  function seatStudent(state, student) {
    state.seats.push({ student, seatedAt: state.now, confirmed: false });
  }

  function joinWaitingList(state, student) {
    if (!state.fixes.waitingList) {
      state.turnedAway.push(student);
      return { student, outcome: "turned away", message: "Session full. Try again later." };
    }
    state.waiting.push({ student, since: state.now, listenOnly: false });
    return { student, outcome: "waitlisted", position: state.waiting.length, message: "Session full. You are number " + state.waiting.length + " on the waiting list." };
  }

  function refuseUnlessLoggedIn(state, student, loggedIn) {
    if (loggedIn || !state.fixes.authenticate) return null;
    note(state, "warn", student.id + " refused: not logged in");
    return { student, outcome: "refused", message: "Log in to join" };
  }

  function admitReserved(state, student) {
    note(state, "info", student.id + " join request, count now " + state.seats.length);
    if (state.seats.length < state.capacity) {
      seatStudent(state, student);
      return { student, outcome: "seated", message: "You have a seat." };
    }
    return joinWaitingList(state, student);
  }

  function joinBatch(state, students, loggedIn) {
    const seenCount = state.seats.length;
    return students.map((student) => {
      const refused = refuseUnlessLoggedIn(state, student, loggedIn);
      if (refused) return refused;
      if (isInSession(state, student)) return { student, outcome: "already in", message: "Already joined" };
      if (state.fixes.reserve) return admitReserved(state, student);
      note(state, "info", student.id + " join request, count read as " + seenCount);
      if (seenCount < state.capacity) {
        seatStudent(state, student);
        return { student, outcome: "seated", message: "There is room. You have a seat." };
      }
      return joinWaitingList(state, student);
    });
  }

  function fillTo(state, count) {
    const candidates = state.roster.filter((student) => !isInSession(state, student) && student.id !== "S-101" && student.id !== "S-102");
    while (state.seats.length < count && candidates.length > 0) {
      const student = candidates.shift();
      seatStudent(state, student);
      state.seats[state.seats.length - 1].confirmed = true;
    }
  }

  function overCapacity(state) {
    return Math.max(0, state.seats.length - state.capacity);
  }

  function setCapacity(state, value) {
    if (!state.fixes.capacity) return false;
    state.capacity = Math.max(1, Math.min(60, Math.round(value)));
    promoteWaiting(state);
    return true;
  }

  function selectionScore(state, student) {
    return averageMarks(student) + ROTATION_PENALTY * (state.priorityCount[student.id] || 0);
  }

  function chooseNextWaiting(state) {
    if (!state.fixes.selection) return state.waiting[0] || null;
    return state.waiting.slice().sort((a, b) => selectionScore(state, a.student) - selectionScore(state, b.student))[0] || null;
  }

  function promoteWaiting(state) {
    while (state.seats.length < state.capacity && state.waiting.length > 0) {
      const chosen = chooseNextWaiting(state);
      state.waiting = state.waiting.filter((entry) => entry !== chosen);
      if (state.fixes.selection) state.priorityCount[chosen.student.id] = (state.priorityCount[chosen.student.id] || 0) + 1;
      seatStudent(state, chosen.student);
      note(state, "ok", chosen.student.id + " moved from the waiting list to a seat");
    }
  }

  function freeSeat(state, studentId) {
    const before = state.seats.length;
    state.seats = state.seats.filter((seat) => seat.student.id !== studentId);
    if (state.seats.length === before) return false;
    promoteWaiting(state);
    return true;
  }

  function confirmSeat(state, studentId) {
    const seat = state.seats.find((item) => item.student.id === studentId);
    if (seat) seat.confirmed = true;
  }

  function secondsToConfirm(state, seat) {
    if (!state.fixes.noShow || seat.confirmed) return null;
    return Math.max(0, seat.seatedAt + CONFIRM_SECONDS - state.now);
  }

  function releaseNoShows(state) {
    const expired = state.seats.filter((seat) => secondsToConfirm(state, seat) === 0);
    expired.forEach((seat) => note(state, "warn", seat.student.id + " did not confirm in 2 minutes, seat released"));
    state.seats = state.seats.filter((seat) => !expired.includes(seat));
    promoteWaiting(state);
  }

  function advance(state, seconds) {
    state.now += seconds;
    if (state.fixes.noShow) releaseNoShows(state);
  }

  function setListenOnly(state, studentId) {
    const entry = state.waiting.find((item) => item.student.id === studentId);
    if (!entry || !state.fixes.listenOnly) return false;
    entry.listenOnly = true;
    return true;
  }

  function serverShares(state, requests) {
    const servers = state.fixes.balancing ? SERVERS_WITH_BALANCER : 1;
    return Array.from({ length: servers }, (_, index) => Math.floor(requests / servers) + (index < requests % servers ? 1 : 0));
  }

  function findStudent(state, id) {
    return state.roster.find((student) => student.id === id);
  }

  return {
    DEFAULT_CAPACITY,
    CONFIRM_SECONDS,
    FIX_KEYS,
    noFixes,
    createRoster,
    averageMarks,
    createSession,
    setFixes,
    takeEvents,
    joinBatch,
    fillTo,
    overCapacity,
    setCapacity,
    selectionScore,
    chooseNextWaiting,
    freeSeat,
    confirmSeat,
    secondsToConfirm,
    advance,
    setListenOnly,
    serverShares,
    findStudent
  };
});
