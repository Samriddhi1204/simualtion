(function () {
  const ICONS = { problem: "✖", fixed: "✔", warn: "⚠", neutral: "ℹ" };

  function append(node, children) {
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
  }

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? "" : value);
    });
    append(node, children);
    return node;
  }

  function clear(node) {
    node.replaceChildren();
    return node;
  }

  function button(label, onClick, options) {
    const settings = options || {};
    return el("button", { type: "button", class: "btn " + (settings.class || ""), onClick, disabled: settings.disabled, title: settings.title }, label);
  }

  function badge(kind, text) {
    return el("span", { class: "badge badge-" + kind }, el("span", { "aria-hidden": "true", text: ICONS[kind] }), " ", text);
  }

  function number(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function slider(label, min, max, value, onInput) {
    const output = el("output", { class: "slider-value", text: number(value) });
    const input = el("input", { type: "range", min, max, value, "aria-label": label });
    input.addEventListener("input", () => {
      output.textContent = number(Number(input.value));
      onInput(Number(input.value));
    });
    const wrapper = el("label", { class: "control" }, el("span", { class: "control-label", text: label }), input, output);
    return { element: wrapper, input, set(next) {
      input.value = next;
      output.textContent = number(next);
    } };
  }

  function speedControl(ctx) {
    const buttons = ctx.clockSpeeds.map((speed) => el("button", { type: "button", class: "btn btn-small", onClick: () => ctx.setSpeed(speed) }, speed + "x"));
    function refresh() {
      buttons.forEach((node, index) => node.setAttribute("aria-pressed", String(ctx.clockSpeeds[index] === ctx.clock.speed())));
    }
    ctx.onSpeedChange(refresh);
    refresh();
    return el("div", { class: "speed-control", role: "group", "aria-label": "Simulation speed" }, buttons);
  }

  function logFixChange(ctx, content, state, key) {
    if (key === null) {
      const allOn = content.fixes.every((fix) => state[fix.key]);
      ctx.log.add(allOn ? "ok" : "warn", content.nav + ": " + (allOn ? "all fixes switched on" : "all fixes switched off, back to the Problem state"));
      return;
    }
    const fix = content.fixes.find((item) => item.key === key);
    ctx.log.add(state[key] ? "ok" : "warn", content.nav + ": fix " + (state[key] ? "on" : "off") + ": " + fix.name);
  }

  function detailsSection(title, body, extraClass) {
    return el("details", { class: "details " + (extraClass || "") }, el("summary", { text: title }), body);
  }

  function demoFrame(spec) {
    const content = spec.content;
    const stage = el("div", { class: "stage" });
    const caption = el("p", { class: "caption", "aria-live": "polite" });
    const chips = el("ul", { class: "chips", "aria-label": "Fixes applied" });
    const hasFixes = Array.isArray(content.fixes);

    function refreshChips(state) {
      clear(chips);
      const on = content.fixes.filter((fix) => state[fix.key]);
      if (on.length === 0) chips.append(el("li", { class: "chip chip-none" }, badge("problem", "None (Problem state)")));
      on.forEach((fix) => chips.append(el("li", { class: "chip" }, badge("fixed", fix.name))));
    }

    const toggle = hasFixes
      ? window.UiToggle.create({
          fixes: content.fixes,
          onChange: (state, key) => {
            refreshChips(state);
            spec.onFixesChange(state, key);
          }
        })
      : null;
    if (hasFixes) refreshChips(toggle.getState());

    const tryList = el("ol", { class: "try-list" }, content.tryIt.map((step) => el("li", { text: step })));
    const root = el(
      "article",
      { class: "demo", "aria-labelledby": "title-" + content.id },
      el("h2", { id: "title-" + content.id, text: content.nav + ". " + content.title }),
      el("section", { class: "section problem-line" }, el("h3", { text: "The problem in one line" }), el("p", { text: content.problemLine })),
      el("section", { class: "section" }, el("h3", { text: "What to try" }), tryList),
      toggle ? el("section", { class: "section" }, el("h3", { text: "Problem or Fixed" }), toggle.element) : null,
      el("section", { class: "section" }, stage),
      hasFixes
        ? el(
            "section",
            { class: "section" },
            el("h3", { text: "What you're seeing" }),
            caption,
            el("h3", { text: "Fixes applied" }),
            chips
          )
        : null,
      hasFixes ? buildDetails(content) : null,
      el("section", { class: "section" }, button("Reset this demo", spec.onReset, { class: "btn-reset" }))
    );

    return {
      root,
      stage,
      toggle,
      setCaption(text) {
        caption.textContent = text;
      }
    };
  }

  function buildDetails(content) {
    const issues = el("ol", { type: "a", class: "issue-list" }, content.issues.map((issue) => el("li", { text: issue })));
    return el(
      "section",
      { class: "section" },
      detailsSection("Possible issues", issues),
      content.confirm ? detailsSection("How I'd confirm the cause", el("p", { text: content.confirm })) : null,
      detailsSection("Trade-off", el("p", { text: content.tradeoff }))
    );
  }

  function buildOverview(content, demos, onOpen) {
    const nodes = [
      { key: "students", label: "Students", x: 30, y: 190, w: 170, h: 70 },
      { key: "site", label: "Homework site", x: 330, y: 180, w: 190, h: 90 },
      { key: "teacher", label: "Teacher who grades", x: 620, y: 50, w: 170, h: 70 },
      { key: "helper", label: "Live-help teacher", x: 620, y: 310, w: 170, h: 70 },
      { key: "classes", label: "Live classes", x: 330, y: 20, w: 190, h: 60 },
      { key: "chat", label: "Group chat per group", x: 30, y: 360, w: 170, h: 60 },
      { key: "board", label: "Point board", x: 330, y: 360, w: 190, h: 60 }
    ];
    const edges = [["students", "site"], ["site", "teacher"], ["site", "helper"], ["students", "classes"], ["students", "chat"], ["site", "board"]];
    const pins = [
      { id: "q1", x: 340, y: 178, hint: "Many students hit the server" },
      { id: "q2", x: 570, y: 150, hint: "Reports get stuck" },
      { id: "q3", x: 510, y: 232, hint: "Homework gets swapped" },
      { id: "q4", x: 610, y: 340, hint: "Live help session overfills" },
      { id: "q5", x: 265, y: 215, hint: "No cross-verification" },
      { id: "q6", x: 510, y: 372, hint: "Leaderboard rank" }
    ];

    function nodeOf(key) {
      return nodes.find((item) => item.key === key);
    }

    const edgeMarkup = edges
      .map(([from, to]) => {
        const a = nodeOf(from);
        const b = nodeOf(to);
        return `<line x1="${a.x + a.w / 2}" y1="${a.y + a.h / 2}" x2="${b.x + b.w / 2}" y2="${b.y + b.h / 2}" class="diagram-edge"></line>`;
      })
      .join("");
    const nodeMarkup = nodes
      .map(
        (item) =>
          `<g class="diagram-node"><rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" rx="12"></rect><text x="${item.x + item.w / 2}" y="${item.y + item.h / 2 + 5}" text-anchor="middle">${item.label}</text></g>`
      )
      .join("");
    const pinMarkup = pins
      .map((pin) => {
        const demo = demos[pin.id];
        return `<g class="diagram-pin" data-demo="${pin.id}" tabindex="0" role="button" aria-label="Open ${demo.nav}: ${demo.title}"><title>${demo.nav}: ${demo.title}</title><circle cx="${pin.x}" cy="${pin.y}" r="20"></circle><text x="${pin.x}" y="${pin.y + 5}" text-anchor="middle">${demo.nav}</text></g>`;
      })
      .join("");
    const figure = el("div", { class: "overview-figure" });
    figure.innerHTML = `<svg viewBox="0 0 820 440" role="group" aria-label="Diagram of the platform with the six problems pinned to it" class="overview-svg">${edgeMarkup}${nodeMarkup}${pinMarkup}</svg>`;
    figure.querySelectorAll(".diagram-pin").forEach((group) => {
      const open = () => onOpen(group.getAttribute("data-demo"));
      group.addEventListener("click", open);
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    const legend = el(
      "ul",
      { class: "pin-legend" },
      pins.map((pin) => el("li", null, button(demos[pin.id].nav + ": " + demos[pin.id].title, () => onOpen(pin.id), { class: "btn-link" })))
    );
    return el(
      "article",
      { class: "demo overview" },
      el("h2", { text: content.title }),
      el("p", { text: content.purpose }),
      el("section", { class: "section" }, figure),
      el("section", { class: "section" }, el("h3", { text: "The six problems" }), legend, button("Q7. Other problems", () => onOpen("q7"), { class: "btn-link" })),
      el("section", { class: "section" }, el("h3", { text: "How to use this page" }), el("ol", { class: "try-list" }, content.howTo.map((step) => el("li", { text: step }))), el("p", { class: "illustrative", text: content.illustrative }))
    );
  }

  window.UiLayout = { el, clear, button, badge, slider, number, speedControl, demoFrame, buildOverview, logFixChange, ICONS };
})();
