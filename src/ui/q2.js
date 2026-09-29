(function () {
  const COLUMNS = [
    { key: "received", title: "Received" },
    { key: "queue", title: "Queue" },
    { key: "evaluating", title: "Evaluating" },
    { key: "marked", title: "Marked (Results table)" }
  ];
  const SCORE_TYPES = { info: "info", ok: "ok", warn: "warn", error: "error" };

  function create(ctx) {
    const { el, button, badge, demoFrame, logFixChange } = window.UiLayout;
    const model = window.SimQ2;
    const content = ctx.content.demos.q2;
    let state = model.createPipeline(11);
    let silent = false;
    let selectedId = null;
    let signature = "";
    let pendingMark = null;

    const frame = demoFrame({
      content,
      onFixesChange(fixes, key) {
        model.setFixes(state, fixes);
        if (!silent) logFixChange(ctx, content, fixes, key);
        render(true);
      },
      onReset: () => reset(true)
    });

    const submitButton = button("Submit 5 homeworks", () => submitMany(5, "ok"), { class: "btn-primary" });
    const corruptButton = button("Submit a corrupted PDF", () => submitMany(1, "corrupted"));
    const failButton = button("Make queueing fail", toggleQueueing);
    failButton.setAttribute("aria-pressed", "false");
    const crashButton = button("Crash the server now", crash);
    const markButton = button("Teacher marks next", teacherMarks);
    const processorButton = button("Run more background processors", addProcessor);
    const gauge = el("div", { class: "gauge" });
    const board = el("div", { class: "board" });
    const lanes = el("div", { class: "lanes" });
    const trail = el("div", { class: "trail", "aria-live": "polite" });
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    document.body.append(dialog);

    frame.stage.append(
      el("div", { class: "button-row" }, submitButton, corruptButton, failButton, crashButton, markButton),
      gauge,
      board,
      lanes,
      trail
    );

    function log(type, text, time) {
      ctx.log.add(SCORE_TYPES[type], text, time);
    }

    function flushEvents() {
      model.takeEvents(state).forEach((event) => log(event.type, event.text, event.time));
    }

    function submitMany(count, file) {
      log("info", "Q2: student clicks Submit (" + count + " " + (file === "ok" ? "valid" : "corrupted") + ")");
      for (let i = 0; i < count; i++) {
        const card = model.submit(state, file);
        if (card.column === "rejected") log("warn", card.id + " rejected: " + card.reason);
        else if (card.failed) log("error", card.id + " " + card.message);
        else if (!state.fixes.logging) log("info", "Student sees: Submitted");
      }
      flushEvents();
      render(true);
    }

    function toggleQueueing() {
      const broken = !state.queueingBroken;
      model.setQueueingBroken(state, broken);
      failButton.setAttribute("aria-pressed", String(broken));
      failButton.textContent = broken ? "Queueing is failing (press to fix)" : "Make queueing fail";
      log(broken ? "warn" : "ok", "Q2: queueing " + (broken ? "now fails" : "works again"));
    }

    function crash() {
      const crashed = model.crashServer(state);
      log(crashed ? "error" : "info", crashed ? "Q2: the server crashed while evaluating" : "Q2: nothing was being evaluated, so the crash changed nothing");
      render(true);
    }

    function addProcessor() {
      const added = model.addProcessor(state);
      log(added ? "ok" : "warn", added ? "Q2: started another background processor (" + state.processors + " now)" : "Q2: the maximum number of processors is running");
      render(true);
    }

    function teacherMarks() {
      const proposal = model.proposeMark(state);
      if (!proposal) {
        log("info", "Q2: teacher has no unmarked submission in the queue");
        return;
      }
      if (!state.fixes.popup) {
        saveMark(proposal);
        return;
      }
      pendingMark = proposal;
      dialog.replaceChildren(
        el("h3", { text: "Are you sure?" }),
        el("p", { text: "Save score " + proposal.score + " for " + proposal.id + "?" }),
        el("p", { class: "muted", text: "This prevents accidents but does not fix stuck reports." }),
        el("div", { class: "button-row" }, button("Yes, save", () => confirmMark(true), { class: "btn-primary" }), button("Cancel", () => confirmMark(false)))
      );
      dialog.showModal();
    }

    function confirmMark(yes) {
      dialog.close();
      if (yes && pendingMark) saveMark(pendingMark);
      else log("info", "Q2: teacher cancelled at the Are you sure? popup");
      pendingMark = null;
    }

    function saveMark(proposal) {
      model.teacherMark(state, proposal.id, proposal.score);
      log("ok", "Q2: teacher saved " + proposal.score + " for " + proposal.id);
      flushEvents();
      render(true);
    }

    function selectCard(id) {
      selectedId = id;
      log("info", "Q2: opened the log trail of " + id);
      render(true);
    }

    function timerText(card) {
      const seconds = model.secondsInEvaluating(state, card);
      const minutes = Math.floor(seconds / 60);
      const rest = Math.floor(seconds % 60);
      const stopwatch = "⏱ " + minutes + ":" + String(rest).padStart(2, "0");
      if (!state.fixes.recovery) return stopwatch;
      const left = Math.max(0, model.RECOVERY_SECONDS - seconds);
      return stopwatch + " · recovery in " + Math.floor(left / 60) + ":" + String(Math.floor(left % 60)).padStart(2, "0");
    }

    function cardNode(card) {
      const stateWord = card.frozen ? "frozen" : card.status;
      const parts = [el("strong", { text: card.id }), el("span", { class: "card-file", text: card.file === "corrupted" ? " (corrupted PDF)" : "" })];
      if (state.fixes.status) parts.push(el("span", { class: "card-status card-" + stateWord, text: stateWord }));
      if (card.column === "evaluating") parts.push(el("span", { class: "card-timer", "data-id": card.id, text: timerText(card) }));
      if (card.column === "received" || card.column === "rejected") parts.push(el("span", { class: "card-message", text: card.message }));
      if (card.status === "marked" && card.column === "queue") parts.push(el("span", { class: "card-message", text: "✔ done, still taking a queue slot" }));
      if (card.frozen) parts.push(badge("problem", "Stuck, nobody notified"));
      if (card.attempts > 0) parts.push(el("span", { class: "muted", text: "recovered " + card.attempts + "x" }));
      if (state.fixes.oneJob) parts.push(el("span", { class: "muted", text: "job for " + card.id }));
      return el(
        "button",
        { type: "button", class: "card" + (card.frozen ? " card-stuck" : "") + (card.id === selectedId ? " card-selected" : ""), "aria-pressed": String(card.id === selectedId), onClick: () => selectCard(card.id) },
        parts
      );
    }

    function renderBoard() {
      board.replaceChildren(
        ...COLUMNS.map((column) => {
          const cards = state.cards.filter((card) => card.column === column.key);
          return el("section", { class: "column", "aria-label": column.title }, el("h4", { text: column.title + " (" + cards.length + ")" }), cards.map(cardNode));
        })
      );
      const rejected = state.cards.filter((card) => card.column === "rejected");
      const pending = model.pendingTooLong(state);
      lanes.replaceChildren(
        el("section", { class: "column lane-rejected" }, el("h4", { text: "Rejected lane (" + rejected.length + ")" }), rejected.map(cardNode)),
        el(
          "section",
          { class: "column lane-pending" },
          el("h4", { text: "Teacher: Pending too long (" + pending.length + ")" }),
          state.fixes.pendingList ? (pending.length ? pending.map((card) => el("p", { class: "pending-row", text: card.id + " is over 10 simulated minutes old" })) : el("p", { class: "muted", text: "Nothing pending too long." })) : el("p", { class: "muted", text: "No list exists yet. Nobody can see stuck reports." })
        )
      );
    }

    function renderGauge() {
      const stats = model.queueStats(state);
      const parts = [el("span", { class: "gauge-item" }, "Dropped silently: ", el("strong", { text: String(stats.dropped) }))];
      if (state.fixes.queueSize) {
        parts.unshift(
          el("span", { class: "gauge-item" }, "Waiting: ", el("strong", { text: stats.waiting + " of " + stats.limit }), el("progress", { max: String(stats.limit), value: String(Math.min(stats.occupied, stats.limit)), "aria-label": "Queue size" })),
          el("span", { class: "gauge-item", text: "Processors: " + stats.processors })
        );
      }
      gauge.replaceChildren(...parts);
      processorButton.hidden = !state.fixes.queueSize;
      if (state.fixes.queueSize) gauge.append(processorButton);
    }

    function renderTrail() {
      if (!selectedId) {
        trail.replaceChildren(el("p", { class: "muted", text: "Find the cause: click any card to open its log trail." }));
        return;
      }
      const lines = model.cardTrail(state, selectedId);
      trail.replaceChildren(
        el("h4", { text: "Log trail of " + selectedId }),
        lines.length
          ? el("ol", { class: "trail-list" }, lines.map((entry, index) => el("li", { class: index === lines.length - 1 ? "trail-last" : "" }, "[" + window.SimClock.formatClockTime(entry.time) + "] " + entry.step + (index === lines.length - 1 ? "  ← last step reached" : ""))))
          : el("p", { class: "muted", text: "No log lines exist for this ID." }),
        el("p", { class: "trail-verdict", text: model.diagnose(lines) })
      );
    }

    function counts() {
      const cards = state.cards;
      const by = (column) => cards.filter((card) => card.column === column).length;
      return {
        total: cards.length + state.dropped,
        marked: cards.filter((card) => card.status === "marked").length,
        evaluating: by("evaluating") - cards.filter((card) => card.frozen).length,
        queued: cards.filter((card) => card.column === "queue" && card.status === "unmarked").length,
        frozen: cards.filter((card) => card.frozen).length,
        neverQueued: cards.filter((card) => card.column === "received" && !card.failed).length,
        dropped: state.dropped,
        rejected: by("rejected")
      };
    }

    function currentSignature() {
      return JSON.stringify([state.cards.map((c) => [c.id, c.column, c.status, c.frozen, c.message, c.attempts]), state.fixes, state.dropped, state.processors, selectedId, model.pendingTooLong(state).length]);
    }

    function render(force) {
      const next = currentSignature();
      if (force || next !== signature) {
        signature = next;
        renderBoard();
        renderGauge();
        renderTrail();
      }
      state.cards.filter((card) => card.column === "evaluating").forEach((card) => {
        const node = board.querySelector('[data-id="' + card.id + '"]');
        if (node) node.textContent = timerText(card);
      });
      crashButton.disabled = !state.cards.some((card) => card.column === "evaluating" && !card.frozen);
      frame.setCaption(ctx.content.captions.q2(counts()));
    }

    function tick(simSeconds) {
      model.tick(state, simSeconds);
      flushEvents();
      render(false);
    }

    function reset(announce) {
      silent = true;
      state = model.createPipeline(11);
      selectedId = null;
      pendingMark = null;
      failButton.setAttribute("aria-pressed", "false");
      failButton.textContent = "Make queueing fail";
      frame.toggle.setAll(false);
      silent = false;
      if (announce) log("info", "Q2 reset");
      render(true);
    }

    reset(false);

    return {
      element: frame.root,
      tick,
      reset: () => reset(false),
      onShow: () => render(true),
      showcase(fixed) {
        reset(false);
        frame.toggle.setAll(fixed);
        submitMany(4, "ok");
        submitMany(1, "corrupted");
      }
    };
  }

  window.UiQ2 = { create };
})();
