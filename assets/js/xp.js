/* XP: shared widget kit for the blog's interactive explainers. Exposes window.XP.
   Markup: <div class="xp" data-xp="name">static fallback (SVG, table…)</div>. Without JS the
   fallback shows; XP.mount hides it and adds a card. Load at the end of the post body:
   <script src="/assets/js/xp.js" defer></script><script src="/assets/explorables/<slug>/widgets.js" defer></script>

   XP.ready(fn)               run fn once xp.css and any XP.css() sheets have loaded (3 s cap); errors are logged, not thrown
   XP.css(href)               load a stylesheet once; returns a Promise
   XP.mount(name, label, hint) → card element, or null when [data-xp=name] is absent
   XP.el(tag, cls, html) · XP.btn(cls, html) · XP.live(cls)   element helpers (live = aria-live="polite")
   XP.reduced()               true under prefers-reduced-motion
   XP.theme() · XP.onTheme(fn)   "light" | "dark"; fn(theme) runs when the site toggle or the OS changes it
   XP.fmt(n, d) · XP.pct(part, whole, d)   en-US numbers; d = max decimals (default 1 / 0)
   XP.slider(o) · XP.number(o)  o = {label, min, max, step, value, format(v), on(v)} → {el, input, get(), set(v)}
   XP.seg(label, [[value, text]…], current, on(value)) → {el, set(value)}   segmented toggle (aria-pressed)
   XP.toggle(label, on, cb(on)) → button role="switch"
   XP.stepper(o)              o = {label, steps, start, render(i, body)} → {el, go(i, force), i()}. Prev/Next, ←/→, Home/End, aria-live
   XP.detail(panel)           → bind(el, html | fn). Hover, focus or click fills the panel; the bound el gets .is-on
   XP.dots(o)                 o = {groups: [[count, cls, label]…], cols, label} → unit grid with a text summary
   XP.bar(o)                  o = {value, max, cls, label} → element with .set(value)
   XP.quiz(o)                 o = {q, options: [[text, correct]…], reveal: html, on(i, ok)} → predict, then reveal */
(function () {
  "use strict";
  if (window.XP) return;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addListener: function () {} }; };
  var RM = mq("(prefers-reduced-motion: reduce)"), DARK = mq("(prefers-color-scheme: dark)");
  var me = document.currentScript, loaded = {}, pend = [], uid = 0;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(cls, html) { var b = el("button", "xp-btn " + (cls || ""), html); b.type = "button"; return b; }
  function live(cls) { var p = el("p", cls); p.setAttribute("aria-live", "polite"); return p; }
  function id(p) { uid += 1; return "xp-" + (p || "i") + uid; }
  function fmt(n, d) { return (+n).toLocaleString("en-US", { maximumFractionDigits: d == null ? 1 : d }); }
  function pct(a, b, d) { return b ? fmt(a / b * 100, d == null ? 0 : d) + "%" : "–"; }

  function css(href) {
    if (loaded[href]) return loaded[href];
    var p = new Promise(function (res) {
      var l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.onload = l.onerror = function () { res(); };
      setTimeout(res, 3000);
      document.head.appendChild(l);
    });
    loaded[href] = p;
    pend.push(p);
    return p;
  }
  function ready(fn) {
    Promise.all(pend).then(function () {
      try { fn(); } catch (e) { if (window.console) console.error(e); }
    });
  }

  function mount(name, label, hint) {
    var m = document.querySelector('[data-xp="' + name + '"]');
    if (!m || m.getAttribute("data-xp-on")) return null;
    m.setAttribute("data-xp-on", "1");
    Array.prototype.forEach.call(m.children, function (c) { c.setAttribute("hidden", ""); });
    m.hidden = false;
    var w = el("div", "xp-card");
    w.setAttribute("role", "group");
    w.setAttribute("aria-label", label);
    if (hint) w.appendChild(el("p", "xp-hint", hint));
    m.appendChild(w);
    return w;
  }

  function theme() {
    var t = document.documentElement.getAttribute("data-theme");
    return t === "dark" || t === "light" ? t : DARK.matches ? "dark" : "light";
  }
  function onTheme(fn) {
    var last = theme();
    function chk() { var t = theme(); if (t !== last) { last = t; fn(t); } }
    if (window.MutationObserver) new MutationObserver(chk).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    if (DARK.addEventListener) DARK.addEventListener("change", chk); else DARK.addListener(chk);
  }

  function input(type, o) {
    var f = el("label", "xp-field", "<span>" + o.label + "</span>");
    var i = el("input"), out = el("output", "xp-out"), iid = id("in");
    i.type = type;
    i.id = iid;
    ["min", "max", "step"].forEach(function (k) { if (o[k] != null) i.setAttribute(k, o[k]); });
    if (type === "number") i.setAttribute("inputmode", "decimal");
    i.value = o.value;
    out.setAttribute("for", iid);
    f.appendChild(i);
    f.appendChild(out);
    function get() { return +i.value; }
    function show() { out.textContent = o.format ? o.format(get()) : type === "range" ? fmt(get()) : ""; }
    i.addEventListener("input", function () { show(); if (o.on) o.on(get()); });
    show();
    return { el: f, input: i, get: get, set: function (v) { i.value = v; show(); if (o.on) o.on(get()); } };
  }

  function seg(label, opts, cur, on) {
    var g = el("div", "xp-seg");
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", label);
    var bs = opts.map(function (o) {
      var b = el("button", "xp-seg-btn", o[1]);
      b.type = "button";
      b.addEventListener("click", function () { set(o[0]); if (on) on(o[0]); });
      g.appendChild(b);
      return b;
    });
    function set(v) { bs.forEach(function (b, i) { b.setAttribute("aria-pressed", String(opts[i][0] === v)); }); }
    set(cur);
    return { el: g, set: set };
  }

  function toggle(label, on, cb) {
    var b = el("button", "xp-switch", '<span class="xp-knob" aria-hidden="true"></span><span>' + label + "</span>");
    b.type = "button";
    b.setAttribute("role", "switch");
    b.setAttribute("aria-checked", String(!!on));
    b.addEventListener("click", function () { on = !on; b.setAttribute("aria-checked", String(on)); if (cb) cb(on); });
    return b;
  }

  function stepper(o) {
    var root = el("div", "xp-stepper"), cur = -1, n = o.steps;
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", o.label || "Steps");
    var bar = el("div", "xp-step-nav");
    var prev = btn("", "← Prev"), next = btn("xp-btn--primary", "Next →"), count = el("span", "xp-step-n");
    var dots = el("span", "xp-step-dots");
    dots.setAttribute("aria-hidden", "true");
    for (var k = 0; k < n; k++) dots.appendChild(el("i"));
    bar.appendChild(prev);
    bar.appendChild(count);
    bar.appendChild(dots);
    bar.appendChild(next);
    var body = live("xp-step-body");
    body.setAttribute("tabindex", "-1");
    root.appendChild(bar);
    root.appendChild(body);
    function go(i, force) {
      i = Math.max(0, Math.min(n - 1, i));
      if (i === cur && !force) return;
      cur = i;
      var a = document.activeElement;
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
      if (a === next && next.disabled) prev.focus();
      if (a === prev && prev.disabled) next.focus();
      count.textContent = "Step " + (i + 1) + " of " + n;
      Array.prototype.forEach.call(dots.children, function (d, j) { d.className = j < i ? "is-past" : j === i ? "is-on" : ""; });
      body.innerHTML = "";
      o.render(i, body);
    }
    prev.addEventListener("click", function () { go(cur - 1); });
    next.addEventListener("click", function () { go(cur + 1); });
    root.addEventListener("keydown", function (e) {
      var t = e.target.tagName;
      if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
      var to = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key];
      if (to == null) return;
      e.preventDefault();
      go(to);
    });
    go(o.start || 0);
    return { el: root, go: go, i: function () { return cur; } };
  }

  function detail(panel) {
    panel.setAttribute("aria-live", "polite");
    var on = null;
    return function bind(e, content) {
      function show() {
        if (on) on.classList.remove("is-on");
        on = e;
        e.classList.add("is-on");
        panel.innerHTML = typeof content === "function" ? content() : content;
      }
      e.addEventListener("mouseenter", show);
      e.addEventListener("focus", show);
      e.addEventListener("click", show);
      return show;
    };
  }

  function dots(o) {
    var g = el("div", "xp-dots"), s = "", txt = [];
    g.style.setProperty("--xp-cols", o.cols || 20);
    o.groups.forEach(function (x) {
      for (var k = 0; k < x[0]; k++) s += '<i class="' + (x[1] || "") + '"></i>';
      if (x[2]) txt.push(fmt(x[0], 0) + " " + x[2]);
    });
    g.innerHTML = s;
    g.setAttribute("role", "img");
    g.setAttribute("aria-label", o.label || txt.join(", "));
    return g;
  }

  function bar(o) {
    var b = el("span", "xp-bar " + (o.cls || ""), "<i></i>");
    b.setAttribute("role", "img");
    b.set = function (v) {
      var p = o.max ? Math.max(0, Math.min(100, v / o.max * 100)) : 0;
      b.firstChild.style.width = p + "%";
      b.setAttribute("aria-label", (o.label || "") + " " + fmt(p, 0) + "%");
    };
    b.set(o.value || 0);
    return b;
  }

  function quiz(o) {
    var w = el("div", "xp-quiz"), pick = -1, done = false;
    w.appendChild(el("p", "xp-quiz-q", o.q));
    var opts = el("div", "xp-quiz-opts");
    opts.setAttribute("role", "group");
    opts.setAttribute("aria-label", "Your prediction");
    var bs = o.options.map(function (x, i) {
      var b = el("button", "xp-quiz-opt", x[0]);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        if (done) return;
        pick = i;
        bs.forEach(function (c, j) { c.setAttribute("aria-pressed", String(j === i)); });
        rev.disabled = false;
      });
      opts.appendChild(b);
      return b;
    });
    w.appendChild(opts);
    var ctl = el("div", "xp-ctl"), rev = btn("xp-btn--primary", "Reveal"), again = btn("xp-btn--ghost", "Try again");
    rev.disabled = true;
    again.hidden = true;
    ctl.appendChild(rev);
    ctl.appendChild(again);
    w.appendChild(ctl);
    var out = live("xp-quiz-out");
    w.appendChild(out);
    rev.addEventListener("click", function () {
      if (pick < 0) return;
      done = true;
      var ok = !!o.options[pick][1];
      bs.forEach(function (c, j) { c.disabled = true; c.classList.add(o.options[j][1] ? "is-right" : j === pick ? "is-wrong" : "is-dim"); });
      out.innerHTML = '<strong class="' + (ok ? "xp-ok" : "xp-no") + '">' + (ok ? "Right." : "Not quite.") + "</strong> " + o.reveal;
      rev.hidden = true;
      again.hidden = false;
      again.focus();
      if (o.on) o.on(pick, ok);
    });
    again.addEventListener("click", function () {
      done = false;
      pick = -1;
      bs.forEach(function (c) { c.disabled = false; c.className = "xp-quiz-opt"; c.setAttribute("aria-pressed", "false"); });
      out.innerHTML = "";
      rev.hidden = false;
      rev.disabled = true;
      again.hidden = true;
      bs[0].focus();
      if (o.on) o.on(-1, false);
    });
    return w;
  }

  window.XP = {
    ready: ready, css: css, mount: mount, el: el, btn: btn, live: live,
    reduced: function () { return RM.matches; }, theme: theme, onTheme: onTheme,
    fmt: fmt, pct: pct, seg: seg, toggle: toggle, stepper: stepper, detail: detail, dots: dots, bar: bar, quiz: quiz,
    slider: function (o) { return input("range", o); }, number: function (o) { return input("number", o); }
  };
  if (window.Promise && me && me.src) css(me.src.replace(/\/js\/xp\.js(\?.*)?$/, "/css/xp.css"));
})();
