(function () {
  const GRADES_PER_SIM_SECOND = 0.25;
  const TABLE_REFRESH_MS = 250;
  const CHANGE_SHOW_MS = 3000;
  const LOG_EVERY_GRADES = 100;
  const STATUS_KIND = { submitted: "neutral", "under review": "warn", evaluated: "fixed" };

  function create(ctx) {
    const { el, button, badge, number, demoFrame, logFixChange, speedControl } = window.UiLayout;
    const model = window.SimQ6;
    const content = ctx.content.demos.q6;
    const board = model.createBoard(6);
    let fixes = model.noFixes();
    let evaluated = 0;
    let shownCount = 0;
    let auto = false;
    let gradeCarry = 0;
    let scope = "global";
    let page = 0;
    let nicknames = false;
    let loading = null;
    let boardKey = "";
    let lastRank = null;
    let change = null;
    let lastTableDraw = 0;
    let tableDirty = true;
    let silent = false;

    const frame = demoFrame({
      content,
      onFixesChange(state, key) {
        fixes = state;
        if (!state.twoBoards) scope = "global";
        nicknames = state.nicknames;
        if (!silent) logFixChange(ctx, content, state, key);
        shownCount = evaluated;
        tableDirty = true;
        render();
      },
      onReset: () => reset(true)
    });

    const confirmButton = button("Teacher confirms next grade", () => confirmGrades(1, true), { class: "btn-primary" });
    const autoButton = button("Auto-confirm", toggleAuto);
    autoButton.setAttribute("aria-pressed", "false");
    const jumpButton = button("Jump to my rank", jumpToMe);
    const refreshButton = button("Refresh board", () => {
      shownCount = evaluated;
      tableDirty = true;
      ctx.log.add("info", "Q6: board reloaded by hand");
      render();
    });
    const nicknameLabel = el("label", { class: "check" });
    const nicknameInput = el("input", { type: "checkbox", onChange: () => {
      nicknames = nicknameInput.checked;
      tableDirty = true;
      ctx.log.add("info", "Q6: nicknames " + (nicknames ? "on" : "off"));
      render();
    } });
    nicknameLabel.append(nicknameInput, " Show nicknames");
    const scopeButtons = ["batch", "global"].map((key) => {
      const node = el("button", { type: "button", class: "btn tab", onClick: () => {
        scope = key;
        page = 0;
        tableDirty = true;
        render();
      } }, key === "batch" ? "Batch" : "Global");
      node.dataset.key = key;
      return node;
    });
    const batchInput = el("input", { type: "number", min: "5", max: "200", value: String(board.batchSize), class: "number-input", "aria-label": "Batch size" });
    batchInput.addEventListener("change", () => {
      board.batchSize = Math.max(5, Math.min(200, Math.round(Number(batchInput.value)) || model.DEFAULT_BATCH_SIZE));
      batchInput.value = String(board.batchSize);
      tableDirty = true;
      render();
    });
    const scopeRow = el("div", { class: "button-row" }, scopeButtons, el("label", { class: "control-label" }, "Batch size ", batchInput));
    const liveNode = el("span", { class: "live" });
    const progressNode = el("p", { class: "progress-line" });
    const rankNode = el("p", { class: "rank-line" });
    const statusNode = el("p", { class: "status-line" });
    const tieNode = el("p", { class: "muted" });
    const socketNode = el("p", { class: "muted" });
    const tableHost = el("div", { class: "table-host", tabindex: "0", "aria-label": "Leaderboard table" });
    const pagerNode = el("div", { class: "button-row" });

    frame.stage.append(
      el("div", { class: "button-row" }, confirmButton, autoButton, speedControl(ctx), jumpButton, refreshButton, nicknameLabel, liveNode),
      scopeRow,
      progressNode,
      rankNode,
      statusNode,
      tieNode,
      pagerNode,
      tableHost,
      socketNode,
      el("p", { class: "illustrative", text: "Synthetic students, marks and times, made with a seeded generator (illustrative)." })
    );

    function options() {
      return { scope, tieBreak: fixes.twoBoards ? "time" : "id" };
    }

    function confirmGrades(count, announce) {
      const before = evaluated;
      evaluated = Math.min(board.students.length, evaluated + count);
      if (evaluated === before) return;
      if (fixes.realtime) shownCount = evaluated;
      tableDirty = true;
      if (announce) ctx.log.add("ok", "Q6: teacher confirmed grade " + number(evaluated) + " of " + number(board.students.length) + (fixes.realtime ? ", pushed live over a WebSocket" : ""));
      else if (Math.floor(evaluated / LOG_EVERY_GRADES) !== Math.floor(before / LOG_EVERY_GRADES)) ctx.log.add("info", "Q6: " + model.progressLine(evaluated, board.students.length));
      if (evaluated === board.students.length) {
        ctx.log.add("ok", "Q6: every submission is graded");
        stopAuto();
      }
      render();
    }

    function toggleAuto() {
      if (auto) stopAuto();
      else {
        auto = true;
        ctx.log.add("info", "Q6: auto-confirm started");
      }
      autoButton.setAttribute("aria-pressed", String(auto));
    }

    function stopAuto() {
      auto = false;
      autoButton.setAttribute("aria-pressed", "false");
    }

    function visibleCount() {
      return fixes.realtime ? evaluated : shownCount;
    }

    function buildRows() {
      const count = visibleCount();
      const ranked = model.rankedList(board, count, options());
      const done = new Set(ranked.map((row) => row.student.index));
      const pending = board.students.filter((student) => !done.has(student.index) && (scope === "global" || Math.floor(student.index / board.batchSize) === Math.floor(board.youIndex / board.batchSize)));
      return ranked.concat(pending.map((student) => ({ student, rank: null })));
    }

    function yourRow(rows) {
      return rows.findIndex((row) => row.student.index === board.youIndex);
    }

    function jumpToMe() {
      const rows = buildRows();
      page = Math.floor(yourRow(rows) / model.PAGE_SIZE);
      tableDirty = true;
      ctx.log.add("info", "Q6: jumped to my row on page " + (page + 1));
      render();
      const own = tableHost.querySelector(".row-you");
      if (own) own.scrollIntoView({ block: "center" });
    }

    function rowNode(row) {
      const you = fixes.showAll && row.student.index === board.youIndex;
      const name = model.displayName(row.student, nicknames);
      const marks = row.rank === null ? "not graded yet" : String(row.student.marks);
      const time = row.rank === null ? "" : Math.round(row.student.finishSeconds / 60) + " min";
      return el(
        "tr",
        { class: you ? "row-you" : "", "aria-current": you ? "true" : null },
        el("td", { text: row.rank === null ? "-" : String(row.rank) }),
        el("td", { text: (you ? "▶ You: " : "") + name }),
        el("td", { text: marks }),
        el("td", { text: time })
      );
    }

    function tableFor(rows) {
      const paged = fixes.paging;
      const slice = paged ? rows.slice(page * model.PAGE_SIZE, (page + 1) * model.PAGE_SIZE) : rows;
      return el("table", { class: "mini-table board-table" }, el("tr", null, ["Rank", "Student", "Marks", "Finished after"].map((head) => el("th", { text: head }))), slice.map(rowNode));
    }

    function currentKey() {
      return [fixes.showAll, fixes.paging, scope, evaluated >= board.students.length, fixes.twoBoards].join("|");
    }

    function startLoading(rowCount) {
      const delay = model.loadDelayMs(rowCount, fixes.paging);
      loading = { start: performance.now(), delay };
    }

    function renderTable(force) {
      const now = performance.now();
      if (!force && !tableDirty && !loading) return;
      if (!force && now - lastTableDraw < TABLE_REFRESH_MS) return;
      lastTableDraw = now;
      tableDirty = false;
      const showBoard = fixes.showAll || evaluated >= board.students.length;
      if (!showBoard) {
        tableHost.replaceChildren(el("div", { class: "pending-box" }, badge("warn", "Results pending"), el("p", { text: "The board stays empty until every submission is graded. Your own row shows nothing." })));
        return;
      }
      const rows = buildRows();
      if (loading && now - loading.start < loading.delay) {
        const percent = Math.round(((now - loading.start) / loading.delay) * 100);
        tableHost.replaceChildren(el("div", { class: "pending-box" }, el("p", { text: "Loading " + number(rows.length) + " rows (illustrative delay)... " + percent + " percent" }), el("progress", { max: "100", value: String(percent), "aria-label": "Loading the board" })));
        tableDirty = true;
        return;
      }
      loading = null;
      if (fixes.paging) page = Math.min(page, model.pageCount(rows.length) - 1);
      tableHost.replaceChildren(tableFor(rows));
      renderPager(rows.length);
    }

    function renderPager(rowCount) {
      if (!fixes.paging) {
        pagerNode.replaceChildren();
        return;
      }
      const pages = model.pageCount(rowCount);
      pagerNode.replaceChildren(
        button("Previous page", () => changePage(-1), { disabled: page === 0 }),
        el("span", { text: "Page " + (page + 1) + " of " + pages }),
        button("Next page", () => changePage(1), { disabled: page >= pages - 1 })
      );
    }

    function changePage(step) {
      page += step;
      tableDirty = true;
      render();
    }

    function renderInfo() {
      const total = board.students.length;
      const count = visibleCount();
      const status = model.ownStatus(board, evaluated);
      const rank = fixes.showAll ? model.yourRank(board, count, options()) : null;
      progressNode.textContent = fixes.progress ? model.progressLine(count, total) : "";
      progressNode.hidden = !fixes.progress;
      rankNode.hidden = !(fixes.provisionalRank && rank);
      if (fixes.provisionalRank && rank) {
        if (lastRank !== null && rank.rank !== lastRank) change = { ...model.rankChange(lastRank, rank.rank), until: performance.now() + CHANGE_SHOW_MS };
        lastRank = rank.rank;
        const shown = change && performance.now() < change.until ? change : null;
        rankNode.replaceChildren(model.rankLine(rank) + " ", badge("warn", "Provisional"), shown && shown.direction !== "same" ? el("span", { class: "rank-change change-" + shown.direction }, shown.direction === "up" ? " ▲ up " : " ▼ down ", shown.amount) : null);
      } else if (!rank) {
        lastRank = null;
      }
      statusNode.hidden = !fixes.statusPill;
      statusNode.replaceChildren("Your submission status: ", badge(STATUS_KIND[status], status));
      tieNode.hidden = !fixes.twoBoards;
      const tie = fixes.twoBoards ? model.tieExample(board, count) : null;
      tieNode.textContent = tie ? "Tie example: " + model.displayName(tie.first.student, nicknames) + " and " + model.displayName(tie.second.student, nicknames) + " both have " + tie.first.student.marks + " marks, so the earlier finish ranks higher (" + tie.first.rank + " then " + tie.second.rank + ")." : "";
      liveNode.replaceChildren(fixes.realtime ? badge("fixed", "● live") : null);
      refreshButton.hidden = !(fixes.showAll && !fixes.realtime);
      jumpButton.hidden = !fixes.paging;
      nicknameLabel.hidden = !fixes.nicknames;
      scopeRow.hidden = !fixes.twoBoards;
      scopeButtons.forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.key === scope)));
      socketNode.textContent = fixes.realtime ? content.socketNote : "";
      frame.setCaption(ctx.content.captions.q6({ showAll: fixes.showAll, evaluated: fixes.showAll ? count : evaluated, total, rank, status }) + (fixes.showAll && !fixes.realtime && count !== evaluated ? " The board is out of date: press Refresh board." : ""));
    }

    function render() {
      const key = currentKey();
      if (key !== boardKey) {
        boardKey = key;
        startLoading(scope === "batch" ? board.batchSize : board.students.length);
        tableDirty = true;
      }
      nicknameInput.checked = nicknames;
      renderInfo();
      renderTable(false);
    }

    function tick(simSeconds) {
      if (auto) {
        gradeCarry += simSeconds * GRADES_PER_SIM_SECOND;
        const whole = Math.floor(gradeCarry);
        gradeCarry -= whole;
        if (whole > 0) confirmGrades(whole, false);
      }
      render();
    }

    function reset(announce) {
      silent = true;
      evaluated = 0;
      shownCount = 0;
      gradeCarry = 0;
      scope = "global";
      page = 0;
      nicknames = false;
      loading = null;
      boardKey = "";
      lastRank = null;
      change = null;
      board.batchSize = model.DEFAULT_BATCH_SIZE;
      batchInput.value = String(board.batchSize);
      stopAuto();
      frame.toggle.setAll(false);
      silent = false;
      if (announce) ctx.log.add("info", "Q6 reset");
      tableDirty = true;
      render();
      renderTable(true);
    }

    reset(false);

    return {
      element: frame.root,
      tick: (simSeconds) => tick(simSeconds),
      reset: () => reset(false),
      onShow: () => {
        tableDirty = true;
        render();
      },
      showcase(fixed) {
        reset(false);
        frame.toggle.setAll(fixed);
        confirmGrades(fixed ? 200 : 40, false);
        toggleAuto();
        ctx.setSpeed(20);
      }
    };
  }

  window.UiQ6 = { create };
})();
