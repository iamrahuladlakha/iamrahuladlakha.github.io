/* Post comments: loads approved comments and Turnstile only when the section nears view,
   renders everything as text, posts new comments for moderation. */
(function () {
  "use strict";

  var section = document.querySelector("[data-comments]");
  if (!section || !window.fetch) return;

  var api = section.getAttribute("data-api").replace(/\/+$/, "");
  var sitekey = section.getAttribute("data-sitekey");
  var post = section.getAttribute("data-post");
  var list = section.querySelector("[data-comments-list]");
  var status = section.querySelector("[data-comments-status]");
  var countEl = section.querySelector("[data-comments-count]");
  var form = section.querySelector("[data-comment-form]");
  var msg = form.querySelector("[data-comment-msg]");
  var submit = form.querySelector("[data-comment-submit]");
  var bodyField = form.elements.body;
  var charCount = form.querySelector("[data-comment-count]");
  var tsBox = form.querySelector("[data-turnstile]");
  var widget = null;
  var root = document.documentElement;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function renderComment(c, children) {
    var li = el("li", "comment" + (c.is_author ? " comment--author" : ""));
    li.id = "comment-" + c.id;
    var head = el("div", "comment-head");
    head.appendChild(el("span", "comment-name", c.name));
    if (c.is_author) head.appendChild(el("span", "comment-badge", "Author"));
    var time = el("time", "comment-date", formatDate(c.created_at));
    time.dateTime = c.created_at;
    head.appendChild(time);
    li.appendChild(head);
    li.appendChild(el("p", "comment-body", c.body));
    var kids = children[c.id];
    if (kids && kids.length) {
      var ol = el("ol", "comment-replies");
      ol.setAttribute("role", "list");
      kids.forEach(function (k) { ol.appendChild(renderComment(k, children)); });
      li.appendChild(ol);
    }
    return li;
  }

  function render(comments) {
    var ids = {}, children = {}, top = [];
    comments.forEach(function (c) { ids[c.id] = true; });
    comments.forEach(function (c) {
      if (c.parent_id != null && ids[c.parent_id]) (children[c.parent_id] = children[c.parent_id] || []).push(c);
      else top.push(c);
    });
    list.textContent = "";
    top.forEach(function (c) { list.appendChild(renderComment(c, children)); });
    list.hidden = comments.length === 0;
    countEl.textContent = comments.length ? "(" + comments.length + ")" : "";
    status.textContent = comments.length ? "" : "No comments yet. Be the first.";
    status.hidden = comments.length > 0;
  }

  function loadComments() {
    status.textContent = "Loading comments…";
    fetch(api + "/comments?post=" + encodeURIComponent(post))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(render)
      .catch(function () { status.hidden = false; status.textContent = "Comments couldn't load right now."; });
  }

  function theme() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function renderTurnstile() {
    if (!window.turnstile) return;
    if (widget !== null) window.turnstile.remove(widget);
    widget = window.turnstile.render(tsBox, { sitekey: sitekey, theme: theme() });
  }

  function loadTurnstile() {
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = renderTurnstile;
    s.onerror = function () { say("The spam check couldn't load, so posting is unavailable right now.", true); };
    document.head.appendChild(s);
    new MutationObserver(renderTurnstile).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderTurnstile);
  }

  function say(text, isError) {
    msg.textContent = text;
    msg.classList.toggle("is-error", !!isError);
  }

  function updateCount() { charCount.textContent = bodyField.value.length + "/2000"; }
  bodyField.addEventListener("input", updateCount);

  var errors = {
    400: "Please check your name, email and comment, then try again.",
    403: "The spam check didn't pass. Please try again.",
    429: "You've posted a few comments in a short time. Please wait a few minutes and try again."
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements;
    if (!f.name.value.trim() || !f.body.value.trim()) return say("Please add your name and a comment.", true);
    if (f.email.value && !f.email.checkValidity()) return say("That email doesn't look right.", true);
    var token = window.turnstile && widget !== null ? window.turnstile.getResponse(widget) : "";
    if (!token) return say("Please wait for the spam check to finish, then try again.", true);
    submit.disabled = true;
    say("Posting…");
    fetch(api + "/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post: post, name: f.name.value, email: f.email.value, body: f.body.value, website: f.website.value, token: token })
    })
      .then(function (r) {
        if (r.ok) {
          form.reset();
          updateCount();
          say("Thanks! Your comment will appear once it's approved.");
        } else {
          say(errors[r.status] || "Something went wrong. Please try again later.", true);
        }
      })
      .catch(function () { say("Couldn't reach the comment server. Please try again later.", true); })
      .then(function () {
        submit.disabled = false;
        if (window.turnstile && widget !== null) window.turnstile.reset(widget);
      });
  });

  var started = false;
  function start() {
    if (started) return;
    started = true;
    loadComments();
    loadTurnstile();
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { io.disconnect(); start(); }
    }, { rootMargin: "600px 0px" });
    io.observe(section);
  } else {
    start();
  }
})();
