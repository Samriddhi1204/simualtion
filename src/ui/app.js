(function () {
  const content = window.HomeworkContent;
  const { el, button } = window.UiLayout;
  const clock = window.SimClock.createClock();
  const speedListeners = [];
  const sequence = ["overview"].concat(content.order);

  const ctx = {
    clock,
    clockSpeeds: window.SimClock.SPEEDS,
    content,
    log: null,
    setSpeed(speed) {
      clock.setSpeed(speed);
      speedListeners.forEach((listener) => listener());
    },
    onSpeedChange(listener) {
      speedListeners.push(listener);
    }
  };
  ctx.log = window.UiLog.create(document.getElementById("log-panel"), clock);

  const factories = {
    q1: window.UiQ1.create,
    q2: window.UiQ2.create,
    q3: window.UiQ3.create,
    q4: window.UiQ4.create,
    q5: window.UiQ5.create,
    q6: window.UiQ6.create,
    q7: window.UiQ7.create
  };
  const instances = {};
  const mainNode = document.getElementById("main");
  const sidebar = document.getElementById("sidebar");
  const navButtons = {};
  const openLabel = el("p", { class: "sidebar-note", "aria-live": "polite" });
  let openId = null;

  function createOverview() {
    return {
      element: window.UiLayout.buildOverview(content.overview, content.demos, (id) => app.open(id, true)),
      tick() {},
      reset() {},
      showcase() {}
    };
  }

  function instanceFor(id) {
    if (!instances[id]) instances[id] = id === "overview" ? createOverview() : factories[id](ctx);
    return instances[id];
  }

  function open(id, moveFocus) {
    openId = id;
    const instance = instanceFor(id);
    mainNode.replaceChildren(instance.element);
    if (instance.onShow) instance.onShow();
    Object.entries(navButtons).forEach(([key, node]) => {
      if (key === id) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
    openLabel.textContent = "Open now: " + content.navLabels[id];
    if (moveFocus) mainNode.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function resetAll() {
    Object.values(instances).forEach((instance) => instance.reset());
    clock.reset();
    ctx.log.clear();
    ctx.log.add("info", "All demos reset");
  }

  const app = { open, instanceFor, sequence, ctx, resetAll };

  function buildSidebar() {
    sequence.forEach((id, index) => {
      const number = index > 0 ? el("span", { class: "nav-key", "aria-hidden": "true", text: index }) : null;
      const node = el("button", { type: "button", class: "btn nav-button", onClick: () => open(id, true) }, number, " ", content.navLabels[id]);
      if (index > 0) node.setAttribute("aria-keyshortcuts", String(index));
      navButtons[id] = node;
      sidebar.append(node);
    });
    sidebar.append(openLabel, el("p", { class: "sidebar-note", text: "Press 1 to 7 to jump between demos." }));
  }

  function buildClockBar() {
    const bar = document.getElementById("clock-bar");
    const pause = button("Pause", () => {
      if (clock.isPaused()) clock.resume();
      else clock.pause();
      pause.textContent = clock.isPaused() ? "Resume" : "Pause";
      pause.setAttribute("aria-pressed", String(clock.isPaused()));
    });
    pause.setAttribute("aria-pressed", "false");
    const readout = el("span", { class: "clock-readout" });
    const scale = el("span", { class: "clock-scale" });
    bar.append(el("strong", { text: "Simulated clock" }), pause, window.UiLayout.speedControl(ctx), readout, scale);

    function refresh() {
      readout.textContent = "Time " + window.SimClock.formatClockTime(clock.now());
      scale.textContent = window.SimClock.scaleLabel(clock.speed());
    }
    ctx.onSpeedChange(refresh);
    return refresh;
  }

  function buildAssumptions() {
    const list = document.getElementById("assumption-list");
    content.assumptions.forEach((text) => list.append(el("li", { text })));
  }

  function bindKeys() {
    document.addEventListener("keydown", (event) => {
      const tag = event.target.tagName;
      if (event.ctrlKey || event.metaKey || event.altKey || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const index = Number(event.key);
      if (index >= 1 && index <= content.order.length) open(content.order[index - 1], true);
    });
  }

  function start() {
    buildSidebar();
    buildAssumptions();
    const refreshClock = buildClockBar();
    document.getElementById("reset-all").addEventListener("click", resetAll);
    const tour = window.UiTour.create(app);
    document.getElementById("tour-start").addEventListener("click", tour.start);
    bindKeys();
    open("overview", false);
    refreshClock();

    let last = performance.now();
    function frame(now) {
      const delta = Math.min(now - last, 100);
      last = now;
      const simDelta = clock.advance(delta);
      if (simDelta > 0 && openId && instances[openId]) instances[openId].tick(simDelta);
      refreshClock();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.HomeworkApp = app;
  start();
})();
