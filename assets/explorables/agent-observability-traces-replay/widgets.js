/* Widgets for "Agent Observability". Built on window.XP (assets/js/xp.js).
   Figures come from the post. Sample messages, IDs and versions are labelled examples. */
(function () {
  "use strict";
  if (!window.XP) return;
  var X = XP, el = X.el, me = document.currentScript;
  if (me && me.src) X.css(me.src.replace(/\.js(\?.*)?$/, ".css"));
  var EX = '<span class="xp-ex">example</span>';

  /* ---------- 1. Waterfall: three logs vs one trace ---------- */
  var TOTAL = 1825;
  var SP = [
    ["guardrail", "prompt check, allow", 35, "g", "which guardrail, its verdict, its score, the policy version"],
    ["model", "decide, propose tool call", 900, "m", "model and version, token counts, cost, the decision it made"],
    ["guardrail", "tool-call check, allow", 40, "g", "which guardrail, its verdict, its score, the policy version"],
    ["tool", "track_order", 250, "t", "tool name, arguments, result status, the system it touched"],
    ["model", "reply", 600, "m", "model and version, token counts, cost, the decision it made"]
  ];
  var LOGS = [["tool", "Tool log"], ["model", "Model provider log"], ["guardrail", "Guardrail log"]];
  function waterfall() {
    var w = X.mount("waterfall", "Trace waterfall for the order question", "Switch between three separate logs and one trace. Hover, focus or tap a span to see what it records.");
    if (!w) return;
    var mode = "trace";
    w.appendChild(X.seg("View", [["logs", "Three separate logs"], ["trace", "One trace"]], mode, function (v) { mode = v; draw(); }).el);
    var view = el("div", "ox-view"), det = el("div", "xp-panel ox-det"), bind = X.detail(det), sum = el("p", "ox-sum");
    w.appendChild(view);
    w.appendChild(det);
    w.appendChild(sum);
    function info(s, i) {
      return function () {
        return "<p><b>" + s[0] + ": " + s[1] + "</b> · " + X.fmt(s[2], 0) + " ms · about " + X.pct(s[2], TOTAL) + " of the run</p>" +
          "<p>What I'd record on a " + s[0] + " span: " + s[4] + ".</p>" + (mode === "trace" ? "<p class=\"ox-mut\">Span " + (i + 1) + " of 5, same trace ID, parent: the run.</p>" : "<p class=\"ox-mut\">No trace ID: nothing ties this line to the other four.</p>");
      };
    }
    function spanBtn(s, i, style) {
      var b = el("button", "ox-span ox-" + s[3], (style ? '<span class="ox-track" aria-hidden="true"><i style="' + style + '"></i></span>' : "") +
        '<span class="ox-lab">' + s[0] + ": " + s[1] + " <b>" + X.fmt(s[2], 0) + " ms</b></span>");
      b.type = "button";
      bind(b, info(s, i));
      return b;
    }
    function draw() {
      view.innerHTML = "";
      det.innerHTML = "<p class=\"ox-mut\">Pick a span.</p>";
      if (mode === "trace") {
        var head = el("p", "ox-run", 'run: "where\'s my order?" · one trace ID · <b>1,825 ms</b>');
        view.appendChild(head);
        var at = 0;
        SP.forEach(function (s, i) {
          view.appendChild(spanBtn(s, i, "margin-left:" + (at / TOTAL * 100) + "%;width:" + (s[2] / TOTAL * 100) + "%"));
          at += s[2];
        });
        view.appendChild(el("p", "ox-mut", "Bar length is proportional to time; each bar starts where the one before it ends."));
        sum.innerHTML = "35 + 900 + 40 + 250 + 600 = <b>1,825 ms</b>. The first model call is <b>900 ms, about 49%</b>. The two guardrail checks together are <b>75 ms, about 4%</b>.";
      } else {
        var cols = el("div", "ox-logs");
        LOGS.forEach(function (l) {
          var c = el("div", "ox-log", "<p class=\"ox-log-t\">" + l[1] + "</p>");
          SP.forEach(function (s, i) { if (s[0] === l[0]) c.appendChild(spanBtn(s, i)); });
          c.appendChild(el("p", "ox-mut", "…plus every other user's entries in the same window"));
          cols.appendChild(c);
        });
        view.appendChild(cols);
        sum.innerHTML = "Each log is accurate, and each keeps its own clock. None of them says which lines belong to this run, or in what order they happened.";
      }
    }
    draw();
  }

  /* ---------- 2. The $40 refund, step by step ---------- */
  var TREE = [
    ["run", "the conversation that ended in a refund", 0],
    ["tool", "tracking tool: result includes the restaurant's free-text note", 1],
    ["model", "proposes issue_refund", 1],
    ["guardrail", "verdict: allow · policy version on the span", 2],
    ["tool", "issue_refund: $40", 1]
  ];
  var ISTEPS = [
    [-1, "A different conversation ends with a <b>$40 refund</b> the customer never asked for."],
    [-1, "<b>Without a trace:</b> the refund tool's log shows the call went out. The model provider's log shows 30 prompts in that minute, from lots of different users. The guardrail's log shows 200 “allow” verdicts in the same window. All accurate; none says what the agent read just before it decided to refund."],
    [0, "<b>With a trace</b>, open the run by its one trace ID. Every step is a span under it, so the investigation takes minutes."],
    [1, "The tracking tool's result included a line from the restaurant's free-text notes field saying the customer was owed a refund and it should be issued now."],
    [2, "The very next model span proposed <code>issue_refund</code>."],
    [3, "The guardrail span below it says “allow”, with the policy version that allowed it."],
    [4, "<b>Diagnosis.</b> Text that came back from a tool was treated as an instruction, and the guardrail never compared the proposed action with what the customer actually asked for. A precise fix, not a vague “make the prompt more careful”."]
  ];
  function incident() {
    var w = X.mount("incident", "The $40 refund, step by step", "Step through the investigation with Prev and Next, or the arrow keys.");
    if (!w) return;
    w.appendChild(X.stepper({ label: "Refund investigation", steps: ISTEPS.length, render: function (i, body) {
      var on = ISTEPS[i][0];
      if (i === 1) {
        var l = el("div", "ox-logs ox-logs--sm");
        [["Refund tool log", "call went out"], ["Model provider log", "30 prompts this minute"], ["Guardrail log", "200 “allow” verdicts"]].forEach(function (x) {
          l.appendChild(el("div", "ox-log", "<p class=\"ox-log-t\">" + x[0] + "</p><p>" + x[1] + "</p>"));
        });
        l.setAttribute("aria-hidden", "true");
        body.appendChild(l);
      } else if (i > 1) {
        var t = el("div", "ox-tree");
        t.setAttribute("aria-hidden", "true");
        TREE.forEach(function (n, k) {
          t.appendChild(el("p", "ox-node ox-d" + n[2] + (k === on ? " is-on" : "") + (k <= on || i === ISTEPS.length - 1 ? "" : " is-dim") + (i === ISTEPS.length - 1 && (k === 1 || k === 3) ? " is-bad" : ""), "<b>" + n[0] + "</b> " + n[1]));
        });
        body.appendChild(t);
      }
      body.appendChild(el("p", "", ISTEPS[i][1]));
    } }).el);
  }

  /* ---------- 3. Replay simulator ---------- */
  var STAGES = ["record", "replay", "measure", "ship or tune"];
  function replay() {
    var w = X.mount("replay", "Replay simulator", "Replay last week's recorded actions through the stricter check, offline, then decide.");
    if (!w) return;
    var chips = el("div", "ox-stages");
    chips.setAttribute("aria-hidden", "true");
    var cs = STAGES.map(function (s) { var c = el("span", "ox-stage", s); chips.appendChild(c); return c; });
    w.appendChild(chips);
    var go = X.btn("xp-btn--primary", "Replay 50,000 actions");
    var ctl = el("div", "xp-ctl");
    ctl.appendChild(go);
    w.appendChild(ctl);
    var prog = X.bar({ value: 0, max: 50000, label: "Replayed" }), cnt = X.live("ox-cnt");
    w.appendChild(prog);
    w.appendChild(cnt);
    var res = el("div", "ox-res");
    res.hidden = true;
    w.appendChild(res);
    function stage(k) { cs.forEach(function (c, j) { c.className = "ox-stage" + (j < k ? " is-past" : j === k ? " is-on" : ""); }); }
    stage(0);
    cnt.textContent = "Recorded: last week's 50,000 actions.";
    function show() {
      stage(2);
      cnt.textContent = "Replayed 50,000 actions. The candidate would have blocked 43.";
      res.innerHTML = "";
      res.appendChild(el("p", "", "The 43 actions the stricter check would have blocked:"));
      res.appendChild(X.dots({ cols: 15, groups: [[1, "b", "this refund"], [12, "b", "others like it"], [30, "w", "legitimate refunds customers had asked for"]] }));
      res.appendChild(el("ul", "ox-leg", '<li><i class="b"></i><b>13 caught</b>: this refund and 12 others like it</li><li><i class="w"></i><b>30 false blocks</b>: legitimate refunds that customers had asked for</li>'));
      res.appendChild(X.quiz({
        q: "Ship the check now, or tune it first?",
        options: [["Ship it: it catches this refund and 12 like it."], ["Tune first: 30 false blocks is 30 customers.", true]],
        reveal: "Those 30 false blocks go back to the team to tune before the check goes live. Without replay, those 30 customers would have found the problem for them. Then go round again: record, replay, measure.",
        on: function (i) { stage(i < 0 ? 2 : 3); }
      }));
      res.hidden = false;
      go.disabled = false;
      go.textContent = "Replay again";
    }
    go.addEventListener("click", function () {
      go.disabled = true;
      res.hidden = true;
      stage(1);
      if (X.reduced()) { prog.set(50000); show(); return; }
      var t0 = 0;
      requestAnimationFrame(function f(t) {
        t0 = t0 || t;
        var p = Math.min(1, (t - t0) / 1200);
        prog.set(p * 50000);
        cnt.textContent = "Replaying… " + X.fmt(Math.round(p * 50000), 0) + " of 50,000";
        if (p < 1) requestAnimationFrame(f); else show();
      });
    });
  }

  /* ---------- 4. Redaction on write ---------- */
  var CASES = {
    sup: ["Support (delivery)", "My card 4111 1111 1111 1111 was charged twice, please fix it", "My card [CARD] was charged twice, please fix it", "support_agent", "issue_refund"],
    med: ["Patient intake (healthcare)", "I'm Jane Doe, born 02/03/1984, and I need to book my referral follow-up", "I'm [NAME], born [DOB], and I need to book my referral follow-up", "intake_agent", "book_slot"]
  };
  var MODES = [["off", "Content capture off"], ["raw", "On, raw"], ["red", "On, redacted on write"], ["ref", "Separate store + reference"]];
  var MNOTE = {
    off: "The default in OpenTelemetry's GenAI conventions: you switch content on deliberately. The metadata is enough to troubleshoot and audit who did what, but not why the model answered as it did.",
    raw: "The most useful thing to keep and the most dangerous: customers' messages and personal details now sit in the trace store.",
    red: "Redacted before storing, on the way in, not on the way out. Anyone who can read the trace never sees the raw value.",
    ref: "The content goes to separate access-controlled storage, and the span keeps only a reference. Restrict who can read it, and delete it after a retention period."
  };
  function redaction() {
    var w = X.mount("redaction", "Redaction toggle", "Choose what the trace store keeps. The messages, IDs and versions are made-up examples.");
    if (!w) return;
    var mode = "off", cs = "sup";
    var ctl = el("div", "ox-ctl2");
    ctl.appendChild(X.seg("Case", [["sup", "Support"], ["med", "Healthcare " + EX]], cs, function (v) { cs = v; draw(); }).el);
    ctl.appendChild(X.seg("Content capture", MODES, mode, function (v) { mode = v; draw(); }).el);
    w.appendChild(ctl);
    var rec = el("pre", "ox-rec"), note = X.live("xp-note");
    w.appendChild(rec);
    w.appendChild(note);
    w.appendChild(el("p", "xp-note", "Every one of these controls removes detail an investigation might want later. That's a trade you make on purpose."));
    function q(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function draw() {
      var c = CASES[cs];
      var lines = [
        '<span class="ox-cap">span: model call ' + EX + "</span>",
        "agent:          " + c[3],
        "proposed tool:  " + c[4],
        "verdict:        allow",
        "policy_version: v7",
        "duration_ms:    900"
      ];
      if (mode === "raw") lines.push('<b class="ox-hot">input:          "' + q(c[1]) + '"</b>');
      if (mode === "red") lines.push('<b class="ox-safe">input:          "' + q(c[2]).replace(/\[(\w+)\]/g, '<mark>[$1]</mark>') + '"</b>');
      if (mode === "ref") lines.push('<b class="ox-safe">input_ref:      "traces-content/run-0042/msg-1"</b>');
      if (mode === "off") lines.push('<span class="ox-mut">input:          (not captured)</span>');
      rec.innerHTML = lines.join("\n");
      note.textContent = MNOTE[mode];
    }
    draw();
  }

  /* ---------- 5. Predict: what was the guardrail missing? ---------- */
  function guardrail() {
    var w = X.mount("guardrail", "Predict: what was the guardrail missing?", "The guardrail span says “allow”. Predict why before you read on.");
    if (!w) return;
    w.appendChild(X.quiz({
      q: "The guardrail said allow to issue_refund. What was it missing?",
      options: [
        ["A stricter score threshold on the same check."],
        ["A comparison between the proposed action and what the customer actually asked for.", true],
        ["More verbose, token-level logging of the model call."],
        ["A larger model behind the guardrail."]
      ],
      reveal: "Text that came back from a tool was treated as an instruction, and the guardrail never compared the proposed action with what the customer actually asked for. The policy version on the span tells you exactly which rules it was applying, so the fix lands on the right policy."
    }));
  }

  X.ready(function () { [waterfall, guardrail, incident, replay, redaction].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } }); });
})();
