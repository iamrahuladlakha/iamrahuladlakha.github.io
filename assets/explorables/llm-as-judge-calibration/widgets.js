/* Widgets for "LLM-as-a-Judge". Built on window.XP (assets/js/xp.js).
   Figures come from the post. Prompt wording in the anatomy explorer is a labelled example. */
(function () {
  "use strict";
  if (!window.XP) return;
  var X = XP, el = X.el, me = document.currentScript;
  if (me && me.src) X.css(me.src.replace(/\.js(\?.*)?$/, ".css"));
  var EX = '<span class="xp-ex">example</span>';
  function f2(n) { return isFinite(n) ? X.fmt(n, 3) : "–"; }

  /* ---------- 1. Anatomy of a judge prompt ---------- */
  var PARTS = [
    ["Context", "You review replies from a customer-support assistant that answers from the company's policy documents.",
      "What the application does, and the domain knowledge this one check needs. Without it the judge fills the gaps with its own assumptions."],
    ["Criterion", "Pass if the reply cites at least one source document. Ignore formatting.",
      "One precise rule, including what to ignore. “Is the response high quality?” gets different answers from different people; this doesn't."],
    ["Examples", "Example (fail): the reply quotes a refund window but names no document. Reason: no citation.",
      "Optional. A few labelled pass and fail cases with reasons. Add them only if the judge isn't accurate enough, since they cost tokens on every call."],
    ["Reasoning first", "Write your reasoning first. Then give the verdict on its own line: pass or fail.",
      "Reasoning before the verdict is the usual advice, and the reasoning is what you read when you disagree. How much it helps is disputed: one 2026 test found a reasoning model's thinking mode changed tool-call scoring by at most 0.3 points."],
    ["Way out", "If the documents are missing or empty, answer unknown.",
      "Lets the judge say “unknown” when information is missing, rather than guess."],
    ["Evidence", "Input: {{input}} · Reply: {{output}} · Documents: {{context}}",
      "The variables filled in for each case: the input, the output, the retrieved context, or a reference answer. Give each judge only what its failure mode needs."]
  ];
  function anatomy() {
    var w = X.mount("anatomy", "Anatomy of a judge prompt", "Hover, focus or tap a line of the prompt to see what that part does.");
    if (!w) return;
    var pr = el("div", "lj-prompt"), det = el("div", "xp-panel lj-det"), bind = X.detail(det);
    pr.appendChild(el("p", "lj-cap", "Judge prompt " + EX));
    var first;
    PARTS.forEach(function (p, i) {
      var b = el("button", "lj-line", '<span class="lj-tag">' + (i + 1) + ". " + p[0] + "</span><span>" + p[1].replace(/</g, "&lt;") + "</span>");
      b.type = "button";
      var show = bind(b, "<p><b>" + p[0] + "</b></p><p>" + p[2] + "</p>");
      if (!i) first = show;
      pr.appendChild(b);
    });
    w.appendChild(pr);
    w.appendChild(det);
    first();
  }

  /* ---------- 2. Predict: the always-pass judge ---------- */
  function quiz() {
    var w = X.mount("quiz", "Predict: the always-pass judge", "Commit to an answer, then reveal.");
    if (!w) return;
    w.appendChild(el("p", "", "100 outputs, 10 of them real failures. The judge says “pass” to every one, so it agrees with the person on 90 of 100."));
    w.appendChild(X.dots({ cols: 20, groups: [[10, "b", "real failures, all passed by the judge"], [90, "a", "real passes"]] }));
    w.appendChild(X.quiz({
      q: "What is its Cohen's kappa?",
      options: [["About 0.9, the same as its agreement"], ["About 0.5"], ["0", true], ["Below 0"]],
      reveal: "The person fails 10%, the judge fails 0%, so luck-level agreement is  p<sub>e</sub> = 0.1 × 0 + 0.9 × 1 = 0.9, and κ = (0.9 − 0.9) ÷ (1 − 0.9) = <b>0</b>. Ninety percent agreement, zero information: it caught none of the 10 failures it exists to catch."
    }));
  }

  /* ---------- 3. Kappa calculator ---------- */
  var PRE = {
    essay: ["Essay marking", [7, 1, 2, 30], "The head teacher and the assistant on 40 essays."],
    esc: ["Escalation", [13, 1, 0, 21], "35 support conversations. Here “fail” means “escalated to a human”."],
    lazy: ["Always pass", [0, 10, 0, 90], "The judge from the quiz: says pass to all 100."]
  };
  function band(k) {
    if (!isFinite(k)) return "undefined (one side used only one label)";
    if (k >= 0.81) return "almost perfect";
    if (k >= 0.61) return "substantial";
    if (k >= 0.41) return "moderate";
    if (k > 0) return "fair to slight";
    return k === 0 ? "no better than luck" : "worse than luck";
  }
  function kappa() {
    var w = X.mount("kappa", "Cohen's kappa calculator", "Pick a preset or type counts into the 2×2 table. Everything recomputes as you type.");
    if (!w) return;
    var cur = "essay", busy = false, note = el("p", "xp-note");
    w.appendChild(X.seg("Preset", Object.keys(PRE).map(function (k) { return [k, PRE[k][0]]; }), cur, function (v) { cur = v; load(); }).el);
    w.appendChild(note);
    var grid = el("div", "xp-fields lj-mx"), labs = ["Person fail · judge fail", "Person fail · judge pass", "Person pass · judge fail", "Person pass · judge pass"];
    var ins = labs.map(function (l, i) {
      var n = X.number({ label: l, min: 0, max: 9999, step: 1, value: PRE.essay[1][i], on: function () { if (!busy) calc(); } });
      grid.appendChild(n.el);
      return n;
    });
    w.appendChild(grid);
    var out = X.live("lj-out");
    w.appendChild(out);
    var bars = el("div", "lj-bars"), bpo = X.bar({ max: 1, cls: "w", label: "Raw agreement" }), bk = X.bar({ max: 1, label: "Kappa" });
    bars.appendChild(el("span", "lj-bl", "agreement"));
    bars.appendChild(bpo);
    bars.appendChild(el("span", "lj-bl", "kappa"));
    bars.appendChild(bk);
    w.appendChild(bars);
    function load() {
      busy = true;
      PRE[cur][1].forEach(function (v, i) { ins[i].set(v); });
      busy = false;
      note.textContent = PRE[cur][2];
      calc();
    }
    function calc() {
      var v = ins.map(function (n) { var x = Math.max(0, Math.round(n.get() || 0)); return x; });
      var a = v[0], b = v[1], c = v[2], d = v[3], n = a + b + c + d;
      if (!n) { out.textContent = "Enter at least one case."; bpo.set(0); bk.set(0); return; }
      var po = (a + d) / n, af = (a + b) / n, jf = (a + c) / n;
      var pe = af * jf + (1 - af) * (1 - jf);
      var k = pe < 1 ? (po - pe) / (1 - pe) : NaN;
      var rec = a + b ? a / (a + b) : NaN, prec = a + c ? a / (a + c) : NaN;
      var f1 = rec + prec > 0 ? 2 * prec * rec / (prec + rec) : NaN;
      var base = Math.max(a + b, c + d) / n;
      out.innerHTML = "Agreement p<sub>o</sub> = (" + a + " + " + d + ") ÷ " + n + " = <b>" + f2(po) + "</b>. " +
        "Luck-level p<sub>e</sub> = " + f2(af) + " × " + f2(jf) + " + " + f2(1 - af) + " × " + f2(1 - jf) + " = <b>" + f2(pe) + "</b>. " +
        "κ = <b>" + f2(k) + "</b> (" + band(k) + ").<br>Recall " + f2(rec) + " · precision " + f2(prec) + " · F1 " + f2(f1) +
        ". Always giving the majority verdict would already agree on " + X.pct(base, 1) + " of cases.";
      bpo.set(po);
      bk.set(isFinite(k) ? Math.max(0, k) : 0);
    }
    load();
  }

  /* ---------- 4. Calibration loop, step by step ---------- */
  var STAGES = ["label", "split", "write", "run on dev", "read", "tighten", "test once", "ship"];
  var STEPS = [
    "<b>Label.</b> A trusted domain expert labels 100–200 real examples per failure mode, with enough fails and passes to test both. If you can't decide whether an example passes, fix the definition of success first.",
    "<b>Split.</b> Train 10–20% (the few-shot pool), dev 40–45% (iterate against it), test 40–45% (untouched). With 150 labels: about 22, 64 and 64.",
    "<b>Write the judge.</b> One criterion for one failure mode, reasoning before the verdict, a way to say “unknown”. Few-shot examples come only from train.",
    "<b>Run on dev.</b> Compare with the labels: true positive rate (failures caught), true negative rate (good outputs passed), kappa.",
    "<b>Read the disagreements by hand.</b> Missing context or a wrong label isn't a prompt problem, and an automated prompt tuner would only paper over it.",
    "<b>Tighten the rubric and repeat on dev.</b> Each round leaks a little about dev into the judge, which is why test stays untouched.",
    "<b>Score test once</b>, when you've stopped changing the judge. Aim for 30–50 passes and 30–50 fails in it, and both rates above 90%. Much worse than dev? Suspect overfitting, or a small sample.",
    "<b>Ship and keep sampling.</b> Humans keep labelling a sample of live traffic, and the judge is re-validated against fresh labels, because whatever you optimise against, you overfit."
  ];
  function loop() {
    var w = X.mount("loop", "The calibration loop", "Step through with Prev and Next, or the arrow keys.");
    if (!w) return;
    var chips = el("div", "lj-stages");
    chips.setAttribute("aria-hidden", "true");
    var cs = STAGES.map(function (s) { var c = el("span", "lj-stage", s); chips.appendChild(c); return c; });
    w.appendChild(chips);
    w.appendChild(X.stepper({ label: "Calibration steps", steps: STEPS.length, render: function (i, body) {
      cs.forEach(function (c, j) { c.className = "lj-stage" + (j < i ? " is-past" : j === i ? " is-on" : ""); });
      if (i === 1) {
        var sp = el("div", "lj-split", '<span style="flex:22">train 22</span><span style="flex:64">dev 64</span><span style="flex:64">test 64</span>');
        sp.setAttribute("aria-hidden", "true");
        body.appendChild(sp);
      }
      body.appendChild(el("p", "", STEPS[i]));
    } }).el);
  }

  /* ---------- 5. Judge cost calculator ---------- */
  function cost() {
    var w = X.mount("cost", "Judge cost calculator", "Move the sliders. Defaults are the support-bot numbers from the post.");
    if (!w) return;
    var vol = X.slider({ label: "Replies per day", min: 10000, max: 1000000, step: 10000, value: 200000, format: function (v) { return X.fmt(v, 0); }, on: calc });
    var smp = X.slider({ label: "Share judged", min: 1, max: 100, step: 1, value: 5, format: function (v) { return v + "%"; }, on: calc });
    var cpc = X.slider({ label: "Cost per judge call", min: 0.01, max: 0.1, step: 0.01, value: 0.02, format: function (v) { return "$" + v.toFixed(2); }, on: calc });
    var ctl = el("div", "xp-fields");
    [vol, smp, cpc].forEach(function (s) { ctl.appendChild(s.el); });
    w.appendChild(ctl);
    var out = X.live("lj-out");
    w.appendChild(out);
    w.appendChild(el("p", "xp-note", "The 30-day month is my rounding for the monthly figure. Human review assumes two minutes per output."));
    function calc() {
      var n = Math.round(vol.get() * smp.get() / 100), day = n * cpc.get();
      out.innerHTML = X.fmt(vol.get(), 0) + " × " + smp.get() + "% = <b>" + X.fmt(n, 0) + "</b> judged a day. " +
        X.fmt(n, 0) + " × $" + cpc.get().toFixed(2) + " = <b>$" + X.fmt(day, 0) + " a day</b>, about $" + X.fmt(day * 30, 0) + " a month. " +
        "The same volume by human review: " + X.fmt(n, 0) + " × 2 min ÷ 60 = <b>" + X.fmt(n * 2 / 60, 0) + " hours</b> a day.";
    }
    calc();
  }

  X.ready(function () { [anatomy, quiz, kappa, loop, cost].forEach(function (f) { try { f(); } catch (e) { if (window.console) console.error(e); } }); });
})();
