(function () {
  const MAX_LINES = 400;
  const TYPE_MARKS = { info: "ℹ", ok: "✔", warn: "⚠", error: "✖" };
  const TYPE_WORDS = { info: "info", ok: "ok", warn: "warning", error: "error" };

  function create(container, clock) {
    const { el, button } = window.UiLayout;
    const lines = [];
    let paused = false;
    let filterText = "";

    const list = el("div", { class: "log-lines", role: "log", "aria-live": "polite", "aria-label": "Live log", tabindex: "0" });
    const filter = el("input", { type: "search", class: "log-filter", placeholder: "Filter by sub-1042 or S-101", "aria-label": "Filter log by submission or student ID" });
    const pauseButton = button("Pause scroll", () => {
      paused = !paused;
      pauseButton.setAttribute("aria-pressed", String(paused));
      pauseButton.textContent = paused ? "Resume scroll" : "Pause scroll";
      if (!paused) scrollToEnd();
    });
    pauseButton.setAttribute("aria-pressed", "false");
    const clearButton = button("Clear", () => {
      lines.length = 0;
      render();
    });

    filter.addEventListener("input", () => {
      filterText = filter.value.trim().toLowerCase();
      render();
    });

    container.append(
      el("h2", { class: "log-title", text: "Live log" }),
      el("p", { class: "log-hint", text: "Every demo writes here. Logging is itself one of the fixes." }),
      el("div", { class: "log-tools" }, filter, pauseButton, clearButton),
      list
    );

    function lineNode(entry) {
      return el(
        "div",
        { class: "log-line log-" + entry.type },
        el("span", { class: "log-time", text: "[" + entry.stamp + "]" }),
        " ",
        el("span", { class: "log-mark", "aria-hidden": "true", text: TYPE_MARKS[entry.type] }),
        el("span", { class: "visually-hidden", text: TYPE_WORDS[entry.type] + ": " }),
        " ",
        el("span", { class: "log-text", text: entry.text })
      );
    }

    function visibleLines() {
      return filterText ? lines.filter((entry) => entry.text.toLowerCase().includes(filterText)) : lines;
    }

    function scrollToEnd() {
      list.scrollTop = list.scrollHeight;
    }

    function render() {
      list.replaceChildren(...visibleLines().map(lineNode));
      if (!paused) scrollToEnd();
    }

    function add(type, text, time) {
      const stamp = window.SimClock.formatClockTime(time === undefined ? clock.now() : time);
      const entry = { type, text, stamp };
      lines.push(entry);
      if (lines.length > MAX_LINES) lines.shift();
      if (!filterText || text.toLowerCase().includes(filterText)) {
        list.append(lineNode(entry));
        if (list.childElementCount > MAX_LINES) list.firstElementChild.remove();
        if (!paused) scrollToEnd();
      }
    }

    function clearAll() {
      lines.length = 0;
      render();
    }

    return { add, clear: clearAll };
  }

  window.UiLog = { create };
})();
