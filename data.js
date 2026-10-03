/* ============================================================================
   The questions: answered ones (from questions.js), waiting ones (mock for
   now), the visitor's own (kept on this device), and the helpers the panel
   and the sky share — search, "similar" matching, and the gentle check for
   details that might identify someone.

   Submissions are MOCK by default (SUBMIT_MODE). Switch to 'remote' to post
   to /api/questions (api/questions.js). That endpoint publishes at once; the
   panel's copy promises review first, so add a review step there before
   switching.

   Ids are stable: answered questions are a01…a50 (their place in
   questions.js), waiting ones w-…, the visitor's own m-….
   ========================================================================== */
(function () {
  'use strict';
  var SUBMIT_MODE = 'mock';                 // 'mock' | 'remote'
  var API = '/api/questions';
  var QS = window.GARDEN_QUESTIONS || [];
  var C = window.QF_COPY;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function store(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  /* ---------------------------------------------------------------- topics
     Rough routing tags for answered questions, so search can find "privacy"
     or "anonymous" even when those exact words aren't in the text. */
  var TOPICS = {
    Reporting: ['report', 'complaint', 'investigation', 'formal', 'file', 'police', 'accused', 'retaliat', 'resolution'],
    Privacy: ['name', 'anonym', 'confidential', 'private', 'privacy', 'who will know', 'told', 'family', 'identify'],
    Support: ['support', 'help', 'friend', 'class', 'measure', 'no-contact', 'safety', 'danger', 'housing', 'live', 'work'],
    Process: ['process', 'how long', 'deadline', 'step', 'meet', 'happens', 'title ix', 'cover', 'what is', 'harassment', 'stalking']
  };
  var TOPIC_WORDS = {
    Reporting: 'reporting report complaint',
    Privacy: 'privacy anonymous anonymously confidential private',
    Support: 'support help',
    Process: 'process steps'
  };
  function tagsFor(text) {
    var t = text.toLowerCase(), out = [];
    Object.keys(TOPICS).forEach(function (k) {
      if (TOPICS[k].some(function (w) { return t.indexOf(w) >= 0; })) out.push(k);
    });
    return out;
  }

  /* ------------------------------------------------------------------ data */
  var answered = QS.map(function (x, i) {
    return { id: 'a' + pad(i + 1), n: i + 1, q: x.q, a: x.a, tags: tagsFor(x.q + ' ' + x.a), kind: 'answered' };
  });
  var baseCount = answered.length;

  /* mock waiting questions. ?demo shows a populated Waiting tab (and one gets
     answered after a while); without it, Waiting starts empty. */
  var demo = /[?&]demo\b/.test(location.search);
  var now = Date.now(), DAY = 864e5;
  var waiting = demo ? [
    { id: 'w-1', q: 'Can I ask IEX something on behalf of a group, like a student org?', topic: 'Process', at: now - 2 * DAY, status: 'public' },
    { id: 'w-2', q: 'If I talk to IEX, does my RA or advisor find out?', topic: 'Privacy', at: now - 4 * DAY, status: 'public' },
    { id: 'w-3', q: 'What if the thing that happened was online, in a group chat?', topic: 'Support', at: now - 6 * 3600e3, status: 'public',
      answerLater: 'Yes, you can reach out about things that happen online, including in group chats. Save what you can, and IEX can talk through your options.' },
    { id: 'w-4', q: 'Is there a way to just get advice without anything happening after?', topic: 'Reporting', at: now - 9 * DAY, status: 'public' },
    { id: 'w-r1', q: '(in review)', topic: 'Support', at: now - DAY, status: 'review' },
    { id: 'w-r2', q: '(in review)', topic: 'Privacy', at: now - 2 * DAY, status: 'review' },
    { id: 'w-r3', q: '(in review)', topic: 'Process', at: now - 3 * DAY, status: 'review' }
  ] : [];

  /* the visitor's own questions, on this device only */
  var mine = store('qf-mine', []);
  mine.forEach(function (m) { if (m.status === 'answered') promote(m, m.a, true); });
  var read = store('qf-read', []);
  var seenAnswered = store('qf-seen-answered', []);

  function promote(item, text, quiet) {
    if (answered.some(function (x) { return x.id === item.id; })) return;
    answered.push({ id: item.id, n: answered.length + 1, q: item.q, a: text, tags: item.topic ? [item.topic] : tagsFor(item.q + ' ' + text),
      kind: 'answered', mine: !!item.mine || item.id.indexOf('m-') === 0, fromWaiting: true });
    if (!quiet) emit({ answered: item.id });
  }

  var listeners = [];
  function emit(ev) { listeners.forEach(function (fn) { fn(ev || {}); }); }

  /* ---------------------------------------------------------------- search */
  function norm(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' '); }
  function hay(item) {
    if (!item._hay) item._hay = norm(item.q + ' ' + (item.a || '') + ' ' + (item.tags || []).join(' ') + ' ' +
      (item.tags || []).map(function (t) { return TOPIC_WORDS[t] || ''; }).join(' ') + ' ' + (item.topic || ''));
    return item._hay;
  }
  function matches(item, query) {
    var toks = norm(query).split(/\s+/).filter(Boolean);
    if (!toks.length) return true;
    var h = hay(item);
    return toks.every(function (t) { return h.indexOf(t) >= 0; });
  }

  /* ----------------------------------------------------------- similarity */
  var STOP = ('a an the and or but if of to in on at for with about from by as is are was were be been being do does did ' +
    'i im me my you your we our it its this that these those what when where who how why can could should would will ' +
    'just so not no yes have has had there their they them he she his her any some more very really get got').split(' ');
  function stem(w) { return w.replace(/(ing|ed|ly|es|s)$/, ''); }
  function tokens(s) {
    return norm(s).split(/\s+/).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; }).map(stem);
  }
  function similar(text, limit) {
    var words = norm(text).split(/\s+/).filter(Boolean);
    if (words.length < 3) return [];
    var t = tokens(text);
    if (!t.length) return [];
    return answered.map(function (x) {
      if (!x._tq) { x._tq = tokens(x.q); x._ta = tokens(x.a); }
      var s = 0;
      t.forEach(function (w) {
        if (x._tq.indexOf(w) >= 0) s += 2;
        else if (x._ta.indexOf(w) >= 0) s += 0.6;
      });
      return { item: x, score: s / Math.sqrt(t.length + 1) };
    }).filter(function (r) { return r.score >= 1.1; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, limit || 3).map(function (r) { return r.item; });
  }

  /* ------------------------------------------------- identifying details
     A gentle nudge, never a block: spans of text that might identify
     someone — likely names, emails, phone numbers, rooms and buildings,
     dates. */
  var KEEP = ('I Im Ive Id Ill IEX CMU Carnegie Mellon Title IX RA TA PhD OK Pittsburgh English Google Instagram Snapchat ' +
    'Discord TikTok Twitter Facebook Canvas Zoom').split(' ');
  var MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  var RULES = [
    ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
    ['handle', /(^|[\s(])@[A-Za-z0-9_.]{2,}/g],
    ['phone', /[+(]?(?:\d[\s().-]*){7,}\d/g],
    ['date', new RegExp('\\b' + MONTH + '\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b', 'g')],
    ['date', /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g],
    ['date', /\b(?:on|last|this|next)\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/gi],
    ['place', /\b(?:room|rm|apt|apartment|floor|suite|dorm|unit|bldg|building)\.?\s*#?\s*[A-Z]?\d{1,4}[A-Z]?\b/gi],
    ['place', /\b[A-Z][a-z]+\s+(?:Hall|House|Apartments?|Building|Center|Tower|Commons)\b/g],
    ['place', /\b[A-Z][a-z]+\s+\d{3,4}[A-Z]?\b/g],
    ['place', /#\d{2,4}\b/g]
  ];
  function pii(text) {
    var spans = [];
    function add(s, e, kind) {
      for (var i = 0; i < spans.length; i++) if (s < spans[i].e && e > spans[i].s) return;
      spans.push({ s: s, e: e, kind: kind });
    }
    RULES.forEach(function (r) {
      var re = new RegExp(r[1].source, r[1].flags), m;
      while ((m = re.exec(text))) {
        var lead = r[0] === 'handle' && m[1] ? m[1].length : 0;
        add(m.index + lead, m.index + m[0].length, r[0]);
        if (!m[0].length) re.lastIndex++;
      }
    });
    /* likely names: a capitalised word that isn't starting a sentence */
    var re = /\b[A-Z][a-z]+(?:[-'][A-Z]?[a-z]+)?\b/g, m;
    while ((m = re.exec(text))) {
      var before = text.slice(0, m.index).replace(/\s+$/, '');
      var startsSentence = !before || /[.!?:;"“(]$/.test(before);
      if (startsSentence) continue;
      if (KEEP.indexOf(m[0]) >= 0 || KEEP.indexOf(m[0].replace(/'/g, '')) >= 0) continue;
      if (new RegExp('^' + MONTH + '$').test(m[0])) continue;
      add(m.index, m.index + m[0].length, 'name');
    }
    return spans.sort(function (a, b) { return a.s - b.s; });
  }

  /* --------------------------------------------------------------- submit */
  function submit(q, topic) {
    var text = String(q || '').replace(/\s+/g, ' ').trim();
    if (SUBMIT_MODE === 'remote') {
      return fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, topic: topic || null, website: '', t: 5000 })
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j.item; }); })
        .then(function (item) { return keepMine({ id: 'm-' + item.id, q: item.q, topic: topic, at: item.at, status: 'review' }); });
    }
    /* mock: as if sent and waiting for review */
    return new Promise(function (res) {
      setTimeout(function () {
        res(keepMine({ id: 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), q: text,
          topic: topic || null, at: Date.now(), status: 'review' }));
      }, 380);
    });
  }
  function keepMine(item) {
    item.mine = true;
    mine.unshift(item);
    save('qf-mine', mine);
    emit({ sent: item.id });
    if (demo) setTimeout(function () {
      answer(item.id, 'Thanks for asking. (This is a demo answer, to show what happens when IEX replies: the plane takes its colour and moves to Answered.)');
    }, 20000);
    return item;
  }

  /* an answer arrives (simulated): the question moves to Answered */
  function answer(id, text) {
    var w = waiting.filter(function (x) { return x.id === id; })[0];
    var m = mine.filter(function (x) { return x.id === id; })[0];
    var item = w || m;
    if (!item) return;
    if (w) waiting.splice(waiting.indexOf(w), 1);
    if (m) { m.status = 'answered'; m.a = text; save('qf-mine', mine); }
    promote(item, text);
  }
  if (demo) setTimeout(function () {
    var w = waiting.filter(function (x) { return x.answerLater; })[0];
    if (w) answer(w.id, w.answerLater);
  }, 35000);

  /* --------------------------------------------------------------- exports */
  function isAnswered(id) { return answered.some(function (x) { return x.id === id; }); }
  function waitingRows() {
    var mineRows = mine.filter(function (m) { return m.status !== 'answered'; })
      .map(function (m) { return Object.assign({ kind: 'waiting', mine: true }, m); });
    var pub = waiting.filter(function (w) { return w.status === 'public'; })
      .map(function (w) { return Object.assign({ kind: 'waiting' }, w); });
    return mineRows.concat(pub).sort(function (a, b) { return b.at - a.at; });
  }

  window.QF_DATA = {
    mode: SUBMIT_MODE,
    baseCount: baseCount,
    answered: function () { return answered; },
    waiting: waitingRows,
    inReview: function () { return waiting.filter(function (w) { return w.status === 'review'; }).length; },
    get: function (id) {
      return answered.filter(function (x) { return x.id === id; })[0] ||
        waitingRows().filter(function (x) { return x.id === id; })[0] || null;
    },
    isAnswered: isAnswered,
    isMine: function (id) { return mine.some(function (m) { return m.id === id; }); },
    /* which ids the sky should show for a view and a query (null = every one) */
    match: function (view, query) {
      if (view === 'all' && !query) return { ids: null, count: answered.length, total: answered.length };
      var pool = view === 'waiting' ? waitingRows() : view === 'answered' ? answered : answered.concat(waitingRows());
      var hit = pool.filter(function (x) { return matches(x, query); });
      var ids = {};
      hit.forEach(function (x) { ids[x.id] = true; });
      return { ids: ids, list: hit, count: hit.length, total: pool.length };
    },
    similar: similar,
    pii: pii,
    submit: submit,
    answer: answer,
    read: function () { return read; },
    markRead: function (id) { if (read.indexOf(id) < 0) { read.push(id); save('qf-read', read); emit({ read: id }); } },
    yoursAnswered: function () {
      return answered.filter(function (x) { return x.mine && seenAnswered.indexOf(x.id) < 0; }).length;
    },
    seeAnswered: function () {
      answered.forEach(function (x) { if (x.mine && seenAnswered.indexOf(x.id) < 0) seenAnswered.push(x.id); });
      save('qf-seen-answered', seenAnswered);
      emit({ seen: true });
    },
    onChange: function (fn) { listeners.push(fn); },
    format: function (s, vars) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; }); },
    ago: function (t) {
      var A = C.ago, s = Math.max(1, Math.round((Date.now() - t) / 1000));
      if (s < 60) return A.now;
      var m = Math.round(s / 60); if (m < 60) return A.min.replace('{n}', m);
      var h = Math.round(m / 60); if (h < 24) return h === 1 ? A.hour : A.hours.replace('{n}', h);
      var d = Math.round(h / 24); if (d < 30) return d === 1 ? A.day : A.days.replace('{n}', d);
      return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };
})();
