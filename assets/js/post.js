/* Post page: reading-progress bar, heading anchors, auto table of contents
   with active-section highlight, copy-link button. */
(function () {
  "use strict";

  var body = document.querySelector("[data-post-body]");
  if (!body) return;

  /* ---------- Reading progress ---------- */
  var bar = document.querySelector("[data-progress]");
  if (bar) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var rect = body.getBoundingClientRect();
      var start = rect.top + window.scrollY - window.innerHeight * 0.25;
      var end = rect.bottom + window.scrollY - window.innerHeight;
      var p = end > start ? (window.scrollY - start) / (end - start) : 1;
      bar.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)).toFixed(4) + ")";
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  /* ---------- Heading ids + anchor links ---------- */
  var used = {};
  Array.prototype.forEach.call(document.querySelectorAll("[id]"), function (el) { used[el.id] = true; });
  function slugify(text) {
    var base = text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";
    var id = base, n = 2;
    while (used[id]) { id = base + "-" + n; n += 1; }
    used[id] = true;
    return id;
  }

  var headings = Array.prototype.slice.call(body.querySelectorAll("h2, h3"));
  headings.forEach(function (h) {
    if (!h.id) h.id = slugify(h.textContent);
    var a = document.createElement("a");
    a.className = "heading-anchor";
    a.href = "#" + h.id;
    a.setAttribute("aria-label", "Link to section: " + h.textContent.trim());
    a.textContent = "#";
    h.appendChild(a);
  });

  /* ---------- Table of contents ---------- */
  var toc = document.querySelector("[data-toc]");
  var tocList = document.querySelector("[data-toc-list]");
  if (toc && tocList && headings.length >= 2) {
    var links = {};
    var currentLi = null;
    headings.forEach(function (h) {
      var li = document.createElement("li");
      li.className = "toc-item toc-" + h.tagName.toLowerCase();
      var a = document.createElement("a");
      a.href = "#" + h.id;
      // Heading text without the appended "#" anchor.
      var clone = h.cloneNode(true);
      var anchor = clone.querySelector(".heading-anchor");
      if (anchor) anchor.remove();
      a.textContent = clone.textContent.trim();
      li.appendChild(a);
      tocList.appendChild(li);
      links[h.id] = a;
    });
    toc.hidden = false;
    document.body.classList.add("has-toc");

    // On small screens the TOC is a collapsed <details>; open it on wide screens.
    var details = toc.querySelector("details");
    var wide = window.matchMedia("(min-width: 1100px)");
    var syncDetails = function () { if (details) details.open = wide.matches; };
    syncDetails();
    if (wide.addEventListener) wide.addEventListener("change", syncDetails);

    tocList.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && !wide.matches && details) details.open = false;
    });

    var setActive = function (id) {
      if (currentLi) { currentLi.classList.remove("is-active"); currentLi.removeAttribute("aria-current"); }
      var a = links[id];
      if (!a) return;
      currentLi = a.parentNode;
      currentLi.classList.add("is-active");
      a.setAttribute("aria-current", "true");
    };
    var pickActive = function () {
      var line = window.innerHeight * 0.3;
      var active = headings[0];
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= line) active = headings[i];
        else break;
      }
      setActive(active.id);
    };
    var raf = false;
    window.addEventListener("scroll", function () {
      if (raf) return;
      raf = true;
      requestAnimationFrame(function () { raf = false; pickActive(); });
    }, { passive: true });
    pickActive();
  }

  /* ---------- Copy link ---------- */
  var toast = document.querySelector("[data-toast]");
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 2000);
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
  var copyBtn = document.querySelector("[data-copy-link]");
  if (copyBtn) {
    var label = copyBtn.querySelector("[data-copy-label]");
    copyBtn.addEventListener("click", function () {
      var url = window.location.href.split("#")[0];
      var done = function (ok) {
        showToast(ok ? "Link copied to clipboard" : "Couldn't copy. The link is in the address bar.");
        if (ok && label) {
          label.textContent = "Copied";
          copyBtn.classList.add("is-copied");
          setTimeout(function () { label.textContent = "Copy link"; copyBtn.classList.remove("is-copied"); }, 2000);
        }
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(fallbackCopy(url)); });
      } else {
        done(fallbackCopy(url));
      }
    });
  }
})();
