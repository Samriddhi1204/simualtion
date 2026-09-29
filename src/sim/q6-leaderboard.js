(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root.SimPrng || require("./prng.js"));
  else root.SimQ6 = factory(root.SimPrng);
})(this, function (prng) {
  const TOTAL_STUDENTS = 1500;
  const DEFAULT_BATCH_SIZE = 30;
  const PAGE_SIZE = 25;
  const YOUR_INDEX = 211;
  const YOUR_ORDER_POSITION = 25;
  const UNDER_REVIEW_WINDOW = 10;
  const LOAD_MS_PER_ROW = 2;
  const PAGED_LOAD_ROWS = PAGE_SIZE;
  const FIX_KEYS = ["showAll", "progress", "provisionalRank", "statusPill", "realtime", "twoBoards", "paging", "nicknames"];
  const FIRST_NAMES = [
    "Aarav", "Meera", "Kabir", "Isha", "Riya", "Vivaan", "Anaya", "Dev", "Tara", "Nikhil", "Sana", "Arjun",
    "Diya", "Rohan", "Zara", "Kian", "Naina", "Yash", "Pari", "Om", "Lila", "Veer", "Mira", "Ansh", "Esha",
    "Reyansh", "Kavya", "Ishaan", "Nisha", "Aditya"
  ];
  const LAST_NAMES = [
    "Sharma", "Patel", "Iyer", "Khan", "Das", "Nair", "Reddy", "Singh", "Gupta", "Mehta", "Bose", "Rao",
    "Joshi", "Menon", "Verma", "Kapoor", "Shah", "Pillai", "Ghosh", "Bhat", "Sethi", "Malik", "Roy", "Jain",
    "Saha", "Kulkarni", "Chopra", "Desai", "Naidu", "Thakur"
  ];

  function noFixes() {
    return Object.fromEntries(FIX_KEYS.map((key) => [key, false]));
  }

  function makeStudent(random, index) {
    const first = prng.pick(random, FIRST_NAMES);
    const last = prng.pick(random, LAST_NAMES);
    return {
      index,
      id: "S-" + String(index + 1).padStart(4, "0"),
      name: first + " " + last,
      initials: first[0] + "." + last[0] + ".",
      marks: prng.intBetween(random, 20, 100),
      finishSeconds: prng.intBetween(random, 1200, 10800)
    };
  }

  function createBoard(seed, total) {
    const random = prng.mulberry32(seed || 6);
    const count = total || TOTAL_STUDENTS;
    const students = Array.from({ length: count }, (_, index) => makeStudent(random, index));
    const youIndex = Math.min(YOUR_INDEX, count - 1);
    const order = prng.shuffle(random, students.map((student) => student.index));
    const position = Math.min(YOUR_ORDER_POSITION, count - 1);
    const swapWith = order.indexOf(youIndex);
    order[swapWith] = order[position];
    order[position] = youIndex;
    return { students, order, youIndex, batchSize: DEFAULT_BATCH_SIZE };
  }

  function evaluatedStudents(board, count) {
    return board.order.slice(0, count).map((index) => board.students[index]);
  }

  function isBetter(a, b, tieBreak) {
    if (a.marks !== b.marks) return a.marks > b.marks;
    return tieBreak === "time" ? a.finishSeconds < b.finishSeconds : a.id < b.id;
  }

  function compare(tieBreak) {
    return (a, b) => (a === b ? 0 : isBetter(a, b, tieBreak) ? -1 : 1);
  }

  function batchOf(board, student) {
    return Math.floor(student.index / board.batchSize);
  }

  function inScope(board, student, scope) {
    return scope !== "batch" || batchOf(board, student) === batchOf(board, board.students[board.youIndex]);
  }

  function rankedList(board, count, options) {
    const settings = { scope: "global", tieBreak: "time", ...options };
    return evaluatedStudents(board, count)
      .filter((student) => inScope(board, student, settings.scope))
      .sort(compare(settings.tieBreak))
      .map((student, position) => ({ student, rank: position + 1 }));
  }

  function isYouEvaluated(board, count) {
    return board.order.indexOf(board.youIndex) < count;
  }

  function yourRank(board, count, options) {
    if (!isYouEvaluated(board, count)) return null;
    const list = rankedList(board, count, options);
    const own = list.find((row) => row.student.index === board.youIndex);
    return { rank: own.rank, of: list.length };
  }

  function progressLine(count, total) {
    return "Evaluated: " + count.toLocaleString("en-US") + " of " + total.toLocaleString("en-US");
  }

  function rankLine(rank) {
    return "Your rank: " + rank.rank.toLocaleString("en-US") + " of " + rank.of.toLocaleString("en-US") + " evaluated";
  }

  function ownStatus(board, count) {
    const position = board.order.indexOf(board.youIndex);
    if (count > position) return "evaluated";
    return count >= position - UNDER_REVIEW_WINDOW ? "under review" : "submitted";
  }

  function rankChange(previous, next) {
    if (previous === null || previous === next) return { direction: "same", amount: 0 };
    return { direction: next < previous ? "up" : "down", amount: Math.abs(next - previous) };
  }

  function tieExample(board, count) {
    const list = rankedList(board, count, { tieBreak: "time" });
    for (let i = 1; i < list.length; i++) {
      if (list[i].student.marks === list[i - 1].student.marks) return { first: list[i - 1], second: list[i] };
    }
    return null;
  }

  function displayName(student, nicknames) {
    return nicknames ? student.initials : student.name;
  }

  function loadDelayMs(rowCount, paged) {
    return (paged ? Math.min(rowCount, PAGED_LOAD_ROWS) : rowCount) * LOAD_MS_PER_ROW;
  }

  function pageCount(rowCount) {
    return Math.max(1, Math.ceil(rowCount / PAGE_SIZE));
  }

  function pageOfRank(rank) {
    return Math.floor((rank - 1) / PAGE_SIZE);
  }

  return {
    TOTAL_STUDENTS,
    DEFAULT_BATCH_SIZE,
    PAGE_SIZE,
    FIX_KEYS,
    noFixes,
    createBoard,
    evaluatedStudents,
    rankedList,
    isYouEvaluated,
    yourRank,
    progressLine,
    rankLine,
    ownStatus,
    rankChange,
    tieExample,
    displayName,
    loadDelayMs,
    pageCount,
    pageOfRank
  };
});
