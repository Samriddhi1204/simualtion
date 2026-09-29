(function () {
  const GROUPS = ["A", "B", "C", "D", "E"];
  const STATUS_TEXT = { ok: "OK", slow: "Slow", down: "Down" };
  const STATUS_KIND = { ok: "fixed", slow: "warn", down: "problem" };
  const MAX_LOAD_SHOWN = 150;

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return { text: read("--text"), muted: read("--muted"), neutral: read("--neutral"), warn: read("--warn"), problem: read("--problem"), border: read("--border") };
  }

  function create(ctx) {
    const { el, fill, button, badge, slider, number, demoFrame, logFixChange } = window.UiLayout;
    const model = window.SimQ1;
    const content = ctx.content.demos.q1;
    let config = model.defaultConfig();
    let points = null;
    let playhead = null;
    let running = false;
    let groupOrder = GROUPS.slice();
    let silent = false;
    let lastStatus = null;

    const frame = demoFrame({
      content,
      onFixesChange(state, key) {
        config.fixes = state;
        points = null;
        if (!silent) logFixChange(ctx, content, state, key);
        stopRun();
        render();
      },
      onReset: () => reset(true)
    });

    const studentsSlider = slider("Students submitting", 100, 1500, config.students, (value) => {
      config.students = value;
      points = null;
      stopRun();
      render();
    });
    const slotsSlider = slider("Deadline slots", 1, model.MAX_SLOTS, config.slots, (value) => {
      config.slots = value;
      points = null;
      stopRun();
      render();
    });
    const runButton = button("Everyone submits now", startRun, { class: "btn-primary" });
    const killButton = button("Kill one server", killServer);
    const rotateButton = button("Rotate slots", rotateSlots);

    const loadFill = el("div", { class: "load-fill" });
    const loadBar = el(
      "div",
      { class: "load-bar", role: "meter", "aria-label": "Server load in percent", "aria-valuemin": "0", "aria-valuemax": String(MAX_LOAD_SHOWN) },
      loadFill,
      el("div", { class: "load-limit", "aria-hidden": "true", style: "left:" + (100 / MAX_LOAD_SHOWN) * 100 + "%" })
    );
    const loadText = el("strong", { class: "load-text" });
    const loadLabel = el("span", { class: "muted" });
    const statusNode = el("div", { class: "status-badge" });
    const averageNode = el("dd");
    const tryAgainNode = el("dd");
    const backlogNode = el("dd");
    const serversNode = el("div", { class: "servers" });
    const bandsNode = el("div", { class: "bands" });
    const slotNote = el("p", { class: "muted", text: content.slotsCaption });
    const slotBox = el("div", { class: "slot-box" }, bandsNode, slotNote, rotateButton);
    const canvas = el("canvas", { class: "chart", height: "220", role: "img" });
    const chartLegend = el("p", { class: "muted chart-legend" });

    frame.stage.append(
      el("div", { class: "controls" }, studentsSlider.element, slotsSlider.element),
      el("div", { class: "button-row" }, runButton, killButton),
      el("div", { class: "meter-row" }, el("div", { class: "meter-main" }, loadLabel, loadText, loadBar), statusNode),
      el("dl", { class: "stats" }, el("dt", { text: "Average request time (illustrative)" }), averageNode, el("dt", { text: "\"Try again\" replies" }), tryAgainNode, el("dt", { text: "Background queue waiting" }), backlogNode),
      serversNode,
      slotBox,
      canvas,
      chartLegend,
      el("p", { class: "illustrative", text: "All load levels, timings and counts here are illustrative." })
    );

    function currentPoints() {
      if (!points) points = model.timeline(config);
      return points;
    }

    function peakPoint() {
      return currentPoints().reduce((best, point) => (point.loadPercent > best.loadPercent ? point : best));
    }

    function shownPoint() {
      const all = currentPoints();
      return playhead === null ? peakPoint() : all[Math.min(all.length - 1, Math.floor(playhead))];
    }

    function startRun() {
      playhead = 0;
      running = true;
      lastStatus = null;
      ctx.log.add("info", "Q1: everyone submits now: " + number(config.students) + " students, " + model.activeSlots(config) + " deadline slot(s) (illustrative)");
      render();
    }

    function stopRun() {
      running = false;
      playhead = null;
    }

    function killServer() {
      if (model.serversRunning(config) === 0) return;
      config.killed += 1;
      points = null;
      const left = model.serversRunning(config);
      ctx.log.add(left === 0 ? "error" : "warn", "Q1: server killed, " + left + " running" + (left === 0 ? ", the site is down" : ", the load balancer keeps the site up"));
      render();
    }

    function rotateSlots() {
      groupOrder = model.rotateSlotOrder(groupOrder);
      ctx.log.add("info", "Q1: slots rotated, group " + groupOrder[groupOrder.length - 1] + " now has the last slot");
      render();
    }

    function reset(announce) {
      silent = true;
      config = model.defaultConfig();
      points = null;
      stopRun();
      groupOrder = GROUPS.slice();
      studentsSlider.set(config.students);
      slotsSlider.set(config.slots);
      frame.toggle.setAll(false);
      silent = false;
      if (announce) ctx.log.add("info", "Q1 reset");
      render();
    }

    function renderServers() {
      const total = model.totalServers(config);
      const tiles = Array.from({ length: total }, (_, index) => {
        const alive = index >= config.killed;
        return el("div", { class: "server " + (alive ? "server-up" : "server-dead") }, el("span", { "aria-hidden": "true", text: alive ? "✔" : "✖" }), " Server " + (index + 1) + (alive ? " running" : " killed"));
      });
      const balancer = config.fixes.loadBalancer ? el("div", { class: "server balancer" }, el("span", { "aria-hidden": "true", text: "⚖" }), " Load balancer") : null;
      fill(serversNode, ...[balancer, ...tiles].filter(Boolean));
    }

    function renderBands() {
      const active = config.fixes.staggered;
      slotBox.hidden = !active;
      slotsSlider.input.disabled = !active;
      if (!active) return;
      const bands = model.slotBands(config);
      fill(bandsNode, 
        ...bands.map((band, index) =>
          el("div", { class: "band band-" + (index % 5), style: "flex:1 1 0" }, "Slot " + band.slot + " · Group " + groupOrder[index], el("small", { text: number(band.students) + " students, " + (band.end - band.start) + " min" }))
        )
      );
    }

    function noteStatusChange(info) {
      if (!running || info.status === lastStatus) return;
      lastStatus = info.status;
      const type = info.status === "down" ? "error" : info.status === "slow" ? "warn" : "ok";
      ctx.log.add(type, "Q1: load " + number(info.loadPercent) + " percent, status " + STATUS_TEXT[info.status] + " (illustrative)");
    }

    function render() {
      const point = shownPoint();
      const info = model.statusAt(config, point);
      const summary = model.summary(config);
      const width = Math.min(MAX_LOAD_SHOWN, info.loadPercent);
      loadFill.style.width = (width / MAX_LOAD_SHOWN) * 100 + "%";
      loadFill.className = "load-fill " + (info.loadPercent > 100 ? "load-over" : info.loadPercent >= 70 ? "load-high" : "load-low");
      loadBar.setAttribute("aria-valuenow", String(Math.round(width)));
      loadLabel.textContent = playhead === null ? "Peak load " : "Load now ";
      loadText.textContent = number(info.loadPercent) + " percent" + (info.loadPercent > MAX_LOAD_SHOWN ? " (bar stops at 150)" : "");
      fill(statusNode, badge(STATUS_KIND[info.status], "Status: " + STATUS_TEXT[info.status]));
      averageNode.textContent = info.averageMs === null ? "Requests time out" : number(info.averageMs) + " ms";
      tryAgainNode.textContent = number(summary.tryAgainCount);
      backlogNode.textContent = config.fixes.queue ? number(info.backlog) + " units (drains later)" : "Not used";
      renderServers();
      renderBands();
      noteStatusChange(info);
      frame.setCaption(
        ctx.content.captions.q1({
          students: config.students,
          running: summary.serversRunning,
          slots: summary.slots,
          loadPercent: info.loadPercent,
          status: info.status,
          tryAgain: summary.tryAgainCount,
          backlog: config.fixes.queue ? summary.peakBacklog : 0,
          playing: playhead !== null
        })
      );
      drawChart();
    }

    function drawChart() {
      const all = currentPoints();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(320, canvas.parentElement && canvas.parentElement.clientWidth ? canvas.parentElement.clientWidth : 600);
      const height = 220;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const colors = readColors();
      const left = 46;
      const bottom = 26;
      const top = 10;
      const plotWidth = width - left - 10;
      const plotHeight = height - top - bottom;
      const perSecond = all.map((item) => item.wanted / 60);
      const capacityLine = model.capacityUnits(config) / model.costPerRequest(config) / 60;
      const yMax = Math.max(1, ...perSecond, capacityLine * 1.1);
      const barWidth = plotWidth / all.length;
      context.clearRect(0, 0, width, height);
      context.font = "12px system-ui, sans-serif";
      context.fillStyle = colors.muted;
      context.strokeStyle = colors.border;
      context.textAlign = "right";
      [0, 0.5, 1].forEach((fraction) => {
        const y = top + plotHeight * (1 - fraction);
        context.fillText(number(yMax * fraction), left - 6, y + 4);
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + plotWidth, y);
        context.stroke();
      });
      all.forEach((item, index) => {
        const servedHeight = (item.served / 60 / yMax) * plotHeight;
        const rejectedHeight = (item.rejected / 60 / yMax) * plotHeight;
        const x = left + index * barWidth;
        context.fillStyle = colors.neutral;
        context.fillRect(x, top + plotHeight - servedHeight, Math.max(1, barWidth - 0.5), servedHeight);
        context.fillStyle = colors.warn;
        context.fillRect(x, top + plotHeight - servedHeight - rejectedHeight, Math.max(1, barWidth - 0.5), rejectedHeight);
      });
      if (model.serversRunning(config) > 0) {
        const y = top + plotHeight * (1 - capacityLine / yMax);
        context.strokeStyle = colors.problem;
        context.setLineDash([6, 4]);
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(left + plotWidth, y);
        context.stroke();
        context.setLineDash([]);
        context.lineWidth = 1;
      }
      if (playhead !== null) {
        const x = left + Math.min(playhead, all.length) * barWidth;
        context.strokeStyle = colors.text;
        context.beginPath();
        context.moveTo(x, top);
        context.lineTo(x, top + plotHeight);
        context.stroke();
      }
      context.fillStyle = colors.muted;
      context.textAlign = "center";
      [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => context.fillText(Math.round(all.length * fraction) + " min", left + plotWidth * fraction, height - 8));
      canvas.setAttribute("aria-label", "Requests per second over " + all.length + " simulated minutes, peak " + number(Math.max(...perSecond)) + " per second (illustrative)");
      chartLegend.textContent = "Requests per second over time (illustrative): blue served, amber turned away with \"try again\", dashed red line is what the running servers can handle.";
    }

    function tick(simSeconds) {
      if (!running) return;
      playhead += simSeconds / 60;
      const length = currentPoints().length;
      if (playhead >= length) {
        playhead = null;
        running = false;
        const summary = model.summary(config);
        ctx.log.add(summary.status === "down" ? "error" : "ok", "Q1: run finished, peak load " + number(summary.loadPercent) + " percent, status " + STATUS_TEXT[summary.status] + " (illustrative)");
      }
      render();
    }

    window.addEventListener("resize", () => {
      if (frame.root.isConnected) render();
    });

    reset(false);

    return {
      element: frame.root,
      tick,
      reset: () => reset(false),
      onShow: render,
      showcase(fixed) {
        reset(false);
        frame.toggle.setAll(fixed);
        startRun();
      }
    };
  }

  window.UiQ1 = { create };
})();
