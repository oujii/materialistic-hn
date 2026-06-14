// Instant article navigation — render the article view client-side from
// data the listing already has in memory. Zero HTTP, zero Lambda, ~zero ms
// from tap to first paint.
//
// Lives alongside SSR /item/[id] which is still authoritative for deep
// links, hard refresh, and crawlers. The SSR page emits the same script
// hooks (toggleSave etc.) we define here, so both code paths converge.

(function () {
  if (window.__hnInstantNav) return; // singleton guard
  window.__hnInstantNav = true;

  var FIREBASE = 'https://hacker-news.firebaseio.com/v0/item/';
  var BORDER_COLORS = ['border-hn-orange','border-purple-400','border-blue-400','border-green-400','border-pink-400','border-yellow-400'];
  var TEXT_COLORS   = ['text-hn-orange','text-purple-500','text-blue-500','text-green-500','text-pink-500','text-yellow-500'];

  // ---- Utilities ----
  function timeAgo(unix) {
    var d = Math.floor(Date.now() / 1000) - unix;
    if (d < 60) return d + 's';
    if (d < 3600) return Math.floor(d / 60) + 'm';
    if (d < 86400) return Math.floor(d / 3600) + 'h';
    if (d < 604800) return Math.floor(d / 86400) + 'd';
    return Math.floor(d / 604800) + 'w';
  }
  function getDomain(url) {
    if (!url) return 'news.ycombinator.com';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---- HTML builders (match SSR /item/[id].astro markup) ----
  function buildArticleHeader(story, saved, tab) {
    var hasUrl = !!story.url;
    var external = story.url || ('https://news.ycombinator.com/item?id=' + story.id);
    var domain = getDomain(story.url);
    var ago = timeAgo(story.time);
    var shareTitle = (story.title || '').replace(/'/g, "\\'");
    return ''
      + '<header class="bg-hn-amber">'
      +   '<div class="flex items-center h-14 px-4 gap-2">'
      +     '<a id="back-btn" href="/top" class="text-gray-900 p-1 -ml-1" aria-label="Back">'
      +       '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="m7.825 13l5.6 5.6L12 20l-8-8l8-8l1.425 1.4l-5.6 5.6H20v2z"/></svg>'
      +     '</a>'
      +     '<div class="flex-1"></div>'
      +     '<button class="text-gray-900 p-1" aria-label="Text size" onclick="toggleTextSize()">'
      +       '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14 20V7H9V4h13v3h-5v13zm-9 0v-8H2V9h9v3H8v8z"/></svg>'
      +     '</button>'
      +     (hasUrl
        ? '<a href="' + escAttr(story.url) + '" target="_blank" rel="noopener" class="text-gray-900 p-1" aria-label="Open external">'
          + '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h7v2H5v14h14v-7h2v7q0 .825-.587 1.413T19 21zm4.7-5.3l-1.4-1.4L17.6 5H14V3h7v7h-2V6.4z"/></svg>'
          + '</a>'
        : '')
      +     '<button class="text-gray-900 p-1" aria-label="Share" onclick="shareStory(\'' + shareTitle + '\', \'' + external + '\')">'
      +       '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17 22q-1.25 0-2.125-.875T14 19q0-.15.075-.7L7.05 14.2q-.4.375-.925.588T5 15q-1.25 0-2.125-.875T2 12t.875-2.125T5 9q.6 0 1.125.213t.925.587l7.025-4.1q-.05-.175-.062-.337T14 5q0-1.25.875-2.125T17 2t2.125.875T20 5t-.875 2.125T17 8q-.6 0-1.125-.213T14.95 7.2l-7.025 4.1q.05.175.063.338T8 12t-.012.363t-.063.337l7.025 4.1q.4-.375.925-.587T17 16q1.25 0 2.125.875T20 19t-.875 2.125T17 22"/></svg>'
      +     '</button>'
      +   '</div>'
      +   '<div class="relative px-4 pb-3 pr-20">'
      +     '<h1 class="text-gray-900 text-lg leading-snug">' + escText(story.title) + '</h1>'
      +     '<p class="text-gray-900 text-sm italic mt-2 leading-tight">' + escText(domain) + '</p>'
      +     '<p class="text-gray-900 text-sm mt-0.5 leading-tight">'
      +       escText(ago)
      +       (story.by ? ' - <a href="https://news.ycombinator.com/user?id=' + escAttr(story.by) + '" target="_blank" class="text-hn-orange font-bold">' + escText(story.by) + '</a>' : '')
      +     '</p>'
      +     '<div class="absolute right-3 bottom-2 flex items-center gap-1">'
      +       '<button id="upvote-btn" onclick="toggleUpvote(' + story.id + ')" class="text-gray-900 hover:text-black p-1" aria-label="Upvote" data-voted="false">'
      +         '<svg id="upvote-icon-outline" class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M18 21H7V8l7-7l1.25 1.25q.175.175.288.475t.112.575v.35L14.55 8H21q.8 0 1.4.6T23 10v2q0 .175-.05.375t-.1.375l-3 7.05q-.225.5-.75.85T18 21m-9-2h9l3-7v-2h-9l1.35-5.5L9 8.85zM9 8.85V19zM7 8v2H4v9h3v2H2V8z"/></svg>'
      +         '<svg id="upvote-icon-filled" class="w-7 h-7 hidden" fill="currentColor" viewBox="0 0 24 24"><path d="M18 21H8V8l7-7l1.25 1.25q.175.175.288.475t.112.575v.35L15.55 8H21q.8 0 1.4.6T23 10v2q0 .175-.037.375t-.113.375l-3 7.05q-.225.5-.75.85T18 21M6 8v13H2V8z"/></svg>'
      +       '</button>'
      +       '<button id="bookmark-btn" onclick="toggleSave(' + story.id + ')" class="text-gray-900 hover:text-black p-1" aria-label="Save" data-saved="' + (saved ? 'true' : 'false') + '">'
      +         '<svg id="bookmark-icon-outline" class="w-7 h-7 ' + (saved ? 'hidden' : '') + '" fill="currentColor" viewBox="0 0 24 24"><path d="M17,3L7,3c-1.1,0 -1.99,0.9 -1.99,2L5,21l7,-3 7,3L19,5c0,-1.1 -0.9,-2 -2,-2zM17,18l-5,-2.18L7,18L7,5h10v13z"/></svg>'
      +         '<svg id="bookmark-icon-filled" class="w-7 h-7 ' + (saved ? '' : 'hidden') + '" fill="currentColor" viewBox="0 0 24 24"><path d="M17,3H7c-1.1,0 -1.99,0.9 -1.99,2L5,21l7,-3 7,3V5c0,-1.1 -0.9,-2 -2,-2z"/></svg>'
      +       '</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="flex">'
      +     '<a href="/item/' + story.id + '?tab=comments" class="flex-1 text-center py-3 text-sm font-bold tracking-wide border-b-2 ' + (tab === 'comments' ? 'text-gray-900 border-red-500' : 'text-gray-700/60 border-transparent') + '">'
      +       (story.descendants || 0) + ' COMMENTS'
      +     '</a>'
      +     (hasUrl
        ? '<a href="/item/' + story.id + '?tab=article" class="flex-1 text-center py-3 text-sm font-bold tracking-wide border-b-2 ' + (tab === 'article' ? 'text-gray-900 border-red-500' : 'text-gray-700/60 border-transparent') + '">ARTICLE</a>'
        : '')
      +   '</div>'
      + '</header>';
  }

  function buildSkeleton(count) {
    var n = Math.min(count, 6);
    var s = '<div id="comments-skeleton" class="space-y-2">';
    for (var i = 0; i < n; i++) {
      s += '<div class="border-l-4 border-gray-200 pl-3 mb-2 animate-pulse">'
         +   '<div class="bg-white rounded-r-lg p-3 shadow-sm">'
         +     '<div class="flex items-center gap-2 mb-2"><div class="h-3 w-12 bg-gray-200 rounded"></div><div class="h-3 w-16 bg-gray-200 rounded"></div></div>'
         +     '<div class="space-y-2"><div class="h-3 bg-gray-200 rounded w-11/12"></div><div class="h-3 bg-gray-200 rounded w-9/12"></div><div class="h-3 bg-gray-200 rounded w-10/12"></div></div>'
         +   '</div>'
         + '</div>';
    }
    s += '</div>';
    return s;
  }

  function buildArticleMain(story) {
    var topKids = story.kids || [];
    var html = '<main class="min-h-screen bg-white">';
    html += '<div class="p-3 space-y-2">';
    if (story.text) {
      html += '<div class="bg-amber-50 rounded-lg p-3 mb-3 text-sm text-gray-700 leading-relaxed">' + story.text + '</div>';
    }
    html += '<script id="kids-data" type="application/json">' + JSON.stringify(topKids).replace(/</g, '\\u003c') + '<\/script>';
    html += '<div id="comments-root">';
    if (topKids.length === 0) {
      html += '<p class="text-center text-gray-400 py-8">No comments yet</p>';
    } else {
      html += buildSkeleton(topKids.length);
      html += '<div id="comments-list" class="space-y-2"></div>';
    }
    html += '</div></div></main>';
    return html;
  }

  function buildFAB(storyId) {
    return '<button onclick="replyToStory(' + storyId + ')" '
         + 'class="fixed bottom-6 right-6 z-40 w-14 h-14 bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-full shadow-lg flex items-center justify-center text-white" '
         + 'aria-label="Reply">'
         + '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 19v-4q0-1.25-.875-2.125T16 12H6.825l3.6 3.6L9 17l-6-6l6-6l1.425 1.4l-3.6 3.6H16q2.075 0 3.538 1.463T21 15v4z"/></svg>'
         + '</button>';
    }

  // ---- Client-side comment loader (mirrors item/[id].astro logic) ----
  function fetchHN(id) {
    return fetch(FIREBASE + id + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function renderComment(item, depth) {
    if (!item || item.deleted || item.dead) return null;
    var i = depth % 6;
    var wrap = el('div', 'border-l-4 ' + BORDER_COLORS[i] + ' pl-3 mb-2');
    var card = el('div', 'bg-white rounded-r-lg p-3 shadow-sm');

    var header = el('div', 'flex items-center justify-between mb-2');
    var left = el('div', 'flex items-center gap-2');
    left.appendChild(el('span', 'text-sm text-gray-500', timeAgo(item.time) + ' · '));
    left.appendChild(el('span', 'text-sm font-bold ' + TEXT_COLORS[i], item.by || ''));
    header.appendChild(left);
    card.appendChild(header);

    var text = el('div', 'text-base text-gray-800 leading-relaxed comment-text');
    text.innerHTML = item.text || '';
    var stored = parseInt(localStorage.getItem('comment-text-size') || '16', 10);
    if (!isNaN(stored) && stored !== 16) text.style.fontSize = stored + 'px';
    card.appendChild(text);

    var kids = item.kids || [];
    if (kids.length) {
      var details = el('details', 'mt-2');
      if (depth < 1) details.open = true;
      var summary = el('summary', 'text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none list-none',
        kids.length + ' ' + (kids.length === 1 ? 'reply' : 'replies') + ' ▼');
      details.appendChild(summary);
      var replies = el('div', 'mt-2 space-y-2');
      details.appendChild(replies);
      card.appendChild(details);

      var loaded = false;
      var loadKids = function () {
        if (loaded) return;
        loaded = true;
        var slots = kids.map(function () { var s = el('div'); replies.appendChild(s); return s; });
        kids.forEach(function (kidId, idx) {
          fetchHN(kidId).then(function (child) {
            var node = renderComment(child, depth + 1);
            if (node) slots[idx].replaceWith(node); else slots[idx].remove();
          });
        });
      };
      if (details.open) loadKids();
      details.addEventListener('toggle', function () { if (details.open) loadKids(); });
    }
    wrap.appendChild(card);
    return wrap;
  }

  function loadComments() {
    var kidsScript = document.getElementById('kids-data');
    var list = document.getElementById('comments-list');
    if (!kidsScript || !list) return;
    var kids = [];
    try { kids = JSON.parse(kidsScript.textContent || '[]'); } catch (e) {}
    if (!kids.length) return;
    var slots = kids.map(function () { var s = document.createElement('div'); list.appendChild(s); return s; });
    var visible = 0, settled = 0;
    var removeSkel = function () { var s = document.getElementById('comments-skeleton'); if (s) s.remove(); };
    kids.forEach(function (kid, i) {
      fetchHN(kid).then(function (item) {
        var node = renderComment(item, 0);
        if (node) {
          slots[i].replaceWith(node);
          visible++;
          if (visible === 1) removeSkel();
        } else {
          slots[i].remove();
        }
        settled++;
        if (settled === kids.length) {
          removeSkel();
          if (visible === 0) list.appendChild(el('p', 'text-center text-gray-400 py-6 text-sm', 'No visible comments.'));
        }
      });
    });
    setTimeout(function () {
      if (visible === 0 && settled === 0) {
        removeSkel();
        list.parentNode.innerHTML = '<p class="text-center text-red-400 py-8 text-sm">Couldn’t load comments. <a href="#" onclick="location.reload();return false" class="text-hn-orange underline">Reload</a></p>';
      }
    }, 8000);
  }

  // ---- DOM mutation: replace listing with article view ----
  function swapToArticleView(story, saved) {
    // Find the elements to swap. The listing's <header> and <main> are
    // direct children of <body>.
    var oldHeader = document.querySelector('body > header');
    var oldMain = document.querySelector('body > main');
    var ptr = document.getElementById('ptr-indicator');

    if (ptr) ptr.remove();

    var headerNode = htmlToNode(buildArticleHeader(story, saved, 'comments'));
    var mainNode = htmlToNode(buildArticleMain(story));
    var fabNode = htmlToNode(buildFAB(story.id));

    if (oldHeader) oldHeader.replaceWith(headerNode);
    if (oldMain) oldMain.replaceWith(mainNode);
    // Insert FAB before install-banner if it exists, else at end of body
    var anchor = document.getElementById('install-banner') || document.body.lastElementChild;
    if (anchor) anchor.parentNode.insertBefore(fabNode, anchor); else document.body.appendChild(fabNode);

    document.title = story.title + ' — Materialistic';
    initInArticle(story);
    loadComments();
  }

  function htmlToNode(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // ---- Tap interceptor ----
  document.addEventListener('click', function (e) {
    // Ignore modified clicks / middle-click / right-click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof e.button === 'number' && e.button !== 0) return;

    var target = e.target;
    if (!(target instanceof Element)) return;

    // 1) The three-dots "more options" button on a story row
    var menuBtn = target.closest('button[data-row-menu]');
    if (menuBtn) {
      e.preventDefault();
      e.stopImmediatePropagation();
      var rowA = menuBtn.closest('a[data-story]');
      if (rowA) openStoryMenu(rowA);
      return;
    }

    // 2) A normal story-link tap — open the article instantly from cache
    var a = target.closest('a[data-story]');
    if (a) {
      var story;
      try { story = JSON.parse(a.getAttribute('data-story')); } catch (_) { return; }
      if (!story || !story.id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      var saved = a.getAttribute('data-saved') === 'true';
      openArticleInstant(story, saved, /*pushState*/ true);
    }
  }, true);

  // ---- Shared overflow menu (singleton) ----
  function openStoryMenu(rowAnchor) {
    var menu = document.getElementById('story-menu');
    if (!menu) return;
    var story;
    try { story = JSON.parse(rowAnchor.getAttribute('data-story')); } catch (_) { return; }
    if (!story) return;
    var saved = rowAnchor.getAttribute('data-saved') === 'true';
    var externalUrl = story.url || 'https://news.ycombinator.com/item?id=' + story.id;

    var openArticle = document.getElementById('story-menu-article');
    var openHN = document.getElementById('story-menu-hn');
    var saveBtn = document.getElementById('story-menu-save');
    var shareBtn = document.getElementById('story-menu-share');
    if (openArticle) openArticle.setAttribute('href', externalUrl);
    if (openHN) openHN.setAttribute('href', 'https://news.ycombinator.com/item?id=' + story.id);
    if (saveBtn) {
      saveBtn.textContent = saved ? 'Unsave' : 'Save Story';
      saveBtn.onclick = function () {
        closeStoryMenu();
        window.saveStory && window.saveStory(story.id);
      };
    }
    if (shareBtn) {
      shareBtn.onclick = function () {
        closeStoryMenu();
        window.shareStory && window.shareStory(story.title || '', externalUrl);
      };
    }
    menu.classList.remove('hidden');
  }

  function closeStoryMenu() {
    var menu = document.getElementById('story-menu');
    if (menu) menu.classList.add('hidden');
  }

  // Backdrop click closes; sub-anchors close on follow
  document.addEventListener('click', function (e) {
    var menu = document.getElementById('story-menu');
    if (!menu || menu.classList.contains('hidden')) return;
    // If click is on a link inside the menu (Open Article / Open on HN), let it follow and close
    var link = e.target.closest && e.target.closest('#story-menu a');
    if (link) { closeStoryMenu(); return; }
    // If click was on the backdrop (the menu container itself, not its inner box), close
    if (e.target === menu) { closeStoryMenu(); }
  });

  function openArticleInstant(story, saved, doPush) {
    // Remember the section the user came from for the back button
    if (location.pathname && location.pathname !== '/') {
      sessionStorage.setItem('hn-back', location.pathname);
    }

    var run = function () {
      swapToArticleView(story, saved);
      if (doPush) {
        history.pushState({ instant: true, id: story.id }, '', '/item/' + story.id);
      }
    };

    if (document.startViewTransition) {
      document.documentElement.setAttribute('data-astro-transition', 'forward');
      var t = document.startViewTransition(run);
      t.finished.finally(function () {
        document.documentElement.removeAttribute('data-astro-transition');
      });
    } else {
      run();
    }
  }

  // ---- Article-page action handlers (also used by SSR /item/[id]) ----
  function initInArticle(storyOrSeed) {
    var backBtn = document.getElementById('back-btn');
    if (backBtn) {
      var dest = sessionStorage.getItem('hn-back') || '/top';
      backBtn.setAttribute('href', dest);
    }
  }

  window.toggleSave = async function (id) {
    var btn = document.getElementById('bookmark-btn');
    var isSaved = btn && btn.getAttribute('data-saved') === 'true';
    var outline = document.getElementById('bookmark-icon-outline');
    var filled = document.getElementById('bookmark-icon-filled');
    if (outline) outline.classList.toggle('hidden');
    if (filled) filled.classList.toggle('hidden');
    if (btn) btn.setAttribute('data-saved', isSaved ? 'false' : 'true');
    try {
      var res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, unsave: isSaved }),
      });
      if (res.status === 401) {
        window.showToast && window.showToast('Session expired — please log in again', 3000);
        setTimeout(function () { window.location.href = '/login'; }, 1500);
        return;
      }
      if (!res.ok) {
        if (outline) outline.classList.toggle('hidden');
        if (filled) filled.classList.toggle('hidden');
        if (btn) btn.setAttribute('data-saved', isSaved ? 'true' : 'false');
        window.showToast && window.showToast('Failed to save', 3000);
        return;
      }
      // Invalidate cached favorites set so next listing reflects the change
      try { sessionStorage.removeItem('hn-favs'); } catch (_) {}
      window.showToast && window.showToast(isSaved ? 'Removed from favorites' : 'Saved to your HN favorites');
    } catch (e) {
      window.showToast && window.showToast('Network error', 3000);
    }
  };

  window.toggleUpvote = async function (id) {
    var btn = document.getElementById('upvote-btn');
    if (!btn || btn.getAttribute('data-voted') === 'true') return;
    var outline = document.getElementById('upvote-icon-outline');
    var filled = document.getElementById('upvote-icon-filled');
    if (outline) outline.classList.add('hidden');
    if (filled) filled.classList.remove('hidden');
    btn.setAttribute('data-voted', 'true');
    try {
      var res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, dir: 'up' }),
      });
      if (res.status === 401) window.location.href = '/login';
    } catch (_) {}
  };

  window.toggleTextSize = function () {
    var cur = parseInt(localStorage.getItem('comment-text-size') || '16', 10);
    var next = cur === 16 ? 18 : cur === 18 ? 20 : 16;
    localStorage.setItem('comment-text-size', String(next));
    document.querySelectorAll('.comment-text').forEach(function (n) {
      n.style.fontSize = next + 'px';
    });
  };

  window.shareStory = function (title, url) {
    if (navigator.share) navigator.share({ title: title, url: url });
    else if (navigator.clipboard) navigator.clipboard.writeText(url);
  };

  window.replyToStory = function (id) {
    window.open('https://news.ycombinator.com/item?id=' + id, '_blank', 'noopener');
  };

  // ---- Favorites: client-side cached so Lambda isn't scraping HN every render ----
  var FAV_TTL_MS = 5 * 60 * 1000;
  var BOOKMARK_SVG = '<svg class="saved-bookmark absolute top-0 left-1 w-5 h-5 text-hn-orange" fill="currentColor" viewBox="0 0 24 24"><path d="M5 21V5q0-.825.588-1.412T7 3h10q.825 0 1.413.588T19 5v16l-7-3z"/></svg>';

  function applyFavoritesToDom(ids) {
    var set = new Set(ids);
    document.querySelectorAll('a[data-story]').forEach(function (a) {
      var sid;
      try { sid = JSON.parse(a.getAttribute('data-story')).id; } catch (_) { return; }
      if (!set.has(sid)) return;
      a.setAttribute('data-saved', 'true');
      var rankCol = a.firstElementChild;
      if (rankCol && !rankCol.querySelector('.saved-bookmark')) {
        rankCol.insertAdjacentHTML('afterbegin', BOOKMARK_SVG);
      }
    });
    // Article header bookmark
    var m = location.pathname.match(/^\/item\/(\d+)/);
    if (m) {
      var aid = parseInt(m[1], 10);
      if (set.has(aid)) {
        var btn = document.getElementById('bookmark-btn');
        if (btn) btn.setAttribute('data-saved', 'true');
        var outline = document.getElementById('bookmark-icon-outline');
        var filled = document.getElementById('bookmark-icon-filled');
        if (outline) outline.classList.add('hidden');
        if (filled) filled.classList.remove('hidden');
      }
    }
  }

  function loadFavorites() {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem('hn-favs') || 'null'); } catch (_) {}
    if (cached && Array.isArray(cached.ids) && (Date.now() - cached.ts) < FAV_TTL_MS) {
      applyFavoritesToDom(cached.ids);
      return;
    }
    fetch('/api/favorites', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.ids)) return;
        try { sessionStorage.setItem('hn-favs', JSON.stringify({ ids: data.ids, ts: Date.now() })); } catch (_) {}
        applyFavoritesToDom(data.ids);
      })
      .catch(function () {});
  }

  // ---- Initial run on the page that loaded us (SSR /item/[id]) ----
  function bootIfArticlePage() {
    // If this page has a kids-data island already (SSR item page), run loader
    var kids = document.getElementById('kids-data');
    if (kids) {
      initInArticle();
      loadComments();
    }
    // Always try to populate favorites — cheap with cache, async with network
    loadFavorites();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootIfArticlePage);
  } else {
    bootIfArticlePage();
  }

  // Re-run on Astro view transitions navigation as well
  document.addEventListener('astro:page-load', bootIfArticlePage);
})();
