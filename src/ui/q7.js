(function () {
  const STUDENTS = [
    { id: "S-101", name: "Aarav Sharma", initials: "A.S.", email: "aarav.sharma@example.org" },
    { id: "S-102", name: "Meera Iyer", initials: "M.I.", email: "meera.iyer@example.org" }
  ];
  const ROLE_LABELS = { student: "Student", teacher: "Teacher", liveHelp: "Live-help teacher" };

  function formatOffset(seconds) {
    const rounded = Math.round(Math.abs(seconds));
    const text = Math.floor(rounded / 60) + ":" + String(rounded % 60).padStart(2, "0");
    return seconds > 0 ? text + " after the deadline" : text + " before the deadline";
  }

  function formatSeconds(seconds) {
    return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
  }

  function create(ctx) {
    const { el, fill, button, badge, slider, demoFrame } = window.UiLayout;
    const model = window.SimQ7;
    const content = ctx.content.demos.q7;
    const captions = ctx.content.captions.q7;
    const cards = [];

    const frame = demoFrame({ content, onReset: () => resetAll(true) });

    function makeCard(cardContent, builder) {
      let fixed = false;
      const caption = el("p", { class: "caption", "aria-live": "polite" });
      const body = el("div", { class: "card-body" });
      const toggle = window.UiToggle.create({
        fixes: [{ key: "fixed", name: "Fixed", text: "" }],
        showSwitches: false,
        label: cardContent.title + ": Problem or Fixed",
        onChange(state) {
          fixed = state.fixed;
          ctx.log.add(fixed ? "ok" : "warn", "Q7: " + cardContent.title + ": " + (fixed ? "Fixed" : "Problem"));
          part.reset();
          part.render();
        }
      });
      const env = { body, isFixed: () => fixed, setCaption: (text) => (caption.textContent = text), log: (type, text) => ctx.log.add(type, "Q7: " + text) };
      const part = builder(env);
      const element = el(
        "section",
        { class: "panel q7-card" },
        el("h3", { class: "q7-title", text: cardContent.title }),
        el("p", null, el("strong", { text: "Problem: " }), cardContent.problem),
        el("p", null, el("strong", { text: "Fix: " }), cardContent.fix),
        toggle.element,
        body,
        caption
      );
      part.render();
      const card = {
        element,
        tick: part.tick || (() => {}),
        reset() {
          fixed = false;
          toggle.setQuietly(false);
          part.reset();
          part.render();
        },
        setFixed(value) {
          fixed = value;
          toggle.setQuietly(value);
          part.reset();
          part.render();
        }
      };
      cards.push(card);
      return element;
    }

    function doubleCard(env) {
      let box = model.createSubmissionBox();
      let clock = 100;
      const list = el("div");
      const submitButton = button("Submit", () => {
        clock += 0.5;
        const result = model.submit(box, env.isFixed(), clock, "click");
        env.log(result.accepted ? "info" : "warn", result.accepted ? "attempt " + box.attempts.length + " saved" : result.reason);
        if (!result.accepted) env.setCaption(result.reason);
        else render();
        if (!result.accepted) renderList();
      }, { class: "btn-primary" });
      const resubmit = button("Resubmit (new attempt)", () => resubmitAt(clock + 60));
      const late = button("Resubmit after the deadline", () => resubmitAt(box.deadline + 30));
      function resubmitAt(time) {
        clock = time;
        model.submit(box, env.isFixed(), time, "resubmit");
        env.log("info", "attempt " + box.attempts.length + " saved at " + formatSeconds(time));
        render();
      }
      function renderList() {
        const counted = env.isFixed() ? model.countedAttempt(box) : null;
        const seen = model.teacherSees(box, env.isFixed());
        fill(list, 
          el("p", { class: "muted", text: "Deadline " + formatSeconds(box.deadline) + ". Attempts saved: " + box.attempts.length }),
          el("ul", { class: "plain-list" }, box.attempts.map((item) => el("li", null, "Attempt " + item.attempt + " at " + formatSeconds(item.time) + (item.time > box.deadline ? " (after the deadline)" : ""), counted && counted.attempt === item.attempt ? badge("fixed", "Counted") : null))),
          el("p", { class: "muted", text: "Teacher sees: " + (seen.length ? seen.map((item) => "attempt " + item.attempt).join(", ") : "nothing") + (env.isFixed() ? "" : box.attempts.length > 1 ? " and opens attempt 1, the wrong one" : "") })
        );
      }
      function render() {
        submitButton.setAttribute("aria-disabled", String(env.isFixed() && box.disabled));
        submitButton.classList.toggle("is-disabled", env.isFixed() && box.disabled);
        renderList();
        const counted = env.isFixed() ? model.countedAttempt(box) : null;
        env.setCaption(captions.double({ fixed: env.isFixed(), copies: box.attempts.length, counted: counted ? counted.attempt : 0 }));
      }
      env.body.append(el("div", { class: "button-row" }, submitButton, resubmit, late), list);
      return { render, reset() {
        box = model.createSubmissionBox();
        clock = 100;
      } };
    }

    function deadlineCard(env) {
      const input = { actualStart: -30, uploadSeconds: 120, clockShift: 0 };
      const startSlider = slider("Real upload start (seconds from the deadline)", -120, 300, input.actualStart, (value) => {
        input.actualStart = value;
        render();
      });
      const durationSlider = slider("Upload duration in seconds (slow internet)", 0, 300, input.uploadSeconds, (value) => {
        input.uploadSeconds = value;
        render();
      });
      const shiftSlider = slider("Device clock shift in seconds (drag earlier)", -600, 0, input.clockShift, (value) => {
        input.clockShift = value;
        render();
      });
      const verdict = el("div");
      const slots = el("div");
      function render() {
        const result = model.judgeDeadline(input, env.isFixed());
        fill(verdict, 
          el("p", null, "Decision made with the " + result.basis + ": " + formatOffset(result.shownTime) + "."),
          el("p", null, result.onTime ? badge("fixed", "On time") : badge("problem", "Late")),
          el("p", { class: "muted", text: "Truth: upload starts " + formatOffset(input.actualStart) + " and finishes " + formatOffset(input.actualStart + input.uploadSeconds) + "." })
        );
        if (env.isFixed()) {
          const groups = ["A", "B", "C"];
          fill(slots, 
            el("p", { class: "muted", text: "Deadline stored per slot, every slot 60 minutes, slots rotate across assignments:" }),
            el("table", { class: "mini-table" }, el("tr", null, ["Slot", "Assignment 1", "Assignment 2"].map((head) => el("th", { text: head }))), [0, 1, 2].map((index) => el("tr", null, el("td", { text: "Slot " + (index + 1) }), el("td", { text: "Group " + model.slotSchedule(groups, 0)[index].group }), el("td", { text: "Group " + model.slotSchedule(groups, 1)[index].group }))))
          );
        } else fill(slots, );
        env.setCaption(captions.deadline({ fixed: env.isFixed(), onTime: result.onTime }));
      }
      env.body.append(el("div", { class: "controls" }, startSlider.element, durationSlider.element, shiftSlider.element), verdict, slots);
      return { render, reset() {} };
    }

    function noShowCard(env) {
      let seat = model.createSeatCase();
      const view = el("div");
      const advance = button("Advance 2 minutes", () => {
        model.advanceSeat(seat, model.SEAT_CONFIRM_SECONDS, env.isFixed());
        env.log("info", "seat clock moved 2 minutes");
        render();
      });
      const confirm = button("Seat holder confirms", () => {
        seat.confirmed = true;
        env.log("ok", seat.holder.name + " confirmed the seat");
        render();
      });
      function render() {
        const order = model.waitingOrder(seat, env.isFixed());
        const left = Math.max(0, model.SEAT_CONFIRM_SECONDS - seat.now);
        fill(view, 
          el("p", null, el("strong", { text: "Seat holder: " + seat.holder.name }), seat.confirmed ? badge("fixed", "Confirmed") : env.isFixed() ? badge("warn", "Confirm in " + formatSeconds(left)) : badge("problem", "Has not shown up")),
          env.isFixed() ? null : el("p", { class: "muted", text: "Seat wasted for " + Math.round(model.wastedSeconds(seat, false)) + " seconds while others wait." }),
          el("ol", { class: "plain-list" }, order.map((item) => el("li", { text: item.name + (item.noShows ? " (" + item.noShows + " earlier no-show, lower priority)" : "") })))
        );
        env.setCaption(captions.noshow({ fixed: env.isFixed(), released: seat.released, holder: seat.holder.name, previous: seat.waiting[seat.waiting.length - 1].name, wasted: Math.round(model.wastedSeconds(seat, false)) }));
      }
      env.body.append(el("div", { class: "button-row" }, advance, confirm), view);
      return {
        render,
        reset() {
          seat = model.createSeatCase();
        },
        tick(seconds) {
          model.advanceSeat(seat, seconds, env.isFixed());
          render();
        }
      };
    }

    function privacyCard(env) {
      let requestedId = "S-101";
      let role = "student";
      let allowed = true;
      let link = model.createLink(0);
      let linkTime = 0;
      const urlInput = el("input", { type: "text", class: "text-input", value: requestedId, "aria-label": "Student ID in the address" });
      const roleSelect = el("select", { class: "select", "aria-label": "Signed in as" }, model.ROLES.map((key) => el("option", { value: key, text: ROLE_LABELS[key] })));
      const view = el("div");
      const openButton = button("Open homework", () => {
        requestedId = urlInput.value.trim() || "S-101";
        role = roleSelect.value;
        const result = model.openHomework({ role, viewerId: "S-101", requestedId }, env.isFixed());
        allowed = result.allowed;
        env.log(allowed ? "warn" : "ok", "role " + ROLE_LABELS[role] + " (S-101) asked for " + requestedId + ": " + result.message);
        render();
      }, { class: "btn-primary" });
      function accessTable() {
        return el("table", { class: "mini-table" }, el("tr", null, ["Role", "Own homework", "Any student's homework", "Recent marks"].map((head) => el("th", { text: head }))), model.ROLE_TABLE.map((row) => el("tr", null, el("td", { text: row.label }), [row.own, row.others, row.marks].map((yes) => el("td", { text: yes ? "✔ yes" : "✖ no" })))));
      }
      function render() {
        const fixed = env.isFixed();
        const left = model.linkSecondsLeft(link, linkTime);
        fill(view, 
          el("p", { class: "address" }, "Address: /homework/", el("strong", { text: requestedId })),
          el("p", null, allowed ? badge(fixed ? "fixed" : "problem", fixed ? "Allowed" : "Opened") : badge("fixed", "Access denied"), " ", allowed && requestedId !== "S-101" && !fixed ? "Another student's homework opened by changing the ID." : ""),
          el("p", { class: "muted", text: "Leaderboard shows: " + STUDENTS.map((student) => model.leaderboardName(student, fixed)).join(", ") }),
          el("p", { class: "muted log-sample", text: "Log line: " + model.logLine(STUDENTS[1], fixed) }),
          el("p", { class: "muted", text: "Parent consent at signup: " + (fixed ? "recorded" : "not asked") }),
          el("p", { class: "muted", text: fixed ? "PDF opens through a private short-lived link, expires in " + formatSeconds(left) : "PDF sits in public storage: the link never expires" }),
          fixed ? accessTable() : null
        );
        env.setCaption(captions.privacy({ allowed, requestedId }));
      }
      env.body.append(el("div", { class: "button-row" }, el("label", { class: "control-label" }, "Student ID in the address ", urlInput), el("label", { class: "control-label" }, "Signed in as ", roleSelect), openButton), view);
      return {
        render,
        reset() {
          requestedId = "S-101";
          role = "student";
          allowed = true;
          urlInput.value = "S-101";
          roleSelect.value = "student";
          link = model.createLink(0);
          linkTime = 0;
        },
        tick(seconds) {
          if (!env.isFixed()) return;
          linkTime += seconds;
          if (linkTime > link.expiresAt) {
            link = model.createLink(linkTime);
          }
          render();
        }
      };
    }

    function overloadCard(env) {
      let queue = [];
      let graded = [];
      let absent = false;
      let message = "";
      const view = el("div");
      const absentInput = el("input", { type: "checkbox", onChange: () => {
        absent = absentInput.checked;
        env.log(absent ? "warn" : "info", "Teacher absent: " + (absent ? "on" : "off"));
        render();
      } });
      const nextButton = button("Next submission", nextSubmission, { class: "btn-primary" });
      function load() {
        const all = model.createQueue(7);
        const split = model.splitFlagged(all, env.isFixed());
        queue = model.orderQueue(split.toTeacher, env.isFixed(), 7);
        flagged = split.flagged;
        graded = [];
        message = "";
      }
      let flagged = [];
      function nextSubmission() {
        const grader = model.nextGrader(absent, env.isFixed());
        if (!grader || queue.length === 0) {
          message = grader ? "" : "Nobody is grading";
          env.log("warn", grader ? "queue is empty" : "grading is stopped: the teacher is absent");
          render();
          return;
        }
        const sub = queue.shift();
        graded.push(sub);
        message = grader;
        env.log("ok", sub.id + " marked by " + grader);
        render();
      }
      function applySnippet(text) {
        const last = graded[graded.length - 1];
        if (!last) return;
        last.snippet = text;
        env.log("info", "comment snippet \"" + text + "\" applied to " + last.id);
        render();
      }
      function render() {
        const fixed = env.isFixed();
        nextButton.textContent = "Next submission";
        fill(view, 
          el("p", { class: "muted", text: "Waiting to be graded (" + queue.length + "): " + queue.map((sub) => sub.id + " (" + sub.hoursLeft + "h left)").join(", ") }),
          fixed ? el("p", { class: "muted", text: "Auto-flagged before the teacher: " + flagged.map((sub) => sub.id + " " + model.autoFlag(sub)).join(", ") }) : null,
          el("p", { class: "muted", text: "Graded: " + graded.map((sub) => sub.id + (sub.snippet ? " [" + sub.snippet + "]" : "")).join(", ") }),
          fixed ? el("div", { class: "button-row" }, model.SNIPPETS.map((text) => button(text, () => applySnippet(text), { class: "btn-small" }))) : null,
          fixed ? el("p", { class: "muted", text: "Common mistakes: " + (model.commonMistakes(graded).map((row) => row.snippet + " x" + row.count).join(", ") || "none yet") }) : null,
          el("p", { class: "muted", text: fixed ? "Staggered deadlines: 30 submissions become " + model.spreadLoad(30, 5).join(", ") + " over 5 slots" : "Everything is due at once, so the single teacher is overloaded." })
        );
        env.setCaption(captions.overload({ grader: message === "Nobody is grading" ? "" : message, stopped: message === "Nobody is grading" }));
      }
      env.body.append(el("div", { class: "button-row" }, el("label", { class: "check" }, absentInput, " Teacher absent"), nextButton), view);
      load();
      return {
        render,
        reset() {
          absent = false;
          absentInput.checked = false;
          load();
        }
      };
    }

    const builders = { double: doubleCard, deadline: deadlineCard, noshow: noShowCard, privacy: privacyCard, overload: overloadCard };
    const grid = el("div", { class: "q7-grid" }, content.cards.map((item) => makeCard(item, builders[item.key])));
    frame.stage.append(grid);

    function resetAll(announce) {
      cards.forEach((card) => card.reset());
      if (announce) ctx.log.add("info", "Q7 reset");
    }

    return {
      element: frame.root,
      tick: (seconds) => cards.forEach((card) => card.tick(seconds)),
      reset: () => resetAll(false),
      onShow() {},
      showcase(fixed) {
        cards.forEach((card) => card.setFixed(fixed));
      }
    };
  }

  window.UiQ7 = { create };
})();
