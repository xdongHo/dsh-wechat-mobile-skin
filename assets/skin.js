/* ============================================================
 * DSH Mobile WeChat Skin — 微信风格移动端交互层
 * Loaded via <script defer> from index.html. Inert on desktop:
 * everything only runs when <html> has the `dsh-wx` class that
 * the UA-sniffing snippet adds for mobile browsers.
 *
 * Design:
 *  - The real React app keeps running underneath, untouched.
 *  - A fixed "chat list" overlay (微信消息列表/通讯录风格) mirrors
 *    the sidebar session tree; tapping a row clicks the matching
 *    real sidebar row (React state does the navigation).
 *  - Chat mode hides the sidebar and re-skins the conversation
 *    into a WeChat chat page with a nav bar + back button.
 * ============================================================ */
(function () {
  "use strict";
  var html = document.documentElement;
  if (!html.classList.contains("dsh-wx")) return; // desktop → no-op
  if (window.__DSH_WX_MOBILE_SKIN_LOADED__) return; // never double-mount
  window.__DSH_WX_MOBILE_SKIN_LOADED__ = true;

  var SKIN_CFG = window.__DSH_WX_MOBILE_SKIN__ || {};
  var NAV_TITLE = typeof SKIN_CFG.navTitle === "string" && SKIN_CFG.navTitle
    ? SKIN_CFG.navTitle
    : "DeepSeek";

  var MODE_LIST = "wx-mode-list";
  var MODE_CHAT = "wx-mode-chat";

  /* ---------------- tiny helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn(); }, ms);
    };
  }
  function warn() { try { console.warn.apply(console, ["[wx-mobile]"].concat([].slice.call(arguments))); } catch (e) {} }

  /* ---------------- force light (v1 skin is light-only) ---------------- */
  function keepLight() {
    try { if (document.body) document.body.removeAttribute("data-ds-dark-theme"); } catch (e) {}
  }

  /* ---------------- palette for contact avatars ---------------- */
  var AV_COLORS = ["#5B8CFF", "#07C160", "#FA9D3B", "#F76F6F",
    "#9B6FE8", "#34B3C9", "#E4B84C", "#6EBE71"];
  function avColor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AV_COLORS[h % AV_COLORS.length];
  }

  /* ---------------- build overlay chrome ---------------- */
  var overlay = el("div"); overlay.id = "wxm-mobile-root";
  var nav = el("div"); nav.id = "wxm-nav";
  var navTitle = el("span"); navTitle.id = "wxm-nav-title";
  navTitle.textContent = NAV_TITLE;
  var navCount = el("span"); navCount.id = "wxm-nav-count";
  navTitle.appendChild(navCount);
  var newBtn = el("button"); newBtn.id = "wxm-new"; newBtn.type = "button";
  newBtn.textContent = "+"; newBtn.title = "新建会话"; newBtn.setAttribute("aria-label", "新建会话");
  nav.appendChild(navTitle); nav.appendChild(newBtn);

  var searchWrap = el("div"); searchWrap.id = "wxm-searchbar";
  var search = el("input"); search.id = "wxm-search"; search.type = "text";
  search.placeholder = "搜索会话"; search.setAttribute("autocomplete", "off");
  searchWrap.appendChild(search);

  var list = el("div"); list.id = "wxm-list";
  overlay.appendChild(nav); overlay.appendChild(searchWrap); overlay.appendChild(list);

  var chatbar = el("div"); chatbar.id = "wxm-chatbar";
  var backBtn = el("button"); backBtn.id = "wxm-back"; backBtn.type = "button";
  backBtn.setAttribute("aria-label", "返回会话列表");
  backBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
    '<path d="M15 4 L7.5 12 L15 20" stroke="#191919" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var chatTitle = el("div"); chatTitle.id = "wxm-chat-title"; chatTitle.textContent = "DeepSeek";
  var chatStatus = el("div"); chatStatus.id = "wxm-chat-status";
  chatStatus.appendChild(el("span", "wxm-dot"));
  chatbar.appendChild(backBtn); chatbar.appendChild(chatTitle); chatbar.appendChild(chatStatus);

  /* floating stats ball + panel (会话统计悬浮球) */
  var ball = el("div"); ball.id = "wxm-ball"; ball.setAttribute("role", "button");
  ball.setAttribute("aria-label", "会话统计");
  var ballNum = el("span", "wxm-ball-num", "·");
  var ballLabel = el("span", "wxm-ball-label", "轮");
  ball.appendChild(ballNum); ball.appendChild(ballLabel);
  var panel = el("div"); panel.id = "wxm-stats";
  var panelHead = el("div", "wxm-stats-head");
  panelHead.appendChild(el("span", null, "会话统计"));
  var panelClose = el("button", "wxm-stats-close"); panelClose.type = "button";
  panelClose.textContent = "✕"; panelClose.setAttribute("aria-label", "关闭统计");
  panelHead.appendChild(panelClose);
  var panelBody = el("div", "wxm-stats-body");
  panelBody.appendChild(el("div", "wxm-stats-empty", "暂无统计数据"));
  panel.appendChild(panelHead); panel.appendChild(panelBody);

  function mountChrome() {
    if (!document.body) return false;
    if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
    if (chatbar.parentNode !== document.body) document.body.appendChild(chatbar);
    if (ball.parentNode !== document.body) document.body.appendChild(ball);
    if (panel.parentNode !== document.body) document.body.appendChild(panel);
    restoreBallPos();
    return true;
  }

  /* ---------------- view switching ---------------- */
  var mode = MODE_LIST;
  function setMode(m) {
    mode = m;
    html.classList.remove(MODE_LIST, MODE_CHAT);
    html.classList.add(m);
    if (m === MODE_CHAT) updateChatTitle();
    updateBallVisibility();
    if (m !== MODE_CHAT) closePanel();
    window.scrollTo(0, 0);
  }
  function enterChat(push) {
    setMode(MODE_CHAT);
    if (push !== false) {
      try { if (!history.state || history.state.wxm !== "chat") history.pushState({ wxm: "chat" }, ""); } catch (e) {}
    }
  }
  function enterList() { setMode(MODE_LIST); }
  window.addEventListener("popstate", function () { enterList(); });
  backBtn.addEventListener("click", function () {
    try {
      if (history.state && history.state.wxm === "chat") history.back();
      else enterList();
    } catch (e) { enterList(); }
  });

  /* ---------------- floating stats ball (会话统计悬浮球) ---------------- */
  var DOT_COLORS = ["#07c160", "#576b95", "#fa9d3b", "#9b6fe8", "#f76f6f"];
  var statsSegments = [];

  function extractStats() {
    var dock = $('[data-slot="conversation.composer.dock"]');
    var root = dock ? $('[class*="_root"]', dock) : null;
    if (!root) { statsSegments = []; }
    else {
      statsSegments = $all("span", root)
        .filter(function (s) { return !/sep/i.test(s.className) && s.textContent.trim(); })
        .map(function (s) { return s.textContent.trim(); });
    }
    var m = (statsSegments[0] || "").match(/(\d+)\s*轮/);
    ballNum.textContent = m ? m[1] : "·";
    updateBallVisibility();
    if (panel.classList.contains("open")) renderPanel();
  }

  function updateBallVisibility() {
    ball.classList.toggle("has-data", mode === MODE_CHAT && statsSegments.length >= 2);
    if (!ball.classList.contains("has-data")) closePanel();
  }

  function renderPanel() {
    panelBody.textContent = "";
    if (!statsSegments.length) {
      panelBody.appendChild(el("div", "wxm-stats-empty", "暂无统计数据"));
      return;
    }
    statsSegments.forEach(function (seg, i) {
      var row = el("div", "wxm-stats-row");
      var dot = el("span", "dot");
      dot.style.setProperty("--c", DOT_COLORS[i % DOT_COLORS.length]);
      row.appendChild(dot);
      row.appendChild(el("span", "txt", seg));
      panelBody.appendChild(row);
    });
  }

  function openPanel() {
    renderPanel();
    panel.style.visibility = "hidden";
    panel.classList.add("open");
    var w = panel.offsetWidth, h = panel.offsetHeight;
    var b = ball.getBoundingClientRect();
    var left = Math.min(Math.max(8, b.right - w), window.innerWidth - w - 8);
    var top = b.top - h - 10;
    if (top < 56) top = Math.min(b.bottom + 10, window.innerHeight - h - 8);
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.visibility = "";
  }
  function closePanel() { panel.classList.remove("open"); }
  function togglePanel() {
    if (panel.classList.contains("open")) closePanel();
    else if (statsSegments.length) openPanel();
  }
  panelClose.addEventListener("click", closePanel);
  document.addEventListener("pointerdown", function (e) {
    if (!panel.classList.contains("open")) return;
    if (panel.contains(e.target) || ball.contains(e.target)) return;
    closePanel();
  }, true);

  /* draggable ball (vertical drag anywhere; snaps back to an edge) */
  (function () {
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    ball.addEventListener("pointerdown", function (e) {
      dragging = true; moved = false; sx = e.clientX; sy = e.clientY;
      var r = ball.getBoundingClientRect(); ox = r.left; oy = r.top;
      try { ball.setPointerCapture(e.pointerId); } catch (err) {}
    });
    ball.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved = true;
      if (!moved) return;
      var w = ball.offsetWidth, h = ball.offsetHeight;
      var x = Math.min(Math.max(4, ox + dx), window.innerWidth - w - 4);
      var y = Math.min(Math.max(56, oy + dy), window.innerHeight - h - 8);
      ball.style.left = x + "px"; ball.style.top = y + "px";
      ball.style.right = "auto"; ball.style.bottom = "auto";
    });
    ball.addEventListener("pointerup", function () {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        // snap horizontally to the nearer edge
        var r = ball.getBoundingClientRect();
        var toLeft = r.left + r.width / 2 < window.innerWidth / 2;
        ball.style.left = (toLeft ? 8 : window.innerWidth - r.width - 8) + "px";
        ball.style.right = "auto";
        try {
          localStorage.setItem("wxm-ball-pos", JSON.stringify({
            left: ball.style.left, top: ball.style.top, right: "auto", bottom: "auto"
          }));
        } catch (err) {}
      } else {
        togglePanel();
      }
    });
  })();

  function restoreBallPos() {
    try {
      var saved = localStorage.getItem("wxm-ball-pos");
      if (!saved) return;
      var p = JSON.parse(saved);
      ["left", "top", "right", "bottom"].forEach(function (k) {
        if (p[k]) ball.style[k] = p[k];
      });
    } catch (e) {}
  }


  /* ---------------- sidebar tree snapshot ---------------- */
  // sessions: [{kind:'ws'|'sess', name, title, time, ongoing, selected, el}]
  var sessions = [];
  var signature = "";

  function findTree() {
    return $('[role="tree"]');
  }

  function snapshot() {
    var tree = findTree();
    if (!tree) return false;
    var out = [];
    $all('[role="treeitem"]', tree).forEach(function (row) {
      var isProject = row.hasAttribute("aria-expanded") || /projectRow/i.test(row.className);
      var titleEl = $('[class*="title"]', row);
      var timeEl = $('[class*="time"]', row);
      var title = (titleEl && titleEl.textContent || "").trim();
      if (isProject) {
        out.push({ kind: "ws", name: title || "工作区", el: row,
          collapsed: row.getAttribute("aria-expanded") === "false" });
      } else {
        out.push({
          kind: "sess",
          title: title || "会话",
          time: (timeEl && timeEl.textContent || "").trim(),
          ongoing: !!$('[data-state="ongoing"]', row),
          selected: row.getAttribute("aria-selected") === "true",
          el: row
        });
      }
    });
    sessions = out;
    return true;
  }

  function computeSignature() {
    return sessions.map(function (s) {
      if (s.kind === "ws") return "w:" + s.name + ":" + (s.collapsed ? 0 : 1);
      return "s:" + s.title + ":" + s.time + ":" + (s.ongoing ? 1 : 0) + ":" + (s.selected ? 1 : 0);
    }).join("|");
  }

  function selectedSession() {
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].kind === "sess" && sessions[i].selected) return sessions[i];
    }
    return null;
  }

  function updateNavCount() {
    var n = 0;
    sessions.forEach(function (s) { if (s.kind === "sess") n++; });
    navCount.textContent = n ? " (" + n + ")" : "";
  }

  function updateChatTitle() {
    var sel = selectedSession();
    chatTitle.textContent = sel ? sel.title : NAV_TITLE;
    chatStatus.className = sel && sel.ongoing ? "is-ongoing" : "";
  }

  /* ---------------- render list overlay ---------------- */
  function render() {
    var filter = (search.value || "").trim().toLowerCase();
    list.textContent = "";
    var anyVisible = false;
    var lastWasRow = false;

    sessions.forEach(function (s) {
      if (s.kind === "ws") {
        var head = el("div", "wxm-section", s.name + (s.collapsed ? "  ›" : ""));
        head.addEventListener("click", function () { try { s.el.click(); } catch (e) {} });
        list.appendChild(head);
        lastWasRow = false;
        return;
      }
      if (filter && s.title.toLowerCase().indexOf(filter) === -1) return;
      anyVisible = true;

      var row = el("div", "wxm-row" + (s.ongoing ? " is-ongoing" : ""));
      row.setAttribute("role", "button");

      var av = el("div", "wxm-avatar", s.title.charAt(0).toUpperCase() || "#");
      av.style.setProperty("--wxm-av", avColor(s.title));

      var main = el("div", "wxm-row-main");
      var top = el("div", "wxm-row-top");
      var t = el("span", "wxm-row-title", s.title);
      var tm = el("span", "wxm-row-time", s.time);
      top.appendChild(t); top.appendChild(tm);
      var bottom = el("div", "wxm-row-bottom");
      var previewText = s.ongoing ? "会话进行中…" : "轻触继续对话";
      if (s.selected && mode === MODE_LIST) previewText = "当前会话";
      var pv = el("span", "wxm-row-preview", previewText);
      bottom.appendChild(pv);
      bottom.appendChild(el("span", "wxm-dot"));
      main.appendChild(top); main.appendChild(bottom);

      row.appendChild(av); row.appendChild(main);
      row.addEventListener("click", function () {
        try { s.el.click(); } catch (e) { warn(e); }
        enterChat();
      });
      list.appendChild(row);
      lastWasRow = true;
    });

    if (!anyVisible) {
      list.appendChild(el("div", "wxm-empty",
        filter ? "没有匹配的会话" : "暂无历史会话，点右上角 + 开始新会话"));
    }
    updateNavCount();
    if (mode === MODE_CHAT) updateChatTitle();
  }

  function rebuildIfChanged() {
    keepLight();
    tagLayout();
    extractStats();
    if (!snapshot()) {
      ensureSidebarExpanded();
      return;
    }
    var sig = computeSignature();
    if (sig === signature) return;
    signature = sig;
    render();
  }

  /* ---------------- layout tagging (hash-class independent) ---------------- */
  function tagLayout() {
    try {
      var root = document.getElementById("root");
      if (!root) return;
      // the frame carries stable app attrs; inline grid style is the fallback
      var frame = root.querySelector("[data-sidebar-collapsed]") ||
                  root.querySelector('div[style*="grid-template-columns"]') ||
                  (root.firstElementChild && root.firstElementChild.firstElementChild);
      if (!frame) return;
      frame.setAttribute("data-wx-frame", "");
      var sawSidebar = false, sawCenter = false;
      Array.prototype.forEach.call(frame.children, function (c) {
        c.removeAttribute("data-wx-sidebar");
        c.removeAttribute("data-wx-center");
        c.removeAttribute("data-wx-details");
        if (!sawSidebar && (c.querySelector('[data-slot="sidebar"]') || $('[role="tree"]', c))) {
          c.setAttribute("data-wx-sidebar", ""); sawSidebar = true;
        } else if (!sawCenter && (c.querySelector('[data-slot="conversation"]') ||
                   $("[data-conversation-scroll]", c) || $("[data-composer-seat]", c))) {
          c.setAttribute("data-wx-center", ""); sawCenter = true;
        } else {
          c.setAttribute("data-wx-details", "");
        }
      });
    } catch (e) { warn("tagLayout", e); }
  }

  /* ---------------- keep the sidebar expanded so the tree exists ----------------
   * On narrow viewports the app auto-collapses the sidebar to a rail and the
   * session tree is not rendered at all. Our list needs that tree, so click
   * the rail's expand toggle whenever the sidebar is collapsed. The skin CSS
   * hides the sidebar column, so the expansion is invisible to the user. */
  var lastExpandAt = 0;
  function ensureSidebarExpanded() {
    var frame = $("[data-wx-frame]") || $("[data-sidebar-collapsed]");
    if (!frame) return false;
    var collapsed = frame.getAttribute("data-sidebar-collapsed") === "true";
    if (!collapsed && findTree()) return true;
    var now = Date.now();
    if (now - lastExpandAt < 1000) return false;
    lastExpandAt = now;
    var toggle = $('button[aria-label="打开侧边栏"]') ||
                 $('[data-slot="sidebar"] [class*="_toggle"]') ||
                 $('[class*="_toggle"]', frame);
    if (toggle) {
      try { toggle.click(); warn("sidebar expanded for mobile list"); return true; } catch (e) {}
    }
    return false;
  }

  /* ---------------- new session (+) ---------------- */
  newBtn.addEventListener("click", function () {
    var btn = $('[class*="_newSession"]') ||
              $('button[aria-label="新建会话"]') ||
              $('button[aria-label*="新会话"]');
    if (btn) { try { btn.click(); } catch (e) {} }
    enterChat();
  });

  /* ---------------- search filter ---------------- */
  search.addEventListener("input", debounce(render, 120));

  /* ---------------- observers ---------------- */
  var mo = new MutationObserver(debounce(rebuildIfChanged, 180));
  function observeEverything() {
    try {
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) { warn("observe", e); }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    if (!mountChrome()) { setTimeout(boot, 120); return; }
    keepLight();
    tagLayout();
    ensureSidebarExpanded();
    rebuildIfChanged();
    observeEverything();
    // keep waiting until the sidebar tree exists (app may still be loading)
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (findTree()) { rebuildIfChanged(); clearInterval(iv); }
      else if (tries > 80) { clearInterval(iv); warn("sidebar tree not found; list may stay empty"); }
      else { ensureSidebarExpanded(); }
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
