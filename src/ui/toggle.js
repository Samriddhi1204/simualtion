(function () {
  function create(options) {
    const { el } = window.UiLayout;
    const fixes = options.fixes;
    const state = Object.fromEntries(fixes.map((fix) => [fix.key, false]));
    const inputs = {};

    const problemButton = el("button", { type: "button", class: "seg seg-problem", onClick: () => setAll(false) }, "✖ Problem");
    const fixedButton = el("button", { type: "button", class: "seg seg-fixed", onClick: () => setAll(true) }, "✔ Fixed");
    const mixed = el("span", { class: "toggle-mixed" });
    const segmented = el("div", { class: "segmented", role: "group", "aria-label": options.label || "Show system state" }, problemButton, fixedButton, mixed);
    const switches = options.showSwitches === false ? null : buildSwitches();
    const element = el("div", { class: "toggle" }, segmented, switches);

    function buildSwitches() {
      const fieldset = el("fieldset", { class: "switches" }, el("legend", { text: "Fix switches (one per fix)" }));
      fixes.forEach((fix) => {
        const input = el("input", { type: "checkbox", role: "switch", onChange: () => set(fix.key, input.checked) });
        inputs[fix.key] = input;
        fieldset.append(
          el("label", { class: "switch", title: fix.text }, input, el("span", { class: "switch-name", text: fix.name }), el("span", { class: "switch-text", text: fix.text }))
        );
      });
      return fieldset;
    }

    function enabledCount() {
      return fixes.filter((fix) => state[fix.key]).length;
    }

    function refresh() {
      const count = enabledCount();
      problemButton.setAttribute("aria-pressed", String(count === 0));
      fixedButton.setAttribute("aria-pressed", String(count === fixes.length));
      mixed.textContent = count > 0 && count < fixes.length ? count + " of " + fixes.length + " fixes on" : "";
      fixes.forEach((fix) => {
        if (inputs[fix.key]) inputs[fix.key].checked = state[fix.key];
      });
    }

    function notify(changedKey) {
      refresh();
      options.onChange({ ...state }, changedKey);
    }

    function set(key, value) {
      state[key] = Boolean(value);
      notify(key);
    }

    function setAll(value) {
      fixes.forEach((fix) => (state[fix.key] = value));
      notify(null);
    }

    function setQuietly(value) {
      fixes.forEach((fix) => (state[fix.key] = value));
      refresh();
    }

    refresh();
    return { element, getState: () => ({ ...state }), set, setAll, setQuietly, isOn: (key) => state[key] };
  }

  window.UiToggle = { create };
})();
