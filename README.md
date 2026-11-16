# Rahul Adlakha — AI Solution Architect

**🌐 [iamrahuladlakha.github.io](https://iamrahuladlakha.github.io)** · [Blog](https://iamrahuladlakha.github.io/blog/) · [RSS](https://iamrahuladlakha.github.io/feed.xml) · [LinkedIn](https://www.linkedin.com/in/rahuladlakha/)

The source of my personal site and AI blog. I'm an AI Solution Architect with 13 years across data, ML and
agentic AI. I take agentic AI from whiteboard to production for large enterprises. Here I write about what I'm
learning: agents, LLM systems, evaluation, and what it takes to get them into production.

## What's here

- **Profile:** a hero section, quick links to the latest posts, and an interactive experience timeline you
  can filter by customer-facing and team-leadership roles.
- **Blog:** instant search (press `/`) and tag filters. Each post has a reading-progress bar, a table of
  contents, heading anchors, a copy-link button, and KaTeX for formulas.
- **Built to be found:** pre-rendered HTML, `jekyll-seo-tag` (Open Graph, Twitter cards, JSON-LD), a sitemap
  and an RSS feed.
- **Light and dark themes**, mobile-first layout, keyboard accessible, and it respects `prefers-reduced-motion`.
  Vanilla JS only, and every page still works with JS turned off.

## How posts are written

I learn AI topics in a personal knowledge base that explains each concept from first principles. When a
topic is ready, the knowledge base drafts a post from it. I review the draft, edit the title, description
and tags, and publish it with one click. That writes a file to `_posts/` and pushes it here, and GitHub Pages
does the rest.

Diagrams are original inline SVG.

## Post format

Each post is one HTML file, `_posts/YYYY-MM-DD-<slug>.html`, served at `/blog/<slug>/`:

```html
---
layout: post
title: "How agent memory works in production"
description: "One or two sentences, 160 characters or fewer, shown in search results and social cards."
tags: ["agents", "llm-systems"]
source_id: "knowledge-base-page-id"
math: true          # loads KaTeX: \( inline \), \[ display \]
---
{% raw %}
<p>Post body as an HTML fragment: h2/h3, p, lists, tables, pre/code, figure + inline SVG.</p>
{% endraw %}
```

The `{% raw %}` wrapper keeps code samples that contain `{{ }}` from being processed by Liquid.

## Run it locally

```bash
docker run --rm -v "$PWD":/srv/jekyll jekyll/jekyll:pages jekyll build
python3 -m http.server 4000 --directory _site   # http://localhost:4000
```

## Layout

| Path | What it holds |
|---|---|
| `index.html` | Home: hero, latest posts, experience timeline |
| `blog/index.html` | All posts, search and tag filters |
| `_layouts/` | `default.html` page shell, `post.html` article |
| `_includes/` | head (SEO, theme), header, footer, post card, reading time, icons |
| `_data/experience.yml` | The experience timeline entries |
| `assets/css/site.css` | One stylesheet with light/dark design tokens |
| `assets/js/` | `site.js` (theme, header, timeline), `blog.js` (search and tags), `post.js` (TOC, progress, copy link) |
| `search.json` | Search index generated at build time |

---

Content © Rahul Adlakha. Feel free to learn from the code. Please don't republish the posts as your own.
