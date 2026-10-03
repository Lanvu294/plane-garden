/* ============================================================================
   The question panel: a page of the planes' own ruled paper, with folder
   tabs (Answered, Waiting), a search that is also a filter on the sky, and
   a place to ask.

   It holds no state of its own that the sky needs: everything shared goes
   through QF_STORE (store.js), and the sky (garden.js) reads the same store.
   Words are in copy.js; questions, search and the identifying-detail check
   are in data.js. Submitted or typed text is only ever set as text, never
   as HTML.
   ========================================================================== */
(function () {
  'use strict';
  var S = window.QF_STORE, D = window.QF_DATA, C = window.QF_COPY, F = D.format;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia ? matchMedia('(max-width: 767px)') : { matches: false, addListener: function () {} };
  var MAX = 280, MIN = 8;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(path) {                                   // small line icons, ours only
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = path;
    return s;
  }
  var ICON = {
    pen: '<path d="M10.5 2.5l3 3L6 13H3v-3z M9 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
    search: '<circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5"/>',
    plane: '<path d="M14.5 1.5L1.5 7l5 1.8L14.5 1.5 8.3 14.5 6.5 8.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    check: '<path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  var live = el('div', 'qf-sr'); live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status');
  document.body.appendChild(live);
  function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }

  /* ------------------------------------------------------------------ dock */
  var dock = el('div', 'qdock');
  var dockAsk = el('button', 'q-ask'); dockAsk.type = 'button';
  dockAsk.appendChild(svg(ICON.pen));
  var dl = el('span'); dl.appendChild(el('span', 'label-short', C.dock.askShort)); dl.appendChild(el('span', 'label-long', C.dock.ask));
  dockAsk.appendChild(dl);
  var dockAll = el('button', 'q-all'); dockAll.type = 'button';
  dockAll.appendChild(el('span', null, C.dock.all));
  var dockCount = el('span', 'count', String(D.answered().length));
  dockAll.appendChild(dockCount);
  dock.appendChild(dockAsk); dock.appendChild(dockAll);
  document.body.appendChild(dock);

  /* ----------------------------------------------------------------- panel */
  var nb = el('aside', 'nb');
  nb.setAttribute('role', 'dialog'); nb.setAttribute('aria-modal', 'false'); nb.setAttribute('aria-label', C.tabs.label);
  nb.setAttribute('inert', '');
  var grip = el('div', 'nb-grip'); grip.setAttribute('aria-hidden', 'true'); grip.appendChild(el('span'));
  var head = el('div', 'nb-head');
  var tablist = el('div', 'nb-tabs'); tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', C.tabs.label);
  function makeTab(id, label) {
    var b = el('button', 'nb-tab'); b.type = 'button'; b.id = 'qf-tab-' + id;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'qf-list'); b.setAttribute('aria-selected', 'false');
    b.appendChild(el('span', 'nb-tab-label', label));
    var n = el('b', 'nb-count', '0'); b.appendChild(n);
    b.addEventListener('click', function () { S.set({ view: id, mode: 'browse' }); });
    tablist.appendChild(b);
    return { b: b, n: n };
  }
  var tabA = makeTab('answered', C.tabs.answered), tabW = makeTab('waiting', C.tabs.waiting);
  var badge = el('span', 'nb-badge'); badge.hidden = true; tabA.b.appendChild(badge);
  tablist.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    var v = S.get().view === 'answered' ? 'waiting' : 'answered';
    S.set({ view: v, mode: 'browse' });
    (v === 'answered' ? tabA : tabW).b.focus();
  });
  var askBtn = el('button', 'nb-ask'); askBtn.type = 'button';
  askBtn.addEventListener('click', function () { S.set({ mode: S.get().mode === 'browse' ? 'ask' : 'browse' }); });
  head.appendChild(tablist); head.appendChild(askBtn);

  var page = el('div', 'nb-page');
  var closeBtn = el('button', 'nb-close', '×'); closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', C.tabs.close);
  closeBtn.addEventListener('click', function () { S.set({ panelOpen: false }); });
  var scroll = el('div', 'nb-scroll');
  page.appendChild(closeBtn); page.appendChild(scroll);
  nb.appendChild(grip); nb.appendChild(head); nb.appendChild(page);
  document.body.appendChild(nb);

  /* -------------------------------------------------------------- browse */
  var browse = el('section', 'nb-browse');
  var bKick = el('p', 'nb-kicker'), bTitle = el('h2', 'nb-title'), bNote = el('p', 'nb-note');
  var searchWrap = el('label', 'nb-search'); searchWrap.appendChild(svg(ICON.search));
  var search = el('input'); search.type = 'search'; search.placeholder = C.answered.search;
  search.setAttribute('aria-label', C.answered.search); search.setAttribute('aria-describedby', 'qf-cue');
  var searchCount = el('span', 'nb-search-count');
  var clearBtn = el('button', 'nb-clear', '×'); clearBtn.type = 'button'; clearBtn.setAttribute('aria-label', C.answered.clear); clearBtn.hidden = true;
  clearBtn.addEventListener('click', function (e) { e.preventDefault(); search.value = ''; S.set({ query: '' }); search.focus(); });
  searchWrap.appendChild(search); searchWrap.appendChild(searchCount); searchWrap.appendChild(clearBtn);
  var cue = el('p', 'nb-cue'); cue.id = 'qf-cue';
  var list = el('ol', 'nb-list'); list.id = 'qf-list'; list.setAttribute('role', 'tabpanel');
  var empty = el('div', 'nb-empty'); empty.hidden = true;
  var reviewLine = el('p', 'nb-review'); reviewLine.hidden = true;
  [bKick, bTitle, bNote, searchWrap, cue, list, empty, reviewLine].forEach(function (n) { browse.appendChild(n); });
  scroll.appendChild(browse);

  var searchTimer = null;
  search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { S.set({ query: search.value }); }, 120);
  });

  /* rows: answered ones built once (and when a question is answered),
     waiting ones whenever the data changes */
  var rowsA = {}, rowsW = {}, orderA = [], expanded = null;
  function buildAnswered() {
    var items = D.answered();
    items.forEach(function (x) {
      if (rowsA[x.id]) return;
      var li = el('li', 'row'); li.dataset.id = x.id;
      var main = el('button', 'row-main'); main.type = 'button';
      main.setAttribute('aria-expanded', 'false'); main.setAttribute('aria-controls', 'qf-prev-' + x.id);
      var num = el('span', 'num'); num.appendChild(el('span', 'num-n', x.n < 10 ? '0' + x.n : String(x.n)));
      var tick = svg(ICON.check); tick.setAttribute('class', 'num-read'); num.appendChild(tick);
      main.appendChild(num);
      var q = el('span', 'q', x.q); main.appendChild(q);
      main.appendChild(el('span', 'plus', '+'));
      var prev = el('div', 'preview'); prev.id = 'qf-prev-' + x.id; prev.hidden = true;
      prev.appendChild(el('p', 'ans', x.a));
      var unfold = el('button', 'nb-link unfold'); unfold.type = 'button';
      unfold.appendChild(svg(ICON.plane)); unfold.appendChild(el('span', null, C.answered.unfold));
      prev.appendChild(unfold);
      li.appendChild(main); li.appendChild(prev);
      main.addEventListener('click', function () { setExpanded(expanded === x.id ? null : x.id); });
      main.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); S.set({ openId: x.id, openHint: null }); }
      });
      unfold.addEventListener('click', function () { S.set({ openId: x.id, openHint: null }); });
      hoverable(li, x.id, main);
      rowsA[x.id] = { li: li, main: main, prev: prev, item: x };
      orderA.push(x.id);
    });
  }
  function setExpanded(id) {
    if (expanded && rowsA[expanded]) {
      rowsA[expanded].prev.hidden = true;
      rowsA[expanded].main.setAttribute('aria-expanded', 'false');
      rowsA[expanded].li.classList.remove('open');
    }
    expanded = id;
    if (id && rowsA[id]) {
      rowsA[id].prev.hidden = false;
      rowsA[id].main.setAttribute('aria-expanded', 'true');
      rowsA[id].li.classList.add('open');
    }
  }
  function buildWaiting() {
    Object.keys(rowsW).forEach(function (k) { rowsW[k].li.remove(); });
    rowsW = {};
    D.waiting().forEach(function (x) {
      var li = el('li', 'row waiting' + (x.mine ? ' mine' : '')); li.dataset.id = x.id;
      var main = el('button', 'row-main'); main.type = 'button';
      main.appendChild(el('span', 'q', x.q));
      var meta = el('span', 'meta');
      if (x.topic) meta.appendChild(el('span', 'chip', x.topic));
      meta.appendChild(el('span', 'when', F(C.waiting.sent, { ago: D.ago(x.at) })));
      if (x.mine) meta.appendChild(el('span', 'yours', x.status === 'review' ? C.waiting.yoursReview : C.waiting.yours));
      meta.appendChild(el('span', 'hover-note', C.waiting.hover));
      main.appendChild(meta);
      li.appendChild(main);
      main.addEventListener('click', function () { S.set({ locateId: x.id }); });
      hoverable(li, x.id, main);
      rowsW[x.id] = { li: li, main: main, item: x };
    });
  }
  /* hovering or focusing a row lifts its plane in the sky */
  function hoverable(li, id, main) {
    li.addEventListener('mouseenter', function () { S.set({ hoveredId: id, hoveredPlane: null, hoverSource: 'panel' }); });
    li.addEventListener('mouseleave', function () {
      var st = S.get();
      if (st.hoveredId === id && st.hoverSource === 'panel') S.set({ hoveredId: null, hoverSource: null });
    });
    main.addEventListener('focus', function () { S.set({ hoveredId: id, hoveredPlane: null, hoverSource: 'keyboard' }); });
  }

  /* -------------------------------------------------------------------- ask */
  var ask = el('section', 'nb-askview'); ask.hidden = true;
  ask.appendChild(el('p', 'nb-kicker', C.ask.kicker));
  var askTitle = el('h2', 'nb-title', C.ask.title); askTitle.id = 'qf-ask-title'; ask.appendChild(askTitle);
  var reassure = el('ul', 'reassure');
  C.ask.reassure.forEach(function (t) { reassure.appendChild(el('li', null, t)); });
  ask.appendChild(reassure);
  var composer = el('div', 'composer');
  var backdrop = el('div', 'backdrop'); backdrop.setAttribute('aria-hidden', 'true');
  var ta = el('textarea'); ta.maxLength = MAX; ta.rows = 4; ta.placeholder = C.ask.placeholder;
  ta.setAttribute('aria-label', C.ask.label); ta.setAttribute('aria-describedby', 'qf-ask-count qf-ask-pii');
  composer.appendChild(backdrop); composer.appendChild(ta);
  ask.appendChild(composer);
  var askRow = el('div', 'ask-meta');
  var piiNote = el('p', 'pii-note', C.ask.pii); piiNote.id = 'qf-ask-pii'; piiNote.hidden = true;
  var counter = el('span', 'counter'); counter.id = 'qf-ask-count';
  askRow.appendChild(piiNote); askRow.appendChild(counter);
  ask.appendChild(askRow);
  var similarBox = el('div', 'similar'); similarBox.hidden = true;
  similarBox.appendChild(el('p', 'nb-kicker', C.ask.similar));
  var similarList = el('ul'); similarBox.appendChild(similarList);
  ask.appendChild(similarBox);
  var topics = el('div', 'topics'); topics.setAttribute('role', 'group'); topics.setAttribute('aria-label', C.ask.topics);
  topics.appendChild(el('span', 'nb-kicker', C.ask.topics));
  var topic = null, chips = {};
  C.ask.topicList.forEach(function (t) {
    var b = el('button', 'chip', t); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      topic = topic === t ? null : t;
      Object.keys(chips).forEach(function (k) { chips[k].setAttribute('aria-pressed', k === topic ? 'true' : 'false'); });
    });
    chips[t] = b; topics.appendChild(b);
  });
  ask.appendChild(topics);
  var actions = el('div', 'ask-actions');
  var sendBtn = el('button', 'send'); sendBtn.type = 'button';
  sendBtn.appendChild(el('span', null, C.ask.send)); sendBtn.appendChild(svg(ICON.plane));
  var cancelBtn = el('button', 'nb-link cancel', C.ask.cancel); cancelBtn.type = 'button';
  actions.appendChild(sendBtn); actions.appendChild(cancelBtn);
  ask.appendChild(actions);
  var confirmBox = el('div', 'confirm'); confirmBox.hidden = true; confirmBox.setAttribute('role', 'alertdialog');
  confirmBox.setAttribute('aria-label', C.ask.discardQ);
  confirmBox.appendChild(el('span', null, C.ask.discardQ));
  var discardBtn = el('button', 'nb-link danger', C.ask.discard); discardBtn.type = 'button';
  var keepBtn = el('button', 'nb-link', C.ask.keep); keepBtn.type = 'button';
  confirmBox.appendChild(discardBtn); confirmBox.appendChild(keepBtn);
  ask.appendChild(confirmBox);
  var askErr = el('p', 'ask-error'); askErr.setAttribute('role', 'alert');
  ask.appendChild(askErr);
  scroll.appendChild(ask);

  /* the writing sits on the ruling, and anything that might identify
     someone is underlined (a nudge, never a block) */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var simTimer = null;
  function drafted() {
    var v = ta.value, spans = D.pii(v), html = '', at = 0;
    spans.forEach(function (sp) { html += esc(v.slice(at, sp.s)) + '<mark>' + esc(v.slice(sp.s, sp.e)) + '</mark>'; at = sp.e; });
    backdrop.innerHTML = html + esc(v.slice(at)) + '\n';
    piiNote.hidden = !spans.length;
    counter.textContent = F(C.ask.counter, { n: v.length, max: MAX });
    counter.classList.toggle('near', v.length > MAX - 30);
    ta.style.height = 'auto';
    ta.style.height = Math.max(4, Math.ceil(ta.scrollHeight / 28)) * 28 + 'px';
    askErr.textContent = '';
    confirmBox.hidden = true;
    clearTimeout(simTimer);
    simTimer = setTimeout(suggest, 220);
  }
  function suggest() {
    var hits = D.similar(ta.value, 3);
    similarList.textContent = '';
    hits.forEach(function (x) {
      var li = el('li'), b = el('button', 'nb-link similar-q'); b.type = 'button';
      b.appendChild(el('span', null, x.q));
      b.addEventListener('click', function () { S.set({ openId: x.id, openHint: null }); });
      b.addEventListener('mouseenter', function () { S.set({ hoveredId: x.id, hoveredPlane: null, hoverSource: 'panel' }); });
      b.addEventListener('mouseleave', function () { if (S.get().hoveredId === x.id) S.set({ hoveredId: null }); });
      li.appendChild(b); similarList.appendChild(li);
    });
    similarBox.hidden = !hits.length;
    S.set({ suggestIds: hits.map(function (x) { return x.id; }) });
  }
  ta.addEventListener('input', drafted);
  cancelBtn.addEventListener('click', function () {
    if (ta.value.trim()) { confirmBox.hidden = false; keepBtn.focus(); } else S.set({ mode: 'browse' });
  });
  keepBtn.addEventListener('click', function () { confirmBox.hidden = true; ta.focus(); });
  discardBtn.addEventListener('click', function () { clearDraft(); S.set({ mode: 'browse' }); });
  function clearDraft() {
    ta.value = ''; topic = null;
    Object.keys(chips).forEach(function (k) { chips[k].setAttribute('aria-pressed', 'false'); });
    drafted(); confirmBox.hidden = true;
  }

  var sending = false, lastSent = null;
  sendBtn.addEventListener('click', send);
  ta.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); send(); } });
  function send() {
    if (sending) return;
    var text = ta.value.trim();
    if (text.length < MIN) { askErr.textContent = C.ask.tooShort; ta.focus(); return; }
    sending = true; sendBtn.disabled = true; sendBtn.firstChild.textContent = C.ask.sending;
    D.submit(text, topic).then(function (item) {
      lastSent = item;
      var rect = page.getBoundingClientRect();
      /* the page lifts out of the panel: hide ours, the sky draws the sheet */
      nb.classList.add('lifting');
      var flying = window.GARDEN && window.GARDEN.launch ? window.GARDEN.launch(item, rect) : Promise.resolve();
      setTimeout(function () {
        clearDraft();
        S.set({ mode: 'sent', suggestIds: [] });
        nb.classList.remove('lifting');
        say(C.sent.live);
      }, reduce ? 0 : 700);
      return flying;
    }).catch(function () {
      askErr.textContent = C.ask.failed;
    }).then(function () {
      sending = false; sendBtn.disabled = false; sendBtn.firstChild.textContent = C.ask.send;
    });
  }

  /* ---------------------------------------------------------------- sent */
  var sent = el('section', 'nb-sent'); sent.hidden = true;
  sent.appendChild(el('p', 'nb-kicker', C.sent.kicker));
  var sentTitle = el('h2', 'nb-title', C.sent.title); sentTitle.tabIndex = -1; sent.appendChild(sentTitle);
  sent.appendChild(el('p', 'nb-note', C.sent.body));
  var sentActions = el('div', 'sent-actions');
  var seeBtn = el('button', 'send'); seeBtn.type = 'button'; seeBtn.appendChild(el('span', null, C.sent.see));
  var againBtn = el('button', 'nb-link'); againBtn.type = 'button'; againBtn.appendChild(svg(ICON.pen)); againBtn.appendChild(el('span', null, C.sent.another));
  var talkBtn = el('button', 'nb-link'); talkBtn.type = 'button'; talkBtn.textContent = C.sent.talk;
  talkBtn.setAttribute('aria-expanded', 'false'); talkBtn.setAttribute('aria-controls', 'qf-contact');
  [seeBtn, againBtn, talkBtn].forEach(function (b) { sentActions.appendChild(b); });
  sent.appendChild(sentActions);
  var contact = el('div', 'contact-card'); contact.id = 'qf-contact'; contact.hidden = true;
  contact.appendChild(el('p', 'nb-kicker', C.contact.title));
  contact.appendChild(el('p', 'lead', C.contact.lead));
  var mail = el('a', null, C.contact.email); mail.href = 'mailto:' + C.contact.email;
  var tel = el('a', null, C.contact.phone); tel.href = 'tel:' + C.contact.phone.replace(/[^\d+]/g, '');
  var line = el('p'); line.appendChild(mail); line.appendChild(document.createTextNode(' · ')); line.appendChild(tel);
  contact.appendChild(line);
  contact.appendChild(el('p', null, C.contact.hours));
  contact.appendChild(el('p', 'urgent', C.contact.urgent));
  sent.appendChild(contact);
  scroll.appendChild(sent);
  seeBtn.addEventListener('click', function () {
    S.set({ mode: 'browse', view: 'waiting', locateId: lastSent ? lastSent.id : null });
  });
  againBtn.addEventListener('click', function () { S.set({ mode: 'ask' }); });
  talkBtn.addEventListener('click', function () {
    contact.hidden = !contact.hidden;
    talkBtn.setAttribute('aria-expanded', contact.hidden ? 'false' : 'true');
  });

  /* ------------------------------------------------------------- counts */
  var shown = {};
  function tick(node, key, to) {
    var from = shown[key] == null ? to : shown[key];
    shown[key] = to;
    if (from === to || reduce) { node.textContent = String(to); return; }
    node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump');
    var t0 = performance.now(), dur = 420;
    (function step(now) {
      var u = Math.min(1, (now - t0) / dur);
      node.textContent = String(Math.round(from + (to - from) * u));
      if (u < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* -------------------------------------------------------------- render */
  var lastData = -1, lastAnsCount = 0;
  function render(st, prev, ch) {
    ch = ch || {};
    var open = st.panelOpen;
    if (!prev || ch.panelOpen) {
      nb.classList.toggle('open', open);
      document.body.classList.toggle('asking', open);
      if (open) nb.removeAttribute('inert'); else nb.setAttribute('inert', '');
    }
    /* data */
    if (lastData !== st.dataVersion) {
      lastData = st.dataVersion;
      if (D.answered().length !== lastAnsCount) { lastAnsCount = D.answered().length; buildAnswered(); }
      buildWaiting();
      var readIds = D.read();
      Object.keys(rowsA).forEach(function (id) { rowsA[id].li.classList.toggle('read', readIds.indexOf(id) >= 0); });
      var ya = D.yoursAnswered();
      badge.hidden = !ya; badge.textContent = F(C.answered.yoursAnswered, { n: ya });
    }
    tick(tabA.n, 'a', D.answered().length);
    tick(tabW.n, 'w', D.waiting().length);
    tick(dockCount, 'd', D.answered().length);

    /* tabs and mode */
    var mode = st.mode, view = st.view;
    tabA.b.setAttribute('aria-selected', mode === 'browse' && view === 'answered' ? 'true' : 'false');
    tabW.b.setAttribute('aria-selected', mode === 'browse' && view === 'waiting' ? 'true' : 'false');
    tabA.b.tabIndex = view === 'answered' ? 0 : -1; tabW.b.tabIndex = view === 'waiting' ? 0 : -1;
    nb.classList.toggle('in-ask', mode !== 'browse');
    askBtn.textContent = mode === 'browse' ? C.tabs.ask : C.tabs.back;
    browse.hidden = mode !== 'browse';
    ask.hidden = mode !== 'ask';
    sent.hidden = mode !== 'sent';
    list.setAttribute('aria-labelledby', view === 'answered' ? tabA.b.id : tabW.b.id);

    if (mode === 'browse' && (!prev || ch.view || ch.query || ch.dataVersion || ch.mode || ch.panelOpen)) {
      var V = view === 'answered' ? C.answered : C.waiting;
      bKick.textContent = V.kicker; bTitle.textContent = V.title;
      bNote.textContent = view === 'waiting' ? C.waiting.note : ''; bNote.hidden = view !== 'waiting';
      if (search.value !== st.query && document.activeElement !== search) search.value = st.query;
      /* which rows show */
      list.textContent = '';
      var res = D.match(view, st.query), ids = res.ids, visible = [];
      if (view === 'answered') {
        orderA.forEach(function (id) {
          var r = rowsA[id], hit = !ids || ids[id];
          if (hit) { list.appendChild(r.li); visible.push(id); }
        });
      } else {
        D.waiting().forEach(function (x) {
          var hit = !ids || ids[x.id];
          if (hit && rowsW[x.id]) { list.appendChild(rowsW[x.id].li); visible.push(x.id); }
        });
      }
      var total = view === 'answered' ? D.answered().length : D.waiting().length;
      searchCount.textContent = st.query ? F(C.answered.count, { n: visible.length, total: total }) : '';
      clearBtn.hidden = !st.query;
      cue.textContent = st.query ? F(C.answered.cueQuery, { n: visible.length }) : V.cue;
      /* empty states */
      empty.textContent = '';
      if (!visible.length) {
        var noQuery = !st.query && view === 'waiting';
        empty.appendChild(el('p', null, noQuery ? C.waiting.empty : C.answered.empty));
        var go = el('button', 'nb-link go'); go.type = 'button';
        go.textContent = noQuery ? C.waiting.emptyAsk : C.answered.askIt;
        go.addEventListener('click', function () {
          if (!noQuery) { ta.value = S.get().query.trim() + ' '; }
          S.set({ mode: 'ask' });
          drafted();
        });
        empty.appendChild(go);
      }
      empty.hidden = !!visible.length;
      var nr = D.inReview();
      reviewLine.hidden = view !== 'waiting' || !nr;
      reviewLine.textContent = F(C.waiting.inReview, { n: nr });
      if (ch.query || ch.view) say(visible.length === 1 ? C.answered.liveOne : visible.length ? F(C.answered.liveMany, { n: visible.length }) : C.answered.liveNone);
      if (view === 'answered' && open && D.yoursAnswered()) setTimeout(function () { D.seeAnswered(); }, 1600);
      S.set({ visibleIds: view === 'answered' ? visible : [] });
    }
    /* the hot row: lifted from the sky or the keyboard */
    Object.keys(rowsA).forEach(function (id) { rowsA[id].li.classList.toggle('hot', st.hoveredId === id); });
    Object.keys(rowsW).forEach(function (id) { rowsW[id].li.classList.toggle('hot', st.hoveredId === id || st.locateId === id); });
    if (ch.hoveredId && st.hoveredId && (st.hoverSource === 'pointer' || st.hoverSource === 'touch') && open && mode === 'browse') {
      var r = rowsA[st.hoveredId] || rowsW[st.hoveredId];
      if (r && r.li.isConnected) r.li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    if (ch.locateId && st.locateId && rowsW[st.locateId] && rowsW[st.locateId].li.isConnected) {
      rowsW[st.locateId].li.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    /* mode changes move focus somewhere sensible */
    if (ch.mode && open) {
      if (mode === 'ask') setTimeout(function () { ta.focus(); }, reduce ? 0 : 60);
      if (mode === 'sent') setTimeout(function () { sentTitle.focus(); }, 60);
      if (mode === 'browse' && prev && prev.mode !== 'browse') setTimeout(function () { (view === 'answered' ? tabA : tabW).b.focus(); }, 30);
      if (mode !== 'ask') S.set({ suggestIds: [] });
      else suggest();
    }
    if (ch.panelOpen) onOpenChange(open, prev);
    if (ch.panelOpen || ch.mode) snapFor(st);
  }

  /* open and close: focus goes in, and back to whatever opened it */
  var opener = null;
  function onOpenChange(open) {
    if (open) {
      opener = document.activeElement;
      setTimeout(function () {
        if (S.get().mode === 'ask') ta.focus();
        else (S.get().view === 'answered' ? tabA : tabW).b.focus();
      }, reduce ? 0 : 120);
    } else {
      S.set({ hoveredId: null, hoveredPlane: null, hoverSource: null, suggestIds: [], locateId: null });
      if (opener && opener.focus && document.contains(opener)) opener.focus();
      opener = null;
    }
    reportRect();
  }
  dockAsk.addEventListener('click', function () { S.set({ panelOpen: true, mode: 'ask' }); });
  dockAll.addEventListener('click', function () { S.set({ panelOpen: true, mode: 'browse', view: 'answered' }); });

  /* ------------------------------------------------------------ keyboard */
  window.addEventListener('keydown', function (e) {
    var st = S.get(), t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (e.key === 'Escape') {
      if (document.body.classList.contains('reading')) return;      // the sheet folds first (garden)
      if (!confirmBox.hidden) { confirmBox.hidden = true; ta.focus(); e.stopPropagation(); return; }
      if (st.panelOpen) { e.stopPropagation(); S.set({ panelOpen: false }); }
      return;
    }
    if (e.key === '/' && !typing) {
      e.preventDefault();
      S.set({ panelOpen: true, mode: 'browse' });
      setTimeout(function () { search.focus(); search.select(); }, reduce ? 0 : 140);
      return;
    }
    if (!st.panelOpen || st.mode !== 'browse') return;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!typing || t === search)) {
      var rows = Array.prototype.slice.call(list.querySelectorAll('.row-main'));
      if (!rows.length) return;
      e.preventDefault();
      var i = rows.indexOf(document.activeElement);
      i = i < 0 ? (e.key === 'ArrowDown' ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      rows[i].focus();
      rows[i].scrollIntoView({ block: 'nearest' });
    }
  }, true);

  /* ------------------------------------------------- the line to the plane
     While a row is hovered (or focused), a thin dotted line runs from it to
     its plane in the sky; if the plane is out of view, to the edge, with an
     arrow. */
  var link = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  link.setAttribute('class', 'qf-link'); link.setAttribute('aria-hidden', 'true');
  link.innerHTML = '<path class="ln" d=""/><circle class="dot" r="5"/><circle class="ring" r="13"/>';
  document.body.appendChild(link);
  var lnPath = link.querySelector('.ln'), lnDot = link.querySelector('.dot'), lnRing = link.querySelector('.ring');
  var dwell = null;
  (function linkLoop() {
    requestAnimationFrame(linkLoop);
    var st = S.get(), id = st.hoveredId, r = id && (rowsA[id] || rowsW[id]);
    var show = st.panelOpen && st.mode === 'browse' && id && (st.hoverSource === 'panel' || st.hoverSource === 'keyboard') &&
      r && r.li.isConnected && window.GARDEN && window.GARDEN.locate && !document.body.classList.contains('reading');
    var at = show ? window.GARDEN.locate(id) : null;
    if (!at) { link.classList.remove('on'); dwell = null; return; }
    /* none of its planes in view: after a short dwell, bring one into view */
    if (!at.on) {
      if (!dwell || dwell.id !== id) dwell = { id: id, t: performance.now() };
      else if (!dwell.done && performance.now() - dwell.t > 450) { dwell.done = true; S.set({ locateId: id }); }
    } else if (!dwell || dwell.id !== id) dwell = { id: id, t: performance.now(), done: true };
    var rr = r.main.getBoundingClientRect();
    if (rr.bottom < 0 || rr.top > window.innerHeight) { link.classList.remove('on'); return; }
    var side = phone.matches;
    var x0 = side ? rr.left + 30 : rr.left - 6, y0 = side ? rr.top - 4 : rr.top + rr.height / 2;
    var pr = nb.getBoundingClientRect(), m = 24;
    var x1 = Math.max(m, Math.min((side ? window.innerWidth : pr.left) - m, at.x));
    var y1 = Math.max(m, Math.min((side ? pr.top : window.innerHeight) - m, at.y));
    var mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 30;
    lnPath.setAttribute('d', 'M' + x0 + ' ' + y0 + ' Q' + mx + ' ' + my + ' ' + x1 + ' ' + y1);
    lnDot.setAttribute('cx', x1); lnDot.setAttribute('cy', y1);
    lnRing.setAttribute('cx', x1); lnRing.setAttribute('cy', y1);
    link.classList.toggle('off-screen', !at.on);
    link.classList.add('on');
  })();

  /* ----------------------------------------- where the panel sits (for the
     reading sheet), and on phones, a bottom sheet with three heights */
  var snap = 'half';
  function snapHeights() {
    var H = window.innerHeight;
    return { peek: head.offsetHeight + grip.offsetHeight + 70, half: Math.round(H * 0.52), full: Math.round(H * 0.92) };
  }
  function applySnap(name, instant) {
    snap = name;
    if (!phone.matches) { nb.style.height = ''; return; }
    if (instant) nb.classList.add('no-anim');
    nb.style.height = snapHeights()[name] + 'px';
    nb.dataset.snap = name;
    if (instant) { void nb.offsetWidth; nb.classList.remove('no-anim'); }
    setTimeout(reportRect, reduce ? 0 : 320);
  }
  function snapFor(st) {
    if (!phone.matches) return;
    if (!st.panelOpen) return;
    if (st.mode !== 'browse') applySnap('full');
    else if (snap === 'peek' || snap === 'full') applySnap(snap);
    else applySnap('half');
  }
  /* while a sheet is open to read, the panel steps down out of its way */
  new MutationObserver(function () {
    if (phone.matches && S.get().panelOpen && document.body.classList.contains('reading') && snap !== 'peek') applySnap('peek');
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  function reportRect() {
    if (!S.get().panelOpen) { S.set({ panelRect: null }); return; }
    var r = nb.getBoundingClientRect();
    S.set({ panelRect: { left: r.left, top: r.top, width: r.width, height: r.height, side: phone.matches ? 'bottom' : 'right' } });
  }
  window.addEventListener('resize', function () { applySnap(snap, true); reportRect(); });
  if (phone.addEventListener) phone.addEventListener('change', function () { applySnap(snap, true); reportRect(); });
  nb.addEventListener('transitionend', reportRect);
  nb.addEventListener('animationend', reportRect);
  /* dragging the grip (or the tab row) between peek, half and full */
  (function drag() {
    var start = null;
    function down(e) {
      if (!phone.matches || e.target.closest('button')) return;
      start = { y: e.clientY, h: nb.getBoundingClientRect().height, t: performance.now() };
      nb.classList.add('dragging');
      grip.setPointerCapture && grip.setPointerCapture(e.pointerId);
    }
    function move(e) {
      if (!start) return;
      var H = window.innerHeight, h = Math.max(snapHeights().peek - 20, Math.min(H * 0.95, start.h - (e.clientY - start.y)));
      nb.style.height = h + 'px';
    }
    function up(e) {
      if (!start) return;
      var hs = snapHeights(), h = nb.getBoundingClientRect().height;
      var v = (start.y - e.clientY) / Math.max(1, performance.now() - start.t);     // px per ms, up is +
      var target = h + v * 180, best = 'half', bd = Infinity;
      ['peek', 'half', 'full'].forEach(function (k) { var d = Math.abs(hs[k] - target); if (d < bd) { bd = d; best = k; } });
      if (Math.abs(e.clientY - start.y) < 4) best = snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek';   // a tap steps up
      start = null; nb.classList.remove('dragging');
      applySnap(best);
    }
    [grip, head].forEach(function (n) { n.addEventListener('pointerdown', down); });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  })();

  /* ------------------------------------------------------------- wire up */
  S.subscribe(render);
  D.onChange(function () { /* garden bumps dataVersion; nothing else to do here */ });
  buildAnswered(); lastAnsCount = D.answered().length;
  drafted();
  render(S.get(), null, {});
  applySnap('half', true);
})();
