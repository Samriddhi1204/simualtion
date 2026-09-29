(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HomeworkContent = factory();
})(this, function () {
  const assumptions = [
    "One teacher grades everything",
    "One live-help teacher",
    "Live classes with 1,000 to 1,500 students, class size varies",
    "Live help opens after class and the video part is already built",
    "Homework is a size-limited PDF",
    "Leaderboard ranks by marks with finishing time as tiebreaker",
    "One homework per student per week"
  ];

  const overview = {
    title: "Overview",
    purpose: "Cause each problem yourself, watch it break, then switch the fix on and watch it work.",
    howTo: [
      "Pick a problem in the diagram or the sidebar.",
      "Break it: follow the steps under What to try.",
      "Switch the fix on with the Fixed toggle, or one fix switch at a time."
    ],
    illustrative: "Numbers used inside the animations, such as load levels and timings, are illustrative.",
    tour: "This diagram shows the whole platform, and each numbered pin marks where one problem happens."
  };

  const demos = {
    q1: {
      id: "q1",
      nav: "Q1",
      title: "Many students hit the server at the same time",
      problemLine: "Everyone submits near the deadline, so one server is overwhelmed and the site goes down.",
      tour: "Q1: 1,500 students hit one server at the deadline and it goes down; the fixes spread and cushion the load.",
      tryIt: [
        "Leave the slider at 1,500 and press Everyone submits now to watch the load bar pass 100 percent.",
        "Press Kill one server and see the site go Down.",
        "Turn on Fixed, or switch on one fix at a time, and run it again."
      ],
      issues: [
        "Everything runs on a single server, so CPU or memory runs out near the deadline",
        "Heavy work (saving and processing the PDF) happens inside the request, so requests take long and pile up",
        "Slow database queries, for example fetching submissions with no index",
        "No limit on how often one student (or a script) can call the server",
        "Everyone has the same deadline, so all hit the server together"
      ],
      fixes: [
        { key: "rateLimit", name: "Rate limiting per student", text: `Rate limiting per student (for example 60 requests a minute), with a "try again in a moment" message` },
        { key: "loadBalancer", name: "Load balancer with 2 or more copies", text: "Load balancer (like Nginx) with 2 or more copies of the server, so one failure does not take the site down" },
        { key: "queue", name: "Background queue", text: `Background queue: the request only saves the file and replies "received", the rest happens in the background` },
        { key: "index", name: "Database index on studentId and assignmentId", text: "Database index on studentId and assignmentId" },
        { key: "staggered", name: "Staggered deadlines", text: "Staggered deadlines: students split into slots with a gap between them, each slot gets the same amount of time, deadline stored per student or slot" },
        { key: "reminders", name: "Reminders before each deadline", text: "Reminders before each deadline so submissions do not bunch up at the last minute" }
      ],
      confirm: "Check CPU and memory at peak time, request duration in the logs, and the slowest queries.",
      tradeoff: `A few students may see "try again" during a spike, but the site stays up. Slots must feel fair, so rotate them across assignments.`,
      slotsCaption: "Slots must feel fair, so rotate them across assignments"
    },
    q2: {
      id: "q2",
      nav: "Q2",
      title: "Reports get stuck and never get evaluated",
      problemLine: "A submission can sit in evaluating forever, and nobody is told.",
      tour: "Q2: reports freeze in Evaluating with nobody notified; the fixes track, log, recover and surface every stuck card.",
      tryIt: [
        "Press Submit 5 homeworks and watch the cards move from Queue to Evaluating to Marked.",
        "Press Crash the server now while a card is in Evaluating, then Submit a corrupted PDF.",
        "Turn on Fixed, repeat, then click any card to find the cause in its log trail."
      ],
      issues: [
        "A job was picked up, then the server restarted or the code errored, and the status was never updated",
        "The submission was saved but adding it to the queue failed, so the evaluator never heard about it",
        "One bad file (corrupted PDF) crashed the process and blocked the jobs behind it",
        "The queue was full and new jobs were dropped",
        `No timeout, so "evaluating" can last forever`
      ],
      fixes: [
        { key: "status", name: "Status field", text: "Status field: unmarked -> evaluating -> marked. Only unmarked items get picked up" },
        { key: "logging", name: "Step-by-step logging", text: "Step-by-step logging: every step (received, saved, queued, picked up, marked) prints a log line with the submission ID and time" },
        { key: "recovery", name: "Auto-recovery", text: "Auto-recovery: if a submission stays in evaluating for more than 10 minutes, it goes back to unmarked" },
        { key: "queueCheck", name: "Queue check", text: `Queue check: if queueing fails, show the student an error instead of a false "submitted"` },
        { key: "uploadChecks", name: "Upload checks", text: "Upload checks: reject corrupted or empty PDFs so a bad file never enters the queue" },
        { key: "queueSize", name: "Queue size", text: "Queue size: watch how many items are waiting, if it keeps growing run more background processors or raise the queue limit" },
        { key: "resultsTable", name: "Results table", text: "Results table: finished work moves out of the queue into a separate results table" },
        { key: "oneJob", name: "One job per student", text: "One job per student: each submission is its own job tied to that student's ID, so one stuck report cannot block or mix with another" },
        { key: "pendingList", name: "Pending too long list", text: `"Pending too long" list for the teacher` },
        { key: "popup", name: "Teacher popup", text: `Teacher popup: "Are you sure?" with the score shown before grades are submitted (prevents accidents, does not fix stuck reports)` }
      ],
      confirm: "Search the logs for the stuck submission's ID and see the last step it reached. Saved but never queued means a queueing problem. Started evaluating and stopped means a crash or error.",
      tradeoff: "More statuses and logs mean a bit more code, but nothing disappears silently."
    },
    q3: {
      id: "q3",
      nav: "Q3",
      title: "Students' homework gets swapped",
      problemLine: "Two students upload at the same moment and one sees the other's homework.",
      tour: "Q3: two students upload together and their homework is swapped; the fixes keep every file and record separate.",
      tryIt: [
        "Pick scenario a, then press Both upload at the same moment and read what the teacher sees.",
        "Step through scenarios b to e with the tabs and press the button in each.",
        "Turn on Fixed, or switch on one fix at a time, and press the button again."
      ],
      issues: [
        "Every upload is saved under the same file name (like homework.pdf), so simultaneous uploads overwrite each other",
        "The code finds a submission by assignment ID only, not student ID, and returns the wrong record",
        "A shared or global variable on the server holds data, so two requests at the same time overwrite each other's values",
        "Caching by assignment only, so one student's data is served to another",
        "Two evaluators pick the same document"
      ],
      fixes: [
        { key: "uniqueNames", name: "Unique file names", text: "Unique file names: studentId_assignmentId_timestamp.pdf" },
        { key: "lookupBoth", name: "Look up by studentId and assignmentId", text: "Always look up by both studentId and assignmentId" },
        { key: "uniqueRule", name: "Unique rule in the database", text: "Unique rule in the database on studentId + assignmentId (+ attempt), so one record cannot overwrite another" },
        { key: "prisma", name: "Prisma for queries", text: "Prisma for queries, so they are written in a consistent, checked way" },
        { key: "noGlobals", name: "No student data in global variables", text: "No student data in global variables on the server" },
        { key: "atomicClaim", name: "Status check in one step", text: "Status check: skip anything already marked, and change unmarked to evaluating in one step so two processes never pick the same document" }
      ],
      confirm: "Check how files are named, how the lookup query is written, and whether any variable is shared across requests, then reproduce it with two test students uploading at the same moment.",
      tradeoff: "Slightly stricter saving rules, but swapping is prevented at the database level, not only in code.",
      scenarios: [
        { key: "a", label: "a) Same file name" },
        { key: "b", label: "b) Lookup by assignment only" },
        { key: "c", label: "c) Shared variable" },
        { key: "d", label: "d) Cache by assignment only" },
        { key: "e", label: "e) Two evaluators, one document" }
      ]
    },
    q4: {
      id: "q4",
      nav: "Q4",
      title: "Two groups of 20 try to join the same live help session at once",
      problemLine: "Two students see 19 seats taken and both get in, so the session has 21.",
      tour: "Q4: two students grab the last seat and the session hits 21 of 20; the fixes give one seat and a waiting list.",
      tryIt: [
        "Press Fill to 19, then Two students click Join together.",
        "Press Join without logging in, then Two groups of 20 join together.",
        "Turn on Fixed, repeat, then click a seated student to free a seat and Advance 2 minutes."
      ],
      issues: [
        `The code checks "fewer than 20?" and adds the student as two separate steps, so two students clicking together both see 19 and both get in, making it 21`,
        "Both groups are told there is room",
        "The capacity is hard-coded, with no waiting list as a fallback",
        "Anyone can try to join without logging in",
        "Students who need help most may miss out"
      ],
      fixes: [
        { key: "authenticate", name: "Authenticate", text: "Authenticate every student before joining" },
        { key: "reserve", name: "Reserve the seat in one step", text: "Reserve the seat in one database step, so only one student gets the last seat and the other gets a clear message" },
        { key: "capacity", name: "Capacity as a setting", text: "Capacity as a setting, not a fixed 20" },
        { key: "waitingList", name: "Waiting list", text: "Waiting list: students without a seat see their position and move up automatically when a seat frees up" },
        { key: "selection", name: "Selection by recent marks with rotation", text: "Selection by marks in the last few tests, with rotation so the same students do not always get priority" },
        { key: "balancing", name: "Load balancing", text: "Load balancing so the join page does not slow down" },
        { key: "listenOnly", name: "Listen-only option", text: "Listen-only option for waiting students" },
        { key: "noShow", name: "No-show release", text: "No-show release: if a student does not confirm within 2 minutes, the seat goes to the next in line" }
      ],
      confirm: "Log every join request with its time and the current count, and check whether two requests read the same count.",
      tradeoff: "The live-help teacher can only handle so many students, which is why the waiting list is needed."
    },
    q5: {
      id: "q5",
      nav: "Q5",
      title: "No cross-verification",
      problemLine: "The system trusts whatever comes in: any upload is accepted and any score is saved.",
      tour: "Q5: uploads and scores are accepted unchecked with no record; the fixes add checks, summaries, receipts and history.",
      tryIt: [
        "On the student side pick notes.txt and press Submit, then submit the same file twice.",
        "On the teacher side type a score, press Save and look at the history area.",
        "Turn on Fixed and repeat: read the rejection reasons, confirm the summary and edit a score twice."
      ],
      issues: [
        "The system trusts whatever comes in: any upload is accepted and any score is saved",
        "No summary or confirmation before submitting",
        "No record of who changed what, so mistakes cannot be traced",
        "No receipt, so students and teacher cannot verify a submission later",
        "The same file can be uploaded twice with no warning"
      ],
      fixes: [
        { key: "fileChecks", name: "File checks at upload", text: "File checks at upload: PDF only, size limit, not empty or corrupted" },
        { key: "summary", name: "Summary screen before submitting", text: "Summary screen before the student submits (name, assignment, file name, size, time), then confirm" },
        { key: "receipt", name: "Receipt", text: "Receipt with submission ID and time after submitting" },
        { key: "teacherPopup", name: "Teacher summary and popup", text: "Teacher summary and popup before final grades are saved (student, assignment, score, comments)" },
        { key: "duplicate", name: "Duplicate check", text: "Duplicate check: flag the same file uploaded twice" },
        { key: "history", name: "History of changes", text: "History of changes: who, when, old value, new value" }
      ],
      confirm: "This is mostly a design gap, so walk through the flow and list every point where data enters without being checked.",
      tradeoff: "One extra click for students and teacher, but far fewer mistakes.",
      gapCaption: "This is mostly a design gap: the warning markers show every point where data enters without being checked, and turn green once checked."
    },
    q6: {
      id: "q6",
      nav: "Q6",
      title: "Leaderboard: seeing rank before everything is checked",
      problemLine: "Ranks appear only after every submission is graded, so students wait with no information.",
      tour: "Q6: the board stays empty until all 1,500 are graded; the fixes show a live, provisional, private ranking.",
      tryIt: [
        "Press Auto-confirm and watch the board stay on Results pending while grades arrive.",
        "Let it run to the end to see the slow load of 1,500 rows with real names.",
        "Press Reset, turn on Fixed, press Auto-confirm again and try Jump to my rank and Show nicknames."
      ],
      issues: [
        "Ranks appear only after every submission is graded, so students wait with no information",
        "Students whose work is not evaluated yet see nothing",
        "The board loads slowly with 1,500 rows",
        "The public board shows real names of children"
      ],
      fixes: [
        { key: "showAll", name: "Show all students, own row highlighted", text: "Show all students, with the student's own row highlighted" },
        { key: "progress", name: "Progress line", text: `Progress line: "Evaluated: 640 of 1,500"` },
        { key: "provisionalRank", name: "Provisional rank so far", text: `Rank among evaluated so far: "Your rank: 212 of 640 evaluated", labelled provisional` },
        { key: "statusPill", name: "Own status", text: "If the student's own work is not evaluated yet, show its status: submitted -> under review -> evaluated" },
        { key: "realtime", name: "Real-time updates", text: "Real-time updates with WebSockets each time the teacher confirms a grade" },
        { key: "twoBoards", name: "Batch and global boards", text: "Two boards: batch and global, ranked by marks with finishing time as tiebreaker" },
        { key: "paging", name: "Pages and jump to my rank", text: `Pages or scrolling with a "jump to my rank" button` },
        { key: "nicknames", name: "Nickname or initials option", text: "Nickname or initials option for privacy" }
      ],
      confirm: null,
      tradeoff: "Provisional ranks can move up or down, but students would rather see a moving rank than nothing.",
      socketNote: "A WebSocket keeps a live connection open so the server can push each confirmed grade to the page. This demo only describes it and opens no connection."
    },
    q7: {
      id: "q7",
      nav: "Q7",
      title: "Other problems",
      problemLine: "Five smaller problems that show up around the main six.",
      tour: "Q7: five smaller problems, each with its own Problem and Fixed toggle and one tiny interaction.",
      tryIt: [
        "In each card, leave the toggle on Problem and try the interaction.",
        "Switch the card to Fixed and try the same interaction again."
      ],
      cards: [
        {
          key: "double",
          title: "Double submissions and resubmissions",
          problem: "Two copies saved, teacher grades the wrong one.",
          fix: `Button disables after the first click, duplicate rejected, attempts listed (attempt 1, 2), latest before the deadline counted and marked "Counted", older ones kept, teacher sees only the counted version.`
        },
        {
          key: "deadline",
          title: "Deadline unfairness and time cheating",
          problem: "The deadline check uses the device clock, so a late upload looks on time; slow internet makes an on-time student look late.",
          fix: "Server time decides, the upload start time is recorded as well as the finish time, the deadline is stored per student or slot, every slot gets the same amount of time, and slots rotate across assignments."
        },
        {
          key: "noshow",
          title: "Live help no-shows",
          problem: "Seat wasted while others wait.",
          fix: "Confirm within 2 minutes or release to the next on the waiting list, waiting students see their position, repeated no-shows get lower priority next time."
        },
        {
          key: "privacy",
          title: "Privacy of minors and access control",
          problem: "Changing the ID opens another student's homework, the leaderboard shows real names, logs contain names and emails.",
          fix: "Parent consent at signup, nickname or initials, role-based access, role checked on every request, logs show IDs only, PDFs in private storage opened through short-lived links."
        },
        {
          key: "overload",
          title: "Single teacher dependency and overload",
          problem: `Random order, urgent ones wait, and a "Teacher absent" toggle stops grading.`,
          fix: `Queue sorted by deadline with a "Next submission" button, saved comment snippets applied in one click, auto-flags for late, blank or duplicate files before they reach the teacher, backup access for the live-help teacher or an admin, a per-assignment "common mistakes" summary, and staggered deadlines spreading the load.`
        }
      ]
    }
  };

  function plural(count, singular, pluralForm) {
    return count === 1 ? singular : pluralForm;
  }

  function number(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  const captions = {
    q1(info) {
      const servers = info.running + " " + plural(info.running, "server", "servers");
      const slots = info.slots + " " + plural(info.slots, "deadline slot", "deadline slots");
      const parts = [
        number(info.students) + " students, " + slots + ", " + servers + " running: " + (info.playing ? "load now " : "peak load ") + number(info.loadPercent) + " percent (illustrative)."
      ];
      const endings = {
        down: info.running === 0 ? "No server is running, so the site is down." : "The server is overloaded, so the site is down.",
        slow: "Requests are slow but the site is still up.",
        ok: "The site stays healthy."
      };
      parts.push(endings[info.status]);
      if (info.tryAgain > 0) parts.push(number(info.tryAgain) + ` extra requests from scripts got "try again in a moment" and added no load.`);
      if (info.backlog > 0) parts.push("Up to " + number(info.backlog) + " units of work wait in the background queue and drain later.");
      return parts.join(" ");
    },
    q2(info) {
      if (info.total === 0) return "Nothing submitted yet. Press Submit 5 homeworks to start.";
      const parts = [info.total + " submitted: " + info.marked + " marked, " + info.evaluating + " evaluating, " + info.queued + " waiting in the queue."];
      if (info.frozen > 0) parts.push(info.frozen + " " + plural(info.frozen, "card is", "cards are") + " frozen in Evaluating and nobody has been told.");
      if (info.neverQueued > 0) parts.push(info.neverQueued + " " + plural(info.neverQueued, "card was", "cards were") + ` saved but never queued, yet the student saw "Submitted".`);
      if (info.dropped > 0) parts.push(info.dropped + " dropped silently because the queue was full.");
      if (info.rejected > 0) parts.push(info.rejected + " rejected at upload, so they never entered the queue.");
      return parts.join(" ");
    },
    q3: {
      a(result) {
        return result.fixed
          ? "Each file has its own name, so both are kept and the teacher sees each student's own homework."
          : "Both saved as homework.pdf, the second overwrote the first, and the teacher sees Meera's file under Aarav's name.";
      },
      b(result) {
        return result.fixed
          ? "The lookup uses studentId and assignmentId, so each student gets their own record."
          : "The lookup used the assignment ID only, so it returned the first record for both students.";
      },
      c(result) {
        return result.fixed
          ? "Each request keeps its own local data, so nothing is overwritten."
          : "The shared variable currentSubmission was overwritten between the two requests, so Aarav's record holds Meera's file.";
      },
      d(result) {
        return result.fixed
          ? "The cache key has both ids, so Meera gets her own data."
          : "The cache key is the assignment only, so Meera was served Aarav's cached answer.";
      },
      e(result) {
        return result.fixed
          ? "The status changed from unmarked to evaluating in one step, so one evaluator won and the other skipped the document."
          : "Both evaluators saw unmarked, both claimed the same document and both marked it.";
      },
      idle: "Press Both upload at the same moment to see what happens."
    },
    q4(info) {
      if (info.overCapacity > 0) return "Two students both saw 19 seats taken and both got in, so the session has " + info.seats + " of " + info.capacity + ".";
      if (info.lastLine) return info.lastLine;
      return info.seats + " of " + info.capacity + " seats taken, " + info.waiting + " on the waiting list.";
    },
    q5: {
      student: {
        idle: "Pick a file and press Submit.",
        accepted: "The file was accepted with no check at all and no receipt.",
        rejected: (reason) => "Rejected: " + reason + ".",
        duplicate: "The same file was uploaded twice and the system said nothing.",
        flagged: "Duplicate flagged: this file was already uploaded.",
        receipt: (id) => "Submitted. Your receipt is " + id + "."
      },
      teacher: {
        idle: "Type a score and press Save.",
        saved: "The score was saved instantly and the history shows no record of who changed it.",
        confirmed: "The change was added to the history with who, when, old value and new value."
      }
    },
    q6(info) {
      if (!info.showAll) {
        return info.evaluated < info.total
          ? "Results pending: " + number(info.evaluated) + " of " + number(info.total) + " graded, and students see nothing until every one is done."
          : "Everything is graded, so the board finally appears, with real names and a slow load.";
      }
      if (info.rank) {
        return "You are " + ordinal(info.rank.rank) + " of the " + number(info.rank.of) + " checked so far. This can change as more work is graded.";
      }
      return "Your work is " + info.status + ". " + number(info.evaluated) + " of " + number(info.total) + " are checked so far.";
    },
    q7: {
      double(info) {
        return info.fixed
          ? info.counted ? "Attempt " + info.counted + " is counted. Older attempts are kept and the teacher sees only the counted one." : "No attempt is counted yet."
          : info.copies > 1 ? info.copies + " copies saved, and the teacher opens the wrong one." : "One copy saved so far. Double click Submit.";
      },
      deadline(info) {
        return info.fixed
          ? "Server time decides using the recorded upload start: " + (info.onTime ? "on time." : "late.")
          : "The device clock decides: " + (info.onTime ? "looks on time." : "looks late.");
      },
      noshow(info) {
        return info.fixed
          ? info.released ? info.holder + " has the seat now and " + info.previous + " waits with lower priority." : "The seat holder must confirm within 2 minutes."
          : "The seat has been empty for " + info.wasted + " seconds while others wait.";
      },
      privacy(info) {
        return info.allowed ? "Homework of " + info.requestedId + " opened." : "Access denied: the role check stopped it.";
      },
      overload(info) {
        return info.grader ? info.grader + " marked the next submission." : "Nobody is grading because the teacher is absent.";
      }
    }
  };

  function ordinal(value) {
    const teen = value % 100 >= 11 && value % 100 <= 13;
    const suffixes = { 1: "st", 2: "nd", 3: "rd" };
    return number(value) + (teen ? "th" : suffixes[value % 10] || "th");
  }

  const navLabels = {
    overview: "Overview",
    q1: "Q1 Server load",
    q2: "Q2 Stuck reports",
    q3: "Q3 Swapped homework",
    q4: "Q4 Live help seats",
    q5: "Q5 No verification",
    q6: "Q6 Leaderboard",
    q7: "Q7 Other problems"
  };

  return { assumptions, overview, demos, captions, navLabels, order: ["q1", "q2", "q3", "q4", "q5", "q6", "q7"] };
});
