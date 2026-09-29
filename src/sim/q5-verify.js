(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SimQ5 = factory();
})(this, function () {
  const SIZE_LIMIT_KB = 10240;
  const FIX_KEYS = ["fileChecks", "summary", "receipt", "teacherPopup", "duplicate", "history"];
  const FILE_PRESETS = [
    { name: "report.pdf", type: "pdf", sizeKb: 240, empty: false, corrupted: false },
    { name: "empty.pdf", type: "pdf", sizeKb: 0, empty: true, corrupted: false },
    { name: "huge.pdf", type: "pdf", sizeKb: 25600, empty: false, corrupted: false },
    { name: "notes.txt", type: "txt", sizeKb: 12, empty: false, corrupted: false },
    { name: "corrupted.pdf", type: "pdf", sizeKb: 180, empty: false, corrupted: true }
  ];
  const INPUT_POINTS = [
    { id: "file", label: "Uploaded file (type, size, empty, corrupted)", fix: "fileChecks" },
    { id: "submit", label: "Student submits without a summary", fix: "summary" },
    { id: "receipt", label: "No receipt after submitting", fix: "receipt" },
    { id: "duplicate", label: "Same file uploaded twice", fix: "duplicate" },
    { id: "score", label: "Teacher's score saved at once", fix: "teacherPopup" },
    { id: "history", label: "Score changes leave no record", fix: "history" }
  ];
  const STUDENT = { name: "Aarav", id: "S-101" };
  const ASSIGNMENT = "Week 7 homework";
  const FIRST_RECEIPT = 2001;

  function noFixes() {
    return Object.fromEntries(FIX_KEYS.map((key) => [key, false]));
  }

  function checkFile(file, fixes) {
    if (!fixes.fileChecks) return { accepted: true, reason: "Accepted without any check" };
    if (file.type !== "pdf") return { accepted: false, reason: "Only PDF files are allowed" };
    if (file.empty) return { accepted: false, reason: "The file is empty" };
    if (file.corrupted) return { accepted: false, reason: "The file is corrupted and cannot be opened" };
    if (file.sizeKb > SIZE_LIMIT_KB) return { accepted: false, reason: "The file is over the " + SIZE_LIMIT_KB / 1024 + " MB size limit" };
    return { accepted: true, reason: "File passed all checks" };
  }

  function prepareSummary(file, now) {
    return { name: STUDENT.name, assignment: ASSIGNMENT, fileName: file.name, sizeKb: file.sizeKb, time: now };
  }

  function createStudentSide() {
    return { submissions: [], nextReceipt: FIRST_RECEIPT };
  }

  function fileKey(file) {
    return file.name + "|" + file.sizeKb;
  }

  function isDuplicate(state, file) {
    return state.submissions.some((item) => fileKey(item.file) === fileKey(file));
  }

  function submitFile(state, file, fixes, now) {
    const check = checkFile(file, fixes);
    if (!check.accepted) return { status: "rejected", reason: check.reason };
    if (fixes.duplicate && isDuplicate(state, file)) {
      return { status: "duplicate", reason: "This file was already uploaded. Duplicate flagged." };
    }
    const submission = { id: "sub-" + state.nextReceipt++, file, time: now };
    state.submissions.push(submission);
    return { status: "saved", submission, receipt: fixes.receipt ? { id: submission.id, time: now } : null };
  }

  function createGradebook() {
    return {
      submissions: [
        { id: "sub-1901", student: "Aarav", assignment: ASSIGNMENT, score: null },
        { id: "sub-1902", student: "Meera", assignment: ASSIGNMENT, score: null },
        { id: "sub-1903", student: "Kabir", assignment: ASSIGNMENT, score: null }
      ],
      history: []
    };
  }

  function teacherSummary(state, id, score, comments) {
    const item = state.submissions.find((entry) => entry.id === id);
    return { student: item.student, assignment: item.assignment, score, comments: comments || "No comments" };
  }

  function saveScore(state, id, score, actor, now, fixes) {
    const item = state.submissions.find((entry) => entry.id === id);
    const previous = item.score;
    item.score = score;
    if (fixes.history) state.history.push({ id, who: actor, when: now, oldValue: previous, newValue: score });
    return { previous, score };
  }

  function historyFor(state, id) {
    return state.history.filter((row) => row.id === id);
  }

  function inputPoints(fixes) {
    return INPUT_POINTS.map((point) => ({ ...point, checked: Boolean(fixes[point.fix]) }));
  }

  return {
    SIZE_LIMIT_KB,
    FIX_KEYS,
    FILE_PRESETS,
    INPUT_POINTS,
    STUDENT,
    noFixes,
    checkFile,
    prepareSummary,
    createStudentSide,
    isDuplicate,
    submitFile,
    createGradebook,
    teacherSummary,
    saveScore,
    historyFor,
    inputPoints
  };
});
