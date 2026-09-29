(function () {
  const VISITOR = { id: "visitor", name: "Visitor", marks: [50, 50, 50] };

  function create(ctx) {
    const { el, button, badge, demoFrame, logFixChange } = window.UiLayout;
    const model = window.SimQ4;
    const content = ctx.content.demos.q4;
    let state = model.createSession(4);
    let silent = false;
    let lastLine = "";
    let lastShares = null;
    let loginText = "Logged in as Aarav (S-101)";
    let signature = "";

    const frame = demoFrame({
      content,
      onFixesChange(fixes, key) {
        model.setFixes(state, fixes);
        if (!silent) logFixChange(ctx, content, fixes, key);
        render(true);
      },
      onReset: () => reset(true)
    });

    const capacityInput = el("input", { type: "number", min: "1", max: "60", value: String(state.capacity), "aria-label": "Capacity", class: "number-input" });
    capacityInput.addEventListener("change", () => changeCapacity(Number(capacityInput.value)));
    const capacityNote = el("span", { class: "muted" });
    const loginNode = el("p", { class: "login-state" });
    const seatsNode = el("div", { class: "seats" });
    const waitingNode = el("div", { class: "waiting" });
    const serversNode = el("p", { class: "muted" });

    frame.stage.append(
      el(
        "div",
        { class: "button-row" },
        button("Fill to 19", fillTo19),
        button("Two students click Join together", () => joinPair(), { class: "btn-primary" }),
        button("Two groups of 20 join together", joinGroups),
        button("Join without logging in", joinVisitor),
        button("Advance 2 minutes", () => advance(model.CONFIRM_SECONDS))
      ),
      el("label", { class: "control inline" }, el("span", { class: "control-label", text: "Capacity" }), capacityInput, capacityNote),
      loginNode,
      seatsNode,
      serversNode,
      waitingNode
    );

    function log(type, text) {
      ctx.log.add(type, text);
    }

    function flush() {
      model.takeEvents(state).forEach((event) => log(event.type, "Q4: " + event.text));
    }

    function describe(outcomes) {
      const parts = outcomes.slice(0, 2).map((item) => {
        if (item.outcome === "seated") return item.student.name + " got " + (state.seats.length >= state.capacity ? "the last seat" : "a seat");
        if (item.outcome === "waitlisted") return item.student.name + " is number " + item.position + " on the waiting list";
        if (item.outcome === "refused") return item.message;
        return item.student.name + ": " + item.message;
      });
      return parts.join(". ") + ".";
    }

    function report(outcomes) {
      outcomes.slice(0, 4).forEach((item) => log(item.outcome === "seated" ? "info" : item.outcome === "waitlisted" ? "warn" : "error", "Q4: " + item.student.name + " (" + item.student.id + "): " + item.message));
      if (outcomes.length > 4) log("info", "Q4: " + (outcomes.length - 4) + " more join results not listed, " + state.seats.length + " of " + state.capacity + " seats now taken");
      lastShares = model.serverShares(state, outcomes.length);
      lastLine = outcomes.length > 2 ? summarise(outcomes) : describe(outcomes);
      flush();
      render(true);
    }

    function summarise(outcomes) {
      const count = (word) => outcomes.filter((item) => item.outcome === word).length;
      return count("seated") + " seated, " + count("waitlisted") + " on the waiting list, " + count("turned away") + " turned away. Seats: " + state.seats.length + " of " + state.capacity + ".";
    }

    function fillTo19() {
      model.fillTo(state, 19);
      lastLine = "";
      log("info", "Q4: 19 of " + state.capacity + " seats filled");
      render(true);
    }

    function joinPair() {
      loginText = "Logged in as Aarav (S-101) and Meera (S-102)";
      log("info", "Q4: two students click Join together, both read count " + state.seats.length);
      report(model.joinBatch(state, [model.findStudent(state, "S-101"), model.findStudent(state, "S-102")], true));
    }

    function joinGroups() {
      const group = state.roster.filter((student) => student.id !== "S-101" && student.id !== "S-102").slice(0, 40);
      loginText = "Logged in: two groups of 20";
      log("info", "Q4: two groups of 20 click Join together");
      report(model.joinBatch(state, group, true));
    }

    function joinVisitor() {
      loginText = "Not logged in (visitor)";
      log("info", "Q4: a visitor who is not logged in clicks Join");
      report(model.joinBatch(state, [VISITOR], false));
    }

    function advance(seconds) {
      model.advance(state, seconds);
      flush();
      render(true);
    }

    function changeCapacity(value) {
      const changed = model.setCapacity(state, value);
      log(changed ? "ok" : "warn", changed ? "Q4: capacity is now " + state.capacity : "Q4: capacity is hard-coded at 20, so the input does nothing");
      flush();
      render(true);
    }

    function freeSeat(id) {
      model.freeSeat(state, id);
      log("info", "Q4: " + id + " left the session");
      flush();
      lastLine = "";
      render(true);
    }

    function seatNode(seat, index) {
      const over = index >= state.capacity;
      const left = model.secondsToConfirm(state, seat);
      const children = [el("strong", { text: seat.student.name }), el("span", { class: "muted", text: seat.student.id })];
      if (left !== null) children.push(el("span", { class: "seat-timer", "data-id": seat.student.id, text: "confirm in " + Math.ceil(left) + " s" }));
      const seatButton = el("button", { type: "button", class: "seat" + (over ? " seat-over" : ""), "aria-label": "Free the seat of " + seat.student.name + (over ? " (over capacity)" : ""), onClick: () => freeSeat(seat.student.id) }, children);
      const confirm = left !== null ? button("Confirm", () => {
        model.confirmSeat(state, seat.student.id);
        log("ok", "Q4: " + seat.student.id + " confirmed the seat");
        render(true);
      }, { class: "btn-small" }) : null;
      return el("div", { class: "seat-wrap" }, seatButton, confirm);
    }

    function emptySeat() {
      return el("div", { class: "seat seat-empty", "aria-hidden": "true", text: "empty" });
    }

    function renderSeats() {
      const filled = state.seats.map(seatNode);
      const empties = Array.from({ length: Math.max(0, state.capacity - state.seats.length) }, emptySeat);
      const over = model.overCapacity(state);
      seatsNode.replaceChildren(
        el("p", null, over > 0 ? badge("problem", state.seats.length + " of " + state.capacity + " seats: over capacity") : badge("neutral", state.seats.length + " of " + state.capacity + " seats")),
        el("div", { class: "seat-grid" }, filled, empties)
      );
    }

    function renderWaiting() {
      if (!state.fixes.waitingList) {
        waitingNode.replaceChildren(el("p", { class: "muted", text: "No waiting list: extra students are simply turned away (" + state.turnedAway.length + " so far)." }));
        return;
      }
      const rows = state.waiting.map((entry, index) => {
        const student = entry.student;
        const marks = student.marks.join(", ");
        const rotated = state.priorityCount[student.id] ? "↻ had priority " + state.priorityCount[student.id] + "x" : "";
        const listen = state.fixes.listenOnly ? (entry.listenOnly ? badge("neutral", "Listening only") : button("Listen only", () => {
          model.setListenOnly(state, student.id);
          log("info", "Q4: " + student.id + " chose Listen only");
          render(true);
        }, { class: "btn-small" })) : null;
        return el("tr", null, el("td", { text: String(index + 1) }), el("td", { text: student.name + " (" + student.id + ")" }), el("td", { text: marks }), el("td", { text: String(Math.round(model.averageMarks(student))) }), el("td", { text: rotated }), el("td", null, listen));
      });
      waitingNode.replaceChildren(
        el("h4", { text: "Waiting list and recent test marks" }),
        rows.length
          ? el("table", { class: "mini-table" }, el("tr", null, ["Position", "Student", "Last 3 marks", "Average", "Rotation", ""].map((head) => el("th", { text: head }))), rows)
          : el("p", { class: "muted", text: "Nobody is waiting." }),
        state.fixes.selection ? el("p", { class: "muted", text: "When a seat frees up, the weakest recent marks go first, and a rotation marker stops the same students always getting priority." }) : null
      );
    }

    function renderServers() {
      const servers = model.serverShares(state, 0).length;
      serversNode.textContent = state.fixes.balancing
        ? "Join page: " + servers + " servers share the join requests" + (lastShares ? " (last click split " + lastShares.join(" / ") + ")" : "") + "."
        : "Join page: 1 server takes every join request.";
    }

    function currentSignature() {
      return JSON.stringify([state.seats.map((s) => [s.student.id, s.confirmed]), state.waiting.map((w) => [w.student.id, w.listenOnly]), state.capacity, state.fixes, state.turnedAway.length, state.priorityCount]);
    }

    function render(force) {
      const next = currentSignature();
      if (force || next !== signature) {
        signature = next;
        renderSeats();
        renderWaiting();
      }
      state.seats.forEach((seat) => {
        const node = seatsNode.querySelector('[data-id="' + seat.student.id + '"]');
        const left = model.secondsToConfirm(state, seat);
        if (node && left !== null) node.textContent = "confirm in " + Math.ceil(left) + " s";
      });
      capacityInput.value = String(state.capacity);
      capacityInput.disabled = !state.fixes.capacity;
      capacityNote.textContent = state.fixes.capacity ? "a setting" : "hard-coded at 20";
      loginNode.replaceChildren("Login state: ", badge(loginText.startsWith("Not") ? "problem" : "neutral", state.fixes.authenticate ? loginText + " (login required)" : loginText));
      renderServers();
      frame.setCaption(ctx.content.captions.q4({ overCapacity: model.overCapacity(state), seats: state.seats.length, capacity: state.capacity, waiting: state.waiting.length, lastLine }));
    }

    function tick(simSeconds) {
      if (!state.fixes.noShow) {
        state.now += simSeconds;
        return;
      }
      model.advance(state, simSeconds);
      flush();
      render(false);
    }

    function reset(announce) {
      silent = true;
      state = model.createSession(4);
      lastLine = "";
      lastShares = null;
      loginText = "Logged in as Aarav (S-101)";
      frame.toggle.setAll(false);
      silent = false;
      if (announce) log("info", "Q4 reset");
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
        fillTo19();
        joinPair();
      }
    };
  }

  window.UiQ4 = { create };
})();
