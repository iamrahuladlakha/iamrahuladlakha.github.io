/* Blog index: instant search over /search.json, live tag filter, result count,
   "/" to focus search. URL keeps ?q= and ?tag= so filtered views can be shared. */
(function () {
  "use strict";

  var list = document.querySelector("[data-post-list]");
  var input = document.querySelector("[data-search]");
  var countEl = document.querySelector("[data-count]");
  var emptyEl = document.querySelector("[data-empty]");
  var chips = Array.prototype.slice.call(document.querySelectorAll("[data-tag-chip]"));
  var rows = list ? Array.prototype.slice.call(list.querySelectorAll("[data-url]")) : [];
  var total = rows.length;

  // Haystack per post URL. Start from the rendered text; upgrade with search.json (adds excerpt).
  var haystack = {};
  rows.forEach(function (row) { haystack[row.getAttribute("data-url")] = row.textContent.toLowerCase(); });

  var params = new URLSearchParams(window.location.search);
  var query = (params.get("q") || "").trim();
  var tag = params.get("tag") || "";
  if (input) input.value = query;

  function plural(n) { return n === 1 ? "post" : "posts"; }

  function apply() {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    rows.forEach(function (row) {
      var tags = (row.getAttribute("data-tags") || "").split("|");
      var text = haystack[row.getAttribute("data-url")] || "";
      var ok = (!tag || tags.indexOf(tag) !== -1) && terms.every(function (t) { return text.indexOf(t) !== -1; });
      row.hidden = !ok;
      if (ok) { shown += 1; row.classList.add("is-visible"); }
    });
    chips.forEach(function (chip) {
      if (chip.getAttribute("data-tag-chip") === tag) chip.setAttribute("aria-current", "true");
      else chip.removeAttribute("aria-current");
    });
    if (countEl && total) {
      var filtered = query || tag;
      countEl.textContent = filtered
        ? "Showing " + shown + " of " + total + " " + plural(total) + (tag ? " tagged “" + tag + "”" : "")
        : total + " " + plural(total);
    }
    if (emptyEl) emptyEl.hidden = shown > 0 || !total;
  }

  function syncUrl() {
    var p = new URLSearchParams();
    if (query) p.set("q", query);
    if (tag) p.set("tag", tag);
    var qs = p.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
  }

  function setTag(next) {
    tag = next;
    apply();
    syncUrl();
  }

  if (input) {
    input.addEventListener("input", function () {
      query = input.value.trim();
      apply();
      syncUrl();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value) {
        e.preventDefault();
        input.value = "";
        query = "";
        apply();
        syncUrl();
      }
    });
  }

  // Chips and in-row tag links filter in place instead of reloading.
  chips.forEach(function (chip) {
    chip.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var t = chip.getAttribute("data-tag-chip");
      setTag(t === tag ? "" : t);
    });
  });
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("[data-tag-link]");
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setTag(link.getAttribute("data-tag-link"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  var clear = document.querySelector("[data-clear]");
  if (clear) {
    clear.addEventListener("click", function () {
      query = "";
      tag = "";
      if (input) { input.value = ""; input.focus(); }
      apply();
      syncUrl();
    });
  }

  // "/" focuses search unless the user is already typing somewhere.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || !input) return;
    var el = document.activeElement;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    if (typing) return;
    e.preventDefault();
    input.focus();
    input.select();
  });

  if (list && window.fetch) {
    fetch(list.getAttribute("data-index"))
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (posts) {
        posts.forEach(function (p) {
          haystack[p.url] = [p.title, p.description, (p.tags || []).join(" "), p.excerpt].join(" ").toLowerCase();
        });
        apply();
      })
      .catch(function () { /* keep the rendered-text index */ });
  }

  apply();
})();
