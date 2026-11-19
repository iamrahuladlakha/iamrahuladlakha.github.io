/* Interactive widgets for "OpenTelemetry for AI Agents". Progressive enhancement:
   each widget mounts on a [data-xp] element and hides the static fallback inside it.
   Every figure comes from the post; calculator defaults equal the post's numbers. */
(function () {
  "use strict";
  var RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: true };
  var me = document.currentScript;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(cls, html) { var b = el("button", cls, html); b.type = "button"; return b; }
  function live(cls) { var p = el("p", cls); p.setAttribute("aria-live", "polite"); return p; }
  function fmt(n, d) { return n.toLocaleString("en-US", { maximumFractionDigits: d == null ? 1 : d }); }
  function hex(n) {
    var b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return Array.prototype.map.call(b, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }
  function seg(label, opts, cur, on) {
    var g = el("div", "xp-seg");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", label);
    var bs = opts.map(function (o) {
      var b = btn("xp-seg-btn", o[1]);
      b.addEventListener("click", function () { set(o[0]); on(o[0]); });
      g.appendChild(b);
      return b;
    });
    function set(v) { bs.forEach(function (b, i) { b.setAttribute("aria-pressed", String(opts[i][0] === v)); }); }
    set(cur);
    return g;
  }
  function toggle(label, on, cb) {
    var b = btn("xp-switch", '<span class="xp-knob" aria-hidden="true"></span>' + label);
    b.setAttribute("role", "switch");
    b.setAttribute("aria-checked", String(on));
    b.addEventListener("click", function () { on = !on; b.setAttribute("aria-checked", String(on)); cb(on); });
    return b;
  }
  function mount(name, label, hint) {
    var m = $('[data-xp="' + name + '"]');
    if (!m) return null;
    Array.prototype.forEach.call(m.children, function (c) { c.setAttribute("hidden", ""); });
    m.hidden = false;
    var w = el("div", "xp-card");
    w.setAttribute("role", "group");
    w.setAttribute("aria-label", label);
    if (hint) w.appendChild(el("p", "xp-hint", hint));
    m.appendChild(w);
    return w;
  }
  function center(stage, e) {
    var a = stage.getBoundingClientRect(), b = e.getBoundingClientRect();
    return [b.left - a.left + b.width / 2, b.top - a.top + b.height / 2];
  }
  // Move a dot from one element's centre to another's. Resolves at once under reduced motion.
  function fly(stage, from, to, cls, dur) {
    return new Promise(function (res) {
      if (RM.matches || !stage.animate || !from.offsetParent || !to.offsetParent) return res();
      var p = center(stage, from), q = center(stage, to), d = el("span", "xp-fly " + (cls || ""));
      d.setAttribute("aria-hidden", "true");
      d.style.left = p[0] + "px";
      d.style.top = p[1] + "px";
      stage.appendChild(d);
      var a = d.animate([{ transform: "translate(0,0)" }, { transform: "translate(" + (q[0] - p[0]) + "px," + (q[1] - p[1]) + "px)" }],
        { duration: dur || 600, easing: "cubic-bezier(0.22,1,0.36,1)" });
      a.onfinish = a.oncancel = function () { d.remove(); res(); };
    });
  }

  /* ---------- 1. traceparent anatomy and propagation ---------- */
  function traceparent() {
    var w = mount("traceparent", "traceparent anatomy and propagation", "Start a new trace, set the flags and the carrier, then send the request to the MCP tool server.");
    if (!w) return;
    var st = { trace: hex(16), span: hex(8), flags: "01", via: "mcp", sent: false, own: "" };
    var hdr = el("p", "xp-tp");
    hdr.setAttribute("aria-live", "polite");
    w.appendChild(hdr);
    w.appendChild(el("ul", "xp-tp-legend",
      '<li><i class="xp-c0"></i><b>version</b> <code>00</code></li>' +
      '<li><i class="xp-c1"></i><b>trace ID</b> 16 bytes, 32 hex characters</li>' +
      '<li><i class="xp-c2"></i><b>parent span ID</b> 8 bytes, 16 hex: the caller\'s current span</li>' +
      '<li><i class="xp-c3"></i><b>flags</b> <code>01</code> means “this trace is being kept”</li>'));
    var ctl = el("div", "xp-ctl");
    var nw = btn("xp-btn", "New trace");
    var send = btn("xp-btn xp-btn--primary", "Send request →");
    ctl.appendChild(nw);
    ctl.appendChild(seg("Flags", [["01", "01 kept"], ["00", "00 not kept"]], st.flags, function (v) { st.flags = v; reset(); }));
    ctl.appendChild(seg("Carrier", [["http", "HTTP header"], ["mcp", "MCP params._meta"]], st.via, function (v) { st.via = v; reset(); }));
    ctl.appendChild(send);
    w.appendChild(ctl);
    var stage = el("div", "xp-hop");
    var agent = el("div", "xp-svc", '<p class="xp-svc-name">agent service</p>');
    var server = el("div", "xp-svc", '<p class="xp-svc-name">MCP tool server</p>');
    function row(parent, html, cls) { var r = el("div", "xp-sp " + (cls || ""), html); parent.appendChild(r); return r; }
    row(agent, "invoke_agent support_agent");
    row(agent, "chat <span>model asks for tool</span>", "xp-d1");
    var tool = row(agent, "", "xp-d1 xp-hot");
    var link = row(server, '<span class="xp-badge">link</span> HTTP request that carried the message', "xp-link");
    var srv = row(server, "", "xp-hot");
    row(server, "database query", "xp-d1");
    stage.appendChild(agent);
    stage.appendChild(server);
    w.appendChild(stage);
    var carrier = el("pre", "xp-carrier");
    w.appendChild(carrier);
    var note = el("p", "xp-note");
    w.appendChild(note);
    var status = live("xp-status");
    w.appendChild(status);
    w.appendChild(el("p", "xp-math", "Sixteen random bytes give 2<sup>128</sup> ≈ 3.4 × 10<sup>38</sup> possible trace IDs, so in practice two of them never collide."));

    function tp(short) {
      var t = short ? st.trace.slice(0, 8) + "…" : st.trace;
      return '<span class="xp-c0">00</span>-<span class="xp-c1">' + t + '</span>-<span class="xp-c2">' + st.span + '</span>-<span class="xp-c3">' + st.flags + "</span>";
    }
    function render() {
      hdr.innerHTML = '<span class="xp-tp-key">traceparent:</span> ' + tp();
      tool.innerHTML = "execute_tool lookup_order <span>span ID <b class=\"xp-c2t\">" + st.span + "</b></span>";
      var kept = st.flags === "01";
      if (!st.sent) {
        srv.className = "xp-sp xp-hot is-wait";
        srv.innerHTML = "server span: lookup_order <span>no context received yet: without it, the server starts a new, unconnected trace</span>";
      } else {
        srv.className = "xp-sp xp-hot is-got" + (kept ? "" : " is-drop");
        srv.innerHTML = "server span: lookup_order" +
          '<span>trace ID <b class="xp-c1t">' + st.trace.slice(0, 8) + "…</b> (same)</span>" +
          '<span>parent <b class="xp-c2t">' + st.span + "</b> (the caller's span)</span>" +
          "<span>own span ID " + st.own + "</span>" +
          "<span>" + (kept ? "kept: flag 01 respected" : "not kept: flag 00 respected") + "</span>";
      }
      link.hidden = !(st.via === "mcp" && st.sent);
      note.textContent = st.via === "http"
        ? "MCP needed a variation on this. One MCP connection can carry many requests inside a single HTTP request, or run over a local pipe with no HTTP at all, so a header isn't enough."
        : "The MCP conventions put traceparent, tracestate and baggage into each request's params._meta field instead.";
      carrier.innerHTML = st.via === "http"
        ? '<span class="xp-cap">HTTP request headers</span>traceparent: ' + tp(true) + "\nbaggage: …"
        : '<span class="xp-cap">MCP request</span>"params": {\n  …\n  "_meta": {\n    "traceparent": "' + tp(true) + '",\n    "tracestate": "…",\n    "baggage": "…"\n  }\n}';
    }
    function reset() { st.sent = false; status.textContent = ""; render(); }
    nw.addEventListener("click", function () { st.trace = hex(16); st.span = hex(8); reset(); });
    send.addEventListener("click", function () {
      st.sent = false;
      render();
      send.disabled = true;
      fly(stage, tool, srv, "xp-fly--ctx", 800).then(function () {
        st.sent = true;
        st.own = hex(8);
        render();
        send.disabled = false;
        status.innerHTML = "The server span copied the trace ID, became a child of the caller's span <code>" + st.span + "</code>, and " +
          (st.flags === "01" ? "keeps the trace." : "respects the flag: not kept.") +
          (st.via === "mcp" ? " The HTTP request that happened to carry the message is recorded as a <em>link</em> (a pointer to a span that isn't the parent), because one MCP request might be retried over several HTTP requests." : "");
      });
    });
    render();
  }

  /* ---------- 2. In-process pipeline ---------- */
  var JOBS = {
    tracer: "Your code, or a library, calls a tracer to start and end spans. OTel keeps track of the current span even across async code, so nesting happens without you passing parents around.",
    batch: "The batch processor queues them, and it's also the last place you can filter or mask data before anything leaves the program.",
    exporter: "An exporter then sends batches in OTel's wire format, OTLP, over HTTP or gRPC.",
    collector: "Optionally, a separate collector process receives spans from many services, applies central filtering, masking and sampling, and fans them out to more than one backend. Tail sampling and central masking live here.",
    backend: "That's the “record once, export many” story. You instrument in one format and attach one exporter per destination."
  };
  function pipeline() {
    var w = mount("pipeline", "In-process span pipeline", "Press Play to watch spans flow out. Click a stage to see its job.");
    if (!w) return;
    var playing = false, batching = true, collector = true, burst = false;
    var CAP = 16, LIMIT = 2600; // animation only, not OTel settings
    var ctl = el("div", "xp-ctl");
    var play = btn("xp-btn xp-btn--primary", "Play");
    ctl.appendChild(play);
    ctl.appendChild(seg("Span processor", [["each", "Export each span"], ["batch", "Batch"]], "batch", function (v) { batching = v === "batch"; q = 0; t = 0; draw(); }));
    ctl.appendChild(seg("Traffic", [["steady", "Steady"], ["burst", "Burst"]], "steady", function (v) { burst = v === "burst"; }));
    ctl.appendChild(toggle("With collector", true, function (v) { collector = v; draw(); }));
    w.appendChild(ctl);
    var stage = el("div", "xp-pipe");
    var S = {};
    [["tracer", "tracer", "start / end"], ["batch", "batch", "mask, filter"], ["exporter", "exporter", "OTLP"], ["collector", "collector", "optional"]].forEach(function (s) {
      var b = btn("xp-stg xp-stg--" + s[0], "<b>" + s[1] + "</b><span>" + s[2] + "</span>");
      b.addEventListener("click", function () { info.textContent = JOBS[s[0]]; });
      S[s[0]] = b;
      stage.appendChild(b);
    });
    var meter = el("span", "xp-meter", '<i class="xp-q"></i><i class="xp-t"></i>');
    meter.setAttribute("aria-hidden", "true");
    S.batch.appendChild(meter);
    var be = el("div", "xp-backends");
    S.b1 = btn("xp-stg", "<b>LLM tracing</b>");
    S.b2 = btn("xp-stg", "<b>infra monitoring</b>");
    [S.b1, S.b2].forEach(function (b) { b.addEventListener("click", function () { info.textContent = JOBS.backend; }); be.appendChild(b); });
    stage.appendChild(be);
    w.appendChild(stage);
    var cnt = el("p", "xp-cnt");
    w.appendChild(cnt);
    var why = el("p", "xp-why");
    w.appendChild(why);
    w.appendChild(el("p", "xp-note", "Slow motion, not to scale. A batch goes out when it hits a size limit or a time limit, whichever comes first, so those 30 uploads a second become about one."));
    var info = live("xp-info");
    info.textContent = JOBS.batch;
    w.appendChild(info);
    var sr = live("xp-sr");
    w.appendChild(sr);

    var spans = 0, uploads = 0, q = 0, t = 0, since = 0, last = 0;
    function pulse(b) { b.classList.remove("is-pulse"); void b.offsetWidth; b.classList.add("is-pulse"); }
    function draw() {
      S.collector.hidden = !collector;
      stage.classList.toggle("no-col", !collector);
      $(".xp-q", meter).style.width = (q / CAP * 100) + "%";
      $(".xp-t", meter).style.width = (batching && q ? t / LIMIT * 100 : 0) + "%";
      meter.hidden = !batching;
      cnt.innerHTML = "spans ended <b>" + spans + "</b> · uploads sent <b>" + uploads + "</b>";
    }
    function ship(n) {
      uploads += 1;
      draw();
      var hops = (batching ? [S.batch] : []).concat([S.exporter], collector ? [S.collector] : []);
      var chain = Promise.resolve();
      hops.forEach(function (h, i) {
        if (i === 0) return;
        chain = chain.then(function () { pulse(hops[i - 1]); return fly(stage, hops[i - 1], h, n > 1 ? "xp-fly--batch" : "", 380); });
      });
      chain.then(function () {
        var from = hops[hops.length - 1];
        pulse(from);
        fly(stage, from, S.b1, "", 380).then(function () { pulse(S.b1); });
        fly(stage, from, S.b2, "", 380).then(function () { pulse(S.b2); });
      });
    }
    function flush(reason) {
      var n = q;
      q = 0; t = 0;
      why.textContent = "Batch of " + n + " spans sent: " + reason + " hit first.";
      ship(n);
    }
    function frame(now) {
      if (!playing) return;
      var dt = Math.min(100, now - (last || now));
      last = now;
      since += dt;
      if (batching && q) t += dt;
      var every = burst ? 60 : 300;
      while (since >= every) {
        since -= every;
        spans += 1;
        fly(stage, S.tracer, batching ? S.batch : S.exporter, "xp-fly--span", 420).then(function () {
          if (!batching) { why.textContent = "Every finished span goes over the network straight away."; ship(1); return; }
          q += 1;
          if (q >= CAP) flush("the size limit");
        });
      }
      if (batching && q && t >= LIMIT) flush("the time limit");
      draw();
      requestAnimationFrame(frame);
    }
    function setPlay(v) {
      playing = v;
      play.textContent = v ? "Pause" : "Play";
      play.setAttribute("aria-pressed", String(v));
      if (v) { last = 0; requestAnimationFrame(frame); sr.textContent = ""; }
      else sr.textContent = "Paused: " + spans + " spans ended, " + uploads + " uploads sent.";
    }
    play.addEventListener("click", function () { setPlay(!playing); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { if (!e[0].isIntersecting && playing) setPlay(false); }).observe(w);
    }
    draw();
  }

  /* ---------- 3. GenAI span tree explorer ---------- */
  var KIND = { CLIENT: "a call out to another program, including the wait for the reply", INTERNAL: "work done in-process" };
  var TREE = [
    ["invoke_agent", "support_agent", "INTERNAL", "the whole run"],
    ["chat", "gpt-4o", "CLIENT", "model asks for a tool"],
    ["execute_tool", "lookup_order", "INTERNAL", "the tool runs"],
    ["chat", "gpt-4o", "CLIENT", "model writes the answer"]
  ];
  function spantree() {
    var w = mount("spantree", "GenAI span tree explorer", "Hover or focus a span to see what it covers. The toggles below show three of the conventions' rules.");
    if (!w) return;
    var badName = false, perAttempt = false, back = true, sel = 0, reqs = [hex(4), hex(4), hex(4)];
    var list = el("div", "xp-tree");
    w.appendChild(list);
    var det = live("xp-det");
    w.appendChild(det);
    var rules = el("div", "xp-rules");
    function rule(title, s, body) {
      var r = el("div", "xp-rule", "<p class=\"xp-rule-t\">" + title + "</p>");
      r.appendChild(s);
      r.appendChild(body);
      rules.appendChild(r);
    }
    var nameBox = el("div", "xp-rule-b"), retryBox = el("div", "xp-rule-b"), handBox = el("div", "xp-rule-b");
    rule("Names stay low-cardinality", seg("Span name", [["good", "Good"], ["bad", "Bad: request ID in name"]], "good", function (v) { badName = v === "bad"; draw(); }), nameBox);
    rule("One span per logical operation", seg("Retried model call", [["one", "One span, all attempts"], ["many", "A span per attempt"]], "one", function (v) { perAttempt = v === "many"; draw(); }), retryBox);
    rule("Handoff placement", seg("Handoff", [["back", "Control comes back"], ["on", "Control passed on for good"]], "back", function (v) { back = v === "back"; draw(); }), handBox);
    w.appendChild(rules);

    function rows() {
      var r = TREE.map(function (x, i) { return { op: x[0], name: x[0] + " " + x[1] + (i === 2 && badName ? " " + reqs[0] : ""), kind: x[2], covers: x[3], i: i }; });
      if (perAttempt) r.splice(2, 0, { op: "chat", name: "chat gpt-4o", kind: "CLIENT", covers: "model asks for a tool (the retry)", i: 1, wrong: true });
      return r;
    }
    function show(x) {
      det.innerHTML = "<dl><dt>Span name</dt><dd><code>" + x.name + "</code></dd><dt>Operation</dt><dd><code>" + x.op +
        "</code></dd><dt>Span kind</dt><dd><code>" + x.kind + "</code>: " + KIND[x.kind] + "</dd><dt>Covers</dt><dd>" + x.covers +
        (x.i === 1 && !perAttempt ? ", one span covering all the attempts" : "") + "</dd></dl>";
    }
    function draw() {
      list.innerHTML = "";
      var r = rows();
      r.forEach(function (x, k) {
        var pre = k === 0 ? "" : k === r.length - 1 ? "└── " : "├── ";
        var b = btn("xp-node" + (x.wrong || (x.i === 2 && badName) ? " is-wrong" : "") + (k === sel ? " is-on" : ""),
          '<span class="xp-pre" aria-hidden="true">' + pre + '</span><code>' + x.name + '</code><span class="xp-kind">' + x.kind + "</span><span class=\"xp-cov\">" + x.covers + "</span>");
        function pick() { sel = k; $$(".xp-node", list).forEach(function (n, j) { n.classList.toggle("is-on", j === k); }); show(x); }
        b.addEventListener("mouseenter", pick);
        b.addEventListener("focus", pick);
        b.addEventListener("click", pick);
        list.appendChild(b);
      });
      if (sel >= r.length) sel = 0;
      show(r[sel]);
      nameBox.innerHTML = (badName
        ? "<p>Three requests, three span names:</p><ul>" + reqs.map(function (q) { return "<li><code>execute_tool lookup_order " + q + "</code></li>"; }).join("") + "</ul>"
        : "<p>Three requests, one span name:</p><ul>" + reqs.map(function () { return "<li><code>execute_tool lookup_order</code></li>"; }).join("") + "</ul>") +
        "<p>A span name is the operation plus a stable target, like <code>execute_tool lookup_order</code>, and never a request ID." + (badName ? " <small>(Request IDs here are random examples.)</small>" : "") + "</p>";
      retryBox.innerHTML = perAttempt
        ? "<p class=\"xp-bad\">Not how the conventions record it: each attempt became its own span.</p>"
        : "<p>A model call that the SDK retried automatically is one span covering all the attempts.</p>";
      handBox.innerHTML = '<pre class="xp-mini">' + (back
        ? "invoke_agent support_agent\n└── execute_tool <i>(handoff tool)</i>\n    └── <b>invoke_agent <i>(target agent)</i></b>"
        : "invoke_agent support_agent\n│   └── execute_tool <i>(handoff tool)</i>\n<b>invoke_agent <i>(target agent)</i></b>") +
        "</pre><p>A handoff to another agent through a tool is recorded on the tool span. " + (back
          ? "If control comes back to the caller, the target agent's span sits under the tool span."
          : "If control is passed on for good, it becomes a sibling of the caller.") + "</p>";
    }
    draw();
  }

  /* ---------- 4. Sampling calculator ---------- */
  function field(id, label, attrs, val) {
    var f = el("label", "xp-field", "<span>" + label + "</span>");
    var i = el("input");
    for (var k in attrs) i.setAttribute(k, attrs[k]);
    i.id = id;
    i.value = val;
    f.appendChild(i);
    var o = el("output", "xp-out");
    o.setAttribute("for", id);
    f.appendChild(o);
    return { f: f, i: i, o: o };
  }
  function sampling() {
    var w = mount("sampling", "Sampling calculator", "Change the traffic, the failure rate or the keep rate. The defaults are the post's numbers.");
    if (!w) return;
    var D = { n: 10000, f: 1, r: 20 };
    var grid = el("div", "xp-fields");
    var N = field("xp-n", "Traces per day, N", { type: "number", min: 100, max: 1000000, step: 100, inputmode: "numeric" }, D.n);
    var F = field("xp-f", "Failure rate", { type: "range", min: 0, max: 20, step: 0.1 }, D.f);
    var R = field("xp-r", "Keep rate, r", { type: "range", min: 0, max: 100, step: 1 }, D.r);
    [N, F, R].forEach(function (x) { grid.appendChild(x.f); x.i.addEventListener("input", calc); });
    var rst = btn("xp-btn xp-btn--ghost", "Reset to the post's numbers");
    rst.addEventListener("click", function () { N.i.value = D.n; F.i.value = D.f; R.i.value = D.r; calc(); });
    grid.appendChild(rst);
    w.appendChild(grid);
    var out = el("div", "xp-samp");
    w.appendChild(out);
    var sr = live("xp-sr");
    w.appendChild(sr);
    w.appendChild(el("p", "xp-note", "The catch is where it runs. Tail sampling needs a collector that holds every in-flight trace in memory until it ends. That's fine for a quick web request. It's much harder for an agent run that takes minutes, or that pauses to wait for a human to approve something."));
    var to;
    function squares(total, kept, u) {
      var s = "";
      for (var k = 0; k < Math.ceil(total / u); k++) s += k < Math.round(kept / u) ? '<i class="on"></i>' : "<i></i>";
      return '<span class="xp-units" aria-hidden="true">' + s + "</span>";
    }
    function calc() {
      var n = Math.max(0, Math.round(+N.i.value || 0)), f = +F.i.value, r = +R.i.value / 100;
      var E = Math.round(n * f / 100);
      var head = r * n, headE = r * E, tail = E + r * (n - E), extra = tail - head;
      var pct = head > 0 ? Math.round(extra / head * 100) : null;
      F.o.textContent = fmt(f) + "% → E = " + fmt(E, 0) + " failures";
      R.o.textContent = fmt(r * 100, 0) + "% (r = " + fmt(r, 2) + ")";
      var u = Math.max(1, Math.ceil(E / 100));
      var rs = fmt(r, 2);
      out.innerHTML =
        '<div class="xp-col"><p class="xp-col-t">Head sampling</p>' +
        '<p class="xp-eq">kept = r × N = ' + rs + " × " + fmt(n, 0) + " = <b>" + fmt(head) + "</b></p>" +
        '<p class="xp-eq">failures kept = r × E = ' + rs + " × " + fmt(E, 0) + " = <b>" + fmt(headE) + "</b></p>" +
        '<span class="xp-kbar"><i style="width:' + (n ? head / n * 100 : 0) + '%"></i></span>' +
        '<p class="xp-fail-t">failures on file: <b>' + fmt(headE) + "</b> of " + fmt(E, 0) + "</p>" + squares(E, headE, u) + "</div>" +
        '<div class="xp-col"><p class="xp-col-t">Tail sampling</p>' +
        '<p class="xp-eq">kept = E + r × (N − E) = ' + fmt(E, 0) + " + " + rs + " × " + fmt(n - E, 0) + " = <b>" + fmt(tail) + "</b></p>" +
        '<p class="xp-eq">failures kept = E = <b>' + fmt(E, 0) + "</b></p>" +
        '<span class="xp-kbar"><i style="width:' + (n ? tail / n * 100 : 0) + '%"></i></span>' +
        '<p class="xp-fail-t">failures on file: <b>' + fmt(E, 0) + "</b> of " + fmt(E, 0) + "</p>" + squares(E, E, u) + "</div>" +
        '<p class="xp-extra">Tail keeps <b>+' + fmt(extra) + "</b> traces" + (pct != null ? " (about " + pct + "% more storage)" : "") +
        ", and all " + fmt(E, 0) + " failures are on file. <span>Bars: share of N kept. Squares: 1 square = " + u + " failure" + (u > 1 ? "s" : "") + ".</span></p>";
      clearTimeout(to);
      to = setTimeout(function () {
        sr.textContent = "Head sampling keeps " + fmt(head) + " traces and " + fmt(headE) + " failures. Tail sampling keeps " + fmt(tail) + " traces and all " + fmt(E, 0) + " failures, " + fmt(extra) + " more.";
      }, 500);
    }
    calc();
  }

  /* ---------- 5. TPOT calculator ---------- */
  function tpot() {
    var w = mount("tpot", "Time per output token calculator", "Change the timings or the token count to see TPOT update.");
    if (!w) return;
    var D = { tr: 4.2, tf: 0.6, n: 181 };
    var grid = el("div", "xp-fields");
    var A = field("xp-tr", "T<sub>request</sub> (s)", { type: "number", min: 0, step: 0.1, inputmode: "decimal" }, D.tr);
    var B = field("xp-tf", "T<sub>first</sub> (s)", { type: "number", min: 0, step: 0.1, inputmode: "decimal" }, D.tf);
    var C = field("xp-no", "n<sub>out</sub> (tokens)", { type: "number", min: 2, step: 1, inputmode: "numeric" }, D.n);
    [A, B, C].forEach(function (x) { grid.appendChild(x.f); x.i.addEventListener("input", calc); });
    var rst = btn("xp-btn xp-btn--ghost", "Reset to the post's numbers");
    rst.addEventListener("click", function () { A.i.value = D.tr; B.i.value = D.tf; C.i.value = D.n; calc(); });
    grid.appendChild(rst);
    w.appendChild(grid);
    var eq = live("xp-tpot");
    w.appendChild(eq);
    var bar = el("div", "xp-tl", '<span class="xp-tl-w"></span><span class="xp-tl-g"></span>');
    bar.setAttribute("aria-hidden", "true");
    w.appendChild(bar);
    var leg = el("p", "xp-tl-leg");
    w.appendChild(leg);
    function calc() {
      var tr = +A.i.value, tf = +B.i.value, n = Math.round(+C.i.value);
      var bad = !(tr > 0) || tf < 0 || tf > tr ? "The first token has to arrive between 0 and T_request." : !(n >= 2) ? "n_out needs at least 2 tokens." : "";
      if (bad) { eq.innerHTML = '<span class="xp-bad">' + bad + "</span>"; return; }
      var v = (tr - tf) / (n - 1);
      eq.innerHTML = "TPOT = (" + fmt(tr, 3) + " − " + fmt(tf, 3) + ") ÷ " + fmt(n - 1, 0) + " = <b>" + fmt(v, 4) + " s per token</b>";
      var p = tf / tr * 100;
      $(".xp-tl-w", bar).style.width = p + "%";
      $(".xp-tl-g", bar).style.width = (100 - p) + "%";
      leg.innerHTML = '<span><i class="xp-sw-w"></i>wait for first token ' + fmt(tf, 3) + ' s</span><span><i class="xp-sw-g"></i>generation ' + fmt(tr - tf, 3) + " s for " + fmt(n - 1, 0) + " tokens after the first</span>";
    }
    calc();
  }

  function init() {
    [traceparent, pipeline, spantree, sampling, tpot].forEach(function (f) {
      try { f(); } catch (e) { if (window.console) console.error(e); }
    });
  }
  // Load this post's stylesheet first so the widgets never paint unstyled.
  var href = me && me.src ? me.src.replace("/js/explorables/", "/css/explorables/").replace(/\.js(\?.*)?$/, ".css") : null;
  if (!href || !window.Promise || !window.crypto) return;
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  var done = false;
  function go() { if (!done) { done = true; init(); } }
  link.onload = go;
  link.onerror = go;
  setTimeout(go, 3000);
  document.head.appendChild(link);
})();
