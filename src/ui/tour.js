(function () {
  const CONTRAST_DELAY_MS = 5000;

  function create(app) {
    const { el, button } = window.UiLayout;
    const content = app.ctx.content;
    const root = document.getElementById("tour-root");
    const steps = app.sequence.map((id) => ({
      id,
      text: id === "overview" ? content.overview.tour : content.demos[id].tour,
      contrast: id !== "overview"
    }));
    let index = 0;
    let timer = null;

    const stepLabel = el("p", { class: "tour-step" });
    const text = el("p", { class: "tour-text", "aria-live": "polite" });
    const phase = el("p", { class: "tour-phase" });
    const back = button("Back", () => go(index - 1));
    const next = button("Next", () => (index === steps.length - 1 ? stop() : go(index + 1)), { class: "btn-primary" });
    const skip = button("Skip", stop);
    const card = el("div", { class: "tour-card", role: "dialog", "aria-label": "Guided tour" }, stepLabel, text, phase, el("div", { class: "tour-actions" }, back, next, skip));
    card.hidden = true;
    root.append(card);

    function clearTimer() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    function show(step) {
      const instance = app.instanceFor(step.id);
      app.open(step.id, false);
      if (!step.contrast) {
        phase.textContent = "";
        return;
      }
      instance.showcase(false);
      phase.textContent = "Showing the Problem state";
      timer = setTimeout(() => {
        instance.showcase(true);
        phase.textContent = "Now showing the Fixed state";
      }, CONTRAST_DELAY_MS);
    }

    function go(target) {
      clearTimer();
      index = Math.max(0, Math.min(steps.length - 1, target));
      stepLabel.textContent = "Step " + (index + 1) + " of " + steps.length;
      text.textContent = steps[index].text;
      back.disabled = index === 0;
      next.textContent = index === steps.length - 1 ? "Finish" : "Next";
      show(steps[index]);
    }

    function stop() {
      clearTimer();
      card.hidden = true;
    }

    function start() {
      card.hidden = false;
      go(0);
      next.focus();
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !card.hidden) stop();
    });

    return { start, stop };
  }

  window.UiTour = { create };
})();
