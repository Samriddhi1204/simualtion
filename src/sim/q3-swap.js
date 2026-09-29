(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SimQ3 = factory();
})(this, function () {
  const SHARED_FILE_NAME = "homework.pdf";
  const FIX_KEYS = ["uniqueNames", "lookupBoth", "uniqueRule", "prisma", "noGlobals", "atomicClaim"];
  const STUDENTS = [
    { id: "S-101", name: "Aarav", color: "#3f7fd6" },
    { id: "S-102", name: "Meera", color: "#d6893f" }
  ];
  const ASSIGNMENT = "A7";
  const STARTED_AT = 1700000000;

  function noFixes() {
    return Object.fromEntries(FIX_KEYS.map((key) => [key, false]));
  }

  function fileNameFor(upload, uniqueNames) {
    if (!uniqueNames) return SHARED_FILE_NAME;
    return upload.studentId + "_" + upload.assignmentId + "_" + upload.timestamp + ".pdf";
  }

  function simultaneousUploads() {
    return STUDENTS.map((student) => ({
      studentId: student.id,
      owner: student.name,
      assignmentId: ASSIGNMENT,
      timestamp: STARTED_AT,
      attempt: 1
    }));
  }

  function saveFiles(uploads, uniqueNames) {
    const folder = {};
    uploads.forEach((upload) => {
      folder[fileNameFor(upload, uniqueNames)] = upload;
    });
    return folder;
  }

  function teacherView(uploads, folder, uniqueNames) {
    return uploads.map((upload) => {
      const stored = folder[fileNameFor(upload, uniqueNames)];
      return { student: upload.owner, sees: stored.owner, correct: stored.owner === upload.owner };
    });
  }

  function insertRecord(records, record, uniqueRule) {
    const duplicate = records.some(
      (row) => row.studentId === record.studentId && row.assignmentId === record.assignmentId && row.attempt === record.attempt
    );
    if (duplicate && uniqueRule) {
      return { accepted: false, reason: "Unique rule on studentId + assignmentId + attempt rejected the duplicate" };
    }
    records.push(record);
    return { accepted: true, reason: "Saved" };
  }

  function buildRecords(uploads, folder, fixes) {
    const records = [];
    uploads.forEach((upload) => {
      const fileName = fileNameFor(upload, fixes.uniqueNames);
      insertRecord(records, { ...upload, fileName }, fixes.uniqueRule);
    });
    return records;
  }

  function lookupSteps(fixes) {
    const both = fixes.lookupBoth;
    const query = both ? "assignmentId = 'A7' AND studentId = <asking student>" : "assignmentId = 'A7'";
    const queryStep = fixes.prisma
      ? "Prisma writes the query in a consistent, checked way: findFirst where " + (both ? "studentId and assignmentId" : "assignmentId")
      : "Hand-written query: " + query;
    return [queryStep];
  }

  function findRecord(records, query, lookupBoth) {
    return records.find(
      (row) => row.assignmentId === query.assignmentId && (!lookupBoth || row.studentId === query.studentId)
    );
  }

  function lookupByAssignment(uploads, fixes) {
    const records = buildRecords(uploads, {}, { ...fixes, uniqueNames: true });
    return uploads.map((upload) => {
      const found = findRecord(records, { assignmentId: upload.assignmentId, studentId: upload.studentId }, fixes.lookupBoth);
      return { student: upload.owner, sees: found.owner, correct: found.studentId === upload.studentId };
    });
  }

  function sharedVariableRun(requests, noGlobals) {
    const trace = [];
    const saved = {};
    let currentSubmission = null;
    const locals = {};
    requests.forEach((request) => {
      if (noGlobals) locals[request.owner] = request.owner + "'s file";
      else currentSubmission = request.owner + "'s file";
      trace.push({ who: request.owner, action: "reads the upload", current: noGlobals ? "none (local variable)" : currentSubmission });
    });
    requests.forEach((request) => {
      saved[request.owner] = noGlobals ? locals[request.owner] : currentSubmission;
      trace.push({ who: request.owner, action: "saves the record", current: noGlobals ? "none (local variable)" : currentSubmission });
    });
    return {
      trace,
      saved: requests.map((request) => ({ student: request.owner, saved: saved[request.owner], correct: saved[request.owner] === request.owner + "'s file" }))
    };
  }

  function cacheKey(upload, lookupBoth) {
    return lookupBoth ? upload.studentId + ":" + upload.assignmentId : upload.assignmentId;
  }

  function cacheServe(requests, lookupBoth) {
    const cache = {};
    return requests.map((request) => {
      const key = cacheKey(request, lookupBoth);
      const hit = Object.prototype.hasOwnProperty.call(cache, key);
      if (!hit) cache[key] = request.owner;
      return { student: request.owner, key, hit, sees: cache[key], correct: cache[key] === request.owner };
    });
  }

  function runEvaluators(evaluators, atomicClaim) {
    const document = { status: "unmarked", markedBy: [] };
    const trace = [];
    if (atomicClaim) {
      evaluators.forEach((name) => {
        if (document.status === "unmarked") {
          document.status = "evaluating";
          trace.push({ who: name, action: "changes unmarked to evaluating in one step and wins the document" });
          document.markedBy.push(name);
        } else {
          trace.push({ who: name, action: "sees " + document.status + " and skips the document" });
        }
      });
      document.status = "marked";
      return { trace, document };
    }
    evaluators.forEach((name) => trace.push({ who: name, action: "reads status: unmarked, so it picks the document" }));
    evaluators.forEach((name) => {
      document.markedBy.push(name);
      trace.push({ who: name, action: "sets evaluating and marks the document" });
    });
    document.status = "marked";
    return { trace, document };
  }

  function lateEvaluatorSkips(document) {
    return document.status === "marked";
  }

  return {
    FIX_KEYS,
    STUDENTS,
    ASSIGNMENT,
    noFixes,
    fileNameFor,
    simultaneousUploads,
    saveFiles,
    teacherView,
    insertRecord,
    buildRecords,
    lookupSteps,
    findRecord,
    lookupByAssignment,
    sharedVariableRun,
    cacheServe,
    runEvaluators,
    lateEvaluatorSkips
  };
});
