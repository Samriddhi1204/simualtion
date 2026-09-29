(function () {
  function create(ctx) {
    const { el, button, badge, demoFrame, logFixChange } = window.UiLayout;
    const model = window.SimQ5;
    const content = ctx.content.demos.q5;
    const captions = ctx.content.captions.q5;
    let fixes = model.noFixes();
    let side = model.createStudentSide();
    let book = model.createGradebook();
    let studentMessage = captions.student.idle;
    let teacherMessage = captions.teacher.idle;
    let pending = null;
    let receipt = null;
    let silent = false;

    const frame = demoFrame({
      content,
      onFixesChange(state, key) {
        fixes = state;
        if (!silent) logFixChange(ctx, content, state, key);
        render();
      },
      onReset: () => reset(true)
    });

    const fileSelect = el(
      "select",
      { "aria-label": "File to upload", class: "select" },
      model.FILE_PRESETS.map((file) => el("option", { value: file.name, text: file.name + " (" + describeFile(file) + ")" }))
    );
    const studentOutput = el("div", { class: "output", "aria-live": "polite" });
    const teacherRows = el("div", { class: "teacher-rows" });
    const historyNode = el("div", { class: "history" });
    const pointsNode = el("ul", { class: "points" });
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    document.body.append(dialog);

    frame.stage.append(
      el(
        "div",
        { class: "split" },
        el("section", { class: "panel" }, el("h4", { text: "Student" }), el("label", { class: "control-label", text: "Choose a file" }), fileSelect, el("div", { class: "button-row" }, button("Submit", startSubmit, { class: "btn-primary" })), studentOutput),
        el("section", { class: "panel" }, el("h4", { text: "Teacher" }), teacherRows, historyNode)
      ),
      el("section", { class: "panel" }, el("h4", { text: "Where data enters without a check" }), pointsNode),
      el("p", { class: "muted", text: content.gapCaption })
    );

    function describeFile(file) {
      if (file.empty) return "empty";
      return file.sizeKb >= 1024 ? Math.round(file.sizeKb / 1024) + " MB" : file.sizeKb + " KB";
    }

    function chosenFile() {
      return model.FILE_PRESETS.find((file) => file.name === fileSelect.value);
    }

    function stamp() {
      return window.SimClock.formatClockTime(ctx.clock.now());
    }

    function startSubmit() {
      const file = chosenFile();
      receipt = null;
      pending = null;
      ctx.log.add("info", "Q5: student submits " + file.name);
      if (fixes.summary && model.checkFile(file, fixes).accepted) {
        pending = { file, summary: model.prepareSummary(file, ctx.clock.now()) };
        studentMessage = "Check the summary, then confirm.";
        render();
        return;
      }
      finishSubmit(file);
    }

    function finishSubmit(file) {
      const wasDuplicate = model.isDuplicate(side, file);
      const outcome = model.submitFile(side, file, fixes, ctx.clock.now());
      pending = null;
      if (outcome.status === "rejected") {
        studentMessage = captions.student.rejected(outcome.reason);
        ctx.log.add("warn", "Q5: " + file.name + " rejected: " + outcome.reason);
      } else if (outcome.status === "duplicate") {
        studentMessage = captions.student.flagged;
        ctx.log.add("warn", "Q5: " + file.name + " flagged as a duplicate");
      } else {
        receipt = outcome.receipt;
        studentMessage = receipt ? captions.student.receipt(receipt.id) : wasDuplicate ? captions.student.duplicate : captions.student.accepted;
        ctx.log.add(receipt ? "ok" : "info", "Q5: " + file.name + " saved as " + outcome.submission.id + (receipt ? ", receipt issued" : ", no receipt"));
      }
      render();
    }

    function summaryNode() {
      const summary = pending.summary;
      return el(
        "div",
        { class: "summary-box" },
        el("h4", { text: "Summary before you submit" }),
        el("dl", { class: "stats" }, ...[["Name", summary.name], ["Assignment", summary.assignment], ["File name", summary.fileName], ["Size", summary.sizeKb + " KB"], ["Time", window.SimClock.formatClockTime(summary.time)]].flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })])),
        el("div", { class: "button-row" }, button("Confirm", () => finishSubmit(pending.file), { class: "btn-primary" }), button("Back", () => {
          pending = null;
          studentMessage = captions.student.idle;
          render();
        }))
      );
    }

    function renderStudent() {
      studentOutput.replaceChildren(
        pending ? summaryNode() : el("p", null, studentMessage),
        receipt ? el("p", null, badge("fixed", "Receipt " + receipt.id + " at " + window.SimClock.formatClockTime(receipt.time))) : null,
        el("p", { class: "muted", text: "Submissions saved: " + side.submissions.length })
      );
    }

    function teacherRow(item) {
      const score = el("input", { type: "number", min: "0", max: "100", class: "number-input", "aria-label": "Score for " + item.student, value: item.score === null ? "" : String(item.score) });
      const comments = el("input", { type: "text", class: "text-input", "aria-label": "Comments for " + item.student, placeholder: "Comments" });
      return el("div", { class: "teacher-row" }, el("strong", { text: item.student }), el("span", { class: "muted", text: item.id }), score, comments, button("Save", () => saveClicked(item, score.value, comments.value)));
    }

    function saveClicked(item, rawScore, comments) {
      const score = Math.max(0, Math.min(100, Math.round(Number(rawScore))));
      if (rawScore === "" || Number.isNaN(score)) {
        teacherMessage = "Type a score first.";
        render();
        return;
      }
      if (!fixes.teacherPopup) {
        commitScore(item, score);
        return;
      }
      const summary = model.teacherSummary(book, item.id, score, comments);
      dialog.replaceChildren(
        el("h3", { text: "Are you sure?" }),
        el("dl", { class: "stats" }, ...[["Student", summary.student], ["Assignment", summary.assignment], ["Score", String(summary.score)], ["Comments", summary.comments]].flatMap(([label, value]) => [el("dt", { text: label }), el("dd", { text: value })])),
        el("div", { class: "button-row" }, button("Yes, save", () => {
          dialog.close();
          commitScore(item, score);
        }, { class: "btn-primary" }), button("Cancel", () => dialog.close()))
      );
      dialog.showModal();
    }

    function commitScore(item, score) {
      const change = model.saveScore(book, item.id, score, "Teacher", ctx.clock.now(), fixes);
      teacherMessage = fixes.history ? captions.teacher.confirmed : captions.teacher.saved;
      ctx.log.add(fixes.history ? "ok" : "warn", "Q5: " + item.id + " score " + (change.previous === null ? "set to " : change.previous + " changed to ") + score + (fixes.history ? ", history row added" : ", no record of who changed it"));
      render();
    }

    function renderTeacher() {
      teacherRows.replaceChildren(...book.submissions.map(teacherRow));
      if (!fixes.history) {
        historyNode.replaceChildren(el("h4", { text: "History" }), el("p", { class: "seen-bad", text: "No record of who changed this" }));
        return;
      }
      historyNode.replaceChildren(
        el("h4", { text: "History of changes" }),
        book.history.length
          ? el("table", { class: "mini-table" }, el("tr", null, ["Submission", "Who", "When", "Old", "New"].map((head) => el("th", { text: head }))), book.history.map((row) => el("tr", null, [row.id, row.who, window.SimClock.formatClockTime(row.when), row.oldValue === null ? "none" : row.oldValue, row.newValue].map((cell) => el("td", { text: String(cell) })))))
          : el("p", { class: "muted", text: "No changes yet." })
      );
    }

    function renderPoints() {
      pointsNode.replaceChildren(
        ...model.inputPoints(fixes).map((point) => el("li", { class: point.checked ? "seen-ok" : "point-warn" }, el("span", { "aria-hidden": "true", text: point.checked ? "✔ " : "⚠ " }), point.label + (point.checked ? " - checked" : " - unchecked")))
      );
    }

    function render() {
      renderStudent();
      renderTeacher();
      renderPoints();
      frame.setCaption(studentMessage + " " + teacherMessage);
    }

    function reset(announce) {
      silent = true;
      side = model.createStudentSide();
      book = model.createGradebook();
      studentMessage = captions.student.idle;
      teacherMessage = captions.teacher.idle;
      pending = null;
      receipt = null;
      frame.toggle.setAll(false);
      silent = false;
      if (announce) ctx.log.add("info", "Q5 reset");
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
        fileSelect.value = "notes.txt";
        startSubmit();
        commitScore(book.submissions[0], 72);
        commitScore(book.submissions[0], 78);
      }
    };
  }

  window.UiQ5 = { create };
})();
