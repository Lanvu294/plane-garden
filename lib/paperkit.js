/* ============================================================================
   common.js — shared kit for the paper-motion reference tools
   Requires (as classic scripts, in this order):
     three.min.js, OrbitControls.js, jszip.min.js (optional), common.js
   Exposes: window.PaperKit
   ========================================================================== */
(function (global) {
  'use strict';

  var THREE = global.THREE;
  if (!THREE) { console.error('[PaperKit] Three.js must be loaded before common.js'); return; }

  /* ---------------------------------------------------------------- palette */
  var COLORS = {
    paper:  0xEDE9E3,
    ink:    0x1F2328,
    bg:     0xF4F2EE,
    ghost:  0x8A9199,
    guide:  0x7E8890,
    accent: 0xC4472E
  };
  var CSS_INK = '#1F2328', CSS_PAPER = '#EDE9E3', CSS_BG = '#F4F2EE';
  var PK_normHex = null;             // set where the colour control is defined

  /* ----------------------------------------------------------------- easing */
  var EASING = {
    linear: function (t) { return t; },
    easeInOut: function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    easeOut: function (t) { return 1 - Math.pow(1 - t, 3); },
    overshoot: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
  };

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function deg(r) { return r * 180 / Math.PI; }
  function rad(d) { return d * Math.PI / 180; }

  /* -------------------------------------------------------------- stylesheet */
  var STYLE = [
    '*{box-sizing:border-box}',
    'html,body{height:100%}',
    'body{margin:0;display:flex;font:11.5px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
      'color:' + CSS_INK + ';background:' + CSS_BG + ';overflow:hidden;-webkit-font-smoothing:antialiased}',
    '.pk-main{flex:1 1 auto;display:flex;flex-direction:column;min-width:0}',
    '.pk-stage{flex:1 1 auto;position:relative;min-height:0}',
    '.pk-stage canvas{display:block;width:100%;height:100%}',
    '.pk-title{position:absolute;left:14px;top:12px;letter-spacing:.14em;text-transform:uppercase;',
      'font-size:10px;opacity:.55;pointer-events:none}',
    '.pk-hud{position:absolute;right:14px;top:12px;text-align:right;font-size:10px;opacity:.6;',
      'pointer-events:none;white-space:pre;line-height:1.6}',
    '.pk-warn{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:none;',
      'align-items:center;gap:10px;background:' + CSS_PAPER + ';border:1px solid ' + CSS_INK + ';',
      'padding:7px 10px;font-size:10.5px;max-width:80%}',
    '.pk-warn.pk-on{display:flex}',
    '.pk-panel{width:300px;flex:0 0 300px;border-left:1px solid ' + CSS_INK + ';background:' + CSS_PAPER + ';',
      'overflow-y:auto;overflow-x:hidden;padding:0 0 28px}',
    '.pk-nav{display:flex;flex-wrap:wrap;border-bottom:1px solid rgba(31,35,40,.18)}',
    '.pk-nav a{flex:1 1 33%;text-align:center;padding:7px 2px;font-size:9px;letter-spacing:.1em;',
      'text-transform:uppercase;text-decoration:none;color:' + CSS_INK + ';opacity:.42;',
      'border-right:1px solid rgba(31,35,40,.12);border-bottom:1px solid rgba(31,35,40,.12)}',
    '.pk-nav a:hover{opacity:.85;background:rgba(31,35,40,.06)}',
    '.pk-nav a.pk-on{opacity:1;font-weight:600;background:rgba(31,35,40,.09)}',
    '.pk-tabs{display:flex;position:sticky;top:0;z-index:5;background:' + CSS_PAPER + ';',
      'border-bottom:1px solid ' + CSS_INK + '}',
    '.pk-tabs button{flex:1 1 0;min-width:0;border:0;border-right:1px solid rgba(31,35,40,.18);',
      'padding:8px 2px;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.45}',
    '.pk-tabs button:last-child{border-right:0}',
    '.pk-tabs button:hover{background:rgba(31,35,40,.07);color:' + CSS_INK + ';opacity:.8}',
    '.pk-tabs button.pk-on,.pk-tabs button.pk-on:hover{background:' + CSS_INK + ';color:' + CSS_PAPER + ';opacity:1}',
    '.pk-page{display:none}', '.pk-page.pk-on{display:block}',
    '.pk-group{border-bottom:1px solid rgba(31,35,40,.18);padding:10px 12px 12px}',
    '.pk-group h3{margin:0 0 9px;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.5;font-weight:600}',
    '.pk-group.pk-fold h3{cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin:0}',
    '.pk-group.pk-fold h3:hover{opacity:.85}',
    '.pk-group.pk-fold h3:after{content:"\\2212";font-size:12px;opacity:.95}',
    '.pk-group.pk-fold.pk-shut h3:after{content:"+"}',
    '.pk-group.pk-fold .pk-body{margin-top:9px}',
    '.pk-group.pk-shut .pk-body{display:none}',
    '.pk-lead{padding:9px 12px;opacity:.55;font-size:10px;line-height:1.5;border-bottom:1px solid rgba(31,35,40,.18)}',
    '.pk-row{display:flex;align-items:center;gap:8px;margin:0 0 7px}',
    '.pk-row>label{flex:0 0 76px;opacity:.72;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.pk-row .pk-val{flex:0 0 52px;text-align:right;font-variant-numeric:tabular-nums;opacity:.9}',
    '.pk-row input[type=range]{flex:1 1 auto;min-width:0}',
    '.pk-btns{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 7px}',
    'button{font:inherit;color:' + CSS_INK + ';background:transparent;border:1px solid ' + CSS_INK + ';',
      'padding:3px 8px;cursor:pointer;border-radius:0;transition:background .12s,color .12s}',
    'button:hover{background:' + CSS_INK + ';color:' + CSS_PAPER + '}',
    'button[disabled]{opacity:.35;cursor:default}',
    'button[disabled]:hover{background:transparent;color:' + CSS_INK + '}',
    'button.pk-on{background:' + CSS_INK + ';color:' + CSS_PAPER + '}',
    'select,input[type=number],input[type=text]{font:inherit;color:' + CSS_INK + ';background:transparent;',
      'border:1px solid rgba(31,35,40,.45);padding:2px 4px;border-radius:0;min-width:0}',
    'input[type=number]{width:58px;font-variant-numeric:tabular-nums}',
    'input[type=range]{-webkit-appearance:none;appearance:none;height:16px;background:transparent}',
    'input[type=range]::-webkit-slider-runnable-track{height:1px;background:' + CSS_INK + ';opacity:.45}',
    'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:9px;height:9px;margin-top:-4px;',
      'background:' + CSS_INK + ';border-radius:50%}',
    'input[type=range]::-moz-range-track{height:1px;background:' + CSS_INK + ';opacity:.45}',
    'input[type=range]::-moz-range-thumb{width:9px;height:9px;border:0;background:' + CSS_INK + ';border-radius:50%}',
    '.pk-note{opacity:.5;font-size:10px;margin:2px 0 6px;line-height:1.5}',
    '.pk-transport{flex:0 0 auto;border-top:1px solid ' + CSS_INK + ';background:' + CSS_PAPER + ';',
      'padding:7px 12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}',
    '.pk-transport input[type=range]{flex:1 1 200px;min-width:120px}',
    '.pk-frame{font-variant-numeric:tabular-nums;letter-spacing:.06em;white-space:nowrap}',
    '.pk-sep{width:1px;height:16px;background:rgba(31,35,40,.25)}',
    '.pk-ticks{position:relative;height:0}',
    '.pk-tag{display:inline-block;padding:1px 5px;border:1px solid ' + CSS_INK + ';font-size:9.5px;letter-spacing:.08em}',
    '.pk-tag.pk-hot{background:' + CSS_INK + ';color:' + CSS_PAPER + '}'
  ].join('');

  function injectStyle() {
    var s = document.createElement('style');
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------ dom helpers */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function Controls(host, root) { this.el = host; this.root = root || host; }
  Controls.prototype.row = function (labelText, hint) {
    var r = el('div', 'pk-row');
    if (labelText != null) r.appendChild(el('label', null, labelText));
    if (hint) r.title = hint;
    this.el.appendChild(r);
    return r;
  };
  Controls.prototype.slider = function (o) {
    var r = this.row(o.label, o.hint);
    var input = el('input'); input.type = 'range';
    input.min = o.min; input.max = o.max; input.step = o.step != null ? o.step : 1;
    input.value = o.value;
    var val = el('span', 'pk-val');
    r.appendChild(input); r.appendChild(val);
    var fmt = o.format || function (v) { return (o.decimals != null ? v.toFixed(o.decimals) : v) + (o.unit || ''); };
    var api = {
      input: input,
      get: function () { return parseFloat(input.value); },
      set: function (v, silent) { input.value = v; val.textContent = fmt(parseFloat(input.value)); if (!silent && o.onChange) o.onChange(parseFloat(input.value)); },
      refresh: function () { val.textContent = fmt(parseFloat(input.value)); }
    };
    input.addEventListener('input', function () {
      api.refresh();
      if (o.onChange) o.onChange(parseFloat(input.value));
    });
    api.refresh();
    return api;
  };
  Controls.prototype.select = function (o) {
    var r = this.row(o.label, o.hint);
    var sel = el('select');
    o.options.forEach(function (opt) {
      var v = typeof opt === 'string' ? opt : opt.value;
      var t = typeof opt === 'string' ? opt : opt.label;
      var n = el('option', null, t); n.value = v; sel.appendChild(n);
    });
    sel.value = o.value;
    sel.style.flex = '1 1 auto';
    r.appendChild(sel);
    sel.addEventListener('change', function () { if (o.onChange) o.onChange(sel.value); });
    function fill(list) {
      sel.innerHTML = '';
      list.forEach(function (opt) {
        var v = typeof opt === 'string' ? opt : opt.value;
        var t = typeof opt === 'string' ? opt : opt.label;
        var n = el('option', null, t); n.value = v; sel.appendChild(n);
      });
    }
    return { input: sel, get: function () { return sel.value; },
      set: function (v, silent) { sel.value = v; if (!silent && o.onChange) o.onChange(v); },
      setOptions: function (list, value) { fill(list); if (value != null) sel.value = value; } };
  };
  Controls.prototype.number = function (o) {
    var r = this.row(o.label, o.hint);
    var input = el('input'); input.type = 'number';
    if (o.min != null) input.min = o.min;
    if (o.max != null) input.max = o.max;
    input.step = o.step != null ? o.step : 1;
    input.value = o.value;
    r.appendChild(input);
    input.addEventListener('change', function () { if (o.onChange) o.onChange(parseFloat(input.value)); });
    return { input: input, get: function () { return parseFloat(input.value); },
      set: function (v, silent) { input.value = v; if (!silent && o.onChange) o.onChange(v); } };
  };
  /* A colour is entered as a hex code: the swatch is there to look at and to
     pick from, but the number is what you type, with or without the #, three
     or six digits. A half-typed code leaves the colour alone and turns the
     field red until it reads as a colour again. */
  function normHex(v) {
    v = String(v || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.split('').map(function (ch) { return ch + ch; }).join('');
    return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : null;
  }
  PK_normHex = normHex;
  Controls.prototype.colour = function (o) {
    var r = this.row(o.label, o.hint);
    var input = el('input'); input.type = 'color'; input.value = (normHex(o.value) || '#000000').toLowerCase();
    input.style.cssText = 'width:34px;height:20px;padding:0;border:1px solid rgba(31,35,40,.45);background:none;flex:0 0 34px';
    var hex = el('input'); hex.type = 'text';
    hex.value = normHex(o.value) || o.value; hex.spellcheck = false; hex.maxLength = 7;
    hex.title = 'hex code — type it, with or without the #';
    hex.style.cssText = 'flex:1 1 auto;min-width:0;width:80px;text-transform:uppercase;letter-spacing:.04em';
    r.appendChild(input); r.appendChild(hex);
    input.addEventListener('input', function () {
      hex.value = input.value.toUpperCase(); hex.style.borderColor = '';
      if (o.onChange) o.onChange(hex.value);
    });
    hex.addEventListener('input', function () {
      var v = normHex(hex.value);
      hex.style.borderColor = v || !hex.value ? '' : '#C4472E';
      if (v) { input.value = v.toLowerCase(); if (o.onChange) o.onChange(v); }
    });
    hex.addEventListener('blur', function () {
      hex.value = normHex(hex.value) || input.value.toUpperCase();
      hex.style.borderColor = '';
    });
    hex.addEventListener('keydown', function (e) {
      e.stopPropagation();                   // typing is not a shortcut
      if (e.key === 'Enter') hex.blur();
    });
    return { input: input, hex: hex, get: function () { return hex.value; },
      set: function (v, silent) {
        var h = normHex(v) || v;
        input.value = String(h).toLowerCase(); hex.value = h;
        if (!silent && o.onChange) o.onChange(h);
      } };
  };

  Controls.prototype.toggle = function (o) {
    var b = el('button', null, o.label);
    if (o.hint) b.title = o.hint;
    var state = !!o.value;
    function paint() { b.classList.toggle('pk-on', state); }
    b.addEventListener('click', function () { state = !state; paint(); if (o.onChange) o.onChange(state); });
    paint();
    var wrap = el('div', 'pk-btns'); wrap.appendChild(b); this.el.appendChild(wrap);
    return { el: b, get: function () { return state; },
      set: function (v, silent) { state = !!v; paint(); if (!silent && o.onChange) o.onChange(state); } };
  };
  Controls.prototype.buttons = function (list) {
    var wrap = el('div', 'pk-btns');
    var out = [];
    list.forEach(function (b) {
      var n = el('button', null, b.label);
      if (b.hint) n.title = b.hint;
      n.addEventListener('click', b.onClick);
      wrap.appendChild(n);
      out.push(n);
    });
    this.el.appendChild(wrap);
    return out;
  };
  Controls.prototype.readout = function (label, hint) {
    var r = this.row(label, hint);
    var v = el('span', null, '—');
    v.style.flex = '1 1 auto'; v.style.textAlign = 'right';
    v.style.fontVariantNumeric = 'tabular-nums';
    r.appendChild(v);
    return { set: function (t) { v.textContent = t; }, el: v };
  };
  Controls.prototype.note = function (text) {
    this.el.appendChild(el('div', 'pk-note', text));
  };

  /* ===================================================================== app */
  function createApp(opts) {
    opts = opts || {};
    injectStyle();
    document.title = opts.title || 'paper reference';

    var app = {};
    app.totalFrames = opts.totalFrames || 24;
    app.frame = 0;
    app.fps = opts.fps || 12;
    app.name = opts.name || 'frame';

    /* ---- layout ---- */
    var main = el('div', 'pk-main');
    var stage = el('div', 'pk-stage');
    var transport = el('div', 'pk-transport');
    var panel = el('aside', 'pk-panel');
    main.appendChild(stage); main.appendChild(transport);
    document.body.appendChild(main); document.body.appendChild(panel);

    stage.appendChild(el('div', 'pk-title', opts.title || ''));
    var hud = el('div', 'pk-hud'); stage.appendChild(hud);
    app.hud = function (t) { hud.textContent = t; };

    /* The paper is deliberately within a few percent of the background, so
       anything that hides the lines hides the model with it. Rather than let
       that read as a broken viewport, say so and offer the way back. */
    var warn = el('div', 'pk-warn');
    var warnText = el('span');
    var warnBtn = el('button', null, 'show everything');
    warn.appendChild(warnText); warn.appendChild(warnBtn);
    stage.appendChild(warn);
    app.checkVisibility = function () {
      var msg = '';
      if (edgesOnly && curEdgeMode === 'none') {
        msg = 'Nothing is being drawn: “edges only” is on and crease lines are off.';
      } else if (curEdgeMode === 'none') {
        msg = 'Crease lines are off, so only the paper is drawn — and it is nearly the background colour.';
      } else if (edgesOnly && curEdgeMode === 'outline') {
        msg = 'Only the sheet outline is drawn: “edges only” is on and crease lines are set to outline.';
      }
      warnText.textContent = msg;
      warn.classList.toggle('pk-on', !!msg);
    };
    var curEdgeMode = 'auto';

    /* ---- renderer ---- */
    var renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setClearColor(COLORS.bg, 1);
    renderer.autoClear = false;
    stage.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var world = new THREE.Group();      // ghosted content
    var helpers = new THREE.Group();    // never ghosted
    scene.add(world); scene.add(helpers);

    /* ---- background ---------------------------------------------------------
       A colour you choose, optionally ruled like notebook paper. It is drawn as
       a full-screen quad inside the render pass rather than as CSS behind the
       canvas, so what you see is also what a PNG or a frame sequence contains.
       The rules are measured in screen pixels and stay put while you orbit —
       they are the paper you are drawing on, not part of the scene. */
    var bgScene = new THREE.Scene(), bgCam = new THREE.Camera();
    var bgU = {
      uBg:      { value: new THREE.Color(COLORS.bg) },
      uLine:    { value: new THREE.Color(0x9BB4C8) },
      uSpacing: { value: 26 },
      uWeight:  { value: 1 },
      uOn:      { value: 0 },
      uAngle:   { value: 0 },
      uPR:      { value: 1 }
    };
    var bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: bgU, depthTest: false, depthWrite: false,
      vertexShader: 'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: [
        'uniform vec3 uBg;uniform vec3 uLine;',
        'uniform float uSpacing;uniform float uWeight;uniform float uOn;',
        'uniform float uAngle;uniform float uPR;',
        'void main(){',
        '  vec3 c = uBg;',
        '  if (uOn > 0.5) {',
        '    float a = radians(uAngle);',
        '    float d = gl_FragCoord.x * sin(a) + gl_FragCoord.y * cos(a);',
        '    float sp = max(uSpacing * uPR, 2.0);',
        '    float m = mod(d, sp);',
        '    float e = min(m, sp - m);',
        '    float w = max(uWeight * uPR, 0.75) * 0.5;',
        '    c = mix(uBg, uLine, 1.0 - smoothstep(w - 0.5, w + 0.5, e));',
        '  }',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'
      ].join('\n')
    }));
    bgQuad.frustumCulled = false;
    bgScene.add(bgQuad);
    function drawBackground() {
      bgU.uPR.value = renderer.getPixelRatio();
      renderer.render(bgScene, bgCam);
      renderer.clearDepth();
    }

    var bgState = {
      color: opts.bgColor || CSS_BG, line: opts.bgLine || '#9BB4C8',
      pattern: !!opts.bgPattern, spacing: opts.bgSpacing || 26,
      weight: opts.bgWeight || 1, angle: opts.bgAngle || 0
    };
    app.background = bgState;
    app.setBackground = function (o) {
      if (o) for (var k in o) if (o[k] != null) bgState[k] = o[k];
      bgU.uBg.value.set(bgState.color);
      bgU.uLine.value.set(bgState.line);
      bgU.uSpacing.value = bgState.spacing;
      bgU.uWeight.value = bgState.weight;
      bgU.uAngle.value = bgState.angle;
      bgU.uOn.value = bgState.pattern ? 1 : 0;
      renderer.setClearColor(new THREE.Color(bgState.color), 1);
    };
    app.setBackground();

    scene.add(new THREE.AmbientLight(0xffffff, 0.70));
    var key = new THREE.DirectionalLight(0xffffff, 0.58); key.position.set(4, 7, 9); scene.add(key);
    var fill = new THREE.DirectionalLight(0xffffff, 0.26); fill.position.set(-6, -3, -7); scene.add(fill);

    /* ---- cameras ---- */
    var viewSize = opts.viewSize || 14;
    var dist = opts.viewDistance || 26;
    var persp = new THREE.PerspectiveCamera(32, 1, 0.1, 4000);
    var ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 4000);
    app.activeCamera = opts.startOrtho === false ? persp : ortho;

    var controls = new THREE.OrbitControls(app.activeCamera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.screenSpacePanning = true;

    var VIEWS = {
      front: [0, 0, 1], back: [0, 0, -1], top: [0, 1, 0.0001],
      side: [1, 0, 0], threeQuarter: [0.62, 0.48, 0.62]
    };
    var defaultView = opts.defaultView || 'threeQuarter';

    function setView(nameOrVec, keepDistance) {
      var v = typeof nameOrVec === 'string' ? VIEWS[nameOrVec] : nameOrVec;
      if (!v) return;
      var d = keepDistance ? app.activeCamera.position.distanceTo(controls.target) : dist;
      var n = new THREE.Vector3(v[0], v[1], v[2]).normalize().multiplyScalar(d);
      app.activeCamera.position.copy(controls.target).add(n);
      app.activeCamera.up.set(0, 1, 0);
      if (typeof nameOrVec === 'string' && nameOrVec === 'top') app.activeCamera.up.set(0, 0, -1);
      controls.update();
    }
    app.setView = setView;

    /* Square on to the paper: orthographic, centred, zoomed to fit. This is
       the angle you lay the sheet out in, so it gets its own snap — and since
       a sheet has two sides you can design on, the same snap from behind. The
       back view is simply the front one negated, so whatever a tool calls its
       working angle, turning the paper over is the other side of it. */
    var flatSide = 'front';
    /* a tool whose content changes size — a lineup that re-packs itself — needs
       to say where the middle is each time it is asked, not once at startup */
    function optNum(v) { return (typeof v === 'function' ? v() : v) || 0; }

    function layFlat(side) {
      if (side) flatSide = side;
      swapCamera(true);
      controls.target.set(0, optNum(opts.flatTargetY), 0);
      ortho.zoom = 1;
      if (opts.flatViewSize) viewSize = opts.flatViewSize;
      var fv = VIEWS[opts.flatView || 'front'];
      setView(flatSide === 'back' ? [-fv[0], -fv[1], -fv[2]] : fv);
      ortho.updateProjectionMatrix();
      resize();
    }
    app.layFlat = layFlat;
    app.flatSide = function () { return flatSide; };
    app.flipFlat = function () { layFlat(flatSide === 'back' ? 'front' : 'back'); };

    function resetView() {
      controls.target.set(0, optNum(opts.targetY), 0);
      ortho.zoom = 1; persp.zoom = 1;
      setView(defaultView);
      ortho.updateProjectionMatrix(); persp.updateProjectionMatrix();
    }
    app.resetView = resetView;

    function swapCamera(toOrtho) {
      var from = app.activeCamera, to = toOrtho ? ortho : persp;
      if (from === to) return;
      to.position.copy(from.position); to.up.copy(from.up);
      to.lookAt(controls.target);
      app.activeCamera = to;
      controls.object = to;
      controls.update();
      if (camBtn) camBtn.textContent = toOrtho ? 'ortho' : 'persp';
      resize();
    }

    function resize() {
      var w = stage.clientWidth || 1, h = stage.clientHeight || 1;
      renderer.setSize(w, h, false);
      var a = w / h;
      persp.aspect = a; persp.updateProjectionMatrix();
      ortho.left = -viewSize * a * 0.5; ortho.right = viewSize * a * 0.5;
      ortho.top = viewSize * 0.5; ortho.bottom = -viewSize * 0.5;
      ortho.updateProjectionMatrix();
    }
    global.addEventListener('resize', resize);

    app.setViewSize = function (v) { viewSize = v; resize(); };
    app.setDistance = function (d) { dist = d; };

    /* ---- materials ---- */
    function paperMaterial(over) {
      var m = new THREE.MeshStandardMaterial({
        color: COLORS.paper, roughness: 1.0, metalness: 0.0,
        flatShading: true, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1.2, polygonOffsetUnits: 1.2
      });
      if (over) for (var k in over) m[k] = over[k];
      return m;
    }
    function lineMaterial(over) {
      var m = new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0.92 });
      if (over) for (var k in over) m[k] = over[k];
      return m;
    }
    function dashedMaterial(over) {
      var m = new THREE.LineDashedMaterial({
        color: COLORS.guide, dashSize: 0.22, gapSize: 0.18,
        transparent: true, opacity: 0.6
      });
      if (over) for (var k in over) m[k] = over[k];
      return m;
    }
    app.materials = { paper: paperMaterial, line: lineMaterial, dashed: dashedMaterial };

    var GHOST_M = [null], GHOST_L = [null];
    [0.38, 0.24, 0.15].forEach(function (o) {
      GHOST_M.push(new THREE.MeshBasicMaterial({
        color: COLORS.ghost, transparent: true, opacity: o * 0.55, side: THREE.DoubleSide,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1.2, polygonOffsetUnits: 1.2
      }));
      GHOST_L.push(new THREE.LineBasicMaterial({
        color: COLORS.ghost, transparent: true, opacity: o, depthWrite: false
      }));
    });

    function setGhost(root, k) {
      root.traverse(function (o) {
        if (!o.material) return;
        if (k === 0) {
          if (o.userData._om) { o.material = o.userData._om; o.userData._om = null; }
        } else {
          if (o.userData.noGhost) { o.visible = false; return; }
          if (!o.userData._om) o.userData._om = o.material;
          o.material = o.isLine || o.isLineSegments ? GHOST_L[k] : GHOST_M[k];
        }
      });
      if (k === 0) root.traverse(function (o) { if (o.userData.noGhost) o.visible = o.userData._vis !== false; });
    }

    /* ---- paper mesh factory: filled face + dark outline ---- */
    app.makePaper = function (geometry, o) {
      o = o || {};
      var mesh = new THREE.Mesh(geometry, o.material || paperMaterial());
      var eg = new THREE.EdgesGeometry(geometry, o.edgeAngle != null ? o.edgeAngle : 1);
      var edges = new THREE.LineSegments(eg, o.lineMaterial || lineMaterial());
      edges.userData.isEdge = true;
      mesh.add(edges);
      mesh.userData.edges = edges;
      return mesh;
    };

    /* ---- edges-only mode ---- */
    var edgesOnly = false;
    app.setEdgesOnly = function (v) {
      edgesOnly = v;
      if (app.checkVisibility) app.checkVisibility();
      world.traverse(function (o) {
        if (o.isMesh) o.visible = !v || o.userData.keepInEdges === true;
      });
    };
    app.isEdgesOnly = function () { return edgesOnly; };
    app.refreshEdgesOnly = function () { app.setEdgesOnly(edgesOnly); };

    /* ---- optional grid ---- */
    if (opts.grid) {
      var gsize = opts.gridSize || 40, gdiv = opts.gridDiv || 40;
      var grid = new THREE.GridHelper(gsize, gdiv, 0xC7C1B8, 0xD8D3CB);
      grid.material.transparent = true; grid.material.opacity = 0.65;
      if (opts.grid === 'xy') grid.rotation.x = Math.PI / 2;
      if (opts.gridY) grid.position.y = opts.gridY;
      grid.userData.noGhost = true;
      helpers.add(grid);
      app.grid = grid;
    }
    app.world = world;
    app.helpers = helpers;
    app.scene = scene;
    app.renderer = renderer;
    app.controls = controls;
    app.THREE = THREE;

    /* ---- frame application ---- */
    app.onFrame = function () {};        // tools override
    function applyFrame(f) {
      var t = app.totalFrames > 1 ? f / (app.totalFrames - 1) : 0;
      app.onFrame(f, t);
    }
    app.applyFrame = applyFrame;
    app.t = function () { return app.totalFrames > 1 ? app.frame / (app.totalFrames - 1) : 0; };

    /* ---- onion skin ---- */
    var onion = 0, onionStride = 1, onionAhead = false;
    function renderOnce() {
      var cam = app.activeCamera;
      renderer.clear(true, true, true);
      drawBackground();
      if (onion > 0) {
        for (var k = onion; k >= 1; k--) {
          var offs = onionAhead ? [-k, k] : [-k];
          for (var i = 0; i < offs.length; i++) {
            var f = app.frame + offs[i] * onionStride;
            if (f < 0 || f > app.totalFrames - 1) continue;
            applyFrame(f);
            setGhost(world, k);
            renderer.render(scene, cam);
            setGhost(world, 0);
            renderer.clearDepth();
          }
        }
      }
      applyFrame(app.frame);
      app.refreshEdgesOnly();
      renderer.render(scene, cam);
    }
    app.renderOnce = renderOnce;

    /* ---- transport ---- */
    function tbtn(label, fn, title) {
      var b = el('button', null, label);
      if (title) b.title = title;
      b.addEventListener('click', fn);
      transport.appendChild(b);
      return b;
    }
    function tsep() { transport.appendChild(el('div', 'pk-sep')); }

    tbtn('|<', function () { setFrame(0); }, 'first frame (Home)');
    tbtn('<', function () { step(-1); }, 'previous frame (left arrow)');
    var playBtn = tbtn('play', function () { togglePlay(); }, 'play / pause (space)');
    tbtn('>', function () { step(1); }, 'next frame (right arrow)');
    tbtn('>|', function () { setFrame(app.totalFrames - 1); }, 'last frame (End)');

    var scrub = el('input'); scrub.type = 'range';
    scrub.min = 0; scrub.max = app.totalFrames - 1; scrub.step = 1; scrub.value = 0;
    transport.appendChild(scrub);
    scrub.addEventListener('input', function () { setFrame(parseInt(scrub.value, 10)); });

    var frameLabel = el('span', 'pk-frame', '');
    transport.appendChild(frameLabel);

    tsep();
    transport.appendChild(el('span', null, 'frames'));
    var framesInput = el('input'); framesInput.type = 'number';
    framesInput.min = 2; framesInput.max = 480; framesInput.step = 1; framesInput.value = app.totalFrames;
    framesInput.style.width = '56px';
    transport.appendChild(framesInput);
    framesInput.addEventListener('change', function () {
      setTotalFrames(clamp(parseInt(framesInput.value, 10) || 24, 2, 480));
    });

    transport.appendChild(el('span', null, 'fps'));
    var fpsInput = el('input'); fpsInput.type = 'number';
    fpsInput.min = 1; fpsInput.max = 60; fpsInput.value = app.fps; fpsInput.style.width = '44px';
    transport.appendChild(fpsInput);
    fpsInput.addEventListener('change', function () { app.fps = clamp(parseInt(fpsInput.value, 10) || 12, 1, 60); });

    tsep();
    var pngBtn = tbtn('PNG', function () { exportPNG(); }, 'the paper in the current frame, on a transparent background, cropped tight (E)');
    var seqBtn = tbtn('PNG sequence', function () { exportSequence(); }, 'the paper in every frame, transparent, all cropped the same so they line up');

    function setTotalFrames(n) {
      var t = app.t();
      app.totalFrames = n;
      framesInput.value = n;
      scrub.max = n - 1;
      setFrame(Math.round(t * (n - 1)));
      if (app.onTotalFrames) app.onTotalFrames(n);
    }
    app.setTotalFrames = setTotalFrames;

    function setFrame(f) {
      app.frame = clamp(f | 0, 0, app.totalFrames - 1);
      scrub.value = app.frame;
      frameLabel.textContent = 'frame ' + String(app.frame + 1).padStart(3, '0') +
                               ' / ' + String(app.totalFrames).padStart(3, '0');
      if (app.onFrameChange) app.onFrameChange(app.frame, app.t());
    }
    app.setFrame = setFrame;
    function step(d) { setFrame(app.frame + d); }
    app.step = step;

    var playing = false, acc = 0, last = performance.now();
    function togglePlay(v) {
      playing = v == null ? !playing : v;
      playBtn.textContent = playing ? 'pause' : 'play';
      playBtn.classList.toggle('pk-on', playing);
      acc = 0; last = performance.now();
    }
    app.togglePlay = togglePlay;

    /* ---- export ---- */
    function saveBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }
    function pad(n) { return String(n).padStart(4, '0'); }

    /* ---- the paper, and only the paper ----------------------------------
       A PNG is of the paper: everything in `world` (sheets, planes, type,
       creases) and nothing else — no stage colour or ruling, no grid, paths
       or axes (those live in `helpers`), no onion ghosts, no dashed guide of
       the flat sheet. The background is transparent and the frame is cropped
       tight around the paper. The size does not depend on the window or the
       zoom: the crop's longer side comes out EXPORT_LONG pixels. */
    var EXPORT_LONG = opts.exportLongSide || 2400, EXPORT_PAD = 12;
    function isGuide(o) { return !!(o.material && o.material.isLineDashedMaterial); }
    function paperBox(W, H) {
      var cam = app.activeCamera, v = new THREE.Vector3();
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      cam.updateMatrixWorld();
      world.updateMatrixWorld(true);
      world.traverseVisible(function (o) {
        if (!(o.isMesh || o.isLine) || isGuide(o) || !o.geometry || !o.geometry.attributes.position) return;
        var p = o.geometry.attributes.position;
        for (var i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(cam);
          var px = (v.x + 1) * 0.5 * W, py = (1 - v.y) * 0.5 * H;
          if (px < x0) x0 = px; if (px > x1) x1 = px;
          if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
      });
      return x0 < x1 ? [x0, y0, x1, y1] : null;
    }
    function unionBox(a, b) {
      if (!a) return b; if (!b) return a;
      return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
    }
    /* measure the paper at screen size, then scale the virtual frame so the
       crop lands at EXPORT_LONG on its longer side */
    function exportFit(box1) {
      var el = renderer.domElement;
      var W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight);
      if (!box1) return null;
      var k = (EXPORT_LONG - 2 * EXPORT_PAD) / Math.max(box1[2] - box1[0], box1[3] - box1[1], 1);
      return { W: W * k, H: H * k, box: [box1[0] * k, box1[1] * k, box1[2] * k, box1[3] * k] };
    }
    function screenSize() {
      var el = renderer.domElement;
      return [Math.max(1, el.clientWidth), Math.max(1, el.clientHeight)];
    }
    function renderPaper(box, W, H) {
      var x = Math.floor(box[0]) - EXPORT_PAD, y = Math.floor(box[1]) - EXPORT_PAD;
      var w = Math.ceil(box[2]) - x + EXPORT_PAD, h = Math.ceil(box[3]) - y + EXPORT_PAD;
      /* keep inside what a GPU will allocate */
      var k = Math.min(1, 8192 / Math.max(w, h));
      if (k < 1) { W *= k; H *= k; x = Math.floor(x * k); y = Math.floor(y * k); w = Math.ceil(w * k); h = Math.ceil(h * k); }
      var cam = app.activeCamera;
      cam.setViewOffset(W, H, x, y, w, h);
      var RT = THREE.WebGLMultisampleRenderTarget || THREE.WebGLRenderTarget;
      var rt = new RT(w, h);
      var hidden = [];
      world.traverse(function (o) { if (isGuide(o) && o.visible) { o.visible = false; hidden.push(o); } });
      var helpersWere = helpers.visible; helpers.visible = false;
      var prevRT = renderer.getRenderTarget(), prevCol = renderer.getClearColor(new THREE.Color());
      var prevA = renderer.getClearAlpha();
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
      var buf = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      renderer.setRenderTarget(prevRT);
      renderer.setClearColor(prevCol, prevA);
      rt.dispose();
      cam.clearViewOffset();
      helpers.visible = helpersWere;
      hidden.forEach(function (o) { o.visible = true; });

      /* the GL result is premultiplied over transparent black; a PNG wants
         straight alpha, or every soft edge comes out with a dark fringe */
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var c2 = cv.getContext('2d'), img = c2.createImageData(w, h), d = img.data;
      for (var row = 0; row < h; row++) {
        var src = (h - 1 - row) * w * 4, dst = row * w * 4;
        for (var i = 0; i < w * 4; i += 4) {
          var a = buf[src + i + 3];
          if (a === 0) continue;
          var u = a === 255 ? 1 : 255 / a;
          d[dst + i] = Math.min(255, buf[src + i] * u);
          d[dst + i + 1] = Math.min(255, buf[src + i + 1] * u);
          d[dst + i + 2] = Math.min(255, buf[src + i + 2] * u);
          d[dst + i + 3] = a;
        }
      }
      c2.putImageData(img, 0, 0);
      return cv;
    }
    function toBlob(cv) { return new Promise(function (res) { cv.toBlob(res, 'image/png'); }); }
    app.renderPaper = function () {
      renderOnce();
      var sc = screenSize(), fit = exportFit(paperBox(sc[0], sc[1]));
      return fit ? renderPaper(fit.box, fit.W, fit.H) : null;
    };

    function exportPNG() {
      var cv = app.renderPaper();
      if (!cv) return;
      toBlob(cv).then(function (b) { saveBlob(b, app.name + '_' + pad(app.frame + 1) + '.png'); });
    }
    app.exportPNG = exportPNG;

    function exportSequence() {
      if (seqBtn.disabled) return;
      var wasOnion = onion; onion = 0;
      var keep = app.frame;
      seqBtn.disabled = true; pngBtn.disabled = true;
      togglePlay(false);
      var useZip = !!global.JSZip;
      var zip = useZip ? new global.JSZip() : null;
      var folder = useZip ? zip.folder(app.name) : null;
      /* one crop for the whole run, the union of every frame's paper, so the
         frames stay registered with each other when you step through them */
      var sc = screenSize(), box1 = null;
      for (var f = 0; f < app.totalFrames; f++) {
        setFrame(f);
        renderOnce();
        box1 = unionBox(box1, paperBox(sc[0], sc[1]));
      }
      var fit = exportFit(box1), box = fit && fit.box, sz = fit ? [fit.W, fit.H] : null;
      var i = 0;
      function next() {
        if (i >= app.totalFrames) return finish();
        seqBtn.textContent = 'rendering ' + (i + 1) + '/' + app.totalFrames;
        setFrame(i);
        renderOnce();
        if (!box) { i++; return setTimeout(next, 0); }
        toBlob(renderPaper(box, sz[0], sz[1])).then(function (blob) {
          var fn = app.name + '_' + pad(i + 1) + '.png';
          if (useZip) { folder.file(fn, blob); i++; setTimeout(next, 0); }
          else { saveBlob(blob, fn); i++; setTimeout(next, 220); }
        });
      }
      function finish() {
        if (useZip) {
          seqBtn.textContent = 'zipping…';
          zip.generateAsync({ type: 'blob' }).then(function (b) {
            saveBlob(b, app.name + '_sequence_' + app.totalFrames + 'f.zip');
            done();
          });
        } else { done(); }
      }
      function done() {
        seqBtn.textContent = 'PNG sequence';
        seqBtn.disabled = false; pngBtn.disabled = false;
        onion = wasOnion; setFrame(keep);
      }
      next();
    }
    app.exportSequence = exportSequence;

    /* ---- panel: tabs, then collapsible groups inside each ---- */
    /* The tools are separate pages, which is easy to forget once you are deep
       in one of them — so every panel starts with the way to all the others,
       with the one you are on marked. */
    var TOOLS = [
      ['fold',   'paper-fold.html'],
      ['plan',   'fold-plan.html'],
      ['lineup', 'lineup.html'],
      ['flight', 'plane-flight.html'],
      ['card',   'card-flip.html']
    ];
    var nav = el('div', 'pk-nav');
    var hereFile = (global.location.pathname.split('/').pop() || 'paper-fold.html').toLowerCase();
    TOOLS.forEach(function (t) {
      var a = el('a', null, t[0]);
      a.href = t[1];
      a.title = t[1];
      if (hereFile === t[1]) a.classList.add('pk-on');
      nav.appendChild(a);
    });
    panel.appendChild(nav);

    var tabBar = el('div', 'pk-tabs');
    var pages = el('div', 'pk-pages');
    panel.appendChild(tabBar); panel.appendChild(pages);
    var tabs = {}, currentPage = null;

    function useTab(label) {
      if (!tabs[label]) {
        var page = el('div', 'pk-page');
        var btn = el('button', null, label);
        btn.addEventListener('click', function () { showTab(label); });
        tabBar.appendChild(btn); pages.appendChild(page);
        tabs[label] = { page: page, btn: btn };
        if (Object.keys(tabs).length === 1) showTab(label);
      }
      currentPage = tabs[label].page;
      return tabs[label];
    }
    function showTab(label) {
      Object.keys(tabs).forEach(function (k) {
        tabs[k].page.classList.toggle('pk-on', k === label);
        tabs[k].btn.classList.toggle('pk-on', k === label);
      });
    }
    app.useTab = useTab;
    app.showTab = showTab;

    app.ui = {
      group: function (title, o) {
        o = o || {};
        var host = currentPage || panel;
        var g = el('div', 'pk-group');
        var body = el('div', 'pk-body');
        if (title) {
          var h = el('h3', null, title);
          g.appendChild(h);
          if (o.collapsible !== false) {
            g.classList.add('pk-fold');
            if (o.collapsed) g.classList.add('pk-shut');
            h.addEventListener('click', function () { g.classList.toggle('pk-shut'); });
          }
        }
        g.appendChild(body);
        host.appendChild(g);
        return new Controls(body, g);
      },
      lead: function (text) {
        (currentPage || panel).appendChild(el('div', 'pk-lead', text));
      },
      panel: panel
    };

    app.toolPanel = function (title, o) { return app.ui.group(title, o); };

    function buildViewPanel() {
      var g = app.ui.group('camera');
      g.buttons([
        { label: '▣  lay flat', hint: 'square on to the front of the paper, orthographic and centred — the working angle (F)',
          onClick: function () { layFlat('front'); } },
        { label: '▨  flip over', hint: 'the same flat view from behind, for designing the back of the sheet (shift+F)',
          onClick: function () { layFlat('back'); } },
        { label: 'reset', onClick: resetView }
      ]);
      g.buttons([
        { label: 'top', onClick: function () { setView('top'); } },
        { label: 'front', onClick: function () { setView('front'); } },
        { label: 'side', onClick: function () { setView('side'); } },
        { label: '3/4', onClick: function () { setView('threeQuarter'); } }
      ]);
      var camRow = g.row('projection');
      camBtn = el('button', null, app.activeCamera === ortho ? 'ortho' : 'persp');
      camBtn.style.flex = '1 1 auto';
      camBtn.addEventListener('click', function () { swapCamera(app.activeCamera !== ortho); });
      camRow.appendChild(camBtn);
      var edgeTog = g.toggle({
        label: 'edges only (W)', value: false,
        onChange: function (v) { app.setEdgesOnly(v); }
      });
      function showEverything() {
        edgeSel.set('all');
        edgeTog.set(false);
        if (gridTog) gridTog.set(true);
        if (app.onShowAll) app.onShowAll();
        app.checkVisibility();
      }
      warnBtn.addEventListener('click', function () { showEverything(); });

      var edgeSel = g.select({
        label: 'crease lines', value: 'auto',
        options: [
          { value: 'auto', label: 'as they form' },
          { value: 'all', label: 'show every crease' },
          { value: 'outline', label: 'outline only' },
          { value: 'none', label: 'none' }
        ],
        hint: '“as they form” only draws a crease once the paper either side of it has actually moved, so a flat sheet is just a rectangle',
        onChange: function (v) {
          curEdgeMode = v;
          if (app.onEdgeMode) app.onEdgeMode(v);
          app.checkVisibility();
        }
      });
      var gridTog = app.grid ? g.toggle({
        label: 'grid', value: true, onChange: function (v) { app.grid.visible = v; }
      }) : null;
      g.buttons([
        { label: 'clean view', onClick: function () {
            edgeSel.set('auto');
            if (gridTog) gridTog.set(false);
            if (app.onCleanView) app.onCleanView();
          } },
        { label: 'show everything', hint: 'the way back if the viewport looks empty',
          onClick: function () { showEverything(); } }
      ]);
      return g;
    }
    var camBtn;

    function buildOnionPanel() {
      var g = app.ui.group('onion skin');
      g.slider({
        label: 'ghosts', min: 0, max: 3, step: 1, value: 0, decimals: 0,
        format: function (v) { return v === 0 ? 'off' : v; },
        hint: 'faint copies of the previous frames — the gap between them is the travel per frame (O)',
        onChange: function (v) { onion = v; }
      });
      g.slider({
        label: 'spacing', min: 1, max: 6, step: 1, value: 1, decimals: 0,
        format: function (v) { return 'every ' + (v === 1 ? 'frame' : v + ' frames'); },
        onChange: function (v) { onionStride = v; }
      });
      g.toggle({ label: 'ghost the next frames too', value: false,
        onChange: function (v) { onionAhead = v; } });
      return g;
    }

    /* The stage colour is a design decision as much as the paper is, so it gets
       real controls rather than a constant: any colour, plus notebook ruling
       that you can space, weight, recolour and turn on its side. */
    /* a tool can place this itself — in fold-plan it belongs next to the
       gradient controls, not a tab away under the camera */
    var bgBuilt = false;
    function buildBackgroundPanel() {
      if (bgBuilt) return null;
      bgBuilt = true;
      /* open by default: it was the first thing nobody could find */
      var g = app.ui.group('stage background');
      g.colour({
        label: 'colour', value: app.background.color,
        hint: 'the area behind the paper, not the paper itself — exported PNGs use it too',
        onChange: function (v) { app.setBackground({ color: v }); }
      });
      var stripes = g.toggle({
        label: 'ruled lines', value: app.background.pattern,
        hint: 'notebook ruling, measured in screen pixels so it stays put while you orbit',
        onChange: function (v) { app.setBackground({ pattern: v }); }
      });
      g.slider({
        label: 'rule spacing', min: 6, max: 90, step: 1, value: app.background.spacing, decimals: 0,
        format: function (v) { return v + ' px'; },
        onChange: function (v) { app.setBackground({ spacing: v }); }
      });
      g.slider({
        label: 'rule weight', min: 0.5, max: 5, step: 0.5, value: app.background.weight, decimals: 1,
        format: function (v) { return v.toFixed(1) + ' px'; },
        onChange: function (v) { app.setBackground({ weight: v }); }
      });
      g.colour({
        label: 'rule colour', value: app.background.line,
        onChange: function (v) { app.setBackground({ line: v }); }
      });
      g.select({
        label: 'direction', value: String(app.background.angle),
        options: [
          { value: '0', label: 'horizontal' },
          { value: '90', label: 'vertical' },
          { value: '45', label: 'diagonal' }
        ],
        onChange: function (v) { app.setBackground({ angle: parseFloat(v) }); }
      });
      g.note('presets set every field above at once.');
      g.buttons([
        { label: 'notebook', hint: 'cream page, pale blue ruling',
          onClick: function () { preset('#FBF7EC', '#9BB4C8', 26, 1, 0); } },
        { label: 'plain', hint: 'the default stage, no ruling',
          onClick: function () { preset(CSS_BG, '#9BB4C8', 26, 1, 0, false); } },
        { label: 'blueprint', hint: 'dark stage, faint white ruling',
          onClick: function () { preset('#1F2733', '#4E6379', 22, 1, 0); } }
      ]);
      function preset(bg, line, sp, w, ang, on) {
        app.setBackground({
          color: bg, line: line, spacing: sp, weight: w, angle: ang,
          pattern: on === false ? false : true
        });
        syncBackgroundPanel();
      }
      backgroundInputs = { stripes: stripes, group: g };
      return g;
    }
    var backgroundInputs = null;
    /* the presets move several controls at once, so push the values back into
       the widgets rather than leaving them reading the old numbers */
    function syncBackgroundPanel() {
      if (!backgroundInputs) return;
      var b = app.background, rows = backgroundInputs.group.el.querySelectorAll('.pk-row');
      rows.forEach(function (r) {
        var lab = (r.firstChild && r.firstChild.textContent) || '';
        var inp = r.querySelector('input,select');
        if (!inp) return;
        var v = lab.indexOf('colour') === 0 ? b.color
              : lab.indexOf('rule colour') === 0 ? b.line
              : lab.indexOf('rule spacing') === 0 ? b.spacing
              : lab.indexOf('rule weight') === 0 ? b.weight
              : lab.indexOf('direction') === 0 ? String(b.angle) : null;
        if (v === null) return;
        inp.value = v;
        inp.dispatchEvent(new Event(inp.tagName === 'SELECT' ? 'change' : 'input'));
      });
      backgroundInputs.stripes.set(b.pattern, true);
    }
    app.syncBackgroundPanel = syncBackgroundPanel;
    app.buildBackgroundPanel = buildBackgroundPanel;

    app.buildSharedPanels = function () { buildViewPanel(); buildBackgroundPanel(); buildOnionPanel(); };

    /* ---- keyboard ---- */
    global.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key !== 'Escape') return;
      }
      var k = e.key;
      if (k === 'ArrowLeft') { step(e.shiftKey ? -5 : -1); e.preventDefault(); }
      else if (k === 'ArrowRight') { step(e.shiftKey ? 5 : 1); e.preventDefault(); }
      else if (k === 'Home') { setFrame(0); e.preventDefault(); }
      else if (k === 'End') { setFrame(app.totalFrames - 1); e.preventDefault(); }
      else if (k === ' ') { togglePlay(); e.preventDefault(); }
      else if (k === 'o' || k === 'O') { onion = (onion + 1) % 4; syncPanels(); }
      else if (k === 'w' || k === 'W') { app.setEdgesOnly(!edgesOnly); syncPanels(); }
      else if (k === 'r' || k === 'R') { resetView(); }
      else if (k === 'p' || k === 'P') { swapCamera(app.activeCamera !== ortho); }
      else if (k === 'e' || k === 'E') { exportPNG(); }
      else if (k === '1') { setView('top'); }
      else if (k === '2') { setView('front'); }
      else if (k === '3') { setView('side'); }
      else if (k === '4') { setView('threeQuarter'); }
      else if (k === 'f') { layFlat('front'); }        // F  — flat, front of the sheet
      else if (k === 'F') { layFlat('back'); }         // shift+F — flat, back of it
      if (app.onKey) app.onKey(e);
    });

    function syncPanels() {
      // reflect keyboard-driven state back into the panel widgets
      var ranges = panel.querySelectorAll('.pk-group input[type=range]');
      ranges.forEach(function (r) {
        if (r.dataset.pkOnion) { r.value = onion; r.dispatchEvent(new Event('input')); }
      });
      var btns = panel.querySelectorAll('button');
      btns.forEach(function (b) {
        if (b.textContent.indexOf('edges only') === 0) b.classList.toggle('pk-on', edgesOnly);
      });
    }

    /* ---- loop ---- */
    function tick(now) {
      requestAnimationFrame(tick);
      var dt = Math.min((now - last) / 1000, 0.25); last = now;
      if (playing) {
        acc += dt;
        var spf = 1 / app.fps;
        while (acc >= spf) {
          acc -= spf;
          setFrame(app.frame + 1 > app.totalFrames - 1 ? 0 : app.frame + 1);
        }
      }
      controls.update();
      renderOnce();
    }

    app.start = function () {
      resize();
      if (opts.startFlat) layFlat(); else resetView();
      setFrame(0);
      requestAnimationFrame(tick);
    };

    global.PK_APP = app;    // handy for poking at the rig from the console

    // mark the onion slider so keyboard toggling can sync it
    var origGroup = app.ui.group;
    app.ui.group = function (t, o) {
      var c = origGroup(t, o);          // must pass the options through
      if (t === 'onion skin') {
        var origSlider = c.slider.bind(c);
        c.slider = function (o) {
          var s = origSlider(o);
          if (o.label === 'ghosts') s.input.dataset.pkOnion = '1';
          return s;
        };
      }
      return c;
    };

    return app;
  }

  /* ================================================================== 2D math
     Small affine helpers used by the fold engine. A transform is
     {a,b,c,d,e,f}:  x' = a*x + c*y + e ;  y' = b*x + d*y + f
     All transforms here are isometries (rotation/reflection + translation),
     so the linear part is orthogonal and inversion is cheap.
     ====================================================================== */
  var M2 = {
    id: function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    apply: function (m, p) { return [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f]; },
    invApply: function (m, p) {
      var x = p[0] - m.e, y = p[1] - m.f;
      return [m.a * x + m.b * y, m.c * x + m.d * y];
    },
    det: function (m) { return m.a * m.d - m.b * m.c; },
    /* T2 after T1 */
    mul: function (m2, m1) {
      return {
        a: m2.a * m1.a + m2.c * m1.b,
        b: m2.b * m1.a + m2.d * m1.b,
        c: m2.a * m1.c + m2.c * m1.d,
        d: m2.b * m1.c + m2.d * m1.d,
        e: m2.a * m1.e + m2.c * m1.f + m2.e,
        f: m2.b * m1.e + m2.d * m1.f + m2.f
      };
    },
    /* reflection about the line through P with unit direction u */
    reflect: function (P, u) {
      var a = 2 * u[0] * u[0] - 1, b = 2 * u[0] * u[1],
          c = 2 * u[0] * u[1], d = 2 * u[1] * u[1] - 1;
      return { a: a, b: b, c: c, d: d,
        e: P[0] - (a * P[0] + c * P[1]),
        f: P[1] - (b * P[0] + d * P[1]) };
    }
  };

  /* Sutherland–Hodgman clip of a convex polygon by a half plane.
     Keeps points where (p - P)·n >= 0 */
  function clipHalfPlane(poly, P, n, eps) {
    eps = eps || 1e-7;
    var out = [], L = poly.length;
    function sd(p) { return (p[0] - P[0]) * n[0] + (p[1] - P[1]) * n[1]; }
    for (var i = 0; i < L; i++) {
      var A = poly[i], B = poly[(i + 1) % L];
      var da = sd(A), db = sd(B);
      if (da >= -eps) out.push(A);
      if ((da > eps && db < -eps) || (da < -eps && db > eps)) {
        var t = da / (da - db);
        out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
      }
    }
    // drop duplicates
    var clean = [];
    for (var j = 0; j < out.length; j++) {
      var p = out[j], q = clean[clean.length - 1];
      if (!q || Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6) clean.push(p);
    }
    if (clean.length > 2) {
      var a0 = clean[0], aN = clean[clean.length - 1];
      if (Math.abs(a0[0] - aN[0]) < 1e-6 && Math.abs(a0[1] - aN[1]) < 1e-6) clean.pop();
    }
    return clean.length >= 3 ? clean : [];
  }

  function pointInPoly(p, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  function polyArea(poly) {
    var s = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  }
  function polyCentroid(poly) {
    var x = 0, y = 0;
    poly.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / poly.length, y / poly.length];
  }

  /* fan-triangulated BufferGeometry for a convex polygon in the z=0 plane */
  function polyGeometry(poly) {
    var pos = [], idx = [];
    poly.forEach(function (p) { pos.push(p[0], p[1], 0); });
    for (var i = 1; i < poly.length - 1; i++) idx.push(0, i, i + 1);
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function polyOutlineGeometry(poly, z) {
    var pos = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      pos.push(a[0], a[1], z || 0, b[0], b[1], z || 0);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  global.PaperKit = {
    COLORS: COLORS, EASING: EASING, createApp: createApp,
    clamp: clamp, lerp: lerp, deg: deg, rad: rad,
    M2: M2, clipHalfPlane: clipHalfPlane, polyArea: polyArea, pointInPoly: pointInPoly,
    polyCentroid: polyCentroid, polyGeometry: polyGeometry,
    polyOutlineGeometry: polyOutlineGeometry,
    normHex: function (v) { return PK_normHex(v); }
  };
})(window);

/* ============================================================================
   common.js (part 2) — the fold engine
   ---------------------------------------------------------------------------
   The sheet is modelled in its own material 2D space (x right, y up, z = paper
   normal). Every fold is a reflection in that plane; a region's accumulated
   transform T maps material coords -> current flat position.

   Topology is solved first, in 2D: each fold clips every existing region
   against its crease half-plane, splitting regions that straddle it. Each
   resulting leaf region ends up with an ordered list of the folds it takes
   part in.

   Geometry is then built once: leaf polygon -> mesh (in material coords),
   wrapped in one pivot group per fold, innermost = earliest fold. Because the
   group matrices compose in exactly the same order as the reflections, each
   group's matrix is simply the world-space rotation about its own crease line
   -- no local re-expression needed. Rotating by pi lands the piece precisely
   on its reflected position.
   ========================================================================== */
(function (global) {
  'use strict';
  var THREE = global.THREE, PK = global.PaperKit;
  if (!THREE || !PK) return;
  var M2 = PK.M2;

  function norm2(v) { var l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; }
  function sub2(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  function dot2(a, b) { return a[0] * b[0] + a[1] * b[1]; }

  /* A fold: crease through A toward B, the side containing `ref` moves.
     dir = +1 sweeps that side up through +z, -1 sweeps it down through -z. */
  function makeFold(name, A, B, ref, dir, extra) {
    var d = norm2(sub2(B, A));
    var n = [-d[1], d[0]];
    if (dot2(sub2(ref, A), n) < 0) n = [-n[0], -n[1]];
    var axis = dir > 0 ? [n[1], -n[0], 0] : [-n[1], n[0], 0];   // n x z  (or z x n)
    var f = {
      name: name, P: A, dir: d, n: n,
      R: M2.reflect(A, d),
      axisV: new THREE.Vector3(axis[0], axis[1], axis[2]).normalize(),
      pivotV: new THREE.Vector3(A[0], A[1], 0),
      maxAngle: Math.PI, pingPong: false, creaseOnly: false, filter: null
    };
    if (extra) for (var k in extra) f[k] = extra[k];
    return f;
  }

  /* --------------------------------------------------------------- the models
     'classic' — the blunt-nosed plane with a Nakamura lock. The nose triangle
     folds down, two more corners come in on top of it, and the tip that still
     pokes out folds back up to lock them. The nose crease sits `lockTab` below
     the base of the first triangle, and that gap is exactly what leaves a tab
     to lock with.
     'dart'    — the slender classic dart: corners, then the long angled edges
     straight in to the centre line.                                          */
  function foldSpec(model, hw, hh, wo, lockTab) {
    var nose = [0, hh];
    var H = hh * 2;                           // full sheet height
    var base = hh - hw;                       // first creases meet the side edges
    /* Which half a piece is in is not the sign of its material x: a fold
       before the fold-in-half can carry paper that started on the centre line
       across it. The honest test is whether the fold-in-half moved the piece,
       which is recorded as the solver goes. */
    var leftMat = function (r) { return !r.movedByHalf; };
    var rightMat = function (r) { return !!r.movedByHalf; };
    var n = 0;
    function name(t) { return (++n) + ' \u00b7 ' + t; }

    function centreCrease() {
      return makeFold(name('centre crease (fold + unfold)'), [0, -hh], [0, hh], [1, 0], 1,
        { creaseOnly: true, pingPong: true });
    }
    /* both top corners of whatever edge is currently at height `top`,
       brought in to the centre line */
    function cornersToCentre(top, label) {
      var apex = [0, top], reach = top - hw;
      return [
        makeFold(name('left ' + label), apex, [-hw, reach], [-hw, top], 1),
        makeFold(name('right ' + label), apex, [hw, reach], [hw, top], 1)
      ];
    }
    /* a straight fold across the sheet at height y, taking everything above it
       over — forwards by default, backwards with dir -1 for an accordion */
    function edgeDown(y, label, dir) {
      return makeFold(name(label), [-hw - 2, y], [hw + 2, y], [0, hh], dir == null ? 1 : dir);
    }
    function foldInHalf() {
      return makeFold(name('fold in half'), [0, -hh], [0, hh], [1, 0], -1, { isHalf: true });
    }
    function wings(off) {
      return [
        makeFold(name('left wing down'), [-off, -hh], [-off, hh], [-hw, 0], 1,
          { filter: leftMat, isWing: true }),
        makeFold(name('right wing down'), [-off, -hh], [-off, hh], [-hw, 0], -1,
          { filter: rightMat, isWing: true })
      ];
    }
    /* "fold this corner onto that point": the crease is the perpendicular
       bisector of the pair, which is the construction the diagrams mean when
       they mark a dot to fold to */
    function cornerToPoint(corner, target, label, dir) {
      var mx = (corner[0] + target[0]) / 2, my = (corner[1] + target[1]) / 2;
      var d = norm2([-(target[1] - corner[1]), target[0] - corner[0]]);
      return makeFold(name(label), [mx, my], [mx + d[0], my + d[1]], corner, dir == null ? 1 : dir);
    }

    /* the bisector of the angled edge and the centre line, struck from the apex */
    function edgesToCentre(apex, hit, label) {
      var u = norm2(sub2(hit, apex));
      var b = norm2([u[0], u[1] - 1]);
      var far = [apex[0] + b[0] * (hh + hw) * 2, apex[1] + b[1] * (hh + hw) * 2];
      var bm = norm2([-u[0], u[1] - 1]);
      var farM = [apex[0] + bm[0] * (hh + hw) * 2, apex[1] + bm[1] * (hh + hw) * 2];
      return [
        makeFold(name('left ' + label), apex, far, [-hw, apex[1] - 1], 1),
        makeFold(name('right ' + label), apex, farM, [hw, apex[1] - 1], 1)
      ];
    }

    var f = [centreCrease()];

    if (model === 'dart') {
      f = f.concat(cornersToCentre(hh, 'corner to centre'));
      f = f.concat(edgesToCentre(nose, [-hw, base], 'angled edge to centre'));
      f.push(foldInHalf());
      f = f.concat(wings(wo));

    } else if (model === 'needle') {
      /* a dart taken one bisector further: very slender, deep keel */
      f = f.concat(cornersToCentre(hh, 'corner to centre'));
      f = f.concat(edgesToCentre(nose, [-hw, base], 'angled edge to centre'));
      var u2 = norm2(sub2([-hw, base], nose));
      var b2 = norm2([u2[0], u2[1] - 1]);
      f = f.concat(edgesToCentre(nose, [nose[0] + b2[0], nose[1] + b2[1]], 'edge in again'));
      f.push(foldInHalf());
      f = f.concat(wings(wo * 0.75));

    } else if (model === 'bug') {
      /* straight from the BUG diagram: corners in, the whole sheet folded top
         to bottom so the triangle points down at the dot, both new corners
         brought to that dot, the tip locked up, then halved and winged. Short
         and broad — the half-fold throws away half the length. */
      f = f.concat(cornersToCentre(hh, 'corner to centre'));
      f.push(makeFold(name('fold in half, top to bottom'),
        [-hw - 2, 0], [hw + 2, 0], [0, hh], 1));
      var dot = [0, -hh];                       // where the tip lands
      f.push(cornerToPoint([-hw, 0], dot, 'left corner to the dot'));
      f.push(cornerToPoint([hw, 0], dot, 'right corner to the dot'));
      f.push(foldInHalf());
      f = f.concat(wings(wo * 1.25));

    } else if (model === 'distance') {
      /* the distance glider, folded on the sheet turned landscape: the point
         is made on a short edge, taken in twice, so the finished plane is long
         and narrow with a deep keel. */
      f = f.concat(cornersToCentre(hh, 'corner to centre'));
      f.push(edgeDown(hh - hw * 0.34, 'blunt the point'));
      f = f.concat(cornersToCentre(hh - hw * 0.34, 'corner in again'));
      f.push(foldInHalf());
      f = f.concat(wings(wo * 0.8));

    } else if (model === 'arrow') {
      /* a narrow strip turned down first, so the nose is a band rather than a
         point, then corners and the apex down.

         The corner folds have to stop at the centre line. Taken any further
         each one sweeps past it and the second fold re-folds paper the first
         has already moved, so the two stop being mirror images — built that
         way this came out 1.31 in out of true. At 45 degrees the two flaps
         meet without overlapping and the pair commutes. */
      var stripY = hh - hh * 0.14;
      f.push(edgeDown(stripY, 'narrow strip down'));
      f = f.concat(cornersToCentre(stripY, 'corner to centre'));
      f.push(edgeDown(stripY - hw * 0.72, 'apex down'));
      f.push(foldInHalf());
      f = f.concat(wings(wo * 0.85));

    } else if (model === 'jet') {
      /* From the JET diagram: the dart's two folds each side, in half, wings
         down, and the ends of the wings turned up as tips. The tips are struck
         before the wings in the solver's order — a crease has to be placed on
         paper that is lying flat, and after the wings open there is none left
         at the tips — so on screen the tips come up just before the wings go
         down rather than after. The finished plane is the same either way. */
      f = f.concat(cornersToCentre(hh, 'top corner to the middle'));
      f = f.concat(edgesToCentre(nose, [-hw, base], 'fold it over again'));
      f.push(foldInHalf());
      f = f.concat(wingTips(hw - 0.75));
      f = f.concat(wings(wo));

    } else if (model === 'paperplane') {
      /* "A Paper Plane", on letter turned landscape: corners to the middle, the
         point folded down two-thirds of its height, then folded back up just
         below that crease — a pleat that leaves the tip standing proud of the
         top edge — in half, the wing tips turned up, and the wings folded on a
         crease swept from that tip back to the tail. The tips are struck before
         the wings for the same reason as the jet's. */
      f = f.concat(cornersToCentre(hh, 'fold the corners to the middle'));
      var yDown = hh - hw * 0.69;               // the point comes down to here
      var iDown = f.length;
      f.push(edgeDown(yDown, 'fold the point down'));
      var yUp = yDown - 0.45;                   // and goes back up from here
      var flapMat = function (r) { return r.folds.indexOf(iDown) >= 0; };
      f.push(makeFold(name('fold the point back up'), [-hw - 2, yUp], [hw + 2, yUp], [0, -hh], 1,
        { filter: flapMat }));
      f.push(foldInHalf());
      f = f.concat(wingTips(hw - 0.6));
      var tipY = 2 * yUp - (2 * yDown - hh);    // where the pleated point ends up
      f = f.concat(sweptWings([0, tipY], Math.min(wo * 1.6, hw - 0.5)));

    } else if (model === 'simple') {
      /* The easy origami plane: corners in, the triangle folded down, corners
         in again — the Nakamura moves without the lock, so the tip is left
         showing between the flaps — in half, and winged from the nose tip
         back, like the photo: a broad delta over a shallow wedge keel. */
      f = f.concat(cornersToCentre(hh, 'fold diagonally'));
      var ys = base - lockTab;
      f.push(edgeDown(ys, 'fold the triangle down'));
      f = f.concat(cornersToCentre(ys, 'fold diagonally again'));
      f.push(foldInHalf());
      f = f.concat(sweptWings([0, ys], Math.min(wo * 1.8, hw - 0.5)));

    } else if (model === 'lockdart') {
      /* From the locked-dart diagram: the Nakamura nose — corners in, the
         triangle folded down along its base, corners in again to meet at its
         tip, the tip that still shows folded up to lock — but winged like a
         dart. The wing crease runs from the nose tip back to the tail instead
         of parallel to the keel, so the keel is a wedge that deepens toward
         the tail and the wings are long and swept, with the locked nose as
         their leading edge. */
      f = f.concat(buildLockedBody());
      f.push(foldInHalf());
      /* step 16 of the diagram runs the crease nearly to the outer corner at
         the tail: a deep keel and narrow wings, which is what makes it long
         and slender rather than an arrowhead */
      f = f.concat(sweptWings(lockNose(), Math.min(wo * 3.2, hw - 0.5)));

    } else {                                   // classic — the locked nose
      f = f.concat(buildLockedBody());
      f.push(foldInHalf());
      f = f.concat(wings(wo));
    }

    /* the outer strip of each wing, beyond `x` from the spine, turned up a
       right angle — only the wide ends of the wings reach that far out */
    function wingTips(x) {
      return [
        makeFold(name('left wing tip up'), [-x, -hh], [-x, hh], [-hw, -hh], -1,
          { filter: leftMat, maxAngle: Math.PI / 2 }),
        makeFold(name('right wing tip up'), [-x, -hh], [-x, hh], [-hw, -hh], 1,
          { filter: rightMat, maxAngle: Math.PI / 2 })
      ];
    }
    function lockNose() { return [0, base - lockTab]; }
    /* wing creases struck from `nose` on the spine to `tail` in from it at the
       bottom edge — each half folds its own wing, in opposite directions, as
       with the straight wings */
    function sweptWings(nose, tail) {
      var B = [-tail, -hh];
      return [
        makeFold(name('left wing down'), nose, B, [-hw, -hh], 1,
          { filter: leftMat, isWing: true }),
        makeFold(name('right wing down'), nose, B, [-hw, -hh], -1,
          { filter: rightMat, isWing: true })
      ];
    }

    /* the Nakamura body, everything up to the fold in half */
    function buildLockedBody() {
      var out = cornersToCentre(hh, 'corner to centre');
      var yn = base - lockTab;
      var meet = yn - hw;
      var noseMat = function (r) { return PK.polyCentroid(r.poly)[1] > yn; };
      out.push(edgeDown(yn, 'nose triangle down'));
      out = out.concat(cornersToCentre(yn, 'new corner to centre'));
      out.push(makeFold(name('fold the tip up to lock'), [-hw - 2, meet], [hw + 2, meet], [0, -hh], 1,
        { filter: noseMat }));
      return out;
    }

    return f;
  }

  /* Chosen to fold by hand and to carry type, with a spread of proportion
     from stubby to needle-thin. The swallow is gone; the locked dart, the jet
     and the simple delta were added from their diagrams. */
  PK.PLANE_MODELS = [
    { value: 'classic',  label: 'nakamura lock \u2014 the classic' },
    { value: 'lockdart', label: 'locked dart \u2014 nakamura nose, swept wings' },
    { value: 'distance', label: 'distance \u2014 landscape glider' },
    { value: 'bug',      label: 'bug \u2014 halved, short and broad' },
    { value: 'arrow',    label: 'arrow \u2014 strip down, swept' },
    { value: 'dart',     label: 'dart \u2014 slender, sharp' },
    { value: 'needle',   label: 'needle \u2014 edges in twice' },
    { value: 'jet',      label: 'jet \u2014 dart with the wing tips up' },
    { value: 'simple',   label: 'simple \u2014 easy origami, broad delta' },
    { value: 'paperplane', label: 'paper plane \u2014 landscape, pleated nose, tips up' }
  ];

  /* the distance glider is folded on the sheet turned landscape */
  PK.PLANE_SHEET = {
    distance: { w: 11, h: 8.5 },              // letter, turned landscape
    paperplane: { w: 11, h: 8.5 }             // so is this one — step 1 is wider than tall
  };

  PK.createPlaneRig = function (o) {
    o = o || {};
    var sheet = (PK.PLANE_SHEET && PK.PLANE_SHEET[o.model]) || null;
    var W = o.width || (sheet ? sheet.w : 8.5);
    var H = o.height || (sheet ? sheet.h : 11);
    var hw = W / 2, hh = H / 2;
    var state = {
      model: o.model || 'classic',
      wingOffset: o.wingOffset != null ? o.wingOffset : 1.0,
      lockTab: o.lockTab != null ? o.lockTab : 0.6,
      wingAngle: o.wingAngle != null ? o.wingAngle : PK.rad(100),
      thickness: o.thickness != null ? o.thickness : 0.013,
      overlap: o.overlap != null ? o.overlap : 0.15,
      /* how far short of flush the fold-in-half stops, so the two halves sit
         apart the way a real one does instead of welded together */
      spread: o.spread != null ? o.spread : 0,
      /* a real fold does not press shut: the two halves sit a little apart,
         face to face. This is that distance, in inches — a translation along
         each panel's own normal, not a hinge. */
      gap: o.gap != null ? o.gap : 0,
      /* an extra phase after the last fold that tips the finished plane up
         onto its keel */
      /* A wing is creased flat against the body and only then opened out —
         folding it straight to its flying angle skips the crease the paper
         actually takes. This runs the wings to a full 180 and gives them a
         phase of their own to come back out. */
      openWings: o.openWings !== false,
      standUp: !!o.standUp,
      /* upright is tail-on and reads as a sliver from the front, so the stand
         also tips the plane back onto its planform. 0 is bolt upright. */
      standTilt: o.standTilt != null ? o.standTilt : PK.rad(50),
      ease: PK.EASING.easeInOut
    };

    var folds = foldSpec(state.model, hw, hh, state.wingOffset, state.lockTab);

    /* -------------------------------------------------- solve the topology */
    var regions = [{ poly: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]], T: M2.id(), folds: [] }];

    folds.forEach(function (f, fi) {
      var next = [];
      regions.forEach(function (r) {
        if (f.filter && !f.filter(r)) { next.push(r); return; }
        var fp = r.poly.map(function (p) { return M2.apply(r.T, p); });
        var moving = PK.clipHalfPlane(fp, f.P, f.n);
        var stat = PK.clipHalfPlane(fp, f.P, [-f.n[0], -f.n[1]]);
        var am = moving.length ? PK.polyArea(moving) : 0;
        var as = stat.length ? PK.polyArea(stat) : 0;
        if (am < 1e-4) { next.push(r); return; }
        if (as < 1e-4) { advance(r, f, fi); next.push(r); return; }
        var rm = { poly: moving.map(function (p) { return M2.invApply(r.T, p); }),
          T: r.T, folds: r.folds.slice(), movedByHalf: r.movedByHalf };
        var rs = { poly: stat.map(function (p) { return M2.invApply(r.T, p); }),
          T: r.T, folds: r.folds.slice(), movedByHalf: r.movedByHalf };
        advance(rm, f, fi);
        next.push(rs); next.push(rm);
      });
      regions = next;
    });
    function advance(r, f, fi) {
      r.folds.push(fi);
      if (f.isHalf) r.movedByHalf = true;
      if (!f.creaseOnly) r.T = M2.mul(f.R, r.T);
    }

    /* Neighbouring pieces meet along cuts the solver made, and where one
       piece's corner lands part-way along another's edge (a T-junction) the
       rasteriser can leave a hairline crack between them that the background
       shows through. Growing every piece's mesh outward by a hair closes it;
       the overlap is coplanar paper with the same picture on it, so it never
       shows. The crease logic still works on the exact polygons. */
    function inflatePoly(poly, d) {
      var n = poly.length, area = 0, out = [];
      for (var i = 0; i < n; i++) {
        var a = poly[i], b = poly[(i + 1) % n];
        area += a[0] * b[1] - b[0] * a[1];
      }
      var sgn = area > 0 ? 1 : -1;
      function outward(a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        return [sgn * dy / L, -sgn * dx / L];
      }
      for (var k = 0; k < n; k++) {
        var p0 = poly[(k + n - 1) % n], p1 = poly[k], p2 = poly[(k + 1) % n];
        var n1 = outward(p0, p1), n2 = outward(p1, p2);
        var mx = n1[0] + n2[0], my = n1[1] + n2[1], dotn = 1 + n1[0] * n2[0] + n1[1] * n2[1];
        var sc = dotn > 1e-6 ? d * 2 / dotn : 0;
        var len = Math.hypot(mx, my) * sc;
        if (len > 4 * d) sc *= 4 * d / len;              // a needle-sharp corner: cap the mitre
        out.push([p1[0] + mx * sc * 0.5, p1[1] + my * sc * 0.5]);
      }
      return out;
    }

    /* ------------------------------------------------------ build geometry */
    var root = new THREE.Group();
    var owned = [];
    var paperMat = o.paperMaterial || new THREE.MeshStandardMaterial({
      color: PK.COLORS.paper, roughness: 1, metalness: 0, flatShading: true,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1.4, polygonOffsetUnits: 1.4
    });
    var lineMat = o.lineMaterial || new THREE.LineBasicMaterial({
      color: PK.COLORS.ink, transparent: true, opacity: 0.92
    });

    regions.forEach(function (r) {
      var mg = PK.polyGeometry(o.seam ? inflatePoly(r.poly, o.seam) : r.poly);
      owned.push(mg);
      var mesh = new THREE.Mesh(mg, paperMat);
      r.mesh = mesh;
      r.det = M2.det(r.T) < 0 ? -1 : 1;
      r.halfSign = r.movedByHalf ? -1 : 1;      // which side of the spine it landed
      var node = mesh;
      r.nodes = [];
      r.folds.forEach(function (fi) {
        var g = new THREE.Group();
        g.matrixAutoUpdate = false;
        g.add(node);
        node = g;
        r.nodes.push({ g: g, fold: fi });
      });
      /* Opening the two halves has to happen OUTSIDE every fold, not by
         leaving the fold-in-half short. Each fold's hinge axis is written in
         the flat layout and is only correct if the folds before it landed
         flat; stopping the fold-in-half 20 degrees short tilts that half, so
         its wing then hinges about a line that is no longer on the paper and
         tears away from the body. As a final articulation it cannot do that. */
      var split = new THREE.Group();
      split.matrixAutoUpdate = false;
      split.add(node);
      r.splitGroup = split;
      root.add(split);
    });

    /* ---------------------------------------------------- stacking order
       Which piece sits on top of which. Counting a region's folds is a poor
       proxy: it fans pieces apart that are nowhere near each other, and it
       ties pieces that really are stacked, so they z-fight and the nose comes
       out as a jumble of slivers. The honest rule is the one the paper obeys —
       a piece folded later lands on top of whatever it covers — applied only
       between pieces that actually overlap. A region's height in the stack is
       therefore the number of overlapping regions that were folded before it,
       which leaves pieces sitting side by side properly coplanar.            */
    function signedArea2(poly) {
      var t = 0;
      for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length];
        t += a[0] * b[1] - b[0] * a[1];
      }
      return t / 2;
    }
    function overlapArea(a, b) {
      var out = a, ccw = signedArea2(b) > 0;
      for (var i = 0; i < b.length && out.length; i++) {
        var p = b[i], q = b[(i + 1) % b.length];
        var n = [-(q[1] - p[1]), q[0] - p[0]];
        if (!ccw) { n[0] = -n[0]; n[1] = -n[1]; }
        out = PK.clipHalfPlane(out, p, n);
      }
      return out.length >= 3 ? PK.polyArea(out) : 0;
    }
    (function assignLayers() {
      var placed = regions.map(function (r) {
        return r.poly.map(function (p) { return M2.apply(r.T, p); });
      });
      function last(r) { return r.folds.length ? r.folds[r.folds.length - 1] : -1; }
      function key(r) { return last(r) * 1000 + r.folds.length; }
      /* Height is the LONGEST CHAIN of pieces stacked under this one, not the
         count of them: a piece resting on six others that are all side by side
         is one layer up, not six. Walking in fold order means everything below
         is already settled when we get here. */
      var order = regions.map(function (r, i) { return i; })
        .sort(function (a, b) { return key(regions[a]) - key(regions[b]); });
      /* The solver's transform treats every fold as landing flat, including
         the wing folds — which do not: they open out to roughly square. So in
         the flat map the two wings sit on top of each other when in truth they
         are side by side, and stacking them fans them apart at the root. Two
         pieces carried by opposite wing folds are never stacked. */
      function wingOf(r) {
        for (var k = 0; k < r.folds.length; k++) {
          if (folds[r.folds[k]].isWing) return r.folds[k];
        }
        return -1;
      }
      order.forEach(function (i) {
        var r = regions[i], h = 0, wr = wingOf(r);
        for (var k = 0; k < order.length; k++) {
          var j = order[k];
          if (j === i) continue;
          var o = regions[j];
          if (key(o) >= key(r)) continue;                  // not underneath
          if (o.layer == null) continue;
          if (o.layer + 1 <= h) continue;                  // cannot raise us
          var wo = wingOf(o);
          if (wr >= 0 && wo >= 0 && wr !== wo) continue;   // opposite wings
          if (overlapArea(placed[i], placed[j]) > 1e-3) h = o.layer + 1;
        }
        r.layer = h;
      });
    })();

    var rigZTop = 0;
    /* The true stacking order. `layer` above treats every fold as landing on
       top, which is right for the folds that sweep up but not for the fold in
       half, which sweeps the second half under the first — so inside the fold
       it has the stack upside down. `zRank` replays the folds physically:
       each fold turns the paper it moves over (so that paper's own order
       reverses) and lays it above everything if it sweeps up, below
       everything if it sweeps down. Higher zRank is further along the folded
       layout's +z; a piece's layout +z in the scene is its front normal times
       `det`, so from any viewpoint the paper nearest the eye is the highest
       rank if that direction faces the viewer and the lowest if it does not. */
    (function () {
      var z = regions.map(function () { return 0; });
      folds.forEach(function (f, k) {
        if (f.creaseOnly) return;
        var mv = [];
        regions.forEach(function (r, i) { if (r.folds.indexOf(k) >= 0) mv.push(i); });
        if (!mv.length) return;
        var up = (f.axisV.x * f.n[1] - f.axisV.y * f.n[0]) > 0;   // swept through +z
        var all = z.slice(), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
        var mlo = Infinity, mhi = -Infinity;
        mv.forEach(function (i) { mlo = Math.min(mlo, z[i]); mhi = Math.max(mhi, z[i]); });
        mv.forEach(function (i) {
          z[i] = up ? hi + 1 + (mhi - z[i]) : lo - 1 - (z[i] - mlo);
        });
      });
      /* dense: 0, 1, 2 … in stacking order, so depth bias built on it stays
         small however many folds went into it */
      var distinct = z.slice().sort(function (a, b) { return a - b; })
        .filter(function (v, i, a) { return i === 0 || v !== a[i - 1]; });
      regions.forEach(function (r, i) { r.zRank = distinct.indexOf(z[i]); });
      rigZTop = distinct.length - 1;
    })();

    /* The same physical replay, kept for every point in the recipe. While a
       sheet is part folded, only the folds made so far have stacked anything,
       and pieces that lie flat together are ordered by THAT stack — not the
       finished plane's. rankHistory[k] is the stack once folds 0..k-1 are in;
       rankHistory[folds.length] is the finished plane. */
    /* A piece's rank is its HEIGHT in the stack — the longest chain of
       overlapping pieces beneath it — not its place in one global order. Only
       paper that really overlaps needs telling apart, and keeping the numbers
       small keeps the depth nudge they become small, so it can't drag paper
       from behind through the paper in front where two surfaces meet at an
       angle (the spine, a wing root). Pieces carried by opposite wings never
       count as stacked: the wings stand apart, they do not lie on each other. */
    var rankHistory = (function () {
      var z = regions.map(function () { return 0; });
      var det = regions.map(function () { return 1; });
      var Ts = regions.map(function () { return M2.id(); });
      var wingOf = regions.map(function () { return -1; });
      var hist = [];
      function snap() {
        var placed = regions.map(function (r, i) {
          return r.poly.map(function (p) { return M2.apply(Ts[i], p); });
        });
        var order = regions.map(function (r, i) { return i; }).sort(function (a, b) { return z[a] - z[b]; });
        var h = regions.map(function () { return 0; });
        order.forEach(function (i, oi) {
          for (var oj = 0; oj < oi; oj++) {
            var j = order[oj];
            if (z[j] >= z[i] || h[j] + 1 <= h[i]) continue;
            if (wingOf[i] >= 0 && wingOf[j] >= 0 && wingOf[i] !== wingOf[j]) continue;
            if (overlapArea(placed[i], placed[j]) > 1e-3) h[i] = h[j] + 1;
          }
        });
        return { z: h, det: det.slice(), top: Math.max.apply(null, h) };
      }
      hist.push(snap());
      folds.forEach(function (f, k) {
        if (!f.creaseOnly) {
          var mv = [];
          regions.forEach(function (r, i) { if (r.folds.indexOf(k) >= 0) mv.push(i); });
          if (mv.length) {
            var up = (f.axisV.x * f.n[1] - f.axisV.y * f.n[0]) > 0;
            var lo = Math.min.apply(null, z), hi = Math.max.apply(null, z);
            var mlo = Infinity, mhi = -Infinity;
            mv.forEach(function (i) { mlo = Math.min(mlo, z[i]); mhi = Math.max(mhi, z[i]); });
            mv.forEach(function (i) {
              z[i] = up ? hi + 1 + (mhi - z[i]) : lo - 1 - (z[i] - mlo);
              det[i] = -det[i];
              Ts[i] = M2.mul(f.R, Ts[i]);
              if (f.isWing) wingOf[i] = k;
            });
          }
        }
        hist.push(snap());
      });
      return hist;
    })();
    /* each piece's rank for each of its faces, counted from that face's side:
       the face seen is the front when the piece's layout +z faces the viewer
       and it has not been turned over (det > 0), so the higher rank is nearer */
    function ranksAt(k) {
      var h = rankHistory[PK.clamp(k, 0, folds.length)];
      return regions.map(function (r, i) {
        var z = h.z[i], d = h.det[i];
        return { front: d > 0 ? z : h.top - z, back: d > 0 ? h.top - z : z };
      });
    }

    /* Stacked panels have to be told apart somehow, and shifting each one
       along its own normal is the obvious way — but two panels that share a
       crease get shifted by different amounts, so they stop meeting and the
       fold comes apart into slivers. Depth bias does the same job without
       moving anything: the geometry stays exactly connected at every crease
       and the renderer just decides which coplanar face wins. `thickness`
       remains for when you actually want to see the stack fanned out. */
    var layerMats = {};
    function materialForLayer(n) {
      if (!layerMats[n]) {
        var m = paperMat.clone();
        m.polygonOffset = true;
        m.polygonOffsetFactor = -1 - n * 0.6;
        m.polygonOffsetUnits = -1 - n * 0.6;
        layerMats[n] = m;
        owned.push({ dispose: function () { m.dispose(); } });
      }
      return layerMats[n];
    }
    regions.forEach(function (r) { r.mesh.material = materialForLayer(r.layer); });

    /* ------------------------------------------------- which edges are real
       Every region boundary is a cut in the solver, but most of them are not
       anything you could see: the two pieces either side stay coplanar until
       a fold actually separates them. So each boundary is sampled to find the
       region on the other side, and tagged with the folds the two pieces do
       NOT share. That tag is the condition for the edge existing: if none of
       those folds has opened yet, there is nothing there to draw. An edge with
       no region on the other side is the sheet's own outer edge, always real.  */
    function regionAt(x, y, skip) {
      for (var i = 0; i < regions.length; i++) {
        if (i === skip) continue;
        if (PK.pointInPoly([x, y], regions[i].poly)) return i;
      }
      return -1;
    }
    function signature(r, nb) {
      if (nb < 0) return 'outer';
      var A = r.folds, B = regions[nb].folds, diff = [];
      A.forEach(function (f) { if (B.indexOf(f) < 0) diff.push(f); });
      B.forEach(function (f) { if (A.indexOf(f) < 0) diff.push(f); });
      if (!diff.length) return 'flat';            // same transform, never a visible edge
      diff.sort(function (a, b) { return a - b; });
      return diff.join(',');
    }

    var OFF = 0.012;
    regions.forEach(function (r, ri) {
      var groups = {};
      function emit(sig, a, b, t0, t1) {
        if (t1 - t0 < 1e-6) return;
        (groups[sig] = groups[sig] || []).push(
          a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, 0,
          a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, 0);
      }
      for (var e = 0; e < r.poly.length; e++) {
        var a = r.poly[e], b = r.poly[(e + 1) % r.poly.length];
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        var nx = -dy / L, ny = dx / L;
        var n = PK.clamp(Math.ceil(L / 0.1), 2, 200);
        var prev = null, start = 0;
        for (var k = 0; k < n; k++) {
          var tm = (k + 0.5) / n;
          var mx = a[0] + dx * tm, my = a[1] + dy * tm;
          var px = mx + nx * OFF, py = my + ny * OFF;
          var out = PK.pointInPoly([px, py], r.poly)
            ? regionAt(mx - nx * OFF, my - ny * OFF, ri)
            : regionAt(px, py, ri);
          var sig = signature(r, out);
          if (prev === null) { prev = sig; start = 0; }
          else if (sig !== prev) { emit(prev, a, b, start, k / n); prev = sig; start = k / n; }
        }
        emit(prev, a, b, start, 1);
      }
      var mesh = r.mesh;
      r.edgeGroups = [];
      Object.keys(groups).forEach(function (sig) {
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(groups[sig], 3));
        owned.push(g);
        var line = new THREE.LineSegments(g, lineMat);
        mesh.add(line);
        r.edgeGroups.push({
          sig: sig, line: line,
          outer: sig === 'outer',
          folds: (sig === 'outer' || sig === 'flat') ? [] : sig.split(',').map(Number)
        });
      });
    });

    /* crease map: every region boundary drawn on the flat sheet */
    var gpos = [];
    regions.forEach(function (r) {
      for (var i = 0; i < r.poly.length; i++) {
        var a = r.poly[i], b = r.poly[(i + 1) % r.poly.length];
        gpos.push(a[0], a[1], 0.02, b[0], b[1], 0.02);
      }
    });
    var gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    owned.push(gg);
    var creaseGuides = new THREE.LineSegments(gg, new THREE.LineDashedMaterial({
      color: PK.COLORS.guide, dashSize: 0.3, gapSize: 0.22, transparent: true, opacity: 0.55
    }));
    creaseGuides.computeLineDistances();
    creaseGuides.userData.keepInEdges = true;
    root.add(creaseGuides);

    /* ------------------------------------------------------------ playback */
    var tmpA = new THREE.Matrix4(), tmpB = new THREE.Matrix4(), tmpC = new THREE.Matrix4();
    var angles = new Array(folds.length).fill(0);

    function openIndex() { return state.openWings ? folds.length : -1; }
    function standIndex() { return state.standUp ? folds.length + (state.openWings ? 1 : 0) : -1; }
    function phaseCount() {
      return folds.length + (state.openWings ? 1 : 0) + (state.standUp ? 1 : 0);
    }

    /* Which regions each fold actually moves. Two folds may only run at the
       same time if they move different paper: a crease is written in the flat
       layout and is only in the right place once the fold before it has landed,
       so overlapping two folds that touch the same piece hinges the second one
       about a line that has already moved, and the sheet tears. Folds on
       opposite halves are independent and can happily overlap. */
    var movers = folds.map(function () { return {}; });
    regions.forEach(function (r, ri) {
      r.folds.forEach(function (fi) { movers[fi][ri] = 1; });
    });
    function conflicts(a, b) {
      if (a >= folds.length || b >= folds.length) return true;   // the finishing phases
      for (var k in movers[a]) if (movers[b][k]) return true;
      return false;
    }

    function segments() {
      var k = phaseCount(), out = [];
      var gaps = [];                        // how far to advance after each phase
      for (var i = 0; i < k - 1; i++) {
        gaps.push(conflicts(i, i + 1) ? 1 : 1 - state.overlap);
      }
      var total = 1;
      gaps.forEach(function (g) { total += g; });
      var len = 1 / total, at = 0;
      for (var j = 0; j < k; j++) {
        out.push([at, len]);
        if (j < gaps.length) at += len * gaps[j];
      }
      return out;
    }

    function progressToU(t) {
      var segs = segments(), out = [];
      for (var i = 0; i < segs.length; i++) {
        out.push(PK.clamp((t - segs[i][0]) / segs[i][1], 0, 1));
      }
      return out;
    }

    function angleFor(i, us) {
      var f = folds[i], u = us[i] || 0;
      if (f.pingPong) {
        var s = u < 0.5 ? state.ease(u * 2) : state.ease(1 - (u - 0.5) * 2);
        return Math.PI * s;
      }
      if (f.isWing) {
        var target = state.wingAngle - state.spread * 0.5;
        var folded = state.ease(PK.clamp(u, 0, 1));
        if (!state.openWings) return target * folded;
        var oi = openIndex();
        var opened = state.ease(PK.clamp(us[oi] || 0, 0, 1));
        /* crease flat to pi, then unwind to the flying angle */
        return Math.PI * folded + (target - Math.PI) * opened;
      }
      /* The spine spread is a roll about the centre crease, and the wing
         creases are parallel to it, so opening the spine would carry the wings
         round with it and change the whole silhouette. Taking half the spread
         back out of each wing fold cancels that exactly: the spine opens and
         the wings stay put. */
      var max = f.maxAngle;
      return max * state.ease(PK.clamp(u, 0, 1));
    }

    var edgeMode = 'auto';
    var EDGE_OPEN = 0.02;                     // radians — below this it is still flat

    /* Standing up: a cyclic basis swap that takes the sheet's own axes onto
       world ones — the keel (local x) points down, the wings (local z) spread
       across the screen, and the length (local y) runs away from the viewer,
       so you end up looking at the finished plane tail-on, sitting on its keel.
       The spine spread is folded in as a half-angle roll about the centre
       crease, which keeps the V symmetric instead of hanging off one half. */
    /* The keel runs from the wing crease (local x = -wingOffset) to the spine
       (local x = 0), and the wings hang off the crease end. Mapping local +x
       to world +y therefore put the crease — and the wings with it — at the
       BOTTOM of the keel, i.e. the plane upside down, body up and wings
       drooping. Local +x has to go to world -y, so the crease ends up at the
       top, the wings spread from there, and the keel hangs beneath them with
       the spine fold resting on the ground. The other two axes follow from
       keeping this a proper rotation: e3 = e1 x e2. */
    var STAND_BASE = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(1, 0, 0)));
    var WING_AXIS = new THREE.Vector3(1, 0, 0);
    var STAND_Q = new THREE.Quaternion();
    function standTarget() {
      return STAND_Q.setFromAxisAngle(WING_AXIS, state.standTilt).multiply(STAND_BASE);
    }
    var FLAT_Q = new THREE.Quaternion();
    var SPINE = new THREE.Vector3(0, 1, 0);
    var qSpread = new THREE.Quaternion(), qStand = new THREE.Quaternion();
    var halfIndex = -1;
    folds.forEach(function (f, i) { if (f.isHalf) halfIndex = i; });

    function applyAngles(us, globalT) {
      for (var i = 0; i < folds.length; i++) angles[i] = angleFor(i, us);
      /* crease memory: paper that has been folded never lies quite flat again.
         Each crease keeps a few degrees in the direction it was folded, so the
         panels of an opened sheet catch the light slightly differently. */
      if (state.memory) {
        for (var mi = 0; mi < folds.length; mi++) {
          var mf = folds[mi];
          if (mf.pingPong) continue;
          angles[mi] += state.memory * (mf.isWing ? 1 : Math.sign(mf.maxAngle || 0));
        }
      }

      var uHalf = halfIndex >= 0 ? state.ease(PK.clamp(us[halfIndex] || 0, 0, 1)) : 0;
      var uStand = state.standUp ? PK.clamp(us[standIndex()] || 0, 0, 1) : 0;
      qStand.copy(FLAT_Q).slerp(standTarget(), state.ease(uStand));
      root.quaternion.copy(qStand);
      /* hinge on the spine: zero at the fold, opening toward the wing crease */
      place(state.spread * 0.5 * uHalf, uHalf, globalT);
    }

    /* Put every piece where the current crease angles say. Each piece hangs
       from the chain of folds that moved it, every link a rotation about that
       fold's own crease line, so the sheet stays one connected surface: no
       piece is ever translated on its own. */
    var curHalf = 0;
    function place(halfAngle, uHalf, globalT) {
      curHalf = halfAngle;
      regions.forEach(function (r) {
        for (var g = 0; g < r.edgeGroups.length; g++) {
          var eg = r.edgeGroups[g], vis;
          if (edgeMode === 'none') vis = false;
          else if (edgeMode === 'all') vis = true;
          else if (edgeMode === 'outline') vis = eg.outer;
          else {
            vis = eg.outer;                   // auto
            for (var q = 0; q < eg.folds.length && !vis; q++) {
              if (Math.abs(angles[eg.folds[q]]) > EDGE_OPEN) vis = true;
            }
          }
          eg.line.visible = vis;
        }
        for (var j = 0; j < r.nodes.length; j++) {
          var nd = r.nodes[j], f = folds[nd.fold];
          tmpA.makeTranslation(f.pivotV.x, f.pivotV.y, 0);
          tmpB.makeRotationAxis(f.axisV, angles[nd.fold]);
          tmpC.makeTranslation(-f.pivotV.x, -f.pivotV.y, 0);
          nd.g.matrix.copy(tmpA).multiply(tmpB).multiply(tmpC);
          nd.g.matrixWorldNeedsUpdate = true;
        }
        /* world offset = layer stacking + half the gap, pushed the opposite
           way for each side of the spine so they part rather than shift. The
           gap arrives with the fold-in-half, since before that the halves are
           side by side and there is nothing to part. */
        r.splitGroup.matrix.makeRotationY(halfAngle * r.halfSign);
        r.splitGroup.matrixWorldNeedsUpdate = true;
        var lift = r.layer * state.thickness + r.halfSign * state.gap * 0.5 * uHalf;
        r.mesh.position.z = lift * r.det * (globalT != null ? globalT : 1);
        r.mesh.renderOrder = r.layer;
      });
      if (creaseGuides.visible) {
        creaseGuides.material.opacity = 0.55 * (1 - PK.clamp((globalT || 0) * 1.6, 0, 1)) + 0.03;
      }
    }

    /* ---- the crease pattern, for printing as a folding guide ---------------
       Every boundary between two pieces that a fold actually separates, on the
       flat sheet, each tagged with the step that makes it and whether it is a
       valley or a mountain seen from the front of the sheet. A boundary is
       fold k's crease if it lies on k's line in the layout as it was when k was
       made; its sense follows from which way k swept and whether the paper
       there was face up at the time. The sheet's own edge comes back as
       'edge'. Cuts the solver made that no fold ever opens are left out. */
    function creasePattern() {
      var up = folds.map(function (f) { return (f.axisV.x * f.n[1] - f.axisV.y * f.n[0]) > 0; });
      function layoutBefore(r, k) {                // r's transform just before fold k
        var t = M2.id();
        r.folds.forEach(function (j) { if (j < k && !folds[j].creaseOnly) t = M2.mul(folds[j].R, t); });
        return t;
      }
      function onLine(f, p) {
        var d = [p[0] - f.P[0], p[1] - f.P[1]];
        return Math.abs(d[0] * f.n[0] + d[1] * f.n[1]) < 2e-3;
      }
      var segs = [], EPS = 0.012;
      regions.forEach(function (r, ri) {
        for (var e = 0; e < r.poly.length; e++) {
          var a = r.poly[e], b = r.poly[(e + 1) % r.poly.length];
          var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
          if (L < 1e-6) continue;
          var nx = -dy / L, ny = dx / L, n = PK.clamp(Math.ceil(L / 0.05), 2, 400);
          var prev = null, start = 0;
          for (var s2 = 0; s2 <= n; s2++) {
            var nb;
            if (s2 < n) {
              var tm = (s2 + 0.5) / n, mx = a[0] + dx * tm, my = a[1] + dy * tm;
              var inR = PK.pointInPoly([mx + nx * EPS, my + ny * EPS], r.poly);
              nb = regionAt(inR ? mx - nx * EPS : mx + nx * EPS, inR ? my - ny * EPS : my + ny * EPS, ri);
            }
            if (s2 === n || (prev !== null && nb !== prev)) {
              var t0 = start / n, t1 = s2 / n;
              /* each shared boundary once: from the lower-numbered piece */
              if (prev === -1 || prev > ri) {
                segs.push({ a: [a[0] + dx * t0, a[1] + dy * t0], b: [a[0] + dx * t1, a[1] + dy * t1],
                            r: ri, nb: prev });
              }
              start = s2;
            }
            prev = nb;
          }
        }
      });
      var out = [];
      segs.forEach(function (sg) {
        if (sg.nb === -1) { out.push({ a: sg.a, b: sg.b, kind: 'edge', fold: null }); return; }
        var A = regions[sg.r], B = regions[sg.nb], diff = [];
        A.folds.forEach(function (f) { if (B.folds.indexOf(f) < 0) diff.push(f); });
        B.folds.forEach(function (f) { if (A.folds.indexOf(f) < 0) diff.push(f); });
        if (!diff.length) return;                    // a cut no fold opens
        /* the latest fold whose line this is decides the final crease */
        var k = -1, creaseOnly = -1;
        diff.sort(function (x, y) { return y - x; }).forEach(function (j) {
          if (k >= 0) return;
          var still = A.folds.indexOf(j) < 0 ? A : B;    // the side j did not move
          var t = layoutBefore(still, j);
          var p = M2.apply(t, sg.a), q = M2.apply(t, sg.b);
          if (onLine(folds[j], p) && onLine(folds[j], q)) {
            if (folds[j].creaseOnly) { if (creaseOnly < 0) creaseOnly = j; }
            else k = j;
          }
        });
        if (k < 0 && creaseOnly < 0) return;
        var j2 = k >= 0 ? k : creaseOnly;
        var stillSide = A.folds.indexOf(j2) < 0 ? A : B;
        var faceUp = M2.det(layoutBefore(stillSide, j2)) > 0;
        var valley = up[j2] === faceUp;
        out.push({ a: sg.a, b: sg.b, fold: j2,
                   kind: k < 0 ? 'crease' : (valley ? 'valley' : 'mountain') });
      });
      /* join collinear touching pieces of the same crease into single lines */
      var merged = [];
      out.forEach(function (s3) {
        for (var i = 0; i < merged.length; i++) {
          var m = merged[i];
          if (m.kind !== s3.kind || m.fold !== s3.fold) continue;
          var d = [m.b[0] - m.a[0], m.b[1] - m.a[1]], L = Math.hypot(d[0], d[1]);
          var nn = [-d[1] / L, d[0] / L];
          function off(p) { return Math.abs((p[0] - m.a[0]) * nn[0] + (p[1] - m.a[1]) * nn[1]); }
          if (off(s3.a) > 1e-3 || off(s3.b) > 1e-3) continue;
          function tt(p) { return ((p[0] - m.a[0]) * d[0] + (p[1] - m.a[1]) * d[1]) / (L * L); }
          var ta = tt(s3.a), tb = tt(s3.b), lo = Math.min(ta, tb), hi = Math.max(ta, tb);
          if (hi < -1e-3 || lo > 1 + 1e-3) continue;   // collinear but not touching
          var n0 = Math.min(0, lo), n1 = Math.max(1, hi);
          m.b = [m.a[0] + d[0] * n1, m.a[1] + d[1] * n1];
          m.a = [m.a[0] + d[0] * n0, m.a[1] + d[1] * n0];
          return;
        }
        merged.push({ a: s3.a.slice(), b: s3.b.slice(), kind: s3.kind, fold: s3.fold });
      });
      return {
        w: hw * 2, h: hh * 2, segs: merged,
        steps: folds.map(function (f, i) { return { n: i + 1, name: f.name.replace(/^\d+ \u00b7 /, '') }; })
      };
    }

    /* ---- the recipe as data ----------------------------------------------
       One entry per step a person would make, in folding order. A step turns
       one crease, or a left/right pair made at the same moment, about the
       crease line (`creasePoint` + `creaseAxis`) to `angles` (radians, one
       per fold in `folds`). `usedWhen` says which way it plays:
         'both' — a real fold: made when folding, undone when unfolding;
         'fold' — only needed to fold: a pre-crease (fold and unfold to find
                  the centre). Unfolding skips it; the crease it leaves is
                  already in the paper.
       `duration` is a weight; a timeline shares its time out by it. */
    function foldSteps() {
      var fin = rig.finishedAngles().angles, steps = [];
      function base(name) { return name.replace(/^\d+\s*\u00b7\s*/, ''); }
      folds.forEach(function (f, i) {
        var b = base(f.name), side = /^(left|right)\s/.test(b), core = b.replace(/^(left|right)\s+/, '');
        var prev = steps[steps.length - 1];
        if (side && prev && prev.side && prev.core === core && prev.folds.length === 1 &&
            !conflicts(prev.folds[0], i)) {
          prev.folds.push(i); prev.angles.push(fin[i]);
          prev.name = core + ' (both sides)';
          return;
        }
        steps.push({
          name: b, core: core, side: side,
          folds: [i], angles: [fin[i]],
          creasePoint: f.pivotV.clone(), creaseAxis: f.axisV.clone(),
          peak: f.maxAngle,                       // a pre-crease goes to here and back
          duration: f.pingPong ? 1.2 : 1,
          usedWhen: (f.pingPong || f.creaseOnly) ? 'fold' : 'both',
          pingPong: !!f.pingPong, half: !!f.isHalf
        });
      });
      return steps;
    }

    var rig = {
      root: root,
      regions: regions,
      creasePattern: creasePattern,
      zTop: function () { return rigZTop; },
      folds: folds,
      creaseGuides: creaseGuides,
      materials: { paper: paperMat, line: lineMat },
      state: state,
      foldCount: folds.length,
      foldNames: folds.map(function (f, i) { return { value: String(i), label: f.name }; }),
      segments: segments,
      progressToU: progressToU,
      setProgress: function (t) { applyAngles(progressToU(t), t); },
      /* -- driving the creases directly (see PK.createFoldTimeline) -- */
      getAngles: function () { return angles.slice(); },
      getHalfAngle: function () { return curHalf; },
      /* set every crease angle at once; the root's orientation is left alone */
      setAngles: function (a, halfAngle) {
        for (var i = 0; i < folds.length; i++) angles[i] = a[i] || 0;
        var hMax = state.spread * 0.5;
        place(halfAngle || 0, hMax > 0 ? (halfAngle || 0) / hMax : 0, 1);
      },
      /* the crease angles of the finished plane, as setProgress(1) leaves it */
      finishedAngles: function () {
        var ones = [], n = phaseCount();
        for (var i = 0; i < n; i++) ones.push(1);
        return { angles: folds.map(function (f, k) { return angleFor(k, ones); }),
          half: halfIndex >= 0 ? state.spread * 0.5 : 0 };
      },
      foldSteps: foldSteps,
      ranksAt: ranksAt,
      /* radians of crease memory; applied on the next setProgress */
      setMemory: function (m) { state.memory = m || 0; },
      setFoldValues: function (us, t) { applyAngles(us, t); },
      /* one fold driven alone: everything before it closed, everything after open */
      setIsolated: function (index, u) {
        var us = [], n = phaseCount();
        for (var i = 0; i < n; i++) us.push(i < index ? 1 : (i === index ? u : 0));
        applyAngles(us, 1);
      },
      setWingAngle: function (a) { state.wingAngle = a; },
      setOverlap: function (v) { state.overlap = v; },
      setEase: function (fn) { state.ease = fn; },
      setThickness: function (v) { state.thickness = v; },
      setSpread: function (v) { state.spread = v; },
      setGap: function (v) { state.gap = v; },
      setStandUp: function (v) { state.standUp = !!v; },
      setOpenWings: function (v) { state.openWings = !!v; },
      setStandTilt: function (v) { state.standTilt = v; },
      phaseCount: phaseCount,
      phaseNames: function () {
        var out = folds.map(function (f, i) { return { value: String(i), label: f.name }; });
        for (var i = folds.length; i < phaseCount(); i++) {
          out.push({ value: String(i), label: rig.phaseName(i) });
        }
        return out;
      },
      phaseName: function (i) {
        if (i < folds.length) return folds[i].name;
        if (i === openIndex()) return (i + 1) + ' · open the wings out';
        if (i === standIndex()) return (i + 1) + ' · stand it up';
        return '';
      },
      setEdgeMode: function (m) { edgeMode = m; },
      edgeMode: function () { return edgeMode; },
      activeFold: function (t) {
        var us = progressToU(t), n = us.length;
        for (var i = n - 1; i >= 0; i--) if (us[i] > 0 && us[i] < 1) return i;
        for (var j = n - 1; j >= 0; j--) if (us[j] >= 1) return j;
        return 0;
      },
      /* bounding box of the paper itself, in rig-local coords, at the current
         pose — the crease map is excluded, so this measures the model */
      measure: function () {
        root.updateMatrixWorld(true);
        var inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        var box = new THREE.Box3(), v = new THREE.Vector3();
        regions.forEach(function (r) {
          var p = r.mesh.geometry.attributes.position;
          for (var i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).applyMatrix4(r.mesh.matrixWorld).applyMatrix4(inv);
            box.expandByPoint(v);
          }
        });
        return {
          min: box.min.clone(), max: box.max.clone(),
          size: box.getSize(new THREE.Vector3()),
          center: box.getCenter(new THREE.Vector3())
        };
      },
      area: function () {
        return regions.reduce(function (s, r) { return s + PK.polyArea(r.poly); }, 0);
      },
      dispose: function () {
        owned.forEach(function (g) { g.dispose(); });
        if (!o.paperMaterial) paperMat.dispose();
        if (!o.lineMaterial) lineMat.dispose();
        creaseGuides.material.dispose();
      }
    };
    rig.setProgress(0);
    return rig;
  };

  /* ==========================================================================
     One timeline for folding or unfolding a rig, driven by a single progress
     value 0..1.

       lead  | step | step | ... | step |  tail
     Every step gets its own slice of time, the slices never overlap, and each
     is clamped, so a crease can't overshoot or replay. Easing is per step.
     A crease only ever moves inside its own step, from the angle it held
     when the timeline was made (where the previous steps left it) to its end
     angle, so each step starts where the last one finished.

     mode 'unfold': steps in reverse, skipping fold-only ones; every crease
       goes from where it is now to flat.
     mode 'fold':   every step in order, pre-creases included; every crease
       goes from where it is now to the finished plane.

     opts: { mode, lead, steps, tail }  — seconds (at 1x) for the part before
     the steps, all the steps together, and the part after.
     apply(p) poses the rig and returns where in the timeline p is:
       { lead, steps, tail } each 0..1, `step` (the step playing), and
       `stack` — how many folds are physically in, for depth ordering.
     ======================================================================== */
  PK.createFoldTimeline = function (rig, opts) {
    var mode = opts.mode === 'fold' ? 'fold' : 'unfold';
    var ease = opts.ease || PK.EASING.easeInOut;
    var all = rig.foldSteps();
    var steps = mode === 'fold' ? all : all.slice().reverse().filter(function (s) { return s.usedWhen !== 'fold'; });
    var from = rig.getAngles(), fromHalf = rig.getHalfAngle();
    var fin = rig.finishedAngles();
    var lead = opts.lead || 0, tail = opts.tail || 0, body = opts.steps || 1;
    var total = lead + body + tail;
    var weight = steps.reduce(function (a, s) { return a + s.duration; }, 0) || 1;
    var at = lead / total;
    steps.forEach(function (s) {
      s.t0 = at; at += (body * s.duration / weight) / total; s.t1 = at;
    });
    var b0 = lead / total, b1 = (lead + body) / total;
    var out = rig.getAngles();

    function local(p, a, b) { return b > a ? PK.clamp((p - a) / (b - a), 0, 1) : (p >= b ? 1 : 0); }

    function apply(p) {
      p = PK.clamp(p, 0, 1);
      var half = fromHalf, playing = -1, stack;
      for (var i = 0; i < out.length; i++) out[i] = from[i];
      steps.forEach(function (s, si) {
        var u = local(p, s.t0, s.t1);
        if (u > 0 && u < 1) playing = si;
        var e = ease(u);
        s.folds.forEach(function (fi, k) {
          if (mode === 'unfold') out[fi] = from[fi] * (1 - e);
          else if (s.pingPong) {
            var pp = u < 0.5 ? ease(u * 2) : ease(2 - u * 2);
            out[fi] = from[fi] + (s.peak - from[fi]) * pp;
          } else out[fi] = from[fi] + (s.angles[k] - from[fi]) * e;
        });
        if (s.half) half = mode === 'unfold' ? fromHalf * (1 - e) : fromHalf + (fin.half - fromHalf) * e;
        s.u = u;
      });
      rig.setAngles(out, half);
      /* which folds are physically in: a step counts as in while its crease
         is more than half closed */
      if (mode === 'unfold') {
        stack = 0;
        for (var j = 0; j < steps.length; j++) {
          if (steps[j].u < 0.5) { stack = Math.max.apply(null, steps[j].folds) + 1; break; }
        }
      } else {
        stack = 0;
        steps.forEach(function (s) {
          var closed = s.pingPong ? (s.u > 0.25 && s.u < 0.75) : s.u >= 0.5;
          if (closed || (!s.pingPong && s.u >= 1)) stack = Math.max(stack, Math.max.apply(null, s.folds) + 1);
        });
      }
      return {
        lead: local(p, 0, b0), steps: local(p, b0, b1), tail: local(p, b1, 1),
        step: playing >= 0 ? steps[playing] : null, stack: stack
      };
    }
    return { steps: steps, duration: total, apply: apply };
  };

  /* kept so older calls still work */
  PK.createDartRig = function (o) {
    o = o || {};
    if (!o.model) o.model = 'dart';
    return PK.createPlaneRig(o);
  };
})(window);
