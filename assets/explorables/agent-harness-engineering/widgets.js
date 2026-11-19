/* Widgets for "The Agent Harness". Built on window.XP (assets/js/xp.js).
   Figures come from the post. Finance and healthcare cases are labelled examples. */
(function () {
  "use strict";
  if (!window.XP) return;
  var X = XP, el = X.el, me = document.currentScript;
  if (me && me.src) X.css(me.src.replace(/\.js(\?.*)?$/, ".css"));
  var EX = '<span class="xp-ex">example</span> ';

  /* ---------- 1. Seven jobs explorer ---------- */
  var JOBS = [
    ["contract", "Task contract"], ["map", "Map"], ["tools", "Right tools"], ["state", "Durable state"],
    ["sensors", "Sensors"], ["perms", "Permissions outside the model"], ["traces", "Traces and recovery"],
    ["loop", "The harness owns the loop"]
  ];
  var CASES = {
    code: ["Coding agent (from the post)", {
      contract: "No “done when”. Success isn't defined before execution, so nothing says what counts as finished.",
      map: "Missing context: like the team whose agents stalled because they hadn't been told enough about the world they were working in.",
      tools: "Picks the wrong tool. Tools without a clear purpose, predictable output or a defined failure state.",
      state: "Forgets a decision. Decisions live only in the conversation, so a crash or a context reset loses them, and a resumed task has nothing to rebuild from.",
      sensors: "Skips verification. Quality isn't turned into evidence: the agent marks its own pull request “done” while the tests it skipped would have failed.",
      perms: "The cheque problem. The model decides whether its own action is allowed, and deploy or delete run without human approval.",
      traces: "No receipts. No trail of context, tool calls, retries or cost, no rollback point, and no way to compare runs across a model upgrade.",
      loop: "Loops. “Keep trying until it works” with no evidence, retry cap, budget or escalation: the first runaway bill."
    }],
    fin: ["Invoice matching (finance)", {
      contract: "It isn't told whether “done” means every invoice line matched, or matched or flagged, so it stops at whatever looks finished.",
      map: "It doesn't know where the vendor records or the matching policy live, so it guesses.",
      tools: "The lookup tool returns “not found” and “error” the same way, so a failed lookup reads as “no purchase order exists”.",
      state: "After a restart it can't tell which invoices it already matched, and matches some twice.",
      sensors: "No check that the matched totals reconcile, so a wrong match looks as confident as a right one.",
      perms: "Releasing a payment, which can't be undone, rests on the model's own judgement instead of a human approval outside it.",
      traces: "When an auditor asks why an invoice was paid, there's no record of what the agent read.",
      loop: "A mismatch it can't resolve turns into endless retries instead of a hand-off to a person."
    }],
    med: ["Patient intake (healthcare)", {
      contract: "No bound on the output, so the summary drifts from intake facts into advice nobody asked for.",
      map: "It doesn't know where the clinic's intake guidelines live, so it falls back on general knowledge.",
      tools: "The scheduling tool has no defined failure state, so a failed booking looks like a successful one.",
      state: "A context reset halfway through loses what the patient already answered, and they get asked again.",
      sensors: "No schema validator on the summary, so a missing required field reaches the triage nurse unnoticed.",
      perms: "The agent confirms a triage slot itself instead of proposing it for a nurse to approve.",
      traces: "When someone asks why a patient was booked where they were, nobody can reconstruct what the agent saw.",
      loop: "A form it can't parse is retried again and again instead of going to a person."
    }]
  };
  function jobs() {
    var w = X.mount("jobs", "Seven jobs explorer", "Switch a job off to see the failure it lets in. Pick a case to see the same gap in another domain.");
    if (!w) return;
    var on = {}, cs = "code";
    JOBS.forEach(function (j) { on[j[0]] = true; });
    var ctl = el("div", "xp-ctl");
    ctl.appendChild(X.seg("Case", [["code", "Coding agent"], ["fin", "Finance " + EX], ["med", "Healthcare " + EX]], cs, function (v) { cs = v; draw(); }).el);
    w.appendChild(ctl);
    var flow = el("div", "hx-flow");
    flow.innerHTML = '<div class="hx-end"><b>model</b><span>reasons, proposes</span></div><span class="hx-arr" aria-hidden="true">→</span>';
    var hb = el("div", "hx-harness", "<p class=\"hx-h\"><b>harness</b> <span></span></p>");
    var sw = el("div", "hx-sw");
    var btns = JOBS.map(function (j, i) {
      var b = X.toggle((i < 7 ? (i + 1) + ". " : "+ ") + j[1], true, function (v) { on[j[0]] = v; draw(); });
      sw.appendChild(b);
      return b;
    });
    hb.appendChild(sw);
    flow.appendChild(hb);
    flow.appendChild(el("span", "hx-arr", "→"));
    flow.lastChild.setAttribute("aria-hidden", "true");
    flow.appendChild(el("div", "hx-end", "<b>tools</b><span>run in a sandbox</span>"));
    w.appendChild(flow);
    var all = el("div", "xp-ctl");
    var bAll = X.btn("xp-btn--ghost", "All on"), bNone = X.btn("xp-btn--ghost", "All off (prompt + model)");
    function setAll(v) { JOBS.forEach(function (j, i) { on[j[0]] = v; btns[i].setAttribute("aria-checked", String(v)); }); draw(); }
    bAll.addEventListener("click", function () { setAll(true); });
    bNone.addEventListener("click", function () { setAll(false); });
    all.appendChild(bAll);
    all.appendChild(bNone);
    w.appendChild(all);
    var out = X.live("hx-fail");
    w.appendChild(out);
    function draw() {
      var off = JOBS.filter(function (j) { return !on[j[0]]; });
      hb.querySelector(".hx-h span").textContent = (8 - off.length) + " of 8 in place";
      hb.classList.toggle("is-thin", off.length > 0);
      var c = CASES[cs];
      out.innerHTML = off.length
        ? "<p><b>" + off.length + " gap" + (off.length > 1 ? "s" : "") + "</b> in the " + (cs === "code" ? "" : EX) + c[0] + " case:</p><ul>" +
          off.map(function (j) { return "<li><b>" + j[1] + " off.</b> " + c[1][j[0]] + "</li>"; }).join("") + "</ul>"
        : "<p>Every job is in place. When this agent fails now, the fix is a guide, a test, a tool or a policy, not a louder prompt.</p>";
    }
    draw();
  }

  /* ---------- 2. Bounded loop ---------- */
  var ST = ["task state", "build", "verify", "return", "add the gap", "escalate"];
  function loop() {
    var w = X.mount("loop", "Bounded loop simulator", "Set the cap and the attempt on which the sensors pass, then step through. The defaults match the change receipt: 2 retries against a cap of 3.");
    if (!w) return;
    var cap = 3, pass = 3, holder = el("div");
    var f = el("div", "xp-fields");
    var capIn = X.number({ label: "Retry cap N (attempts)", min: 1, max: 6, step: 1, value: 3, on: function (v) { cap = Math.max(1, Math.min(6, Math.round(v) || 1)); build(); } });
    f.appendChild(capIn.el);
    var pf = el("div", "xp-field", "<span>Sensors pass on attempt</span>");
    pf.appendChild(X.seg("Sensors pass on attempt", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [0, "never"]], pass, function (v) { pass = v; build(); }).el);
    f.appendChild(pf);
    w.appendChild(f);
    w.appendChild(holder);
    function steps() {
      var s = [{ on: 0, t: "The run starts from the <b>task state</b>: the contract, the map and whatever earlier attempts left behind." }];
      for (var a = 1; a <= cap; a++) {
        s.push({ on: 1, t: "<b>Attempt " + a + ".</b> The model builds an artefact from the current task state. It decides <em>how</em> to repair." });
        if (a === pass) {
          s.push({ on: 2, t: "<b>Verify.</b> The sensors run and the evidence passes." });
          s.push({ on: 3, t: "<b>Return.</b> " + (a - 1) + " retr" + (a === 2 ? "y" : "ies") + " (cap: " + cap + ")." + (a === cap && cap > 1 ? " That came within one attempt of escalating: worth watching across runs, not just within one." : "") });
          return s;
        }
        s.push({ on: 2, t: "<b>Verify.</b> The sensors find a gap." });
        if (a < cap) s.push({ on: 4, t: "<b>Add the gap.</b> What the sensors found goes into the task state, and attempt " + (a + 1) + " of " + cap + " is allowed. The harness decides <em>whether</em> another attempt happens." });
      }
      s.push({ on: 5, t: "<b>Cap hit.</b> After " + cap + " attempt" + (cap > 1 ? "s" : "") + " the harness stops and hands the task to a person, with the gaps on file." });
      return s;
    }
    function build() {
      var s = steps();
      holder.innerHTML = "";
      var st = X.stepper({ label: "Loop steps", steps: s.length, render: function (i, body) {
        var row = el("div", "hx-chips");
        ST.forEach(function (n, k) { row.appendChild(el("span", "hx-chip" + (k === s[i].on ? " is-on" : "") + (k === 5 ? " hx-esc" : ""), n)); });
        row.setAttribute("aria-hidden", "true");
        body.appendChild(row);
        body.appendChild(el("p", "", s[i].t));
      } });
      holder.appendChild(st.el);
    }
    build();
  }

  /* ---------- 3. Maturity ladder ---------- */
  var LV = [
    ["Level 0", "prompt + model", []],
    ["Level 1", "adds a project guide and tools", ["project guide", "tools"]],
    ["Level 2", "adds structured state, tests and a bounded loop", ["structured state", "tests", "bounded loop"]],
    ["Level 3", "adds permissions, traces, recovery and human gates", ["permissions", "traces", "recovery", "human gates"]]
  ];
  var TASK = {
    short: [1, "A short, low-risk task", "The post's rule: a short, low-risk task needs level 1."],
    long: [3, "A six-hour run that edits files and opens pull requests", "The post's rule: a six-hour run that edits files and opens pull requests needs level 3."],
    med: [2, EX + "Summarise a referral form for a triage nurse", "My call: the agent takes no action itself, but a missing field matters, so it needs state, a schema test and a capped loop. The nurse is the gate."],
    fin: [3, EX + "Match invoices and release payment", "My call: releasing a payment can't be undone, so it needs permissions in code and a human gate before the money moves."]
  };
  function ladder() {
    var w = X.mount("ladder", "Harness maturity ladder", "Pick a task, then climb the ladder. Each level adds weight: latency, cost and maintenance.");
    if (!w) return;
    var task = "long", st;
    var tc = el("div", "xp-field", "<span>Task</span>");
    tc.appendChild(X.seg("Task", Object.keys(TASK).map(function (k) { return [k, TASK[k][1]]; }), task, function (v) { task = v; st.go(st.i(), true); }).el);
    w.appendChild(tc);
    st = X.stepper({ label: "Harness levels", steps: 4, render: function (i, body) {
      var need = TASK[task][0];
      var rungs = el("div", "hx-rungs");
      rungs.setAttribute("aria-hidden", "true");
      for (var k = 3; k >= 0; k--) rungs.appendChild(el("span", "hx-rung" + (k <= i ? " is-on" : "") + (k === need ? " is-need" : ""), LV[k][0] + (k === need ? " · needed" : "")));
      body.appendChild(rungs);
      var have = [];
      for (k = 1; k <= i; k++) have = have.concat(LV[k][2]);
      body.appendChild(el("p", "", "<b>" + LV[i][0] + "</b> " + LV[i][1] + "." + (have.length ? " In place: " + have.join(", ") + "." : "")));
      var weight = X.bar({ value: i, max: 3, cls: i > need ? "w" : "", label: "Harness weight" });
      var wl = el("p", "hx-wl", "harness weight");
      wl.appendChild(weight);
      body.appendChild(wl);
      var v = i < need ? '<b class="xp-no">Not enough.</b> Missing: ' + LV.slice(i + 1, need + 1).map(function (l) { return l[2].join(", "); }).join("; ") + "."
        : i === need ? '<b class="xp-ok">Enough.</b> This is where I\'d stop for this task.'
        : '<b class="hx-warn">More than this task needs.</b> Every extra check, gate and state store adds latency, cost and maintenance.';
      body.appendChild(el("p", "", v));
      body.appendChild(el("p", "xp-note", TASK[task][2] + " Match the weight of the harness to how much can go wrong, and no more."));
    } });
    w.appendChild(st.el);
  }

  /* ---------- 4. Predict, then compare graders ---------- */
  function evaluator() {
    var w = X.mount("evaluator", "Predict the result: single agent or three-agent harness", "Make a prediction before you read on.");
    if (!w) return;
    var cmp = el("div", "hx-cmp");
    cmp.hidden = true;
    w.appendChild(X.quiz({
      q: "Same prompt, a retro game maker. One run uses a single agent; the other uses the planner, generator and evaluator. What happened?",
      options: [
        ["They cost about the same, and both games were playable."],
        ["The harness cost over 20× more, and only its game was actually playable.", true],
        ["The harness cost over 20× more, and both games were playable, so the single agent was the better deal."],
        ["The single agent cost more, because it had to retry more often."]
      ],
      reveal: "Compared with a single agent on the same prompt, the harness cost over 20× more. But only its game was actually playable. That harness is a planner, a generator and a separate evaluator, with a contract for “done” agreed before each chunk of work (27 test criteria for one level-editor sprint). Now compare who grades the work.",
      on: function (i) { cmp.hidden = i < 0; }
    }));
    var who = "self", roles = el("div", "hx-roles"), txt = X.live("xp-panel");
    cmp.appendChild(X.seg("Who grades the work", [["self", "The builder grades itself"], ["sep", "A separate evaluator"]], who, function (v) { who = v; draw(); }).el);
    roles.setAttribute("aria-hidden", "true");
    cmp.appendChild(roles);
    cmp.appendChild(txt);
    w.appendChild(cmp);
    function draw() {
      var s = who === "self";
      roles.innerHTML = [["plans the action", "model"], ["decides it's allowed", s ? "model" : "policy"], ["judges the result", s ? "model" : "evaluator"]]
        .map(function (r) { return '<span class="hx-role' + (s && r[0] !== "plans the action" ? " is-bad" : "") + '"><i>' + r[0] + "</i><b>" + r[1] + "</b></span>"; }).join("");
      txt.innerHTML = s
        ? "One person writes the cheque, approves it and cashes it. Asked to grade their own work, agents tend to praise it confidently even when it's mediocre, especially on subjective tasks with no test to run. One confident mistake passes every check."
        : "A separate, sceptical evaluator clicks through the running app with a browser tool, files bugs and grades against criteria agreed before the work started. It's a much stronger check. It still drifts lenient, so you tune it: read its logs, find where its judgement differs from yours, update its instructions.";
    }
    draw();
  }

  /* ---------- 5. Components are assumptions ---------- */
  var PARTS = ["sprint structure", "planner", "evaluator"];
  var STEPS = [
    [["", "", ""], "A stronger model arrives. Every part of the harness is a bet that the model can't yet manage something alone. Remove them one at a time to see which are still load-bearing."],
    [["off", "", ""], "<b>Sprint structure: removed.</b> It had become unnecessary."],
    [["off", "keep", ""], "<b>Planner: kept.</b> It still stopped the builder from under-scoping."],
    [["off", "keep", "cond"], "<b>Evaluator: kept, with a condition.</b> It was worth its cost only when the task sat beyond what the model did reliably alone."],
    [["off", "keep", "cond"], "<b>The slimmed harness</b> built a browser-based music studio in about 4 hours for about $124 in tokens, and the evaluator still caught features that were display-only. Re-test on every model upgrade; change receipts make the runs comparable."]
  ];
  var LAB = { "": "testing", off: "removed", keep: "load-bearing", cond: "only beyond the model's reach" };
  function assumptions() {
    var w = X.mount("assumptions", "Components are assumptions", "Step through the upgrade: remove one part at a time and watch which still earn their place.");
    if (!w) return;
    w.appendChild(X.stepper({ label: "Removing parts after a model upgrade", steps: STEPS.length, render: function (i, body) {
      var row = el("div", "hx-parts");
      PARTS.forEach(function (p, k) {
        var s = STEPS[i][0][k];
        row.appendChild(el("span", "hx-part is-" + (s || "test"), "<b>" + p + "</b><i>" + LAB[s] + "</i>"));
      });
      body.appendChild(row);
      body.appendChild(el("p", "", STEPS[i][1]));
    } }).el);
  }

  X.ready(function () { [jobs, loop, ladder, evaluator, assumptions].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } }); });
})();
