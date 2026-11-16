/* Site-wide enhancements: theme toggle, shrinking header, scroll reveal,
   hero typing effect, interactive experience timeline. Content renders without this file. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { /* storage blocked: theme just isn't remembered */ }
  }

  /* ---------- Theme toggle: system -> light -> dark -> system ---------- */
  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    var order = ["system", "light", "dark"];
    var current = function () { return root.getAttribute("data-theme") || "system"; };
    var render = function () {
      var mode = current();
      var next = order[(order.indexOf(mode) + 1) % order.length];
      toggle.setAttribute("data-mode", mode);
      toggle.setAttribute("aria-label", "Theme: " + mode + ". Switch to " + next);
      toggle.title = "Theme: " + mode;
    };
    toggle.addEventListener("click", function () {
      var next = order[(order.indexOf(current()) + 1) % order.length];
      if (next === "system") { root.removeAttribute("data-theme"); store("theme", null); }
      else { root.setAttribute("data-theme", next); store("theme", next); }
      render();
    });
    render();
  }

  /* ---------- Sticky header shrinks once the page scrolls ---------- */
  var header = document.querySelector("[data-header]");
  if (header) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle("is-scrolled", window.scrollY > 12);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Scroll reveal ---------- */
  var revealables = document.querySelectorAll("[data-reveal]");
  if (revealables.length && "IntersectionObserver" in window && !reduceMotion.matches) {
    root.classList.add("reveal-ready");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Hero typing effect on the role line ---------- */
  var typing = document.querySelector("[data-typing]");
  if (typing && !reduceMotion.matches) {
    var full = typing.textContent;
    typing.textContent = "";
    // Real text stays available to assistive tech; only the animated copy is hidden from it.
    var srText = document.createElement("span");
    srText.className = "sr-only";
    srText.textContent = full;
    var textNode = document.createElement("span");
    textNode.setAttribute("aria-hidden", "true");
    typing.appendChild(srText);
    typing.appendChild(textNode);
    typing.classList.add("is-typing");
    var i = 0;
    var step = function () {
      i += 1;
      textNode.textContent = full.slice(0, i);
      if (i < full.length) setTimeout(step, 45 + Math.random() * 45);
      else setTimeout(function () { typing.classList.remove("is-typing"); typing.classList.add("is-typed"); }, 1600);
    };
    setTimeout(step, 450);
  }

  /* ---------- Experience timeline: expand/collapse + badge filter ---------- */
  var timeline = document.querySelector("[data-timeline]");
  if (timeline) {
    var items = Array.prototype.slice.call(timeline.querySelectorAll(".tl-item"));
    var expandAll = document.querySelector("[data-exp-expand]");
    var emptyMsg = document.querySelector("[data-exp-empty]");

    var setOpen = function (item, open) {
      var btn = item.querySelector(".tl-toggle");
      item.classList.toggle("is-collapsed", !open);
      btn.setAttribute("aria-expanded", String(open));
    };
    var syncExpandLabel = function () {
      if (!expandAll) return;
      var visible = items.filter(function (it) { return !it.hidden; });
      var allOpen = visible.length > 0 && visible.every(function (it) { return !it.classList.contains("is-collapsed"); });
      expandAll.textContent = allOpen ? "Collapse all" : "Expand all";
      expandAll.setAttribute("data-state", allOpen ? "open" : "closed");
    };

    // Start with only the current role open; everything is open without JS.
    items.forEach(function (item, idx) { setOpen(item, idx === 0); });
    timeline.classList.add("is-interactive");

    items.forEach(function (item) {
      item.querySelector(".tl-toggle").addEventListener("click", function () {
        setOpen(item, item.classList.contains("is-collapsed"));
        syncExpandLabel();
      });
    });

    if (expandAll) {
      expandAll.addEventListener("click", function () {
        var open = expandAll.getAttribute("data-state") !== "open";
        items.forEach(function (it) { if (!it.hidden) setOpen(it, open); });
        syncExpandLabel();
      });
    }

    var filterGroup = document.querySelector("[data-exp-filter]");
    if (filterGroup) {
      var buttons = Array.prototype.slice.call(filterGroup.querySelectorAll("button"));
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var f = btn.getAttribute("data-filter");
          buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
          var shown = 0;
          items.forEach(function (it) {
            var match = f === "all" || it.getAttribute("data-badge") === f;
            it.hidden = !match;
            if (match) { shown += 1; it.classList.add("is-visible"); }
          });
          if (emptyMsg) emptyMsg.hidden = shown > 0;
          syncExpandLabel();
        });
      });
    }
    syncExpandLabel();
  }
})();
