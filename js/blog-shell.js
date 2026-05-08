(function () {
  "use strict";

  const ROOT = document.documentElement;
  const body = document.body;
  const view = document.getElementById("shell-view");
  const route = body.dataset.route || inferRoute();
  const shellView = body.dataset.view || "route";
  const cmdOutput = document.getElementById("cmd-output");
  const cmdInput = document.getElementById("cmdline-input");
  const topPath = document.getElementById("top-path");
  const topClock = document.getElementById("top-clock");
  const topFilter = document.getElementById("top-filter");
  const topFilterName = document.getElementById("top-filter-name");
  const topFilterClear = document.getElementById("top-filter-clear");
  const reader = document.getElementById("reader-article");
  const readerBackdrop = document.getElementById("reader-backdrop");
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsClose = document.getElementById("settings-close");
  const settingsCmdline = document.getElementById("settings-cmdline");
  const sidebarPostCount = document.getElementById("sidebar-post-count");
  const sidebarShortsCount = document.getElementById("sidebar-shorts-count");
  const sidebarProjectCount = document.getElementById("sidebar-project-count");
  const sidebarUptime = document.getElementById("sidebar-uptime");
  const sidebarItems = Array.from(document.querySelectorAll(".filetree-item"));
  const tagCloud = document.getElementById("tag-cloud");
  const mobileSidebarToggle = document.getElementById("mobile-sidebar-toggle");

  const launchAt = Date.UTC(2024, 7, 1);
  const shellCfg = safeJSON("BLOG_SHELL_DATA", {});
  const rawPosts = safeJSON("BLOG_POST_DATA", []);
  const posts = Array.isArray(rawPosts) ? rawPosts.map(normalizePost) : [];

  let activeRoute = route;
  let activeTag = localStorage.getItem("blog-active-tag") || "";
  const tagMap = buildTagMap(posts);
  let cmdHistory = [];
  let cmdIndex = -1;
  let showCmdline = localStorage.getItem("blog-cmdline") !== "0";

  const startCmdline = () => {
    const panel = document.querySelector(".cmdline-shell");
    if (!panel) return;
    if (!showCmdline) {
      panel.style.display = "none";
    }
  };

  if (shellCfg && typeof shellCfg === "object") {
    if (Array.isArray(shellCfg.shorts)) sidebarShortsCount.textContent = String(shellCfg.shorts.length);
    else sidebarShortsCount.textContent = "0";
    if (Array.isArray(shellCfg.projects)) sidebarProjectCount.textContent = String(shellCfg.projects.length);
    else sidebarProjectCount.textContent = "0";
  }
  sidebarPostCount.textContent = String(posts.length);

  if (shellView !== "post") {
    applyTheme(
      localStorage.getItem("blog-theme") || "light",
      localStorage.getItem("blog-density") || "cozy",
      localStorage.getItem("blog-accent") || "#d97757",
    );

    renderTagCloud(tagMap);
    bindSidebar();
    bindSettings();
    bindReaderClose();
    bindTopActions();
    bindCmdline();
    startUptime();
    startClock();
    syncRoute(activeRoute);
    refreshTagFilterUI();
    startCmdline();
  }

  function normalizePost(post) {
    if (!post || typeof post !== "object") return null;
    return {
      title: String(post.title || ""),
      slug: String(post.slug || ""),
      url: String(post.url || ""),
      date: String(post.date || ""),
      tags: Array.isArray(post.tags) ? post.tags.map((t) => String(t || "")) : [],
      excerpt: String(post.excerpt || ""),
      content: String(post.content || ""),
      read: Number(post.read || calcReadMinutes(post.content || "")),
    };
  }

  function calcReadMinutes(text) {
    if (!text) return 1;
    const words = String(text).replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 250));
  }

  function inferRoute() {
    const p = (window.location.pathname || "/").toLowerCase().replace(/\/+$/, "");
    const map = {
      "": "home",
      "/": "home",
      "/articles": "articles",
      "/shorts": "shorts",
      "/projects": "projects",
      "/about": "about",
      "/now": "now",
      "/contact": "contact",
    };
    return map[p] || "home";
  }

  function safeJSON(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent || "[]");
    } catch (err) {
      return fallback;
    }
  }

  function toPath(routeName) {
    const paths = {
      home: "/",
      articles: "/articles/",
      shorts: "/shorts/",
      projects: "/projects/",
      about: "/about/",
      now: "/now/",
      contact: "/contact/",
    };
    return paths[routeName] || "/";
  }

  function formatDate(v) {
    if (!v) return "—";
    return String(v).replace(/-/g, ".");
  }

  function relTime(iso) {
    if (!iso) return "—";
    const now = new Date();
    const target = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(target.getTime())) return "—";
    const diff = Math.floor((now - target) / (1000 * 60 * 60 * 24));
    if (diff < 1) return "today";
    if (diff < 2) return "yesterday";
    if (diff < 8) return `${diff}d ago`;
    if (diff < 31) return `${Math.floor(diff / 7)}w ago`;
    if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
    return `${Math.floor(diff / 365)}y ago`;
  }

  function normalizeTag(v) {
    return String(v || "").toLowerCase();
  }

  function buildTagMap(items) {
    const m = {};
    items.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        const key = normalizeTag(tag);
        if (!m[key]) m[key] = { label: tag, count: 0 };
        m[key].count += 1;
      });
    });
    return m;
  }

  function applyTheme(themeName, densityName, accentColor) {
    ROOT.dataset.theme = themeName;
    ROOT.style.setProperty("--accent", accentColor);

    const densityMap = {
      tight: { fs: "13px", lh: 1.45 },
      cozy: { fs: "14px", lh: 1.55 },
      roomy: { fs: "15px", lh: 1.7 },
    };
    const d = densityMap[densityName] || densityMap.cozy;
    ROOT.style.setProperty("--fs-base", d.fs);
    ROOT.style.setProperty("--lh-base", String(d.lh));

    if (settingsPanel) {
      settingsPanel.querySelectorAll(".settings-chip").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.theme === themeName);
        btn.classList.toggle("is-active", btn.dataset.density === densityName);
      });
      settingsPanel.querySelectorAll(".swatch").forEach((sw) => {
        sw.classList.toggle("is-active", sw.dataset.accent === accentColor);
      });
    }

    localStorage.setItem("blog-theme", themeName);
    localStorage.setItem("blog-density", densityName);
    localStorage.setItem("blog-accent", accentColor);
  }

  function startClock() {
    const tick = () => {
      topClock.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });
    };
    tick();
    setInterval(tick, 1000);
  }

  function startUptime() {
    setInterval(() => {
      const s = Math.floor((Date.now() - launchAt) / 1000);
      const d = Math.floor(s / 86400);
      const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      sidebarUptime.textContent = `${d}d ${h}:${m}:${ss}`;
    }, 1000);
  }

  function syncRoute(next) {
    activeRoute = next;
    sidebarItems.forEach((el) => {
      el.classList.toggle("filetree-item-active", el.dataset.route === activeRoute);
    });
    topPath.textContent = next === "home" ? "~" : `~/${next}`;

    if (shellView === "post") return;

    if (next === "home") {
      renderHome();
    } else if (next === "articles") {
      renderArticles();
    } else if (next === "shorts") {
      renderShorts();
    } else if (next === "projects") {
      renderProjects();
    } else if (next === "about") {
      renderAbout();
    } else if (next === "now") {
      renderNow();
    } else if (next === "contact") {
      renderContact();
    } else {
      renderHome();
    }
  }

  function bindSidebar() {
    sidebarItems.forEach((el) => {
      el.addEventListener("click", () => {
        const routeName = el.dataset.route;
        if (!routeName || routeName === activeRoute) return;
        window.location.href = toPath(routeName);
      });
    });

    if (mobileSidebarToggle) {
      mobileSidebarToggle.addEventListener("click", () => {
        document.body.classList.toggle("sidebar-open");
      });
    }
  }

  function bindTopActions() {
    if (topFilterClear) {
      topFilterClear.addEventListener("click", () => {
        activeTag = "";
        localStorage.removeItem("blog-active-tag");
        refreshTagFilterUI();
        if (activeRoute === "articles") renderArticles();
      });
    }

    document.addEventListener("keydown", (e) => {
      if (document.activeElement === cmdInput) return;
      if (e.key === "/" && e.target !== cmdInput) {
        e.preventDefault();
        cmdInput.focus();
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        execute("help");
      }
      if (e.key === "Escape") {
        closeReader();
        cmdInput.blur();
      }
      if (e.key === "g") {
        const skip = (ev) => {
          const map = { h: "home", a: "articles", s: "shorts", p: "projects", o: "about", n: "now", c: "contact" };
          const target = map[ev.key];
          if (target) window.location.href = toPath(target);
          document.removeEventListener("keydown", skip, { capture: true });
        };
        document.addEventListener("keydown", skip, { capture: true, once: true });
      }
    });
  }

  function bindCmdline() {
    if (!cmdInput || !cmdOutput) return;

    const autocomplete = [
      "ls",
      "cd",
      "cat",
      "open",
      "tag",
      "theme",
      "clear",
      "help",
      ":q",
    ];

    cmdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        execute(cmdInput.value);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (cmdHistory.length === 0) return;
        cmdIndex = Math.min(cmdHistory.length - 1, cmdIndex + 1);
        cmdInput.value = cmdHistory[cmdIndex];
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        cmdIndex = Math.max(-1, cmdIndex - 1);
        cmdInput.value = cmdIndex >= 0 ? cmdHistory[cmdIndex] : "";
      } else if (e.key === "Tab") {
        e.preventDefault();
        const raw = cmdInput.value.trim();
        const [head, ...rest] = raw.split(/\s+/);
        if (!head) return;
        if (head.length >= 1 && rest.length === 0) {
          const hit = autocomplete.find((c) => c.startsWith(head));
          if (hit) cmdInput.value = hit;
          return;
        }
        if (head === "cat" || head === "open") {
          const q = rest.join(" ").toLowerCase();
          const match = posts.find((p) => p.slug.startsWith(q) || p.title.toLowerCase().includes(q));
          if (match) cmdInput.value = `${head} ${match.slug}`;
          return;
        }
        if (head === "tag") {
          const q = (rest.join(" ") || "").toLowerCase();
          const keys = Object.keys(tagMap);
          const found = keys.find((k) => k.startsWith(q));
          if (found) cmdInput.value = `${head} ${tagMap[found].label}`;
          return;
        }
      }
    });
  }

  function execute(raw) {
    const input = String(raw || "").trim();
    if (!input) return;

    cmdHistory.unshift(input);
    cmdHistory.length = Math.min(cmdHistory.length, 40);
    cmdIndex = -1;
    cmdInput.value = "";

    const row = document.createElement("div");
    row.className = "cmdline-row";
    row.innerHTML = `<div class="cmdline-prompt">you@blog:~$ ${escapeHtml(input)}</div>`;
    cmdOutput.appendChild(row);
    cmdOutput.scrollTop = cmdOutput.scrollHeight;

    const parts = input.split(/\s+/);
    const command = (parts[0] || "").toLowerCase();
    const arg = parts.slice(1).join(" ").trim();
    let output = "";

    if (command === "ls") {
      output = posts.slice(0, 20).map((p) => `${p.date}  ${p.slug}`).join("\n") || "no posts found";
    } else if (command === "cd") {
      const target = arg.replace(/^\//, "").replace(/\/+$/, "");
      const map = { home: "home", "": "home", "~": "home", articles: "articles", shorts: "shorts", projects: "projects", about: "about", now: "now", contact: "contact" };
      if (map[target] != null) {
        output = `→ ${target || "home"}`;
        window.location.href = toPath(map[target]);
      } else {
        output = `cd: no such directory: ${arg}`;
      }
    } else if (command === "cat" || command === "open") {
      if (!arg) {
        output = "cat: missing argument";
      } else {
        const q = arg.toLowerCase();
        const post = posts.find((p) => {
          return p.slug === q || p.slug.startsWith(q) || p.title.toLowerCase().includes(q);
        });
        if (!post) {
          output = `${command}: no such article: ${arg}`;
        } else {
          output = `opening ${post.slug}...`;
          openReader(post);
        }
      }
    } else if (command === "tag") {
      if (!arg) {
        output = "tag: missing argument";
      } else {
        const candidate = tagMap[normalizeTag(arg)];
        if (!candidate) {
          output = `tag: no such tag: ${arg}`;
        } else {
          activeTag = candidate.label;
          localStorage.setItem("blog-active-tag", activeTag);
          refreshTagFilterUI();
          output = `filter: #${candidate.label}`;
          if (activeRoute !== "articles") {
            window.location.href = "/articles/";
          } else {
            renderArticles();
          }
        }
      }
    } else if (command === "theme") {
      if (arg === "light" || arg === "dark") {
        const currentAccent = localStorage.getItem("blog-accent") || "#d97757";
        applyTheme(arg, localStorage.getItem("blog-density") || "cozy", currentAccent);
        output = `theme → ${arg}`;
      } else if (arg === "toggle") {
        const next = ROOT.dataset.theme === "dark" ? "light" : "dark";
        applyTheme(next, localStorage.getItem("blog-density") || "cozy", localStorage.getItem("blog-accent") || "#d97757");
        output = `theme → ${next}`;
      } else if (arg.startsWith("density ")) {
        const density = normalize(arg.split(/\s+/)[1]);
        if (["tight", "cozy", "roomy"].includes(density)) {
          applyTheme(ROOT.dataset.theme || "light", density, localStorage.getItem("blog-accent") || "#d97757");
          output = `density → ${density}`;
        } else {
          output = "theme density <tight|cozy|roomy>";
        }
      } else if (!arg) {
        output = "theme <light|dark|toggle|density <tight|cozy|roomy>>";
      } else {
        output = `theme: unknown: ${arg}`;
      }
    } else if (command === "whoami") {
      output = "engineer · devops · security · Shanghai";
    } else if (command === "clear") {
      cmdOutput.innerHTML = "";
      return;
    } else if (command === "help" || command === "?") {
      output = "ls                    list articles\ncd <path>             cd home | articles | shorts | projects | about | now | contact\ncat <slug>            open an article\nopen <slug>           alias for cat\ntag <name>            filter articles by tag\ntheme <light|dark>    change theme\ntheme density ...     set density\ntheme toggle          toggle light/dark\npwd                   print current path\nclear                 clear command output\nhelp                  show help\n:q or exit            go home";
    } else if (command === "pwd") {
      output = `/${activeRoute === "home" ? "" : activeRoute}`;
    } else if (command === "exit" || command === ":q") {
      output = "→ home";
      window.location.href = "/";
    } else {
      output = `${command}: command not found. try help`;
    }

    const outRow = document.createElement("pre");
    outRow.className = "cmdline-output";
    outRow.textContent = output;
    cmdOutput.appendChild(outRow);
    cmdOutput.scrollTop = cmdOutput.scrollHeight;
  }

  function bindSettings() {
    if (!settingsPanel || !settingsToggle) return;

    settingsToggle.addEventListener("click", () => {
      const isOpen = settingsPanel.classList.toggle("is-open");
      settingsToggle.classList.toggle("is-open", isOpen);
    });

    settingsClose.addEventListener("click", () => {
      settingsPanel.classList.remove("is-open");
      settingsToggle.classList.remove("is-open");
    });

    settingsPanel.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.theme;
        applyTheme(mode, localStorage.getItem("blog-density") || "cozy", localStorage.getItem("blog-accent") || "#d97757");
      });
    });
    settingsPanel.querySelectorAll("[data-density]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const density = btn.dataset.density;
        applyTheme(localStorage.getItem("blog-theme") || "light", density, localStorage.getItem("blog-accent") || "#d97757");
      });
    });
    settingsPanel.querySelectorAll(".swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        const accent = btn.dataset.accent;
        applyTheme(localStorage.getItem("blog-theme") || "light", localStorage.getItem("blog-density") || "cozy", accent);
      });
    });

    if (settingsCmdline) {
      settingsCmdline.checked = showCmdline;
      settingsCmdline.addEventListener("change", () => {
        showCmdline = settingsCmdline.checked;
        const panel = document.querySelector(".cmdline-shell");
        panel.style.display = showCmdline ? "block" : "none";
        localStorage.setItem("blog-cmdline", showCmdline ? "1" : "0");
      });
    }
  }

  function bindReaderClose() {
    if (!readerBackdrop) return;
    readerBackdrop.addEventListener("click", (e) => {
      if (e.target === readerBackdrop) closeReader();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !readerBackdrop.hidden) closeReader();
    });
  }

  function normalize(value) {
    return String(value || "").trim();
  }

  function renderTagCloud(map) {
    if (!tagCloud) return;
    const items = Object.values(map).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    tagCloud.innerHTML = items
      .map(
        (entry) => `
          <button class="tag" data-tag="${escapeAttr(entry.label)}">
            <span class="tag-hash">#</span>${escapeHtml(entry.label)}
            <span class="tag-count">·${entry.count}</span>
          </button>
        `,
      )
      .join("");

    tagCloud.querySelectorAll("[data-tag]").forEach((btn) => {
      btn.classList.toggle("tag-active", normalizeTag(btn.dataset.tag) === normalizeTag(activeTag));
      btn.addEventListener("click", () => {
        activeTag = btn.dataset.tag;
        localStorage.setItem("blog-active-tag", activeTag);
        refreshTagFilterUI();
        if (activeRoute === "articles") {
          renderArticles();
        } else {
          window.location.href = "/articles/";
        }
      });
    });
  }

  function refreshTagFilterUI() {
    if (!activeTag) {
      topFilter.hidden = true;
      topFilterName.textContent = "";
    } else {
      topFilter.hidden = false;
      topFilterName.textContent = activeTag;
    }
    renderTagCloud(tagMap);
  }

  function renderHome() {
    const latest = posts[0];
    const recent = posts.slice(1, 4);
    const rows = recent.map((post) => postRow(post, false)).join("");
    const shorts = (shellCfg.shorts || []).slice(0, 3).map((item) => shortRow(item)).join("");

    view.innerHTML = `
      <div class="view view-home">
        <section class="hero">
          <pre class="hero-ascii" aria-hidden="true">${escapeHtml((shellCfg.ascii && shellCfg.ascii.hero) || "")}</pre>
          <div>
            <div class="hero-eyebrow">// ${escapeHtml((shellCfg.brand && shellCfg.brand.hero_kicker) || "engineer's notebook")}</div>
            <h1 class="hero-title">
              ${escapeHtml((shellCfg.brand && shellCfg.brand.hero_title_line1) || "")}<br>
              ${escapeHtml((shellCfg.brand && shellCfg.brand.hero_title_line2) || "")}
              <span class="hero-cursor">▌</span>
            </h1>
            <p class="hero-lede">
              <span class="muted">$</span> ${escapeHtml((shellCfg.brand && shellCfg.brand.hero_lede) || "")}
            </p>
            <div class="hero-actions">
              <button class="btn btn-primary" type="button" data-route-link="articles">read articles <span class="btn-arrow">→</span></button>
              <button class="btn" type="button" data-route-link="about">about me</button>
              <button class="btn btn-ghost" type="button" data-route-link="now">/now</button>
            </div>
          </div>
        </section>

        <section class="block">
          <div class="block-header">
            <div class="block-header-l">
              <span class="block-label">latest</span>
              <span class="block-cmd"><span class="muted">$</span> cat articles/latest</span>
            </div>
            <div class="block-header-r">
              <a class="link" href="/articles/">see all →</a>
            </div>
          </div>
          ${latest ? renderFeatured(latest) : `<p class="empty">no posts yet.</p>`}
        </section>

        <section class="block">
          <div class="block-header">
            <div class="block-header-l">
              <span class="block-label">recent</span>
              <span class="block-cmd"><span class="muted">$</span> ls articles/ | head -3</span>
            </div>
          </div>
          <ul class="post-list">${rows || '<li class="empty">no posts yet.</li>'}</ul>
        </section>

        <section class="block">
          <div class="block-header">
            <div class="block-header-l">
              <span class="block-label">shorts</span>
              <span class="block-cmd"><span class="muted">$</span> tail -3 shorts.log</span>
            </div>
            <div class="block-header-r">
              <a class="link" href="/shorts/">all shorts →</a>
            </div>
          </div>
          <ul class="shorts-list">${shorts || "<li class=\"empty\">no short notes yet.</li>"}</ul>
        </section>

        <footer class="footer">
          <div class="footer-l">
            <pre class="footer-ascii">/* end of file */</pre>
          </div>
          <div class="footer-r">
            <span>© 2024–2026</span>
            <span class="muted">·</span>
            <span>built with html, css, and stubbornness</span>
          </div>
        </footer>
      </div>
    `;
    bindViewRouteLinks();
    bindPostRows();
  }

  function renderArticles() {
    const keyword = activeTag ? normalizeTag(activeTag) : "";
    const total = posts.length;
    const filtered = posts.filter((post) => !keyword || post.tags.map(normalizeTag).includes(keyword));

    view.innerHTML = `
      <div class="view">
        <div class="block-header">
          <div class="block-header-l">
            <span class="block-label">articles</span>
            <span class="block-cmd"><span class="muted">$</span> ${keyword ? `grep "#${activeTag}" articles/` : "ls -lah articles/"}</span>
          </div>
          ${keyword ? `<div class="block-header-r">
            <button class="tag tag-active" id="clear-filter-inline">
              <span class="tag-hash">#</span>${escapeHtml(activeTag)}<span class="tag-x"> ×</span>
            </button>
          </div>` : ""}
        </div>
        <div class="search-row">
          <span class="search-glyph">grep</span>
          <input id="articles-search" class="search-input" placeholder="search title/excerpt/tag…" value="" />
          <span class="search-count"><span id="articles-count">${filtered.length}</span> / ${total}</span>
        </div>
        <ul class="post-list post-list-large" id="article-list"></ul>
      </div>
    `;

    const list = view.querySelector("#article-list");
    const input = view.querySelector("#articles-search");
    const count = view.querySelector("#articles-count");
    const clearBtn = view.querySelector("#clear-filter-inline");

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        activeTag = "";
        localStorage.removeItem("blog-active-tag");
        refreshTagFilterUI();
        renderArticles();
      });
    }

    function applySearch(q) {
      const needle = normalize(q).toLowerCase();
      const current = posts.filter((post) => {
        const okTag = !keyword || post.tags.map(normalizeTag).includes(keyword);
        if (!needle) return okTag;
        return (
          okTag &&
          (post.title.toLowerCase().includes(needle) ||
            post.excerpt.toLowerCase().includes(needle) ||
            post.tags.some((t) => normalizeTag(t).includes(needle)))
        );
      });

      if (current.length === 0) {
        list.innerHTML = `<li class="empty">no matches. try a different query, or clear filters.</li>`;
      } else {
        list.innerHTML = current.map((post) => postRow(post, true)).join("");
      }
      count.textContent = String(current.length);
      bindPostRows();
    }

    applySearch("");
    input.addEventListener("input", () => applySearch(input.value));
  }

  function renderShorts() {
    const rows = (shellCfg.shorts || []).map((item) => shortRow(item, true)).join("");
    view.innerHTML = `
      <div class="view">
        <div class="block-header">
          <div class="block-header-l">
            <span class="block-label">shorts</span>
            <span class="block-cmd"><span class="muted">$</span> cat shorts.log</span>
          </div>
        </div>
        <ul class="shorts-list shorts-list-full">${rows || "<li class=\"empty\">no short notes yet.</li>"}</ul>
      </div>
    `;
  }

  function renderProjects() {
    const cards = (shellCfg.projects || [])
      .map(
        (project) => `
          <article class="project-card">
            <div class="project-card-head">
              <span class="project-tag">${escapeHtml(project.tag || "")}</span>
              <span class="project-status">${escapeHtml(project.status || "")}</span>
            </div>
            <h3 class="project-name">/<span class="project-slash"></span>${escapeHtml(project.name || "")}</h3>
            <p class="project-blurb">${escapeHtml(project.blurb || "")}</p>
            <div class="project-meta">
              <span><span class="muted">lang:</span> ${escapeHtml(project.lang || "")}</span>
              <span><span class="muted">★</span> ${(project.stars == null ? 0 : project.stars)}</span>
            </div>
          </article>
        `,
      )
      .join("");

    view.innerHTML = `
      <div class="view">
        <div class="block-header">
          <div class="block-header-l">
            <span class="block-label">projects</span>
            <span class="block-cmd"><span class="muted">$</span> ls projects/ --json</span>
          </div>
        </div>
        <div class="projects-grid">${cards || "<div class=\"empty\">no projects yet.</div>"}</div>
      </div>
    `;
  }

  function renderAbout() {
    const about = shellCfg.brand ? shellCfg.brand : {};
    const contact = shellCfg.contact || {};
    view.innerHTML = `
      <div class="view view-about">
        <div class="block-header">
          <div class="block-header-l">
            <span class="block-label">about</span>
            <span class="block-cmd"><span class="muted">$</span> cat about.txt</span>
          </div>
        </div>
        <div class="about-grid">
          <div>
            <pre class="about-ascii" aria-hidden="true">${escapeHtml((shellCfg.ascii && shellCfg.ascii.about) || "")}</pre>
            <dl class="about-kv">
              <div><dt>role</dt><dd>${escapeHtml(about.author && about.author.role ? about.author.role : "")}</dd></div>
              <div><dt>city</dt><dd>${escapeHtml(about.author && about.author.location ? about.author.location : "")}</dd></div>
              <div><dt>tz</dt><dd>${escapeHtml(about.author && about.author.timezone ? about.author.timezone : "")}</dd></div>
              <div><dt>shell</dt><dd>zsh · tmux · vim</dd></div>
              <div><dt>editor</dt><dd>vim · no language wars</dd></div>
            </dl>
          </div>
          <div class="about-prose">
            <p class="lede">I'm an engineer who works where dev, ops, and security overlap. The work is practical, boring, and production-safe.</p>
            <p>
              This blog is where I keep practical long-form notes, short observations, and small projects.
            </p>
            <h4 class="about-h">// what you'll find here</h4>
            <ul class="about-list">
              <li><span class="b">articles</span> for deep operational writeups.</li>
              <li><span class="b">shorts</span> for quick observations and one-line takes.</li>
              <li><span class="b">projects</span> for tools worth sharing in public.</li>
            </ul>
            <h4 class="about-h">// what you won't</h4>
            <ul class="about-list">
              <li>empty hype.</li>
              <li>unreproducible "best practice" myths.</li>
            </ul>
            <p class="about-sign">— <span class="ink-orange">$</span> redacted</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderNow() {
    const now = shellCfg.now || {};
    const payload = {
      as_of: now.updated_at || new Date().toISOString(),
      city: now.city || "",
      tz: now.tz || "",
      reading: now.reading || "",
      listening: now.listening || "",
      building: now.building || "",
      thinking: now.thinking || "",
    };
    view.innerHTML = `
      <div class="view">
        <div class="block-header">
          <div class="block-header-l">
            <span class="block-label">now</span>
            <span class="block-cmd"><span class="muted">$</span> cat now.json | jq .</span>
          </div>
          <div class="block-header-r">
            <span class="muted small">last updated ${escapeHtml((now.updated_at || "").split("T")[0] || "now")}</span>
          </div>
        </div>
        <pre class="now-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
        <div class="now-grid">
          <div class="now-card">
            <div class="now-card-head">
              <span class="now-card-glyph">♩</span><span>now playing</span>
            </div>
            <div class="now-card-value">${escapeHtml(now.listening || "")}</div>
            <div class="now-card-sub">08k stereo · 320kbps</div>
            <div class="wave">${waveHTML(20)}</div>
          </div>
          <div class="now-card">
            <div class="now-card-head">
              <span class="now-card-glyph">📄</span><span>now reading</span>
            </div>
            <div class="now-card-value">${escapeHtml(now.reading || "")}</div>
            <div class="now-card-sub">current focus</div>
          </div>
          <div class="now-card">
            <div class="now-card-head">
              <span class="now-card-glyph">✗</span><span>now building</span>
            </div>
            <div class="now-card-value">${escapeHtml(now.building || "")}</div>
          </div>
          <div class="now-card">
            <div class="now-card-head">
              <span class="now-card-glyph">✎</span><span>now thinking</span>
            </div>
            <div class="now-card-value">${escapeHtml(now.thinking || "")}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderContact() {
    const channels = shellCfg.social || [];
    view.innerHTML = `
      <div class="view">
        <div class="block-header">
          <div class="block-header-l">
            <span class="block-label">contact</span>
            <span class="block-cmd"><span class="muted">$</span> gpg --fingerprint</span>
          </div>
        </div>
        <div class="contact-grid">
          <div>
            <h3 class="contact-h">channels</h3>
            <ul class="contact-list">${channels
              .map(
                (item) => `
                <li>
                  <a class="contact-link" href="${escapeAttr(item.url || "#")}">
                    <span class="contact-key">${escapeHtml(item.key || item.label || "")}</span>
                    <span class="contact-arrow">→</span>
                    <span class="contact-val">${escapeHtml(item.handle || "")}</span>
                  </a>
                </li>
              `,
              )
              .join("")}
            </ul>
            <p class="contact-note">For sensitive content, encrypted channels are preferred.</p>
          </div>
          <div>
            <h3 class="contact-h">pgp fingerprint</h3>
            <pre class="pgp">${escapeHtml((shellCfg.contact && shellCfg.contact.pgp_fingerprint) || "")}</pre>
            <pre class="pgp-block">${escapeHtml((shellCfg.contact && shellCfg.contact.pgp_key) || "")}</pre>
          </div>
        </div>
      </div>
    `;
  }

  function renderFeatured(post) {
    return `
      <article class="featured" data-post-slug="${escapeAttr(post.slug)}">
        <div class="featured-meta">
          <span class="meta-date">${formatDate(post.date)}</span>
          <span class="meta-sep">·</span>
          <span class="meta-read">${post.read}m</span>
        </div>
        <h2 class="featured-title">${escapeHtml(post.title)}</h2>
        <p class="featured-excerpt">${escapeHtml(post.excerpt)}</p>
        <div class="featured-tags">
          ${(post.tags || []).map((tag) => `<button class="tag tag-sm" data-filter-tag="${escapeAttr(tag)}"><span class="tag-hash">#</span>${escapeHtml(tag)}</button>`).join("")}
        </div>
      </article>
    `;
  }

  function postRow(post, withExcerpt) {
    return `
      <li class="post-row ${withExcerpt ? "post-row-large" : ""}" data-post-slug="${escapeAttr(post.slug)}">
        <div class="post-row-head">
          <span class="post-row-id">[${escapeHtml(String(post.slug || "").slice(0, 2))}]</span>
          <span class="post-row-date">${formatDate(post.date)}</span>
          <span class="post-row-read">${post.read}m</span>
        </div>
        <div class="post-row-title">${escapeHtml(post.title)}</div>
        ${withExcerpt ? `<p class="post-row-excerpt">${escapeHtml(post.excerpt)}</p>` : ""}
        <div class="post-row-tags">
          ${(post.tags || []).map((tag) => `<button class="tag tag-sm" data-filter-tag="${escapeAttr(tag)}"><span class="tag-hash">#</span>${escapeHtml(tag)}</button>`).join("")}
          <span class="post-row-arrow">read →</span>
        </div>
      </li>
    `;
  }

  function shortRow(item) {
    return `
      <li class="short ${item.full ? "short-full" : ""}">
        <div class="short-meta">
          <span class="short-id">${escapeHtml(item.id || "")}</span>
          <span class="short-date">${formatDate(item.date || "")}</span>
          <span class="short-rel">· ${escapeHtml(relTime(item.date || ""))}</span>
        </div>
        <p class="short-text">${escapeHtml(item.text || "")}</p>
      </li>
    `;
  }

  function bindViewRouteLinks() {
    view.querySelectorAll("[data-route-link]").forEach((button) => {
      button.addEventListener("click", () => {
        const routeName = button.dataset.routeLink;
        if (routeName) window.location.href = toPath(routeName);
      });
    });
    bindPostRows();
  }

  function bindPostRows() {
    if (!view) return;
    view.querySelectorAll("[data-post-slug]").forEach((row) => {
      const slug = row.getAttribute("data-post-slug");
      const post = posts.find((p) => p.slug === slug);
      if (!post) return;
      row.addEventListener("click", () => openReader(post));
    });
    view.querySelectorAll("[data-filter-tag]").forEach((tag) => {
      tag.addEventListener("click", (e) => {
        e.stopPropagation();
        activeTag = tag.dataset.filterTag;
        localStorage.setItem("blog-active-tag", activeTag);
        if (activeRoute === "articles") {
          renderArticles();
        } else {
          window.location.href = "/articles/";
        }
      });
    });
  }

  function openReader(post) {
    if (!reader || !readerBackdrop || !post) return;
    const author = shellCfg.brand && shellCfg.brand.author ? shellCfg.brand.author.name : "author";
    const bodyContent = post.content
      ? post.content
      : `<p class="reader-body-empty">inline content is disabled for this route.</p>
<p><a class="reader-open-link" href="${escapeAttr(post.url)}">Open full post →</a></p>`;

    reader.innerHTML = `
      <header class="reader-head">
        <div class="reader-head-l">
          <span class="prompt">
            <span class="prompt-user">you</span>
            <span class="prompt-at">@</span>
            <span class="prompt-host">blog</span>
            <span class="prompt-colon">:</span>
            <span class="prompt-path">~/articles/${escapeHtml(post.slug)}.md</span>
            <span class="prompt-glyph">$</span>
          </span>
        </div>
        <div class="reader-head-r">
          <span class="reader-meta">${post.read}m</span>
          <button class="reader-close" type="button" aria-label="close">esc</button>
        </div>
      </header>
      <div class="reader-body">
        <div class="reader-eyebrow">
          <span class="meta-date">${formatDate(post.date)}</span>
          <span class="meta-sep">·</span>
          <span class="meta-rel">${relTime(post.date)}</span>
          <span class="meta-sep">·</span>
          <span>${escapeHtml(author)}</span>
        </div>
        <h1 class="reader-title">${escapeHtml(post.title)}</h1>
        <p class="reader-excerpt">${escapeHtml(post.excerpt)}</p>
        <div class="reader-rule"></div>
        <div class="reader-prose">${bodyContent}</div>
        <div class="reader-rule"></div>
        <div class="reader-foot">
          <div class="reader-tags">
            ${(post.tags || []).map((t) => `<button class="tag" data-filter-tag="${escapeAttr(t)}"><span class="tag-hash">#</span>${escapeHtml(t)}</button>`).join("")}
          </div>
          <pre class="reader-end">/* end of file · ${post.read}m read */</pre>
        </div>
      </div>
    `;

    reader.querySelectorAll("[data-filter-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTag = btn.dataset.filterTag;
        localStorage.setItem("blog-active-tag", activeTag);
        window.location.href = "/articles/";
      });
    });
    reader.querySelector(".reader-close").addEventListener("click", closeReader);

    readerBackdrop.hidden = false;
    readerBackdrop.style.display = "flex";
    document.body.classList.add("reader-open");
  }

  function closeReader() {
    if (!readerBackdrop) return;
    readerBackdrop.hidden = true;
    readerBackdrop.style.display = "none";
    reader.innerHTML = "";
    document.body.classList.remove("reader-open");
  }

  function waveHTML(count) {
    return Array.from({ length: count })
      .map(
        (_, i) =>
          `<span class="wave-bar" style="animation-delay:${i * 60}ms;height:${20 + ((i * 13) % 70)}%"></span>`,
      )
      .join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll('"', "&quot;");
  }
})();
