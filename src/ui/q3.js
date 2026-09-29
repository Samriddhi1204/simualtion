(function () {
  function ownerOf(text) {
    return text.replace("'s file", "");
  }

  function create(ctx) {
    const { el, fill, button, demoFrame, logFixChange } = window.UiLayout;
    const model = window.SimQ3;
    const content = ctx.content.demos.q3;
    const colors = Object.fromEntries(model.STUDENTS.map((student) => [student.name, student.color]));
    let fixes = model.noFixes();
    let scenario = "a";
    let result = null;
    let silent = false;

    const frame = demoFrame({
      content,
      onFixesChange(state, key) {
        fixes = state;
        if (!silent) logFixChange(ctx, content, state, key);
        if (result) run(false);
        else render();
      },
      onReset: () => reset(true)
    });

    const tabs = content.scenarios.map((item) => {
      const tab = el("button", { type: "button", class: "btn tab", onClick: () => selectScenario(item.key) }, item.label);
      tab.dataset.key = item.key;
      return tab;
    });
    const tabRow = el("div", { class: "button-row", role: "group", "aria-label": "Scenario" }, tabs);
    const uploadButton = button("Both upload at the same moment", () => run(true), { class: "btn-primary" });
    const students = el("div", { class: "students" });
    const details = el("div", { class: "swap-grid" });

    frame.stage.append(tabRow, students, el("div", { class: "button-row" }, uploadButton), details);

    function pdf(name, label) {
      return el("div", { class: "pdf", style: "background:" + colors[name], role: "img", "aria-label": "PDF written by " + name }, el("span", { text: label || name }));
    }

    function studentCard(student) {
      return el("div", { class: "student-card" }, pdf(student.name), el("div", null, el("strong", { text: student.name }), el("div", { class: "muted", text: student.id })));
    }

    function panel(title, body) {
      return el("section", { class: "panel" }, el("h4", { text: title }), body);
    }

    function listOf(items) {
      return items.length ? el("ul", { class: "plain-list" }, items.map((item) => el("li", null, item))) : el("p", { class: "muted", text: "Nothing yet" });
    }

    function compute() {
      const uploads = model.simultaneousUploads();
      if (scenario === "a") return computeFiles(uploads);
      if (scenario === "b") return computeLookup(uploads);
      if (scenario === "c") return computeShared(uploads);
      if (scenario === "d") return computeCache(uploads);
      return computeEvaluators();
    }

    function duplicateLine(records) {
      const copy = records.slice();
      const attempt = model.insertRecord(copy, { ...records[0] }, fixes.uniqueRule);
      return (attempt.accepted ? "Duplicate S-101 + A7 + attempt 1 insert: accepted, now " + copy.length + " rows" : "Duplicate insert: " + attempt.reason);
    }

    function computeFiles(uploads) {
      const folder = model.saveFiles(uploads, fixes.uniqueNames);
      const records = model.buildRecords(uploads, folder, fixes);
      return {
        folder: Object.keys(folder),
        records,
        steps: [duplicateLine(records)],
        teacher: model.teacherView(uploads, folder, fixes.uniqueNames)
      };
    }

    function computeLookup(uploads) {
      const rows = model.lookupByAssignment(uploads, fixes);
      const records = model.buildRecords(uploads, {}, { ...fixes, uniqueNames: true });
      return { folder: null, records, steps: model.lookupSteps(fixes).concat(duplicateLine(records)), teacher: rows };
    }

    function computeShared(uploads) {
      const run = model.sharedVariableRun(uploads, fixes.noGlobals);
      return {
        folder: null,
        records: null,
        steps: run.trace.map((row) => row.who + " " + row.action + ", currentSubmission = " + row.current),
        teacher: run.saved.map((row) => ({ student: row.student, sees: ownerOf(row.saved), correct: row.correct }))
      };
    }

    function computeCache(uploads) {
      const rows = model.cacheServe(uploads, fixes.lookupBoth);
      return {
        folder: null,
        records: null,
        steps: rows.map((row) => row.student + " asks, cache key " + row.key + (row.hit ? ": cache hit" : ": cache miss, stored")),
        teacher: rows
      };
    }

    function computeEvaluators() {
      const outcome = model.runEvaluators(["Evaluator 1", "Evaluator 2"], fixes.atomicClaim);
      const steps = outcome.trace.map((row) => row.who + " " + row.action);
      if (fixes.atomicClaim && model.lateEvaluatorSkips(outcome.document)) steps.push("A late evaluator sees marked and skips the document");
      const marks = outcome.document.markedBy;
      return {
        folder: null,
        records: null,
        steps,
        teacher: [{ student: "Aarav's document", sees: "marked by " + marks.join(" and "), correct: marks.length === 1 }]
      };
    }

    function teacherPanel(rows) {
      return panel(
        "Teacher sees",
        el(
          "ul",
          { class: "plain-list" },
          rows.map((row) => {
            const owner = colors[row.sees] ? pdf(row.sees, row.sees.slice(0, 1)) : null;
            return el("li", { class: row.correct ? "seen-ok" : "seen-bad" }, el("span", { "aria-hidden": "true", text: row.correct ? "✔ " : "✖ " }), row.student + " → " + row.sees + (row.correct ? " (correct)" : " (wrong)"), owner);
          })
        )
      );
    }

    function render() {
      tabs.forEach((tab) => tab.setAttribute("aria-pressed", String(tab.dataset.key === scenario)));
      fill(students, ...model.STUDENTS.map(studentCard));
      if (!result) {
        fill(details, el("p", { class: "muted", text: "The storage folder, database table and what the teacher sees appear here." }));
        frame.setCaption(ctx.content.captions.q3.idle);
        return;
      }
      const panels = [];
      panels.push(panel("Storage folder", result.folder ? listOf(result.folder.map((name) => el("code", { text: name }))) : el("p", { class: "muted", text: "Not used in this scenario" })));
      panels.push(
        panel(
          "Database table",
          result.records
            ? el("table", { class: "mini-table" }, el("tr", null, ["studentId", "assignmentId", "attempt", "file"].map((head) => el("th", { text: head }))), result.records.map((row) => el("tr", null, [row.studentId, row.assignmentId, row.attempt, row.fileName].map((cell) => el("td", { text: String(cell) })))))
            : el("p", { class: "muted", text: "Not used in this scenario" })
        )
      );
      panels.push(panel("Steps", listOf(result.steps.map((step) => el("span", { text: step })))));
      panels.push(teacherPanel(result.teacher));
      fill(details, ...panels);
      frame.setCaption(ctx.content.captions.q3[scenario]({ fixed: result.teacher.every((row) => row.correct) }));
    }

    function run(announce) {
      result = compute();
      if (announce) {
        ctx.log.add("info", "Q3: scenario " + scenario + ": Aarav (S-101) and Meera (S-102) upload at the same moment");
        result.teacher.forEach((row) => ctx.log.add(row.correct ? "ok" : "error", "Q3: " + row.student + " -> " + row.sees));
      }
      render();
    }

    function selectScenario(key) {
      scenario = key;
      result = null;
      render();
    }

    function reset(announce) {
      silent = true;
      scenario = "a";
      result = null;
      frame.toggle.setAll(false);
      silent = false;
      if (announce) ctx.log.add("info", "Q3 reset");
      render();
    }

    reset(false);

    return {
      element: frame.root,
      tick() {},
      reset: () => reset(false),
      onShow: render,
      showcase(fixed) {
        reset(false);
        frame.toggle.setAll(fixed);
        run(true);
      }
    };
  }

  window.UiQ3 = { create };
})();
