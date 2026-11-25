/* Widgets for "Context Engineering". Built on window.XP (assets/js/xp.js).
   Defaults are the figures in the post. Nothing here is a measured support deployment. */
(function () {
  "use strict";
  if (!window.XP) return;
  var X = XP, el = X.el, me = document.currentScript;
  if (me && me.src) X.css(me.src.replace(/\.js(\?.*)?$/, ".css"));

  function money(n) { return X.fmt(n, 0); }

  /* ---------- 1. Four layers on the sales-report task ---------- */
  var LAYERS = ["Isolate", "Limit output", "Pointers", "Verify"];
  var LAYER_COPY = [
    "<b>One shared window.</b> “Analyse sales data and create a report” ran five stages, took about 15 minutes and used over 150,000 tokens. Kept in one context, a 200,000-token window overflows mid-task. A single browser page returned by one tool was about 17,000 characters, and that page stayed in the history for every later call.",
    "<b>Isolate.</b> Each agent gets its own context. Only a compressed summary crosses to the next one. In this setup a coder stayed under 25,000 tokens. The state they share is four small fields.",
    "<b>Limit what comes back.</b> The cap is written into the instructions. The coder returns 1,000 to 1,500 tokens, the validator 800, the reporter about 1,000. Anything longer goes to a file.",
    "<b>Pointers, not the data.</b> The context gets a short note and a path. “Wrote 105 lines, execution successful” stands in for the code. A note passed between agents is about 30 tokens.",
    "<b>Verify, and a net for overflow.</b> A validator re-runs the calculations and signs off. If a window still fills, summarise the oldest half and keep the 10 latest messages."
  ];
  function layers() {
    var w = X.mount("layers", "Four layers on the sales-report task", "Step through. The first step is the overflowing run; each later step is one layer.");
    if (!w) return;
    w.appendChild(X.stepper({
      label: "Four layers",
      steps: LAYER_COPY.length,
      render: function (i, body) {
        var row = el("div", "cx-layers");
        row.setAttribute("aria-hidden", "true");
        LAYERS.forEach(function (name, k) {
          var cls = "cx-chip" + (k < i - 1 ? " is-past" : "") + (k === i - 1 ? " is-on" : "");
          row.appendChild(el("span", cls, name));
        });
        body.appendChild(row);
        body.appendChild(el("p", "", LAYER_COPY[i]));
      }
    }).el);
  }

  /* ---------- 2. Catalogue calculator ---------- */
  function catalogue() {
    var w = X.mount("catalogue", "Catalogue cost calculator", "Move the three counts. Defaults are the skills pattern: 500 tokens of descriptions, 20,000 if every guide is loaded, and one 3,000-token guide only when a skill is used.");
    if (!w) return;
    var cat = 500, full = 20000, guide = 3000, open = false;
    var fields = el("div", "xp-fields");
    fields.appendChild(X.slider({
      label: "Catalogue, always in the prompt (tokens)",
      min: 0, max: 5000, step: 50, value: 500,
      format: function (v) { return money(v) + " tokens"; },
      on: function (v) { cat = v; draw(); }
    }).el);
    fields.appendChild(X.slider({
      label: "Every guide loaded (tokens)",
      min: 1000, max: 40000, step: 500, value: 20000,
      format: function (v) { return money(v) + " tokens"; },
      on: function (v) { full = v; draw(); }
    }).el);
    fields.appendChild(X.slider({
      label: "One guide, only when chosen (tokens)",
      min: 0, max: 10000, step: 100, value: 3000,
      format: function (v) { return money(v) + " tokens"; },
      on: function (v) { guide = v; draw(); }
    }).el);
    w.appendChild(fields);
    var tools = el("div", "cx-tools");
    tools.appendChild(X.toggle("A skill is in use, so load its guide", false, function (v) { open = v; draw(); }));
    w.appendChild(tools);
    var bars = el("div", "cx-bars");
    var optCat = { max: 20000, label: "Catalogue" };
    var optUse = { max: 20000, label: "With one guide" };
    var optFull = { max: 20000, cls: "w", label: "Every guide" };
    var bCat = X.bar(optCat), bUse = X.bar(optUse), bFull = X.bar(optFull);
    [["catalogue", bCat], ["one skill open", bUse], ["all guides", bFull]].forEach(function (row) {
      bars.appendChild(el("span", "cx-bl", row[0]));
      bars.appendChild(row[1]);
    });
    w.appendChild(bars);
    var out = X.live("cx-out");
    w.appendChild(out);
    function less(small) {
      var rel = (1 - small / full) * 100;
      var word = rel >= 0 ? "less" : "more";
      return "1 − " + money(small) + " ÷ " + money(full) + " = <b>" + X.fmt(rel, 1) + "%</b> " + word + " than loading every guide.";
    }
    function draw() {
      var used = cat + (open ? guide : 0);
      var max = Math.max(full, cat + guide, 1);
      optCat.max = optUse.max = optFull.max = max;
      bCat.set(cat);
      bUse.set(cat + guide);
      bFull.set(full);
      var standing = "Standing cost, before any skill is opened: " + money(cat) + " tokens. " + less(cat);
      var opened = "With one guide loaded: " + money(cat) + " + " + money(guide) + " = <b>" + money(cat + guide) + "</b>. " + less(cat + guide);
      out.innerHTML = (open ? "<p>" + opened + "</p><p>" + standing + "</p>" : "<p>" + standing + "</p><p>" + opened + "</p>")
        + "<p>This call is carrying <b>" + money(used) + "</b> tokens from the catalogue"
        + (open ? " and the open guide." : ". The guide stays on disk until a skill is picked.") + "</p>";
    }
    draw();
  }

  /* ---------- 3. Predict: capping a page after the fact ---------- */
  function trim() {
    var w = X.mount("trim", "Predict: cap the page at 8,000 characters", "Pick an answer, then reveal. This is a different experiment from the compact-snapshot comparison below.");
    if (!w) return;
    w.appendChild(X.quiz({
      q: "A bloated browser page is capped at 8,000 characters after the tool has already returned it. What happens to the cost per successful task?",
      options: [
        ["It falls, because every later call sends a smaller page."],
        ["It stays flat. The agent fetches the page again.", true],
        ["It falls about 13×, the same gain as switching to compact snapshots."],
        ["The 200,000-token window stops overflowing, so the cost falls away."]
      ],
      reveal: "Capping the page after it arrived did not help. The agents fetched it again, and the cost per success stayed flat. The cut has to be in what the tool returns: a compact view of the interactive elements, or a short script that chains the calls so the pages in between never enter the context. The 13× figure is the other experiment, compact snapshots against full pages, not this cap."
    }));
  }

  /* ---------- 4. Five hooks ---------- */
  var HOOKS = [
    ["Offloading", "After each tool call",
      "<p>A result over about 20,000 tokens is saved to a file. The model sees the first and last few lines, plus the path, and can read more of the file later. A pasted user message gets the same treatment above 50,000 tokens.</p><p>A 40,000-row export is offloaded at once, so the window grows by that short preview, not by the export. Cutting the text off would throw the rest away. The file keeps it retrievable.</p>"],
    ["Summarisation", "Before each model call",
      "<p>At 85% of the window, a separate model call condenses the older messages into one summary. On a 200,000-token window that threshold is 0.85 × 200,000 = <b>170,000</b> tokens. The latest messages stay word for word. The originals are saved to a file, and each later summary includes the previous one.</p><p>The big export never has to be what trips this. It was already offloaded. The slow climb from searches and drafts is what usually does. I also summarise when the topic changes, and I retune the threshold per task.</p>"],
    ["Skills", "Before the run, then on each call",
      "<p>Only each skill’s name and description sit in the prompt. The full instructions are read when that skill is the one being used. That is the catalogue above: about 500 tokens instead of over 20,000, with one guide of about 3,000 tokens loaded on demand.</p>"],
    ["Subagents", "When the model delegates",
      "<p>Noisy work runs in its own context. Only the result comes back to the caller. The parent window never has to hold the search trail.</p>"],
    ["Long-term memory", "Start, each call, and when it learns",
      "<p>A plain file is loaded into the system prompt at the start and on later calls, and it is updated when the agent learns something worth keeping. It outlives this run because it is a file, not a turn in the chat.</p>"]
  ];
  function hooks() {
    var w = X.mount("hooks", "Five ways to move context out of the window", "Hover, focus or tap a technique to see when it runs and what it leaves behind.");
    if (!w) return;
    var list = el("div", "cx-hooks"), panel = el("div", "xp-panel"), bind = X.detail(panel), first;
    HOOKS.forEach(function (h, i) {
      var b = el("button", "cx-hook", "<b>" + h[0] + "</b><span>" + h[1] + "</span>");
      b.type = "button";
      var show = bind(b, "<p><b>" + h[0] + ".</b> " + h[1] + ".</p>" + h[2]);
      if (!i) first = show;
      list.appendChild(b);
    });
    w.appendChild(list);
    w.appendChild(panel);
    first();
  }

  /* ---------- 5. Full pages vs compact results ---------- */
  function browser() {
    var w = X.mount("browser", "Full pages or compact results", "Switch the two setups. Same tasks, same model. Only what entered the context changed.");
    if (!w) return;
    var mode = "full";
    w.appendChild(X.seg("What the tool put in context", [["full", "Full pages"], ["compact", "Compact + scripts"]], mode, function (v) { mode = v; draw(); }).el);
    var stats = el("div", "cx-stats");
    w.appendChild(stats);
    var out = X.live("cx-out");
    w.appendChild(out);
    var ratio = 26.71 / 1.98;
    function draw() {
      var c = mode === "compact";
      var rows = [
        ["Turns per task", c ? "about 10" : "about 26"],
        ["Success", c ? "90%" : "78%"],
        ["Total cost", c ? "$1.98" : "$26.71"],
        ["One navigation", c ? "median 117 characters" : "about 17,000 characters"]
      ];
      stats.innerHTML = rows.map(function (r) {
        return '<div class="cx-stat"><span>' + r[0] + "</span><b>" + r[1] + "</b></div>";
      }).join("");
      out.innerHTML = "<p>" + (c
        ? "The tool returns a compact snapshot of the interactive elements. A short script chains several calls, so the pages in between never enter the context."
        : "Each full page stays in the history and is sent again on the next call. About 26 turns per task, 78% success, $26.71 in total.")
        + "</p><p>26.71 ÷ 1.98 = <b>" + X.fmt(ratio, 1) + "</b>, about 13× cheaper for the compact setup, with success moving from 78% to 90%.</p>";
    }
    draw();
  }

  X.ready(function () {
    [layers, catalogue, trim, hooks, browser].forEach(function (f) { f(); });
  });
})();
