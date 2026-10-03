/* ============================================================================
   Questions, folded — a hanging garden of paper planes.

   Each plane is folded by the same engine as the reference tools
   (lib/paperkit.js, a copy of motion-reference/common.js): a flat sheet cut
   into pieces along its creases and turned about them, so a plane can unfold
   back to its sheet just by running its folds backwards. The front of every
   sheet is ruled campaign paper with a question and its answer on it; the
   back is one of the IEX gradients. Folded, a plane shows both — the way the
   printed ones do.

   One canvas, two scenes: the garden of hanging planes, and a stage for the
   plane you are reading, drawn over a dimmed garden. Depth comes from real
   perspective, from the air — far planes fade toward the sky behind them —
   and from fainter strings at the back; nothing is blurred.
   ========================================================================== */
(function () {
  'use strict';
  var PK = window.PaperKit, T = window.THREE;
  var QS = window.GARDEN_QUESTIONS || [];
  var GRADS = window.GARDEN_GRADIENTS || {};
  var GRAD_NAMES = Object.keys(GRADS);
  /* the question panel and the sky share one state (store.js); questions and
     their ids come from data.js, words from copy.js */
  var S = window.QF_STORE, D = window.QF_DATA, C = window.QF_COPY;
  var MODELS = PK.PLANE_MODELS.map(function (m) { return m.value; });

  /* ---------------------------------------------------------------- layout */
  /* a dense cluster: wider than it is tall, so there is somewhere to go both
     ways, and deep — planes hang in layers front to back and overlap */
  var N = 160, COLS = 16, ROWS = Math.ceil(N / COLS);
  var COL_W = 8, ROW_H = 7;                      // inches between hanging points
  /* Depth in planes, the way painters group it: a pale background, a crisp
     middle ground where most of the planes hang, a richer foreground, and a
     few very near planes — big, cropped by the frame, sweeping past fastest
     (z is inches toward the viewer) */
  var Z_FAR = -26, Z_NEAR = 38;
  var DEPTH = Z_NEAR - Z_FAR;
  function depthFor(i) {
    var u = rnd(i, 3), v = rnd(i, 15);
    if (u < 0.34) return -26 + v * 12;            // background   -26 .. -14
    if (u < 0.82) return -6 + v * 14;             // middle        -6 ..  +8
    if (u < 0.95) return 13 + v * 10;             // foreground   +13 .. +23
    return 30 + v * 8;                            // very near    +30 .. +38
  }
  var PLANE_SCALE = 1.4;                         // hung a little larger than the paper's true size
  /* the strings hang from well above the page: the view never scrolls high
     enough to see where they start */
  var CEIL_Y = 44;
  var PAPER = '#F1EFEA',          /* off-white stock, only a breath of warmth */
      INK = '#1F2328', RULE = '#638097';
  var RULE_PITCH = 0.28, LOW_PPI = 40, HIGH_PPI = 150;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* deterministic jitter, so the garden hangs the same way every visit */
  function rnd(i, k) {
    var x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ------------------------------------------------------------- renderer */
  var canvas = document.getElementById('stage');
  var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  var ANISO = renderer.capabilities.getMaxAnisotropy();

  var wall = new T.Scene(), stage = new T.Scene();
  /* lit so a face turned to the light shows the paper's own colour and no
     brighter — #F1EFEA reads as off-white, not stark white — and faces turned away
     shade down from there */
  function light(scene) {
    /* soft, matte light, the way paper takes it: mostly sky and bounce, a
       gentle key, so faces turn from light to shade without snapping */
    var a = new T.HemisphereLight(0xfffdf9, 0xe7e4df, 0.8);
    var d = new T.DirectionalLight(0xfffaf4, 0.2); d.position.set(-0.5, 1, 0.8);
    var f = new T.DirectionalLight(0xe9eefc, 0.08); f.position.set(0.6, -0.4, -0.7);
    /* the planes are drawn a depth band at a time, and a light only reaches
       the layers it is on — so the lights are on all of them */
    [a, d, f].forEach(function (l) { l.layers.enableAll(); scene.add(l); });
  }
  light(wall); light(stage);

  /* near and far hug the scene (the nearest paper is ~40 away, the farthest
     ~120): the depth buffer's precision goes where the paper is, which is
     what lets stacked layers be told apart by a hair (RANK_STEP) */
  var camera = new T.PerspectiveCamera(30, 1, 10, 1000);
  var CAM_NEAR = { value: camera.near }, CAM_FAR = { value: camera.far };
  var CAM_Z = 88;
  var cam = { x: COL_W * 1.6, y: 0, tx: 0, ty: 0 };

  /* the dim between the wall and the plane you are reading */
  var dimScene = new T.Scene(), dimCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /* a warm, soft dim — a cold dark one turns the sheet into a hard cut-out */
  var dimMat = new T.MeshBasicMaterial({ color: 0x4a4038, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  dimScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), dimMat));

  function visibleHeight(dist) { return 2 * dist * Math.tan(T.MathUtils.degToRad(camera.fov / 2)); }
  function bounds() {
    var vh = visibleHeight(CAM_Z), vw = vh * camera.aspect;
    var minX = Math.min(vw * 0.35, (COLS - 1) * COL_W / 2), maxX = (COLS - 1) * COL_W + COL_W * 0.5 - vw * 0.35;
    /* the highest view keeps the top of the frame — at the farthest plane's
       depth, where it reaches highest — clear below the strings' tops */
    var farHalf = visibleHeight(CAM_Z - Z_FAR + 2) / 2;
    var maxY = CEIL_Y - 6 - farHalf, minY = -(ROWS - 1) * ROW_H - 6 + vh / 2 - 4;
    if (maxX < minX) maxX = minX = (COLS - 1) * COL_W / 2;
    if (minY > maxY) minY = maxY;
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }
  function clampTarget() {
    var b = bounds();
    cam.tx = Math.min(b.maxX, Math.max(b.minX, cam.tx));
    cam.ty = Math.min(b.maxY, Math.max(b.minY, cam.ty));
  }
  /* ------------------------------------------------------------ depth
     Aerial perspective: the farther back a plane hangs, the more of the air
     between you and it, so its colours wash toward the sky behind it at that
     height on the screen and lose a little saturation. Worked out per pixel
     from true distance, so it is continuous, and a plane in the reading pose
     (much nearer) is untouched. */
  var skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 1024;
  (function () {
    var c = skyCanvas.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 1024);
    [['#A8C4E6', 0], ['#B6CAE9', .1], ['#C4D0EB', .2], ['#D1D7EC', .3], ['#D9DAED', .35], ['#E3DADF', .45],
     ['#E7D9D3', .5], ['#EAD6C5', .55], ['#EED5B8', .6], ['#F1D2A9', .65], ['#F4D19C', .7], ['#F3C88C', .75],
     ['#EAB87C', .8], ['#E3A36A', .85], ['#DF8B58', .9], ['#DF744C', .95], ['#DF6645', 1]]
      .forEach(function (st) { g.addColorStop(st[1], st[0]); });
    c.fillStyle = g; c.fillRect(0, 0, 2, 1024);
  })();
  var HAZE = {
    skyMap: { value: new T.CanvasTexture(skyCanvas) },
    viewH: { value: 1 },
    hazeNear: { value: 0 }, hazeFar: { value: 1 },
    hazeAmount: { value: 0.66 },
    nearFrom: { value: 0 }, nearTo: { value: 1 },
    mist: { value: new T.Color('#D9DAED') },           // the cool, luminous colour of distance
    glow: { value: new T.Color('#FFF1DA') },           // the backlight that wraps turning faces
    ambience: { value: 1 }                             // 1 in the garden, 0 for the sheet being read
  };
  /* the same sky as the page, fixed to the screen — drawn as its own quad so
     the intro can bring it up from a paler, washed-out version */
  var skyWash = { value: 0.35 };
  var bgScene = new T.Scene(), bgCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    uniforms: { map: HAZE.skyMap, wash: skyWash }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader: 'uniform sampler2D map; uniform float wash; varying vec2 vUv;\n' +
      'void main() { vec3 c = texture2D( map, vUv ).rgb; gl_FragColor = vec4( mix( c, vec3( 0.965, 0.96, 0.955 ), wash ), 1.0 ); }'
  })));

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    HAZE.viewH.value = h * renderer.getPixelRatio();
    clampTarget();
  }
  window.addEventListener('resize', resize);
  /* the mist starts behind the middle ground and is thickest at the back;
     everything nearer than the middle is "near" for colour and contrast */
  HAZE.hazeNear.value = CAM_Z - 2;
  HAZE.hazeFar.value = CAM_Z - Z_FAR + 4;
  HAZE.nearFrom.value = CAM_Z - Z_NEAR;
  HAZE.nearTo.value = CAM_Z - 4;

  /* -------------------------------------------------------------- textures
     Every sheet is drawn in its own inches: x right, y up, centred on the
     sheet, the same coordinates the fold engine cuts the sheet in — so the
     pictures fold with the paper. */
  /* The surface of real stock, painted over the print: soft blotches where
     ink and paper took up colour unevenly (a few octaves of smooth noise,
     scaled up from tiny random canvases), and short pale and dark fibres.
     `seed` makes every sheet its own. */
  function paperSurface(c, W, H, ppi, seed, strength) {
    var s2 = seed * 9301 + 49297;
    function r() { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; }
    c.save();
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    [[4, 0.07], [9, 0.05], [20, 0.03]].forEach(function (oct) {
      var n = oct[0], m = Math.max(2, Math.round(n * H / W));
      var t = document.createElement('canvas'); t.width = n; t.height = m;
      var tc = t.getContext('2d'), id = tc.createImageData(n, m);
      for (var k = 0; k < n * m; k++) {
        var v = Math.round(r() * 255);
        id.data[k * 4] = id.data[k * 4 + 1] = id.data[k * 4 + 2] = v; id.data[k * 4 + 3] = 255;
      }
      tc.putImageData(id, 0, 0);
      c.globalCompositeOperation = 'overlay';
      c.globalAlpha = oct[1] * strength * 4;
      c.drawImage(t, 0, 0, W, H);
    });
    /* fibres */
    c.globalCompositeOperation = 'source-over';
    c.lineCap = 'round';
    var count = Math.round(W * H / (ppi * ppi) * 9 * strength);
    for (var i = 0; i < count; i++) {
      var x = r() * W, y = r() * H, L = (0.03 + r() * 0.09) * ppi, a = r() * Math.PI * 2;
      c.strokeStyle = r() < 0.55 ? 'rgba(255,255,255,0.22)' : 'rgba(60,50,40,0.14)';
      c.lineWidth = Math.max(0.5, 0.006 * ppi);
      c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * L * 0.4, y + Math.sin(a) * L * 0.5,
                         x + Math.cos(a) * L, y + Math.sin(a) * L);
      c.stroke();
    }
    c.restore();
  }
  /* A crease pressed into paper is not a line of ink, and it is not even:
     it comes and goes along its length, some folds were pressed harder than
     others, and mostly it shows as a soft change of light across the fold —
     a broad, faint shade on one side, a faint lift on the other — with a
     hairline only where it was pressed hardest. Drawn into the sheet's own
     picture, so it folds and unfolds with the paper. */
  function pressCreases(c, sheet, ppi, creases, strength) {
    if (!creases || !creases.length) return;
    function px(p) { return [(p[0] + sheet.w / 2) * ppi, (sheet.h / 2 - p[1]) * ppi]; }
    c.save();
    creases.forEach(function (sg, ci) {
      /* a little random generator of its own, seeded by where the crease is,
         so both sides of the sheet agree */
      var s2 = Math.abs(Math.round((sg.a[0] * 7.3 + sg.a[1] * 13.1 + sg.b[0] * 3.7 + sg.b[1] * 5.9) * 1000)) % 2147483646 + 1;
      function r() { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; }
      var a = px(sg.a), b = px(sg.b), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var tx = dx / L, ty = dy / L, nx = -ty, ny = tx;
      var sign = sg.kind === 'mountain' ? -1 : 1;           // which side catches the light
      var press = (0.35 + 0.65 * r()) * strength;           // how hard this fold was pressed
      var f1 = 0.6 + r() * 1.4, f2 = 2 + r() * 3, p1 = r() * 6.3, p2 = r() * 6.3;
      function along(t) {                                    // 0..1, comes and goes along the crease
        var inch = t * L / ppi;
        var v = 0.55 + 0.3 * Math.sin(inch * f1 + p1) + 0.2 * Math.sin(inch * f2 + p2);
        return Math.max(0, Math.min(1, v));
      }
      var step = 0.12 * ppi, n = Math.max(1, Math.ceil(L / step));
      var shadeW = (0.1 + 0.12 * r()) * ppi, liftW = shadeW * 0.7;
      for (var k = 0; k < n; k++) {
        var t0 = k / n, t1 = (k + 1) / n, v = along((t0 + t1) / 2) * press;
        if (v < 0.02) continue;
        var x0 = a[0] + dx * t0, y0 = a[1] + dy * t0, x1 = a[0] + dx * t1, y1 = a[1] + dy * t1;
        /* the shade side and the lit side, each a soft band fading away from the fold */
        [[-sign, shadeW, 'rgba(72,68,64,', 0.17], [sign, liftW, 'rgba(255,250,240,', 0.15]].forEach(function (sd) {
          var ox = nx * sd[0] * sd[1], oy = ny * sd[0] * sd[1];
          var g = c.createLinearGradient(x0, y0, x0 + ox, y0 + oy);
          g.addColorStop(0, sd[2] + (sd[3] * v) + ')');
          g.addColorStop(1, sd[2] + '0)');
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x1 + ox, y1 + oy); c.lineTo(x0 + ox, y0 + oy);
          c.closePath(); c.fill();
        });
        /* the fold itself, only where it was pressed hard */
        var hard = Math.max(0, v - 0.35) / 0.65;
        if (hard > 0) {
          c.strokeStyle = 'rgba(80,76,72,' + (0.26 * hard) + ')';
          c.lineWidth = Math.max(0.6, 0.006 * ppi);
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
      }
    });
    c.restore();
  }
  /* the cut edge of the stock: a faint, slightly uneven rim, so the sheet's
     silhouette is paper rather than a perfect vector cut */
  function cutEdge(c, W, H, ppi, seed) {
    /* the paper falls off a touch toward its own edges, as a real sheet does */
    var band = 0.35 * ppi;
    c.save();
    [[0, 0, band, 0], [W, 0, W - band, 0], [0, 0, 0, band], [0, H, 0, H - band]].forEach(function (e, i) {
      var g = c.createLinearGradient(e[0], e[1], e[2], e[3]);
      g.addColorStop(0, 'rgba(68,64,60,0.08)'); g.addColorStop(1, 'rgba(68,64,60,0)');
      c.fillStyle = g;
      if (i < 2) c.fillRect(Math.min(e[0], e[2]), 0, band, H); else c.fillRect(0, Math.min(e[1], e[3]), W, band);
    });
    c.restore();
    var s2 = seed * 7919 + 13;
    function r() { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; }
    var w = Math.max(1, 0.035 * ppi);
    c.save();
    c.strokeStyle = 'rgba(76,72,68,0.16)';
    c.lineWidth = w;
    c.shadowColor = 'rgba(76,72,68,0.22)'; c.shadowBlur = w;
    var steps = 40;
    [[0, 0, W, 0], [W, 0, W, H], [W, H, 0, H], [0, H, 0, 0]].forEach(function (e) {
      c.beginPath();
      for (var k = 0; k <= steps; k++) {
        var t = k / steps, j = (r() - 0.5) * w * 0.9;
        var x = e[0] + (e[2] - e[0]) * t + (e[1] === e[3] ? 0 : j), y = e[1] + (e[3] - e[1]) * t + (e[1] === e[3] ? j : 0);
        if (k) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    });
    c.restore();
  }
  /* every sheet a slightly different tone — no two pieces of stock match */
  function tone(base, seed) {
    var col = new T.Color(base), hsl = {};
    col.getHSL(hsl);
    var j = Math.sin(seed * 12.9898) * 43758.5453; j = j - Math.floor(j);
    var k = Math.sin(seed * 78.233) * 43758.5453; k = k - Math.floor(k);
    col.setHSL(hsl.h + (j - 0.5) * 0.02, hsl.s * (0.85 + k * 0.3), hsl.l + (k - 0.5) * 0.035);
    return '#' + col.getHexString();
  }
  function grain(c, W, H, amt, seed) {
    var img = c.getImageData(0, 0, W, H), d = img.data, s = seed || 1;
    for (var i = 0; i < d.length; i += 4) {
      s = (s * 16807) % 2147483647;
      var v = s / 2147483647;
      if (v > 0.5) {
        var a = (v - 0.5) * 2 * amt;
        d[i] = d[i] * (1 - a) + 31 * a; d[i + 1] = d[i + 1] * (1 - a) + 35 * a; d[i + 2] = d[i + 2] * (1 - a) + 40 * a;
      }
    }
    c.putImageData(img, 0, 0);
  }
  /* notebook ruling across the whole sheet: one line every RULE_PITCH inches
     from just over an inch down, the same on both faces */
  function rule(c, W, H, ppi, alpha) {
    var pitch = RULE_PITCH * ppi, top = 1.05 * ppi;
    c.save();
    c.strokeStyle = RULE; c.globalAlpha = alpha; c.lineWidth = Math.max(0.6, 0.008 * ppi);
    for (var y = top; y < H - 0.3 * ppi; y += pitch) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.restore();
  }
  function makeTexture(cv) {
    var t = new T.CanvasTexture(cv);
    t.anisotropy = ANISO;
    return t;
  }
  function backTexture(sheet, stops, ppi, seed, creases) {
    var W = Math.round(sheet.w * ppi), H = Math.round(sheet.h * ppi);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var g = c.createLinearGradient(0, 0, 0, H);         // stop 0 at the top of the sheet
    stops.forEach(function (st) { g.addColorStop(Math.min(1, Math.max(0, st.at)), st.c); });
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    /* the gradient is printed on ruled stock, so the ruling shows through it
       on this side too — same pitch and colour as the front, full width */
    rule(c, W, H, ppi, 0.5);
    paperSurface(c, W, H, ppi, seed, 1);
    pressCreases(c, sheet, ppi, creases, 0.8);
    cutEdge(c, W, H, ppi, seed);
    grain(c, W, H, 0.2, seed);
    return makeTexture(cv);
  }

  /* wrap text to a width, returning lines */
  function wrap(c, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && c.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  /* the type, set on the ruling; printed into the paper, so it is there
     from the first fold to the last */
  function setType(c, sheet, item, ppi) {
    var W = c.canvas.width, H = c.canvas.height, u = ppi;
    var pitch = RULE_PITCH * u, top = 1.05 * u;
    var m = 0.7 * u, maxW = W - 2 * m;
    c.fillStyle = INK;
    c.textBaseline = 'alphabetic';
    c.font = '500 ' + (0.13 * u) + 'px "Bitter", Georgia, serif';
    c.globalAlpha = 0.7;
    c.fillText('A QUESTION, FOLDED', m, top - 0.18 * u);
    c.globalAlpha = 1;
    /* question: two rulings per line */
    var qSize = (sheet.w > sheet.h ? 0.44 : 0.48) * u;
    c.font = '700 ' + qSize + 'px "Bitter", Georgia, serif';
    var qLines = wrap(c, item.q, maxW), line = 2;
    qLines.forEach(function (l) { c.fillText(l, m, top + line * pitch - 0.05 * u); line += 2; });
    /* answer: one ruling per line */
    line += 1;
    c.font = '400 ' + (0.185 * u) + 'px "Bitter", Georgia, serif';
    wrap(c, item.a, maxW).forEach(function (l) { c.fillText(l, m, top + line * pitch - 0.06 * u); line += 1; });
    /* the foot */
    c.font = '400 ' + (0.115 * u) + 'px "Bitter", Georgia, serif';
    c.globalAlpha = 0.75;
    c.fillText('IEX · Office for Institutional Equity and Title IX', m, H - 0.62 * u);
    c.fillText('institutionalequity@cmu.edu · (412) 268-7125', m, H - 0.42 * u);
    c.globalAlpha = 1;
  }
  function frontTexture(sheet, item, ppi, seed, creases) {
    var W = Math.round(sheet.w * ppi), H = Math.round(sheet.h * ppi);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.fillStyle = tone(PAPER, seed); c.fillRect(0, 0, W, H);
    rule(c, W, H, ppi, 0.55);
    setType(c, sheet, item, ppi);
    paperSurface(c, W, H, ppi, seed, 0.8);
    pressCreases(c, sheet, ppi, creases, 1);
    cutEdge(c, W, H, ppi, seed);
    grain(c, W, H, 0.12, seed);
    return makeTexture(cv);
  }

  /* --------------------------------------------------------------- material
     One paper material, two faces: gl_FrontFacing picks the printed front or
     the gradient back. Every plane shares the same shader program. */
  /* Which paper is on top where layers lie flat against each other depends
     on which side you look from, and a single depth bias cannot be right from
     both. So each face carries its own stacking rank — taken from the fold
     engine's physical order (`zRank`), counted from that face's side — and the
     shader nudges its depth by it. The printed side and the gradient side then
     stay exactly where they belong, folded, unfolding, or flat. */
  function paperMaterial(front, back) {
    /* double-sided, with an explicit front (the cream, printed side) and back
       (the gradient), chosen per pixel by which face is towards the eye */
    var m = new T.MeshLambertMaterial({ map: front, side: T.DoubleSide, vertexColors: true, alphaToCoverage: true });
    m.userData.backMap = { value: back };
    /* how much the cut edge feathers: on for hanging planes and for the
       sheet once it lies flat; off while a sheet is folding, where flaps
       butt edge to edge and a feather would let the paper beneath show
       through as a bright line */
    m.userData.feather = { value: 1 };
    /* the sky as a live filter: how far this plane has receded (dim), how
       lifted it is (hi), and for a waiting plane how much of its colour has
       bled in (bleed: 0 plain cream, 1 its gradient) */
    m.userData.dim = { value: 0 };
    m.userData.haze = { value: 0 };          // focus pull: another plane is caught
    m.userData.occl = { value: 0 };          // in front of the caught plane: see through
    m.userData.glint = { value: -1 };        // a sheen running along the creases (-1: none)
    m.userData.creaseMap = { value: null };
    m.userData.fade = { value: 1 };          // overall opacity: the intro's arrival, and behind the title
    m.userData.bleed = { value: 1 };
    m.userData.creamMap = { value: back };
    m.onBeforeCompile = function (sh) {
      sh.uniforms.backMap = m.userData.backMap;
      sh.uniforms.feather = m.userData.feather;
      sh.uniforms.dimAmt = m.userData.dim;
      sh.uniforms.hazeAmt = m.userData.haze;
      sh.uniforms.occlAmt = m.userData.occl;
      sh.uniforms.glintPos = m.userData.glint;
      sh.uniforms.creaseMap = m.userData.creaseMap;
      sh.uniforms.fade = m.userData.fade;
      sh.uniforms.bleed = m.userData.bleed;
      sh.uniforms.creamMap = m.userData.creamMap;
      sh.uniforms.camNear = CAM_NEAR; sh.uniforms.camFar = CAM_FAR;
      for (var k in HAZE) sh.uniforms[k] = HAZE[k];        // shared: one update reaches every plane
      sh.vertexShader = 'attribute vec2 rank;\nvarying vec2 vRank;\nvarying vec3 vViewP;\n' +
        sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n  vViewP = - mvPosition.xyz;\n  vRank = rank;');
      sh.fragmentShader = 'uniform sampler2D backMap, creamMap, creaseMap;\nuniform float feather, camNear, camFar, dimAmt, hazeAmt, occlAmt, glintPos, bleed, fade;\nvarying vec2 vRank;\n#define RANK_STEP 0.0004\n' +
        'uniform sampler2D skyMap;\nuniform float viewH, hazeNear, hazeFar, hazeAmount, nearFrom, nearTo;\n' +
        'uniform vec3 mist, glow;\nuniform float ambience;\nvarying vec3 vViewP;\n' + sh.fragmentShader
        .replace('#include <map_fragment>',
          /* detail falls away with distance: far sheets are read at a coarser
             level of their own picture, so ruling, type and grain melt into
             plain colour while the silhouette stays sharp */
          '  float viewD = 1.0 / gl_FragCoord.w;\n' +
          '  float farT = smoothstep( hazeNear, hazeFar, viewD );\n' +
          /* a plane filtered out of view recedes: softer, as if through haze */
          '  float detailBias = farT * 3.0 + dimAmt * 2.5 + hazeAmt * 0.7;\n' +
          '#ifdef USE_MAP\n' +
          '  vec4 texelColor;\n' +
          '  if ( gl_FrontFacing ) texelColor = texture2D( map, vUv, detailBias );\n' +
          '  else {\n' +
          '    texelColor = texture2D( backMap, vUv, detailBias );\n' +
          '    if ( bleed < 0.999 ) texelColor = mix( texture2D( creamMap, vUv, detailBias ), texelColor, bleed );\n' +
          '  }\n' +
          '  diffuseColor *= texelColor;\n' +
          '#endif')
        .replace('#include <dithering_fragment>',
          '#include <dithering_fragment>\n' +
          '  vec3 col = gl_FragColor.rgb;\n' +
          /* paper is never quite flat: a slow, uneven ripple in how the light
             falls across each panel, and facets that don't snap from one
             tone to the next */
          '  vec2 q = vUv * vec2( 3.1, 2.3 );\n' +
          '  float rip = sin( q.x * 2.1 + sin( q.y * 1.7 ) * 1.3 ) * sin( q.y * 1.9 + sin( q.x * 1.3 + 0.7 ) * 1.1 );\n' +
          '  col *= 1.0 + 0.045 * rip * ( 1.0 - farT );\n' +
          '  col = mix( col, diffuseColor.rgb * 0.93, 0.14 );\n' +
          '  vec3 skyHere = texture2D( skyMap, vec2( 0.5, gl_FragCoord.y / viewH ) ).rgb;\n' +
          /* shadows take the colour of the world around them: the darker a
             face is than its own paper, the more it turns toward the sky */
          '  float la = max( dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ), 0.05 );\n' +
          '  float dark = clamp( 1.0 - dot( col, vec3( 0.299, 0.587, 0.114 ) ) / la, 0.0, 1.0 );\n' +
          '  col = mix( col, diffuseColor.rgb * skyHere * 0.86, dark * 0.55 * ambience );\n' +
          /* light wraps turning faces: seen edge-on, a face catches the
             backlight and glows a little */
          '  vec3 nF = normalize( cross( dFdx( vViewP ), dFdy( vViewP ) ) );\n' +
          '  float rim = pow( 1.0 - abs( dot( nF, normalize( vViewP ) ) ), 2.2 );\n' +
          '  col += glow * skyHere * rim * 0.26 * ambience;\n' +
          /* one light bathes everything */
          '  col = mix( col, col * skyHere * 1.16, 0.12 * ambience );\n' +
          /* form flattens with distance: far planes lose their light-and-shade
             and read as flat shapes in the paper's own colour */
          '  col = mix( col, diffuseColor.rgb * 0.97, farT * 0.75 );\n' +
          /* near planes keep the full range: a little more contrast, warmth
             and saturation than the middle ground */
          '  float nearT = 1.0 - smoothstep( nearFrom, nearTo, viewD );\n' +
          '  float l0 = dot( col, vec3( 0.299, 0.587, 0.114 ) );\n' +
          /* (only on the hanging planes; the sheet being read keeps the
             paper's own off-white) */
          '  col = mix( vec3( l0 ), col, 1.0 + 0.16 * nearT * ambience );\n' +
          '  col = ( col - 0.55 ) * ( 1.0 + 0.14 * nearT ) + 0.55;\n' +
          '  col *= vec3( 1.0 + 0.015 * nearT * ambience, 1.0, 1.0 - 0.015 * nearT * ambience );\n' +
          '  col *= 1.0 - 0.07 * smoothstep( 0.6, 1.0, nearT ) * ambience;\n' +
          /* the sheet being read sits in its own light, a little brighter,
             so it reads as off-white paper rather than grey */
          '  col *= mix( 1.08, 1.0, ambience );\n' +
          /* the air: values compress and colour washes toward the light of
             the sky behind, cooled and lifted a little toward the mist */
          '  float hz = pow( farT, 1.15 ) * hazeAmount;\n' +
          '  vec3 skyc = texture2D( skyMap, vec2( 0.5, gl_FragCoord.y / viewH ) ).rgb;\n' +
          '  vec3 air = mix( skyc, mist, 0.3 ) * 1.03;\n' +
          '  float l1 = dot( col, vec3( 0.299, 0.587, 0.114 ) );\n' +
          '  col = mix( mix( col, vec3( l1 ), hz * 0.45 ), air, hz );\n' +
          /* the printed finish: a touch less contrast and colour, as on a
             photographed page (only the paper; the sky stays as specified) */
          '  col = ( col - 0.5 ) * 0.94 + 0.5;\n' +
          '  col = mix( vec3( dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) ), col, 0.9 );\n' +
          /* focus pull: when another plane is caught, this one goes a little
             softer — about a tenth less colour and contrast, a breath of sky */
          '  float lhz = dot( col, vec3( 0.299, 0.587, 0.114 ) );\n' +
          '  col = mix( col, mix( vec3( lhz ), col, 0.9 ), hazeAmt );\n' +
          '  col = mix( col, ( col - 0.5 ) * 0.91 + 0.5 + ( skyHere - 0.5 ) * 0.03, hazeAmt );\n' +
          /* the crease glint: one slow warm sheen running nose to tail along
             the folds, like light catching creased paper */
          '  if ( glintPos > -0.5 ) {\n' +
          '    float cm = texture2D( creaseMap, vUv ).r;\n' +
          '    float band = exp( -pow( ( vUv.y - glintPos ) / 0.09, 2.0 ) );\n' +
          '    col += vec3( 1.0, 0.97, 0.9 ) * cm * band * 0.32;\n' +
          '  }\n' +
          /* filtered out: grey, and washed toward the sky behind */
          '  float ldim = dot( col, vec3( 0.299, 0.587, 0.114 ) );\n' +
          '  col = mix( col, mix( vec3( ldim ), skyHere * 1.02, 0.55 ), dimAmt * 0.8 );\n' +
          '  gl_FragColor.rgb = clamp( col, 0.0, 1.0 );\n' +
          /* a cut sheet is never a ruler-straight pixel step: the outermost
             pixel and a half of the paper fade out (through alpha-to-coverage,
             so nothing needs sorting), by an amount that wanders along the
             edge the way a guillotined edge does */
          '  vec2 ew = max( fwidth( vUv ), vec2( 1e-5 ) );\n' +
          '  vec2 ed = min( vUv, 1.0 - vUv ) / ew;\n' +
          '  float along = ed.x < ed.y ? vUv.y : vUv.x;\n' +
          '  float soft = 1.4 + 0.7 * sin( along * 61.0 + sin( along * 23.0 ) * 2.0 );\n' +
          '  gl_FragColor.a *= mix( 1.0, smoothstep( 0.0, soft, min( ed.x, ed.y ) ), feather );\n' +
          '  gl_FragColor.a *= ( 1.0 - 0.85 * dimAmt ) * ( 1.0 - 0.45 * occlAmt ) * fade;\n' +
          /* pieces lying flat on each other: the one higher in the stack (as
             seen from this face's side) is drawn as if a hair nearer —
             RANK_STEP world units along the line of sight per place in the
             stack. A fixed distance, whatever the angle: a slope-scaled
             offset grows huge on a panel seen nearly edge-on mid-fold and
             drags paper from behind in front of the paper facing you. */
          '  float rk = gl_FrontFacing ? vRank.x : vRank.y;\n' +
          '  float dv = 1.0 / gl_FragCoord.w;\n' +
          '  float dn = max( dv - rk * RANK_STEP, camNear );\n' +
          '  float k = camFar / ( camFar - camNear );\n' +
          '  gl_FragDepth = gl_FragCoord.z + k * camNear * ( 1.0 / dv - 1.0 / dn );');
    };
    m.customProgramCacheKey = function () { return 'paper-painterly-depth'; };
    return m;
  }
  /* Each piece's depth rank for each face, from the stack as it is with the
     first `k` folds in (the fold engine replays the folds physically). Only
     the plane being opened ever changes this, so it lives in an attribute. */
  function setRanks(p, k) {
    if (p.rankStack === k) return;
    p.rankStack = k;
    var rk = p.rig.ranksAt(k);
    p.rig.regions.forEach(function (r, i) {
      var a = r.mesh.geometry.attributes.rank;
      for (var v = 0; v < a.count; v++) a.setXY(v, rk[i].front, rk[i].back);
      a.needsUpdate = true;
    });
  }

  /* ----------------------------------------------------------------- planes */
  var planes = [], pickables = [];
  var creaseMat = new T.LineBasicMaterial({ color: 0x1f2328, transparent: true, opacity: 0.22 });

  /* every sheet's pieces get sheet-space uvs, a tone and a depth rank, and
     can be picked */
  function dressRig(p, rig, sheet, mat) {
    rig.root.remove(rig.creaseGuides);
    rig.setEdgeMode('none');
    rig.regions.forEach(function (r) {
      var g = r.mesh.geometry, pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
      for (var v = 0; v < pos.count; v++) {
        uv[v * 2] = pos.getX(v) / sheet.w + 0.5;
        uv[v * 2 + 1] = pos.getY(v) / sheet.h + 0.5;
      }
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
      g.setAttribute('rank', new T.Float32BufferAttribute(new Float32Array(pos.count * 2), 2));
      r.mesh.material = mat;
      r.mesh.userData.plane = p;
      pickables.push(r.mesh);
    });
    rig.setProgress(1);
    setRanks(p, rig.folds.length);                       // the finished plane's stack
    rig.root.updateMatrixWorld(true);
  }
  function newRig(model) {
    return PK.createPlaneRig({
      model: model, standUp: true, standTilt: 0, openWings: true,
      spread: PK.rad(14), thickness: 0, seam: 0.006,
      paperMaterial: new T.MeshLambertMaterial(), lineMaterial: creaseMat
    });
  }
  /* a thread: it thins out where it passes behind the title, so the words
     always read (TEXT_RECT is the title block, in device pixels) */
  var TEXT_RECT = { value: new T.Vector4(-1, -1, -1, -1) };
  function stringMaterial(opacity) {
    var m = new T.LineBasicMaterial({ color: 0x1f2328, transparent: true, opacity: opacity });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.textRect = TEXT_RECT;
      sh.fragmentShader = 'uniform vec4 textRect;\n' + sh.fragmentShader.replace('#include <premultiplied_alpha_fragment>',
        '  vec2 fq = gl_FragCoord.xy;\n' +
        '  float dq = max( max( textRect.x - fq.x, fq.x - textRect.z ), max( textRect.y - fq.y, fq.y - textRect.w ) );\n' +
        '  gl_FragColor.a *= 1.0 - 0.78 * ( 1.0 - smoothstep( 0.0, 36.0, dq ) );\n' +
        '#include <premultiplied_alpha_fragment>');
    };
    m.customProgramCacheKey = function () { return 'qf-thread'; };
    return m;
  }
  /* which way a folded plane's nose points (in its own frame), so it can fly
     nose-first */
  function noseOf(rig, sheet, c) {
    var nose = null, tip = [0, sheet.h / 2 - 0.05];
    rig.regions.forEach(function (r) {
      if (!nose && PK.pointInPoly(tip, r.poly)) nose = new T.Vector3(tip[0], tip[1], 0).applyMatrix4(r.mesh.matrixWorld);
    });
    var dir = (nose || new T.Vector3(0, 0, -1).add(c)).clone().sub(c); dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    return dir.normalize();
  }

  /* the filter, the catch (hover) and the colour-bleed, eased per plane */
  function fxInit(p) {
    p.fx = { dim: 0, dimT: 0, fwd: 0, fwdT: 0, at: 0,
             cat: 0, catT: 0, haze: 0, occl: 0, roll: 0, pitch: 0, glint: -1, caught: false };
    var waiting = typeof intro !== 'undefined' && intro.phase !== 'done';
    p.appear = waiting ? 0 : 1; p.threadA = waiting ? 0 : 1; p.cover = 0;
  }
  /* where a model's creases are, as a soft mask in sheet space, for the glint */
  var creaseMaps = {};
  function creaseMapFor(model, rig, sheet) {
    if (creaseMaps[model]) return creaseMaps[model];
    var W = 128, H = Math.round(W * sheet.h / sheet.w), ppi = W / sheet.w;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#fff'; c.lineWidth = 2.2; c.lineCap = 'round'; c.filter = 'blur(1.2px)';
    rig.creasePattern().segs.forEach(function (sg) {
      if (sg.kind === 'edge') return;
      c.beginPath();
      c.moveTo((sg.a[0] + sheet.w / 2) * ppi, (sheet.h / 2 - sg.a[1]) * ppi);
      c.lineTo((sg.b[0] + sheet.w / 2) * ppi, (sheet.h / 2 - sg.b[1]) * ppi);
      c.stroke();
    });
    return (creaseMaps[model] = new T.CanvasTexture(cv));
  }
  var byI = {};

  function buildPlane(i) {
    /* neighbours should differ: models and gradients are walked at strides */
    var row = Math.floor(i / COLS), col = i % COLS;
    var model = MODELS[(i * 3 + row) % MODELS.length];
    var gname = GRAD_NAMES[(i * 5 + row * 3) % GRAD_NAMES.length];
    var ANS = D.answered().slice(0, D.baseCount);
    var item = ANS.length ? ANS[i % ANS.length] : { id: 'a00', q: 'A question', a: 'An answer.' };
    var sheet = (PK.PLANE_SHEET && PK.PLANE_SHEET[model]) || { w: 8.5, h: 11 };

    var rig = newRig(model);
    var front = frontTexture(sheet, item, LOW_PPI, i + 7);
    var back = backTexture(sheet, GRADS[gname], LOW_PPI, i + 101);
    var mat = paperMaterial(front, back);
    var p = { i: i, model: model, gname: gname, item: item, qid: item.id, kind: 'answered', sheet: sheet, rig: rig,
              front: front, back: back, mats: [mat], hi: null };
    fxInit(p); byI[p.i] = p;
    dressRig(p, rig, sheet, mat);
    mat.userData.creaseMap.value = creaseMapFor(model, rig, sheet);
    var box = new T.Box3();
    rig.regions.forEach(function (r) { box.expandByObject(r.mesh); });
    var c = box.getCenter(new T.Vector3());
    /* tie the string to the paper itself, straight above the middle, so it
       balances — found by dropping a ray onto the folded plane */
    var attach = new T.Vector3(c.x, box.max.y, c.z);
    var drop = new T.Raycaster(new T.Vector3(c.x, box.max.y + 5, c.z), new T.Vector3(0, -1, 0));
    var hitTop = drop.intersectObjects(rig.regions.map(function (r) { return r.mesh; }), false)[0];
    if (!hitTop) {                                          // nothing straight above the middle:
      var best = null;                                      // use the highest point of the keel
      rig.regions.forEach(function (r) {
        var pa = r.mesh.geometry.attributes.position, v = new T.Vector3();
        for (var k = 0; k < pa.count; k++) {
          v.fromBufferAttribute(pa, k).applyMatrix4(r.mesh.matrixWorld);
          var d = Math.hypot(v.x - c.x, v.z - c.z);
          if (!best || d < best.d - 0.3 || (Math.abs(d - best.d) <= 0.3 && v.y > best.v.y)) best = { d: d, v: v.clone() };
        }
      });
      attach.copy(best.v);
    } else attach.copy(hitTop.point);

    var wrapG = new T.Group();
    wrapG.add(rig.root);
    wrapG.position.copy(attach).negate();
    p.centerLocal = c.clone().sub(attach);               // the plane's middle, in its tilt frame
    p.noseDir = noseOf(rig, sheet, c); p.noseAng = Math.atan2(p.noseDir.x, p.noseDir.z);
    var hang = new T.Group();
    /* the string hangs straight from `hang`; any tilt of the plane happens
       below it, about the point the string is tied to */
    var tilt = new T.Group();
    var x = col * COL_W + (row % 2) * COL_W * 0.5 + (rnd(i, 1) - 0.5) * 5;
    var y = -row * ROW_H + (rnd(i, 2) - 0.5) * 4;
    var z = depthFor(i);
    /* swing (where the string is tied, above the page) -> hang (at the plane,
       turns on its string) -> tilt (bank and pitch) -> the plane. The wind
       swings the whole string from its tie like a pendulum. */
    var swing = new T.Group();
    swing.position.set(x, CEIL_Y, z);
    hang.position.set(0, y - CEIL_Y, 0);
    tilt.scale.setScalar(PLANE_SCALE);                   // about the tie, so the string still meets the paper
    tilt.add(wrapG);
    hang.add(tilt);
    swing.add(hang);
    var sg = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, 0), new T.Vector3(0, y - CEIL_Y, 0)]);
    /* near strings crisp, far ones faint — the air thins them too */
    var nearness = (z - Z_FAR) / DEPTH;                // 0 farthest .. 1 nearest
    p.stringMat = stringMaterial(0.08 + 0.42 * nearness);
    p.stringOpacity = p.stringMat.opacity;
    swing.add(new T.Line(sg, p.stringMat));
    wall.add(swing);

    /* mostly side-on and three-quarter, a few nose-on, all swaying */
    p.yaw0 = (rnd(i, 4) < 0.5 ? 1 : -1) * Math.PI / 2 + (rnd(i, 5) - 0.5) * 1.9;
    /* hanging planes never sit level: a bank shows the wings (and the
       gradient under them), a little pitch puts the nose up or down */
    p.pitch = (rnd(i, 6) - 0.5) * 0.45;
    p.roll = (rnd(i, 10) < 0.5 ? -1 : 1) * (0.3 + rnd(i, 11) * 0.45);
    /* the physics: a damped pendulum from the tie (two small angles) and a
       torsion spring about the string (yaw), both pushed by the breeze */
    p.phase = rnd(i, 9) * Math.PI * 2;
    p.tw = 2 * Math.PI / (6 + rnd(i, 7) * 5);        // twist period 6-11 s
    p.ax = (rnd(i, 12) - 0.5) * 0.01; p.az = (rnd(i, 13) - 0.5) * 0.01;
    p.vx = 0; p.vz = 0;
    p.yaw = (rnd(i, 14) - 0.5) * 0.1; p.vy = 0;
    p.hang = hang; p.tilt = tilt; p.wrap = wrapG; p.swing = swing;
    p.x = x; p.y = y; p.z = z; p.hangY = y - CEIL_Y;
    p.len = CEIL_Y - y;                                  // string length: longer swings slower
    p.wrapLocal = { position: wrapG.position.clone(), quaternion: wrapG.quaternion.clone(), scale: wrapG.scale.clone() };
    p.size = box.getSize(new T.Vector3()).length() * PLANE_SCALE;
    planes.push(p);
    addListButton(p);
  }

  /* ---------------------------------------------------- waiting planes
     A question without an answer yet is a plain cream plane — lined paper,
     no gradient — and it isn't hung up: it flies, slowly, a loose holding
     pattern in the upper third of the sky. Its gradient is already printed
     on the back, under the cream, for the day it's answered and the colour
     bleeds in. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }
  function hrnd(h, k) { var x = Math.sin((h % 100000) * 0.0137 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
  function creamBack(sheet, ppi, seed, mine) {
    var W = Math.round(sheet.w * ppi), H = Math.round(sheet.h * ppi);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.fillStyle = tone(PAPER, seed); c.fillRect(0, 0, W, H);
    rule(c, W, H, ppi, 0.5);
    paperSurface(c, W, H, ppi, seed, 0.8);
    if (mine) pencilTicks(c, W, H, ppi);
    cutEdge(c, W, H, ppi, seed);
    grain(c, W, H, 0.12, seed);
    return makeTexture(cv);
  }
  /* the visitor's own plane carries a small pencil tick, drawn where the
     wings fall on the back of the sheet */
  function pencilTicks(c, W, H, ppi) {
    c.save();
    c.strokeStyle = 'rgba(48,52,58,0.72)'; c.lineWidth = Math.max(1.2, 0.03 * ppi);
    c.lineCap = 'round'; c.lineJoin = 'round';
    [[0.13, 0.5], [0.87, 0.5], [0.13, 0.72], [0.87, 0.72]].forEach(function (pt) {
      var x = pt[0] * W, y = pt[1] * H, u = 0.22 * ppi;
      c.beginPath(); c.moveTo(x - u, y); c.lineTo(x - u * 0.35, y + u * 0.6); c.lineTo(x + u * 0.9, y - u * 0.9); c.stroke();
    });
    c.restore();
  }
  function waitingItem(item) {
    return { q: item.q, a: item.a || C.waiting.title + '.' };
  }
  var flyers = [];
  function buildWaitingPlane(item) {
    var h = hash(item.id), n = flyers.length;
    var model = MODELS[h % MODELS.length];
    var gname = GRAD_NAMES[(h >>> 3) % GRAD_NAMES.length];
    var sheet = (PK.PLANE_SHEET && PK.PLANE_SHEET[model]) || { w: 8.5, h: 11 };
    var seed = (h % 997) + 3, mine = D.isMine(item.id);
    var rig = newRig(model);
    var front = frontTexture(sheet, waitingItem(item), LOW_PPI, seed);
    var back = backTexture(sheet, GRADS[gname], LOW_PPI, seed + 101);
    var cream = creamBack(sheet, LOW_PPI, seed + 51, mine);
    var mat = paperMaterial(front, back);
    mat.userData.creamMap.value = cream;
    mat.userData.bleed.value = 0;
    var p = { i: 1000 + n, model: model, gname: gname, item: waitingItem(item), qid: item.id, kind: 'waiting', flyer: true,
              mine: mine, sheet: sheet, rig: rig, front: front, back: back, cream: cream, mats: [mat], hi: null };
    fxInit(p); byI[p.i] = p;
    dressRig(p, rig, sheet, mat);
    mat.userData.creaseMap.value = creaseMapFor(model, rig, sheet);
    p.centerLocal = new T.Vector3();
    var box = new T.Box3();
    rig.regions.forEach(function (r) { box.expandByObject(r.mesh); });
    var c = box.getCenter(new T.Vector3());
    var dir = noseOf(rig, sheet, c);
    var wrapG = new T.Group(); wrapG.add(rig.root); wrapG.position.copy(c).negate();
    var tilt = new T.Group(); tilt.scale.setScalar(PLANE_SCALE); tilt.add(wrapG);
    var fly = new T.Group(); fly.add(tilt); wall.add(fly);
    /* a loose oval, slow, in the upper band of the sky, near where you start */
    var x0 = (bounds().minX + COL_W * 0.4) - 18 + hrnd(h, 1) * 64;
    p.path = {
      cx: x0, cy: 5 + hrnd(h, 2) * 6, cz: -2 + hrnd(h, 3) * 12,
      rx: 6 + hrnd(h, 4) * 5, rz: 3.5 + hrnd(h, 5) * 3,
      w: (hrnd(h, 6) < 0.5 ? 1 : -1) * 2 * Math.PI / (44 + hrnd(h, 7) * 26),
      ph: hrnd(h, 8) * Math.PI * 2, t: 0
    };
    p.noseDir = dir; p.noseAng = Math.atan2(dir.x, dir.z);
    p.tilt = tilt; p.wrap = wrapG; p.fly = fly; p.hang = fly;
    p.wrapLocal = { position: wrapG.position.clone(), quaternion: wrapG.quaternion.clone(), scale: wrapG.scale.clone() };
    p.size = box.getSize(new T.Vector3()).length() * PLANE_SCALE;
    p.x = p.path.cx; p.y = p.path.cy; p.z = p.path.cz;
    planes.push(p); flyers.push(p);
    placeFlyer(p, 0, 0);
    return p;
  }
  var qYaw = new T.Quaternion(), qBank = new T.Quaternion(), qPitch = new T.Quaternion(), Y_AXIS = new T.Vector3(0, 1, 0);
  function placeFlyer(p, dt, zoff, bob) {
    var P = p.path;
    P.t += dt;                                            // dt arrives already scaled by the plane's time scale
    var a = P.ph + P.w * P.t;
    var x = P.cx + P.rx * Math.cos(a), z = P.cz + P.rz * Math.sin(a);
    var y = P.cy + 0.6 * Math.sin(P.t * 0.31 + P.ph);
    var vx = -P.rx * Math.sin(a) * P.w, vz = P.rz * Math.cos(a) * P.w, vy = 0.6 * 0.31 * Math.cos(P.t * 0.31 + P.ph);
    p.fly.position.set(x, y + (bob || 0), z + (zoff || 0));
    qYaw.setFromAxisAngle(Y_AXIS, Math.atan2(vx, vz) - p.noseAng);
    qBank.setFromAxisAngle(p.noseDir, 0.22 * (P.w > 0 ? 1 : -1));
    var side = new T.Vector3().crossVectors(p.noseDir, Y_AXIS).normalize();
    qPitch.setFromAxisAngle(side, -Math.atan2(vy, Math.hypot(vx, vz)) * 0.6);
    p.fly.quaternion.copy(qYaw).multiply(qBank).multiply(qPitch);
    p.x = x; p.y = y; p.z = z;
  }

  /* --------------------------------------------------------- accessibility */
  var list = document.getElementById('list'), live = document.getElementById('live');
  function addListButton(p) {
    var b = document.createElement('button');
    b.textContent = 'Plane ' + (p.i + 1) + ': ' + p.item.q;
    p.listBtn = b;
    b.addEventListener('focus', function () { if (!openP) { focusPlane(p); setHover(p, 'keyboard'); } });
    b.addEventListener('blur', function () { if (hov.p === p && S.get().hoverSource === 'keyboard') setHover(null); });
    b.addEventListener('click', function () { S.set({ openId: p.qid, openHint: p }); });
    list.appendChild(b);
  }
  var ring = document.getElementById('ring'), focused = null;
  function focusPlane(p) {
    focused = p;
    cam.tx = p.x; cam.ty = p.y - 3; clampTarget();
  }

  /* ---------------------------------------------------------------- panning */
  var dragging = false, downAt = null, moved = 0, last = null;
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (openP || introBusy()) return;
    var k = (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1) *
            visibleHeight(CAM_Z) / window.innerHeight;
    var dx = e.deltaX, dy = e.deltaY;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }      // shift + wheel goes sideways
    cam.tx += dx * k; cam.ty -= dy * k;
    clampTarget();
  }, { passive: false });
  canvas.addEventListener('pointerdown', function (e) {
    mouse.kind = e.pointerType;
    downAt = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY }; moved = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    mouse.kind = e.pointerType;
    if (e.pointerType !== 'touch') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.fresh = true; mouse.inside = true; }
    if (!downAt || openP) return;
    var dx = e.clientX - last.x, dy = e.clientY - last.y;
    moved += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY };
    if (moved > 6) {
      dragging = true; canvas.classList.add('dragging');
      var k = visibleHeight(CAM_Z) / window.innerHeight;
      cam.tx -= dx * k; cam.ty += dy * k; clampTarget();
    }
  });
  canvas.addEventListener('pointerup', function (e) {
    var wasDrag = dragging;
    dragging = false; downAt = null; canvas.classList.remove('dragging');
    if (wasDrag) return;
    if (openP) { closePlane(); return; }
    var hit = pick(e.clientX, e.clientY);
    if (e.pointerType === 'touch') {
      /* no hover on touch: the first tap catches a plane, the second unfolds
         it, and a tap on empty sky lets go */
      if (hit && hit === hov.p) { setHover(null); activate(hit); }
      else if (hit) { setHover(hit, 'touch'); placeTag(e.clientX, e.clientY); }
      else { setHover(null); if (S.get().panelOpen) S.set({ panelOpen: false }); }
      return;
    }
    if (hit) { setHover(null); activate(hit); }
    else if (S.get().panelOpen) S.set({ panelOpen: false });     // the empty sky puts the panel away
  });
  canvas.addEventListener('pointerleave', function () {
    mouse.inside = false;
    if (hov.p && S.get().hoverSource === 'pointer') setHover(null);
  });
  function activate(p) {
    if (p.kind === 'answered') S.set({ openId: p.qid, openHint: p });
    else S.set({ panelOpen: true, mode: 'browse', view: 'waiting', locateId: p.qid });
  }
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openP) { e.preventDefault(); closePlane(); return; }
    /* typing in the question notebook, or browsing it: the garden stays put */
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, .notebook')) return;
    if (document.body.classList.contains('asking')) return;
    if (openP) {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
      return;
    }
    var vh = visibleHeight(CAM_Z), s = vh * 0.25;
    if (e.key === 'ArrowRight') cam.tx += s;
    else if (e.key === 'ArrowLeft') cam.tx -= s;
    else if (e.key === 'ArrowDown') cam.ty -= s;
    else if (e.key === 'ArrowUp') cam.ty += s;
    else return;
    e.preventDefault(); clampTarget();
  });

  /* ----------------------------------------------------------------- hover */
  var ray = new T.Raycaster(), ndc = new T.Vector2();
  var mouse = { x: -1, y: -1, fresh: false, inside: false, kind: 'mouse' };
  var peek = document.getElementById('peek');
  /* the frontmost plane actually under the point (the meshes, not boxes),
     skipping planes the panel has filtered out and the see-through ones
     standing in front of a caught plane */
  function pick(x, y) {
    if (introBusy()) return null;
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var hits = ray.intersectObjects(pickables, false);
    for (var i = 0; i < hits.length; i++) {
      var p = hits[i].object.userData.plane;
      if (p && p.state !== 'away' && !p.launching && p.fx.dimT < 0.5 && p.fx.occl < 0.5) return p;
    }
    return null;
  }

  /* ----------------------------------------------------------- the catch
     Hovering a plane makes it "catch" the cursor, like a paper plane
     catching a breeze: it slows (but drifts on), bobs, banks toward you,
     lifts a little nearer with a soft shadow behind it, and a sheen runs
     once along its creases; everything else goes very slightly soft, and
     anything standing in front of it turns see-through. One plane at a time.
     Four inputs share it — the pointer, a panel row, keyboard focus, a tap —
     and the store says which (hoverSource).

     For the pointer: a plane must hold the cursor ~80 ms before it catches
     (so a sweep across the sky doesn't set off a cascade); once caught it
     keeps the cursor while it's inside the plane's outline grown by 15%,
     plus 150 ms of grace; a plane passing in front only takes over if the
     cursor rests on it for the same 80 ms; and a plane drifting to the edge
     of the screen or under the panel lets go. */
  var hov = { p: null, cand: null, since: 0, lost: 0, lastPick: 0, blocked: null };
  var INTENT_MS = 80, GRACE_MS = 150;
  function setHover(p, source) {
    if (hov.p === p && (!p || S.get().hoverSource === source)) return;
    hov.p = p; hov.lost = 0;
    canvas.classList.toggle('over', !!p && source !== 'keyboard');
    var tagged = p && (source === 'pointer' || source === 'touch');
    if (tagged) {
      peek.textContent = p.kind === 'waiting' ? (D.isMine(p.qid) ? C.sky.yours : C.sky.waiting)
        : source === 'touch' ? C.sky.tap : C.sky.unfold;
    }
    peek.classList.toggle('on', !!tagged);
    var src = S.get().hoverSource;
    if (p || src === 'pointer' || src === 'touch' || src === 'keyboard') {
      S.set({ hoveredId: p ? p.qid : null, hoveredPlane: p ? p.i : null, hoverSource: p ? source : null });
    }
  }
  function placeTag(x, y) { peek.style.left = x + 'px'; peek.style.top = y + 'px'; }
  var _v = new T.Vector3();
  /* the plane's outline on screen, as a box (from its own vertices) */
  function outline(p) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, W = window.innerWidth, H = window.innerHeight;
    p.rig.regions.forEach(function (r) {
      var pos = r.mesh.geometry.attributes.position;
      for (var k = 0; k < pos.count; k++) {
        _v.fromBufferAttribute(pos, k).applyMatrix4(r.mesh.matrixWorld).project(camera);
        var x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    });
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function insideOutline(p, x, y, grow) {
    var b = outline(p), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    return Math.abs(x - cx) <= (b.x1 - b.x0) / 2 * grow && Math.abs(y - cy) <= (b.y1 - b.y0) / 2 * grow;
  }
  function slipping(p) {
    var d = disc(p), W = window.innerWidth, H = window.innerHeight, m = 24, r = S.get().panelOpen && S.get().panelRect;
    if (!d.front || d.x < m || d.x > W - m || d.y < m || d.y > H - m) return true;
    return !!(r && d.x > r.left && d.x < r.left + r.width && d.y > r.top && d.y < r.top + r.height);
  }
  function pointerHover(now) {
    if (introBusy() || openP || dragging || !mouse.inside || mouse.kind === 'touch') return;
    if (mouse.fresh || now - hov.lastPick > 100) {          // one pick per move (and now and then at rest)
      mouse.fresh = false; hov.lastPick = now;
      var c = pick(mouse.x, mouse.y);
      if (c !== hov.cand) { hov.cand = c; hov.since = now; if (c !== hov.blocked) hov.blocked = null; }
    }
    var src = S.get().hoverSource;
    if (src === 'panel' || src === 'keyboard') return;    // the panel or the keyboard has it
    var cur = hov.p;
    if (hov.cand && hov.cand !== cur && hov.cand !== hov.blocked && now - hov.since >= INTENT_MS) {
      setHover(hov.cand, 'pointer');
    } else if (cur) {
      if (hov.cand === cur || insideOutline(cur, mouse.x, mouse.y, 1.15)) hov.lost = 0;
      else if (!hov.lost) hov.lost = now;
      else if (now - hov.lost > GRACE_MS) setHover(null);
    }
    if (hov.p && slipping(hov.p)) { hov.blocked = hov.p; setHover(null); }
    if (hov.p) placeTag(mouse.x, mouse.y);
  }

  /* ------------------------------------------------------- open and close
     The plane leaves its string, comes to the middle of the screen facing
     you, and unfolds as it comes — its folds run backwards — until it is a
     flat sheet you can read. Closing runs the same thing the other way and
     hangs it back up. */
  var openP = null, anim = null;
  var reader = document.getElementById('reader');
  /* Timing, in seconds at 1x: the trip to and from the middle is a short move
     of its own; unfolding and refolding take as long as these say. Everything
     plays at SPEED (fixed; there is no control for it). */
  var TRAVEL_S = reduceMotion ? 0.4 : 1.8, UNFOLD_S = reduceMotion ? 0.6 : 7, REFOLD_S = reduceMotion ? 0.5 : 6;
  /* after the last fold: a beat to lie still while the cut edge softens; and
     on the way back, the edge firms up before the first fold */
  var ROTATE_UNTIL = 0.6;                       // share of the folds over which it turns to face you
  var SETTLE_S = reduceMotion ? 0.05 : 0.25, EDGE_S = reduceMotion ? 0.1 : 0.5, EDGE_OUT_S = reduceMotion ? 0.05 : 0.2;
  var speed = 1.4;
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth(a, b, t) { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); }

  var DIM = 0.42;
  /* Crease memory. Paper that has been folded never lies flat again: every
     crease keeps a few degrees of the way it went, so the panels of an opened
     sheet each catch the light a little differently. Bending the geometry by
     that much tears a crease pattern apart (nested creases cannot all keep
     the same angle), so the tilt is worked out once — each panel's normal with
     the memory applied — and only its light is kept: a tone per panel. */
  var CREASE_MEMORY = 4 * Math.PI / 180;
  var TONE_LIGHT = new T.Vector3(-0.45, 0.6, 0.66).normalize();
  function panelNormal(rig, r, inv) {
    var g = r.mesh.geometry, pos = g.attributes.position, idx = g.index;
    var ia = idx ? idx.getX(0) : 0, ib = idx ? idx.getX(1) : 1, ic = idx ? idx.getX(2) : 2;
    var m = new T.Matrix4().multiplyMatrices(inv, r.mesh.matrixWorld);
    var a = new T.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(m);
    var b = new T.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(m);
    var c = new T.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(m);
    return b.sub(a).cross(c.sub(a)).normalize();
  }
  function computeTones(p) {
    var rig = p.rig, normals = [];
    function pass(mem) {
      rig.setMemory(mem); rig.setProgress(0);
      rig.root.updateMatrixWorld(true);
      var inv = new T.Matrix4().copy(rig.root.matrixWorld).invert();
      return rig.regions.map(function (r) { return panelNormal(rig, r, inv); });
    }
    var flat = pass(0), kept = pass(CREASE_MEMORY);
    rig.setMemory(0); rig.setProgress(1);
    var n0 = flat[0].z < 0 ? -1 : 1;
    var d = kept.map(function (n, k) {
      var s = (flat[k].z < 0 ? -1 : 1) * n0;        // every panel judged from the same side
      return n.clone().multiplyScalar(s).dot(TONE_LIGHT);
    });
    /* centred on the paper's own colour, and never more than a whisper:
       the widest panel-to-panel step is about a tenth */
    var mean = d.reduce(function (a, b) { return a + b; }, 0) / d.length;
    var spread = d.reduce(function (a, b) { return Math.max(a, Math.abs(b - mean)); }, 1e-6);
    var k = Math.min(1.1, 0.05 / spread);
    p.tones = d.map(function (x) { return 1 + k * (x - mean); });
  }
  function setTones(p, amount) {
    if (!p.tones) return;
    p.rig.regions.forEach(function (r, k) {
      var col = r.mesh.geometry.attributes.color, t = 1 + (p.tones[k] - 1) * amount;
      for (var v = 0; v < col.count; v++) col.setXYZ(v, t, t, t * 0.995);
      col.needsUpdate = true;
    });
  }
  /* the sheet you are reading is a physical thing: as it opens out flat it
     settles a soft shadow onto the dimmed garden behind it */
  var shadowTex = (function () {
    var W = 256, H = 256, pad = 48;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.filter = 'blur(18px)';
    c.fillStyle = 'rgba(30,22,16,1)';
    c.fillRect(pad, pad, W - 2 * pad, H - 2 * pad);
    return new T.CanvasTexture(cv);
  })();
  var shadow = new T.Mesh(new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false }));
  shadow.renderOrder = -1;
  stage.add(shadow);
  function placeShadow(p, amount) {
    var pose = readingPose(p);
    /* the blurred rectangle's paper occupies the middle 62% of its texture */
    var k = pose.scale.x / 0.62;
    shadow.position.copy(pose.position);
    shadow.quaternion.copy(pose.quaternion);
    var right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    var up = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    var back = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    var sw = p.sheet.w * pose.scale.x, sh = p.sheet.h * pose.scale.x;
    shadow.position.addScaledVector(right, 0.018 * sw).addScaledVector(up, -0.03 * sh)
      .addScaledVector(back, 2);
    shadow.scale.set(p.sheet.w * k, p.sheet.h * k, 1);
    shadow.material.opacity = 0.38 * amount;
  }
  /* the part of the screen left for the sheet: all of it, less the panel
     (to the right on a desk, along the bottom on a phone) and a strip for
     the buttons */
  function availRect() {
    var W = window.innerWidth, H = window.innerHeight, st = S.get(), r = st.panelOpen && st.panelRect;
    var a = { x0: 0, y0: 0, x1: W, y1: H - 64 };
    if (r && r.side === 'right') a.x1 = Math.max(W * 0.38, r.left - 8);
    if (r && r.side === 'bottom') a.y1 = Math.max(H * 0.38, r.top - 64);
    return a;
  }
  function readingPose(p) {
    var Dd = 62, vh = visibleHeight(Dd), k = vh / window.innerHeight, a = availRect();
    var s = Math.min(0.86 * (a.y1 - a.y0) * k / p.sheet.h, 0.9 * (a.x1 - a.x0) * k / p.sheet.w);
    var pos = camera.position.clone().add(new T.Vector3(
      ((a.x0 + a.x1) / 2 - window.innerWidth / 2) * k, -((a.y0 + a.y1) / 2 - window.innerHeight / 2) * k, -Dd));
    return { position: pos, quaternion: camera.quaternion.clone(), scale: new T.Vector3(s, s, s) };
  }
  function hangingPose(p) {
    p.hang.updateMatrixWorld(true);
    var m = new T.Matrix4().compose(p.wrapLocal.position, p.wrapLocal.quaternion, p.wrapLocal.scale);
    m.premultiply(p.tilt.matrixWorld);
    var o = { position: new T.Vector3(), quaternion: new T.Quaternion(), scale: new T.Vector3() };
    m.decompose(o.position, o.quaternion, o.scale);
    return o;
  }

  /* ------------------------------------------------------------- opening
     One timeline per open or close (PK.createFoldTimeline), one progress
     value 0..1 driving all of it:

       open:   fly to the middle | undo the real folds, last first | settle,
               (the type is printed on the sheet throughout)
       close:  every fold in order, pre-creases too | fly home

     The paper is the fold engine's own connected sheet — each crease turns
     about its own line and nothing else moves a piece. The plane flies to
     the middle as it hung — no turning on the way, so it never stands up on
     its tail — and turns to the one reading orientation (cream side to the
     camera, upright) by a single shortest-path slerp while it unfolds. The
     fold engine's own "stand it up" turn is left where it is and accounted
     for, so the two never fight. */
  function anchorPose(p, hang, e, eRot, c) {
    /* the whole plane's orientation: hanging -> reading, by the short way */
    var R = readingPose(p), qS = p.qStand;
    var A = hang.quaternion.clone().multiply(qS);
    var q = new T.Quaternion().slerpQuaternions(A, R.quaternion, eRot);
    p.wrap.quaternion.copy(q).multiply(qS.clone().invert());
    var sc = hang.scale.x + (R.scale.x - hang.scale.x) * e;
    p.wrap.scale.setScalar(sc);
    /* the point that travels is the folded plane's middle, which becomes the
       sheet's middle as it opens; the wrap is placed so that point is on the
       path between where it hung and the middle of the screen */
    var from = p.cFolded.clone().applyQuaternion(qS).multiplyScalar(hang.scale.x)
      .applyQuaternion(hang.quaternion).add(hang.position);
    var P = from.lerp(R.position, e);
    var off = c.clone().applyQuaternion(qS).multiplyScalar(sc).applyQuaternion(p.wrap.quaternion);
    p.wrap.position.copy(P).sub(off);
  }

  function openPlane(p) {
    if (anim || openP) return;                           // one animation at a time
    openP = p; p.state = 'away';
    setHover(null);
    S.set({ openId: p.qid });
    peek.classList.remove('on'); ring.classList.remove('on');
    canvas.classList.remove('over');
    /* print the readable sheet now — the paper, its real creases and the
       type, which is on the sheet the whole way through */
    if (!p.crease) p.crease = p.rig.creasePattern().segs.filter(function (sg) { return sg.kind !== 'edge'; });
    p.hi = frontTexture(p.sheet, p.item, HIGH_PPI, p.i + 7, p.crease);
    p.hiBack = backTexture(p.sheet, GRADS[p.gname], HIGH_PPI, p.i + 101, p.crease);
    p.mats.forEach(function (m) {
      m.map = p.hi; m.userData.backMap.value = p.hiBack;
      m.userData.feather.value = 0;
    });
    if (!p.tones) computeTones(p);
    var hang = hangingPose(p);
    stage.attach(p.wrap);
    p.qStand = p.rig.root.quaternion.clone();
    p.cFolded = p.rig.measure().center;
    anim = {
      p: p, kind: 'open', progress: 0, hang: hang,
      tl: PK.createFoldTimeline(p.rig, { mode: 'unfold', lead: TRAVEL_S, steps: UNFOLD_S, tail: SETTLE_S + EDGE_S })
    };
    anchorPose(p, hang, 0, 0, p.cFolded);
    document.body.classList.add('reading');
    live.textContent = p.item.q + ' ' + p.item.a;
  }
  function closePlane(then) {
    if (!openP) return;
    if (anim) {                                          // still opening: close when it lands
      if (anim.kind === 'open') anim.closeAfter = then || true;
      return;
    }
    var p = openP;
    reader.classList.remove('on');
    anim = {
      p: p, kind: 'close', progress: 0, then: then,
      tl: PK.createFoldTimeline(p.rig, { mode: 'fold', lead: EDGE_OUT_S, steps: REFOLD_S, tail: TRAVEL_S })
    };
  }
  function step(d) {
    if (!openP || anim) return;
    var st = S.get();
    var ids = st.panelOpen && st.view === 'answered' && st.visibleIds.length ? st.visibleIds
      : D.answered().map(function (x) { return x.id; });
    var j = ids.indexOf(openP.qid);
    S.set({ openId: ids[(j + d + ids.length) % ids.length], openHint: null });
  }
  /* the plane to use for a question: the one clicked, or of its planes the
     one nearest the middle of the view */
  function planeFor(id, hint) {
    if (hint && hint.qid === id && hint.kind === 'answered') return hint;
    var best = null, bd = Infinity;
    planes.forEach(function (p) {
      if (p.qid !== id || p.launching) return;
      var d = Math.hypot(p.x - cam.x, p.y - (cam.y - 3)) - p.z * 0.4;
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }
  /* the store asks for a plane to be opened (a row, a plane, next/prev) or
     put away; one open at a time, so a new one waits for the last to fold */
  S.subscribe(function (st, prev, ch) {
    if (ch.hoverSource && st.hoverSource !== 'pointer' && st.hoverSource !== 'touch' && hov.p && st.hoveredPlane !== hov.p.i) {
      hov.p = null; canvas.classList.remove('over'); peek.classList.remove('on');
    }
    if (ch.openId) {
      var id = st.openId;
      if (id) {
        if (openP && openP.qid === id) return;
        var target = planeFor(id, st.openHint);
        if (!target || target.kind !== 'answered') return;
        if (anim && anim.kind === 'close') {
          var before = anim.then;
          anim.then = function () { if (before) before(); if (S.get().openId === id) openPlane(target); };
        } else if (openP) closePlane(function () { if (S.get().openId === id) openPlane(target); });
        else openPlane(target);
      } else if (openP) closePlane();
    }
    if (ch.panelOpen || ch.view || ch.mode || ch.query || ch.hoveredId || ch.hoveredPlane || ch.hoverSource || ch.suggestIds || ch.locateId || ch.dataVersion) {
      refreshTargets();
    }
    if (ch.locateId && st.locateId) findPlane(st.locateId);
  });
  document.getElementById('close').addEventListener('click', function () { closePlane(); });
  document.getElementById('next').addEventListener('click', function () { step(1); });
  document.getElementById('prev').addEventListener('click', function () { step(-1); });

  function runAnim(now) {
    if (!anim) return;
    var p = anim.p, m = p.mats[0];
    /* the progress only ever moves forward */
    var dt = Math.min(0.1, (now - (anim.last || now)) / 1000); anim.last = now;
    if (anim.hold == null) anim.progress = Math.min(1, anim.progress + dt * speed / anim.tl.duration);
    else anim.progress = anim.hold;
    var info = anim.info = anim.tl.apply(anim.progress);
    setRanks(p, info.stack);
    var opened = smooth(0, 1, info.steps);              // how far the sheet is through its folds
    if (anim.kind === 'open') {
      var travel = ease(info.lead);
      /* it turns to face you over the first folds, so the last ones open
         straight towards you */
      var turn = ease(smooth(0, ROTATE_UNTIL, info.steps));
      anchorPose(p, anim.hang, travel, turn, p.cFolded.clone().multiplyScalar(1 - opened));
      setTones(p, opened);
      placeShadow(p, smooth(0.6, 1, info.steps));
      dimMat.opacity = DIM * travel;
      m.userData.feather.value = smooth(0, 1, info.tail);
      if (anim.progress >= 1) {
        var after = anim.closeAfter;
        anim = null;
        reader.classList.add('on');
        if (after) closePlane(after === true ? undefined : after);
      }
    } else {
      m.userData.feather.value = info.tail > 0 ? smooth(0, 1, info.tail) : 1 - smooth(0, 1, info.lead);
      setTones(p, 1 - opened);
      placeShadow(p, 1 - smooth(0, 0.35, info.steps));
      var back = ease(info.tail);
      var unturn = ease(smooth(1 - ROTATE_UNTIL, 1, info.steps));
      anchorPose(p, hangingPose(p), 1 - back, 1 - unturn, p.cFolded.clone().multiplyScalar(opened));
      dimMat.opacity = DIM * (1 - back);
      if (anim.progress >= 1) {
        p.tilt.add(p.wrap);
        p.wrap.position.copy(p.wrapLocal.position);
        p.wrap.quaternion.copy(p.wrapLocal.quaternion);
        p.wrap.scale.copy(p.wrapLocal.scale);
        setTones(p, 0);
        p.rig.setProgress(1);
        setRanks(p, p.rig.folds.length);
        p.mats.forEach(function (mm) {
          mm.map = p.front; mm.userData.backMap.value = p.back;
          mm.userData.feather.value = 1;
        });
        ['hi', 'hiBack'].forEach(function (k) { if (p[k]) { p[k].dispose(); p[k] = null; } });
        p.state = null; openP = null;
        document.body.classList.remove('reading');
        reader.style.left = ''; reader.style.bottom = '';
        D.markRead(p.qid);
        var then = anim.then; anim = null; dimMat.opacity = 0;
        if (S.get().openId === p.qid) S.set({ openId: null, openHint: null });
        if (then) then();
      }
    }
  }

  var qLean = new T.Quaternion(), qPar = new T.Quaternion(), qAdj = new T.Quaternion(), eLean = new T.Euler();
  /* a caught plane lifts toward you, so it casts a soft shadow on the sky
     (and anything) behind it: separation by depth, not by brightness */
  var shadowList = [];
  var blobTex = (function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var c = cv.getContext('2d'), g = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(40,32,26,0.9)'); g.addColorStop(0.45, 'rgba(40,32,26,0.45)'); g.addColorStop(1, 'rgba(40,32,26,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(cv);
  })();
  var shadows = [0, 1, 2].map(function () {
    var m = new T.Mesh(new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; wall.add(m);
    return m;
  });
  function placeShadows() {
    shadowList.sort(function (a, b) { return b.fx.cat - a.fx.cat; });
    shadows.forEach(function (m, k) {
      var p = shadowList[k];
      if (!p) { m.visible = false; return; }
      var c = centreOf(p, m.position);
      c.x += p.size * 0.05; c.y -= p.size * 0.07; c.z -= 1.4;
      m.scale.set(p.size * 0.95, p.size * 0.7, 1);
      m.material.opacity = 0.26 * p.fx.cat * (1 - p.fx.dim);
      m.visible = true;
    });
  }

  /* =================================================================== intro
     "One, then many." The sky comes into focus, one plain cream plane is
     thrown in and uncovers the title in its slipstream, the words settle,
     then the others follow — far ones first, faster and faster, until the
     sky is full and you realise everyone has asked. The interface arrives
     last. One master clock (intro.t) drives all of it; every timing is in
     INTRO. Skip it with any click, key, scroll or drag (it catches up over
     0.4 s); a second visit in a session gets a 1.2 s version; reduced
     motion gets a plain crossfade. GARDEN.intro has scrub/replay/speed for
     tuning, and ?introSpeed=0.25 slows the whole thing. */
  var INTRO = {
    sky:      { dur: 0.8, wash: 0.35 },                 // the sky coming into focus
    threads:  { from: 0.1, spread: 0.6, dur: 0.45 },    // left to right
    dolly:    { amount: 0.03, dur: 5.0 },               // arriving, barely noticed
    throwIn:  { from: 0.8, dur: 1.8, depth: 12 },       // the first plane
    bloom:    { delay: 0.3, dur: 0.8 },                 // cream to colour, once it's cruising
    title:    { feather: 40, lead: 18, dotHold: 0.12, dotDur: 0.28 },
    subtitle: { from: 2.4, stagger: 0.14, dur: 0.5, rise: 6 },
    wave:     { from: 2.9, firstGap: 0.42, span: 1.75, dur: 0.95, durJitter: 0.15, startJitter: 0.08, farZ: -12 },
    wobble:   { deg: 10, decay: 0.42, period: 0.62, life: 1.6 },
    ui:       { notBefore: 4.6, lead: 0.8, stagger: 0.1, dur: 0.5, drop: 4, countDur: 0.6 },
    skip:     0.4,
    repeat:   { sky: 0.5, planes: [0.1, 0.75], title: 0.35, subtitle: 0.5, ui: 0.65, fade: 0.4, stagger: 0.15 },
    reduced:  { fade: 0.6, sky: 0, title: 0.3, subtitle: 0.6, planes: 0.9, ui: 1.2, stagger: 0.1 }
  };
  function bezierEase(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) {
        var u = 1 - t, cx = 3 * x1 * t * u * u + 3 * x2 * t * t * u + t * t * t - x;
        var dx = 3 * x1 * u * u + 6 * (x2 - x1) * t * u + 3 * (1 - x2) * t * t;
        if (Math.abs(dx) < 1e-6) break;
        t = Math.max(0, Math.min(1, t - cx / dx));
      }
      var v = 1 - t;
      return 3 * y1 * t * v * v + 3 * y2 * t * t * v + t * t * t;
    };
  }
  var EASE_PLANE = bezierEase(0.22, 1, 0.36, 1);       // fast entry, decelerating into cruise
  var EASE_TEXT = bezierEase(0.25, 0.1, 0.25, 1);      // a gentle ease-out
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seeded(i, k) { var x = Math.sin(i * 91.7 + k * 12.3) * 43758.5453; return x - Math.floor(x); }

  var intro = { phase: 'loading', kind: 'full', t: 0, dur: 1, skipRate: 0, speed: 1, paused: false,
                dolly: INTRO.dolly.amount, reveal: -1e9, dotAt: null, throwP: null, ready: 0, readySince: 0 };
  (function () {
    var m = /[?&]introSpeed=([\d.]+)/.exec(location.search);
    if (m) intro.speed = Math.max(0.05, parseFloat(m[1]) || 1);
  })();
  function introBusy() { return intro.phase !== 'done'; }

  var dom = {};
  function grabDom() {
    dom.mast = document.querySelector('.masthead');
    dom.h1 = dom.mast && dom.mast.querySelector('h1');
    dom.dot = dom.h1 && dom.h1.querySelector('.qf-dot');
    dom.p = dom.mast && dom.mast.querySelector('p');
    dom.contact = document.querySelector('.contact');
    dom.hint = document.querySelector('.hint');
    dom.btns = Array.prototype.slice.call(document.querySelectorAll('.qdock button'));
    dom.count = document.querySelector('.qdock .count');
    /* the subtitle, a line per span, so it can settle line by line */
    if (dom.p && !dom.p.querySelector('.ln')) {
      var words = dom.p.textContent.trim().split(/\s+/), spans = [];
      dom.p.textContent = '';
      words.forEach(function (w, i) {
        var sp = document.createElement('span'); sp.textContent = w + (i < words.length - 1 ? ' ' : '');
        dom.p.appendChild(sp); spans.push(sp);
      });
      var lines = [], top = null;
      spans.forEach(function (sp) {
        if (top === null || Math.abs(sp.offsetTop - top) > 2) { lines.push([]); top = sp.offsetTop; }
        lines[lines.length - 1].push(sp.textContent);
      });
      dom.p.textContent = '';
      lines.forEach(function (ws) { var ln = document.createElement('span'); ln.className = 'ln'; ln.textContent = ws.join('').trim(); dom.p.appendChild(ln); });
    }
    dom.lines = dom.p ? Array.prototype.slice.call(dom.p.querySelectorAll('.ln')) : [];
  }

  /* where on screen a world point sits, and the world point at a screen spot
     and a depth */
  function toScreen(v) {
    var w = v.clone().project(camera);
    return { x: (w.x + 1) / 2 * window.innerWidth, y: (1 - w.y) / 2 * window.innerHeight, front: w.z < 1 };
  }
  function toWorld(sx, sy, z) {
    var d = camera.position.z - z, k = visibleHeight(d) / window.innerHeight;
    return new T.Vector3(camera.position.x + (sx - window.innerWidth / 2) * k, camera.position.y - (sy - window.innerHeight / 2) * k, z);
  }

  /* who comes in when, from where */
  function planIntro(kind) {
    intro.kind = kind;
    var W = window.innerWidth, H = window.innerHeight;
    /* plan with the camera where the intro starts it */
    camera.position.z = CAM_Z * (1 + (kind === 'full' ? INTRO.dolly.amount : 0));
    camera.updateMatrixWorld();
    wall.updateMatrixWorld(true);
    planes.forEach(function (p) {
      p.ent = null; p.appear = kind === 'full' ? 0 : 0; p.threadA = 0; p.cover = 0; p.introScale = 1;
      var c = centreOf(p), sp = toScreen(c);
      p.restScreen = sp;
      /* in view if any of it is (its disc, not just its middle), with a margin */
      var rr = disc(p).r * 1.1 + 24;
      p.introVisible = sp.front && sp.x + rr > 0 && sp.x - rr < W && sp.y + rr > 0 && sp.y - rr < H;
      p.threadAt = INTRO.threads.from + clamp01(sp.x / W) * INTRO.threads.spread;
    });
    if (kind !== 'full') { intro.dur = kind === 'repeat' ? 1.2 : INTRO.reduced.ui + INTRO.reduced.stagger + INTRO.reduced.fade + 0.05; return; }

    /* the first plane: a hanging one whose place is up and to the right of
       the title, carrying question #01 */
    var aim = { x: 0.5 * W, y: 0.32 * H }, best = null, bd = Infinity;
    planes.forEach(function (p) {
      if (p.flyer || !p.introVisible || p.kind !== 'answered') return;
      var sp = p.restScreen;
      if (sp.x < 0.3 * W || sp.x > 0.72 * W || sp.y < 0.15 * H || sp.y > 0.55 * H || p.z < -8 || p.z > 24) return;
      var d = Math.hypot(sp.x - aim.x, sp.y - aim.y);
      if (d < bd) { bd = d; best = p; }
    });
    if (!best) planes.forEach(function (p) { if (!best && !p.flyer && p.introVisible) best = p; });
    var first = D.answered()[0];
    if (best && first && best.qid !== first.id) swapQuestion(best, planes.filter(function (q) { return q.qid === first.id && !q.flyer; })[0]);
    intro.throwP = best;
    if (best) {
      var T0 = INTRO.throwIn.from, sp0 = best.restScreen, rest = centreOf(best);
      /* up the left side from below, cresting just under the title, then
         curving right onto its place */
      var pts = [[-0.07 * W, 1.1 * H], [0.0 * W, 0.06 * H], [0.2 * W, -0.08 * H]].map(function (q) {
        return toWorld(q[0], q[1], best.z).sub(rest);
      });
      best.ent = { mode: 'throw', t0: T0, dur: INTRO.throwIn.dur, p0: pts[0], p1: pts[1], p2: pts[2], depth: INTRO.throwIn.depth, wob: 1 };
      best.introCream = creamBack(best.sheet, LOW_PPI, best.i + 51, false);
      best.mats[0].userData.creamMap.value = best.introCream;
      best.mats[0].userData.bleed.value = 0;
    }

    /* the others: everything you can see, far to near, ever faster */
    var list = planes.filter(function (p) { return p.introVisible && p !== best; })
      .sort(function (a, b) { return a.z - b.z; });
    var n = list.length, g0 = INTRO.wave.firstGap, span = INTRO.wave.span;
    /* gaps shrink geometrically: g0, g0 r, g0 r², … adding up to the span */
    var lo = 0, hi = 0.999;
    for (var it = 0; it < 40; it++) {
      var r = (lo + hi) / 2, sum = n > 1 ? g0 * (1 - Math.pow(r, n - 1)) / (1 - r) : 0;
      if (sum > span) hi = r; else lo = r;
    }
    var rr = lo, at = INTRO.wave.from, last = T0 + INTRO.throwIn.dur;
    list.forEach(function (p, k) {
      if (k > 0) at += g0 * Math.pow(rr, k - 1);
      var t0 = Math.max(INTRO.wave.from, at + (seeded(p.i, 1) - 0.5) * 2 * INTRO.wave.startJitter);
      var dur = INTRO.wave.dur * (1 + (seeded(p.i, 2) - 0.5) * 2 * INTRO.wave.durJitter);
      var wob = seeded(p.i, 3) < 0.5 ? -1 : 1;
      if (p.z < INTRO.wave.farZ) {
        /* far ones come out of the haze */
        p.ent = { mode: 'haze', t0: t0, dur: dur * 1.15, wob: 0 };
      } else {
        /* the rest glide in from the nearest edge onto their place */
        var sp = p.restScreen, rest = centreOf(p), rad = disc(p).r;
        var dl = sp.x, dr = W - sp.x, db = H - sp.y, sx, sy;
        var slide = (seeded(p.i, 4) - 0.5) * 0.3;
        if (dl <= dr && dl <= db) { sx = -rad - 40; sy = sp.y + slide * dl + 0.15 * dl; }
        else if (dr <= db) { sx = W + rad + 40; sy = sp.y + slide * dr + 0.15 * dr; }
        else { sx = sp.x + (sp.x < W / 2 ? -1 : 1) * (0.45 + Math.abs(slide)) * db; sy = H + rad + 40; }   // diagonally, never straight up
        var start = toWorld(sx, sy, p.z).sub(rest);
        var ctrl = start.clone().multiplyScalar(0.45); ctrl.y += start.length() * 0.12;
        p.ent = { mode: 'edge', t0: t0, dur: dur, p0: start, p1: ctrl, wob: wob };
      }
      last = Math.max(last, p.ent.t0 + p.ent.dur);
    });
    intro.last = last;
    intro.uiFrom = Math.max(INTRO.ui.notBefore, last - INTRO.ui.lead);
    intro.dur = Math.max(last, intro.uiFrom + INTRO.ui.stagger + INTRO.ui.dur, INTRO.dolly.dur) + 0.05;
  }
  /* the first plane carries question #01, so the first thing you ever see is
     also the most natural first click */
  function swapQuestion(a, b) {
    if (!a || !b) return;
    var ia = a.item, ib = b.item, qa = a.qid, qb = b.qid;
    a.item = ib; a.qid = qb; b.item = ia; b.qid = qa;
    [a, b].forEach(function (p) {
      var old = p.front;
      p.front = frontTexture(p.sheet, p.item, LOW_PPI, p.i + 7);
      p.mats[0].map = p.front;
      old.dispose();
      if (p.listBtn) p.listBtn.textContent = 'Plane ' + (p.i + 1) + ': ' + p.item.q;
    });
  }

  var qFl = new T.Quaternion(), qFp = new T.Quaternion(), qRestTmp = new T.Quaternion(), qWob = new T.Quaternion();
  var vA = new T.Vector3(), vB = new T.Vector3(), vSide = new T.Vector3(), Z_AXIS = new T.Vector3(0, 0, 1);
  function bez(e, k, out) {
    var u = 1 - k;
    if (e.mode === 'throw') {                             // cubic, ending on its place
      return out.set(0, 0, 0).addScaledVector(e.p0, u * u * u).addScaledVector(e.p1, 3 * u * u * k).addScaledVector(e.p2, 3 * u * k * k);
    }
    return out.set(0, 0, 0).addScaledVector(e.p0, u * u).addScaledVector(e.p1, 2 * u * k);
  }
  /* one plane's arrival at intro time t */
  function arrive(p, t) {
    var e = p.ent;
    if (!e) { p.appear = intro.kind === 'full' || t >= 0 ? 1 : 0; return; }
    if (t < e.t0) { p.appear = 0; return; }
    var u = clamp01((t - e.t0) / e.dur), k = EASE_PLANE(u), tau = t - e.t0;
    var target = p.flyer ? p.fly : p.hang;
    if (e.mode === 'haze') {
      p.appear = EASE_TEXT(u);
      p.introScale = 0.6 + 0.4 * k;
      target.position.y -= 1.5 * (1 - k);
    } else {
      p.appear = clamp01(u * 5);
      var off = bez(e, k, vA);
      if (e.mode === 'throw') off.z += e.depth * (1 - k) * (1 - k);
      target.position.add(off);
      /* nose along the way it's moving, settling into its resting pose */
      /* which way it's heading (a step further along the curve, minus here) */
      var ahead = bez(e, Math.min(1, k + 0.02), vB).sub(off);
      if (e.mode === 'throw') ahead.z += e.depth * ((1 - Math.min(1, k + 0.02)) * (1 - Math.min(1, k + 0.02)) - (1 - k) * (1 - k));
      if (ahead.lengthSq() > 1e-10 && u < 1) {
        /* nose along the way it's moving (as the flying planes do), easing
           into its resting pose as it arrives */
        qFl.setFromAxisAngle(Y_AXIS, Math.atan2(ahead.x, ahead.z) - p.noseAng);
        var side = vSide.crossVectors(p.noseDir, Y_AXIS).normalize();
        var climb = Math.max(-0.45, Math.min(0.45, -Math.atan2(ahead.y, Math.hypot(ahead.x, ahead.z) + 1e-6) * 0.45));
        qFp.setFromAxisAngle(side, climb);
        qFl.multiply(qFp);
        if (!p.flyer) qFl.premultiply(qRestTmp.copy(p.swing.quaternion).invert());
        qRestTmp.copy(target.quaternion);
        target.quaternion.slerpQuaternions(qFl, qRestTmp, smooth(0.45, 1, k));
      }
    }
    /* a glide steadying after the throw: a damped roll */
    if (e.wob && tau < INTRO.wobble.life && !reduceMotion) {
      var a = e.wob * INTRO.wobble.deg * Math.PI / 180 * Math.exp(-tau / INTRO.wobble.decay) * Math.cos(2 * Math.PI * tau / INTRO.wobble.period);
      a *= 1 - smooth(intro.dur - 0.5, intro.dur, t);       // all settled by the handoff, so nothing jumps
      qWob.setFromAxisAngle(p.noseDir, a);
      p.tilt.quaternion.multiply(qWob);
    }
  }

  var textBox = null, measureTick = 0;
  window.addEventListener('resize', function () { measureTick = 0; intro.h1Left = null; });
  /* set a style only when it changes (writes are cheap; churn isn't) */
  function setStyle(el, prop, v) { if (el && el['_qf_' + prop] !== v) { el['_qf_' + prop] = v; el.style[prop] = v; } }
  function measureText() {
    if (!dom.mast) return;
    if (measureTick-- > 0) return;
    measureTick = 20;
    var a = dom.h1.getBoundingClientRect(), b = dom.p && dom.p.offsetParent ? dom.p.getBoundingClientRect() : a;
    textBox = { x0: Math.min(a.left, b.left) - 8, y0: a.top - 8, x1: Math.max(a.right, b.right) + 8, y1: Math.max(a.bottom, b.bottom) + 8 };
    var dpr = renderer.getPixelRatio(), H = window.innerHeight;
    TEXT_RECT.value.set(textBox.x0 * dpr, (H - textBox.y1) * dpr, textBox.x1 * dpr, (H - textBox.y0) * dpr);
  }

  /* per frame: the intro (while it runs), and always the planes behind the
     title thinning out so the words read */
  function introFrame(dt) {
    if (!dom.mast) grabDom();
    if (intro.phase === 'running' && !intro.paused) {
      var rate = Math.max(intro.speed, intro.skipRate);
      intro.t = Math.min(intro.dur, intro.t + dt * rate);
    }
    var t = intro.t, full = intro.kind === 'full', W = window.innerWidth;
    measureText();
    var coverK = 1 - Math.exp(-dt * 2 / 0.25), coverNow = (intro.frame = (intro.frame || 0) + 1) % 2 === 0;
    var running = intro.phase === 'running' || intro.phase === 'loading';
    planes.forEach(function (p) {
      if (intro.phase === 'loading') { p.appear = 0; p.threadA = 0; return; }
      p.introScale = 1;
      if (intro.phase === 'running') {
        if (full) arrive(p, t);
        else {
          var a0 = intro.kind === 'repeat' ? INTRO.repeat.planes[0] : INTRO.reduced.planes;
          var a1 = intro.kind === 'repeat' ? INTRO.repeat.planes[1] : INTRO.reduced.planes + INTRO.reduced.fade;
          p.appear = EASE_TEXT(clamp01((t - a0) / (a1 - a0)));
        }
        p.threadA = full ? EASE_TEXT(clamp01((t - p.threadAt) / INTRO.threads.dur)) : p.appear;
        if (p.introScale !== 1) p.tilt.scale.multiplyScalar(p.introScale);
      }
      /* behind the title: thin out (checked every other frame) */
      if (!coverNow) return;
      var cv = 0;
      if (textBox && p.state !== 'away' && !(intro.phase === 'running' && p === intro.throwP)) {
        var d = disc(p);
        if (d.front) {
          var nx = Math.max(textBox.x0, Math.min(d.x, textBox.x1)), ny = Math.max(textBox.y0, Math.min(d.y, textBox.y1));
          if (Math.hypot(d.x - nx, d.y - ny) < d.r * 0.55) cv = 1;
        }
      }
      p.cover += (cv - p.cover) * coverK;
    });
    if (intro.phase !== 'running') return;

    /* the sky, the threads (above), and the slow dolly */
    if (full) {
      skyWash.value = INTRO.sky.wash * (1 - EASE_TEXT(clamp01(t / INTRO.sky.dur)));
      intro.dolly = INTRO.dolly.amount * (1 - EASE_PLANE(clamp01(t / INTRO.dolly.dur)));
    } else {
      var skyDur = intro.kind === 'repeat' ? INTRO.repeat.sky : INTRO.reduced.fade;
      skyWash.value = INTRO.sky.wash * (1 - EASE_TEXT(clamp01(t / skyDur)));
      intro.dolly = 0;
    }

    /* the title */
    if (dom.h1) {
      if (full && intro.throwP) {
        setStyle(dom.h1, 'opacity', '1');
        if (intro.h1Left == null) {                         // measured once (it's fixed in place)
          intro.h1Left = dom.h1.getBoundingClientRect().left;
          intro.dotEnd = dom.dot.offsetLeft + dom.dot.offsetWidth;
        }
        var px = toScreen(centreOf(intro.throwP)).x;
        if (t >= intro.throwP.ent.t0) intro.reveal = Math.max(intro.reveal, px - intro.h1Left + INTRO.title.lead);
        if (t >= intro.throwP.ent.t0 + intro.throwP.ent.dur) intro.reveal = Math.max(intro.reveal, intro.reveal + dt * 900);
        var f = INTRO.title.feather, rv = Math.max(-2 * f, intro.reveal);
        var mask = 'linear-gradient(90deg, #000 ' + (rv - f) + 'px, transparent ' + rv + 'px)';
        setStyle(dom.h1, 'webkitMaskImage', mask); setStyle(dom.h1, 'maskImage', mask);
        /* the full stop lands last, after a breath */
        var dotEnd = intro.dotEnd;
        if (intro.dotAt === null && rv - f >= dotEnd) intro.dotAt = t + INTRO.title.dotHold;
        var dk = intro.dotAt === null ? 0 : EASE_TEXT(clamp01((t - intro.dotAt) / INTRO.title.dotDur));
        setStyle(dom.dot, 'opacity', dk.toFixed(3));
        setStyle(dom.dot, 'transform', 'translateY(' + (-3 * (1 - dk)).toFixed(2) + 'px)');
      } else {
        var ta = intro.kind === 'repeat' ? INTRO.repeat.title : INTRO.reduced.title, td = intro.kind === 'repeat' ? INTRO.repeat.fade : INTRO.reduced.fade;
        setStyle(dom.h1, 'opacity', EASE_TEXT(clamp01((t - ta) / td)).toFixed(3));
      }
    }
    /* the subtitle, line by line */
    dom.lines.forEach(function (ln, i) {
      var from, dur, rise;
      if (full) { from = INTRO.subtitle.from + i * INTRO.subtitle.stagger; dur = INTRO.subtitle.dur; rise = INTRO.subtitle.rise; }
      else if (intro.kind === 'repeat') { from = INTRO.repeat.subtitle; dur = INTRO.repeat.fade; rise = 0; }
      else { from = INTRO.reduced.subtitle; dur = INTRO.reduced.fade; rise = 0; }
      var k = EASE_TEXT(clamp01((t - from) / dur));
      setStyle(ln, 'opacity', k.toFixed(3));
      setStyle(ln, 'transform', rise ? 'translateY(' + (rise * (1 - k)).toFixed(2) + 'px)' : '');
    });
    if (dom.p) setStyle(dom.p, 'opacity', '0.72');
    /* the interface, last */
    var uiFrom = full ? intro.uiFrom : intro.kind === 'repeat' ? INTRO.repeat.ui : INTRO.reduced.ui;
    var uiDur = full ? INTRO.ui.dur : intro.kind === 'repeat' ? INTRO.repeat.fade : INTRO.reduced.fade;
    var uiStag = full ? INTRO.ui.stagger : intro.kind === 'repeat' ? INTRO.repeat.stagger : INTRO.reduced.stagger;
    if (!dom.btns.length) dom.btns = Array.prototype.slice.call(document.querySelectorAll('.qdock button'));
    var dock = document.querySelector('.qdock');
    setStyle(dock, 'opacity', '1');
    dom.btns.forEach(function (b, i) {
      var k = EASE_TEXT(clamp01((t - uiFrom - i * uiStag) / uiDur));
      setStyle(b, 'opacity', k.toFixed(3));
      setStyle(b, 'transform', full ? 'translateY(' + (-INTRO.ui.drop * (1 - k)).toFixed(2) + 'px)' : '');
    });
    setStyle(dom.contact, 'opacity', (0.7 * EASE_TEXT(clamp01((t - uiFrom) / uiDur))).toFixed(3));
    if (!dom.count) dom.count = document.querySelector('.qdock .count');
    if (dom.count) {
      var N = D.answered().length;
      if (full) {
        var c0 = intro.last - INTRO.ui.countDur;
        var cn = String(Math.round(N * EASE_TEXT(clamp01((t - c0) / INTRO.ui.countDur))));
        if (dom.count.textContent !== cn) dom.count.textContent = cn;
      } else if (dom.count.textContent !== String(N)) dom.count.textContent = String(N);
    }
    /* the first plane takes its colour, like ink soaking in */
    var tp = intro.throwP;
    if (full && tp && tp.introCream) {
      var b0 = tp.ent.t0 + tp.ent.dur + INTRO.bloom.delay;
      tp.mats[0].userData.bleed.value = EASE_TEXT(clamp01((t - b0) / INTRO.bloom.dur));
    }
    if (intro.t >= intro.dur) finishIntro();
  }

  function startIntro() {
    var kind = 'full';
    try { if (sessionStorage.getItem('qf-intro-seen')) kind = 'repeat'; } catch (e) {}
    if (reduceMotion) kind = 'reduced';
    grabDom();
    planIntro(kind);
    intro.t = 0; intro.skipRate = 0; intro.reveal = -1e9; intro.dotAt = null;
    intro.phase = 'running';
    try { sessionStorage.setItem('qf-intro-seen', '1'); } catch (e) {}
  }
  function skipIntro() {
    if (intro.phase !== 'running') return;
    intro.paused = false;
    intro.skipRate = Math.max(intro.speed, (intro.dur - intro.t) / INTRO.skip);
  }
  function finishIntro() {
    intro.phase = 'done'; intro.t = intro.dur; intro.dolly = 0; skyWash.value = 0;
    planes.forEach(function (p) { p.appear = 1; p.threadA = 1; p.ent = null; p.introScale = 1; });
    var tp = intro.throwP;
    if (tp && tp.introCream) {
      tp.mats[0].userData.bleed.value = 1; tp.mats[0].userData.creamMap.value = tp.back;
      tp.introCream.dispose(); tp.introCream = null;
    }
    document.body.classList.remove('intro');
    function clear(el) {
      if (!el) return;
      el.style.cssText = '';
      Object.keys(el).forEach(function (k) { if (k.indexOf('_qf_') === 0) delete el[k]; });
    }
    [dom.h1, dom.dot, dom.p, dom.contact, document.querySelector('.qdock')].concat(dom.lines, dom.btns).forEach(clear);
    if (dom.count) dom.count.textContent = String(D.answered().length);
    armHint();
  }
  /* the hint: only after two quiet seconds, and never again once you've
     scrolled, dragged or clicked */
  var hintState = { interacted: false, timer: null };
  function armHint() {
    if (hintState.interacted || !dom.hint) return;
    hintState.timer = setTimeout(function () { if (!hintState.interacted) dom.hint.classList.add('show'); }, 2000);
  }
  function interacted() {
    if (hintState.interacted) return;
    hintState.interacted = true;
    clearTimeout(hintState.timer);
    if (dom.hint) dom.hint.classList.remove('show');
  }
  /* any click, key, scroll or drag during the intro fast-forwards it (and
     does nothing else) */
  var swallowUp = false;
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (intro.phase === 'running') {
        skipIntro();
        if (type === 'pointerdown' || type === 'touchstart') swallowUp = true;
        if (type === 'wheel' || type === 'keydown') e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (intro.phase === 'done' && (type === 'pointerdown' || type === 'wheel') && e.target === canvas) interacted();
    }, { capture: true, passive: false });
  });
  window.addEventListener('pointerup', function (e) {
    if (swallowUp) { swallowUp = false; e.stopImmediatePropagation(); }
  }, true);
  S.subscribe(function (st) { if (st.openId || st.panelOpen) document.body.classList.add('oriented'); });

  /* -------------------------------------------------------- the live filter
     Whatever the panel shows is also what the sky shows. Planes that don't
     match recede — fade, grey, soften, drift back — but keep their places
     and their motion; the ones that match come a little forward. Each eases
     there over about 400 ms, starting a few ms after its neighbour to the
     left, so a change ripples across the sky rather than snapping. */
  var FX_TAU = 0.12, BLEED_S = 2.6;
  function centreOf(p, out) {
    return p.tilt.localToWorld((out || new T.Vector3()).copy(p.centerLocal));
  }
  function screenOf(p) {
    var v = centreOf(p).project(camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, front: v.z < 1 };
  }
  /* a plane on screen as a disc: centre, radius, and how far from the eye */
  function disc(p) {
    var w = centreOf(p, _v), dist = camera.position.distanceTo(w);
    w.project(camera);
    var H = window.innerHeight;
    return { x: (w.x + 1) / 2 * window.innerWidth, y: (1 - w.y) / 2 * H, front: w.z < 1, dist: dist,
             r: p.size * 0.5 * H / visibleHeight(dist) };
  }
  /* A question flies on several planes, but a highlight is always one plane:
     the one under the pointer, or for a row, a suggestion or a find, the copy
     nearest the middle of what you can see (one in view beats one that
     isn't). The dotted line, the pulse and the pan all use that same plane. */
  var repOf = {}, primaryP = null;
  function bestPlane(id) {
    var a = availRect(), cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2, best = null, bd = Infinity;
    planes.forEach(function (p) {
      if (p.qid !== id || p.state === 'away' || p.launching) return;
      var sp = screenOf(p);
      var on = sp.front && sp.x > a.x0 + 10 && sp.x < a.x1 - 10 && sp.y > a.y0 + 10 && sp.y < (a.y1 + 54);
      var d = Math.hypot(sp.x - cx, sp.y - cy) + (on ? 0 : 1e5);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }
  function refreshTargets() {
    var f = S.skyFilter(), st = S.get(), now = performance.now();
    var res = (f.view === 'all' && !f.query) ? null : D.match(f.view, f.query);
    var ids = res ? res.ids : null, sug = st.suggestIds || [];
    var lit = {};
    repOf = {}; primaryP = null;
    function mark(id) { var p = bestPlane(id); if (p) { repOf[id] = p; lit[p.i] = true; } return p; }
    var src = st.hoverSource;
    if (st.hoveredPlane != null && (src === 'pointer' || src === 'touch' || src === 'keyboard')) primaryP = byI[st.hoveredPlane] || null;
    else if (st.hoveredId) primaryP = mark(st.hoveredId);
    if (primaryP) lit[primaryP.i] = true;
    sug.forEach(mark);
    if (st.locateId) mark(st.locateId);
    planes.forEach(function (p) {
      var match = !ids || !!ids[p.qid];
      var dimT = match ? 0 : 1, fwdT = ids && match ? 1 : 0;
      if (dimT !== p.fx.dimT || fwdT !== p.fx.fwdT) {
        var x = screenOf(p).x / window.innerWidth;
        p.fx.at = reduceMotion ? 0 : now + Math.max(0, Math.min(1, x)) * 160;
      }
      p.fx.dimT = dimT; p.fx.fwdT = fwdT;
      p.fx.catT = lit[p.i] ? 1 : 0;
    });
  }
  /* bring a question's plane into view (the panel may cover part of it) and
     let it pulse for a moment */
  var locateTimer = null;
  function findPlane(id) {
    var p = repOf[id] || bestPlane(id);
    if (!p) return;
    var k = visibleHeight(CAM_Z - p.z) / window.innerHeight, a = availRect();
    cam.tx = p.x - ((a.x0 + a.x1) / 2 - window.innerWidth / 2) * k;
    cam.ty = p.y + ((a.y0 + a.y1) / 2 - window.innerHeight / 2) * k;
    clampTarget();
    clearTimeout(locateTimer);
    locateTimer = setTimeout(function () { if (S.get().locateId === id) S.set({ locateId: null }); }, 2800);
  }
  /* where a question's plane is on screen (the one nearest the middle of the
     free space), so the panel can draw a line to it */
  function locate(id) {
    var p = repOf[id] || bestPlane(id);
    if (!p) return null;
    var a = availRect(), sp = screenOf(p);
    if (!sp.front) return null;
    sp.on = sp.x > a.x0 + 10 && sp.x < a.x1 - 10 && sp.y > a.y0 + 10 && sp.y < (a.y1 + 54);
    return sp;
  }

  /* ----------------------------------------------------- sending a question
     The page lifts out of the panel as a real sheet with the question on it,
     folds into a plane — the fold timeline played forward, every step,
     including the centre crease that only folding needs — and is thrown
     into the holding pattern with the other waiting planes. */
  var launches = [];
  var LIFT_S = 0.55, FOLDUP_S = 2.6, THROW_S = 1.6;
  function launch(item, rect) {
    return new Promise(function (resolve) {
      var p;
      try { p = buildWaitingPlane(item); } catch (e) { console.error(e); resolve(null); return; }
      refreshTargets();
      if (reduceMotion || !rect) {                    // no fold, no throw: it fades in where it flies
        p.fx.dim = 1; p.fx.dimT = 0; p.fx.at = 0;
        setTimeout(resolve, 400, p);
        return;
      }
      p.launching = true;
      p.hiTex = frontTexture(p.sheet, p.item, HIGH_PPI, p.i + 7);
      p.hiCream = creamBack(p.sheet, HIGH_PPI, p.i + 51, true);
      var m = p.mats[0];
      m.map = p.hiTex; m.userData.creamMap.value = p.hiCream; m.userData.feather.value = 0;
      var qS = p.rig.root.quaternion.clone();
      var zeros = p.rig.getAngles().map(function () { return 0; });
      p.rig.setAngles(zeros, 0);                       // a flat sheet again; the root keeps its stand
      setRanks(p, 0);
      stage.attach(p.wrap);
      /* the sheet starts exactly over the panel's page */
      var Dd = 62, k = visibleHeight(Dd) / window.innerHeight, W = window.innerWidth, H = window.innerHeight;
      var s0 = Math.min(rect.width * k / p.sheet.w, rect.height * k / p.sheet.h) * 0.92;
      var P0 = camera.position.clone().add(new T.Vector3((rect.left + rect.width / 2 - W / 2) * k,
        -(rect.top + rect.height / 2 - H / 2) * k, -Dd));
      var a = availRect();
      var P1 = camera.position.clone().add(new T.Vector3(((a.x0 + a.x1) / 2 - W / 2) * k * 0.6,
        -((a.y0 + a.y1) / 2 - H / 2) * k * 0.6 + 2, -Dd - 6));
      var s1 = s0 * 0.7;
      launches.push({ p: p, qS: qS, P0: P0, P1: P1, s0: s0, s1: s1, R: camera.quaternion.clone(), progress: 0, resolve: resolve,
        tl: PK.createFoldTimeline(p.rig, { mode: 'fold', lead: LIFT_S, steps: FOLDUP_S, tail: THROW_S }) });
    });
  }
  function runLaunches(now, dt) {
    for (var i = launches.length - 1; i >= 0; i--) {
      var L = launches[i], p = L.p;
      L.progress = Math.min(1, L.progress + dt / L.tl.duration);
      var info = L.tl.apply(L.progress);
      setRanks(p, info.stack);
      var lift = ease(info.lead), thr = ease(info.tail);
      var qSi = L.qS.clone().invert();
      if (info.tail <= 0) {
        p.wrap.position.lerpVectors(L.P0, L.P1, lift);
        p.wrap.scale.setScalar(L.s0 + (L.s1 - L.s0) * lift);
        p.wrap.quaternion.copy(L.R).multiply(qSi);
      } else {
        /* thrown: a gentle arc up and over into its place in the pattern */
        var to = hangingPose(p);
        var mid = L.P1.clone().lerp(to.position, 0.5); mid.y += 10;
        var u = 1 - thr;
        p.wrap.position.set(0, 0, 0).addScaledVector(L.P1, u * u).addScaledVector(mid, 2 * u * thr).addScaledVector(to.position, thr * thr);
        /* it levels out early in the throw rather than flying up on its tail */
        var rot = 1 - Math.pow(1 - info.tail, 3);
        var comp = new T.Quaternion().slerpQuaternions(L.R, to.quaternion.clone().multiply(L.qS), rot);
        p.wrap.quaternion.copy(comp).multiply(qSi);
        p.wrap.scale.setScalar(L.s1 + (to.scale.x - L.s1) * thr);
      }
      if (L.progress >= 1) {
        p.tilt.add(p.wrap);
        p.wrap.position.copy(p.wrapLocal.position);
        p.wrap.quaternion.copy(p.wrapLocal.quaternion);
        p.wrap.scale.copy(p.wrapLocal.scale);
        p.rig.setProgress(1);
        setRanks(p, p.rig.folds.length);
        var m = p.mats[0];
        m.map = p.front; m.userData.creamMap.value = p.cream; m.userData.feather.value = 1;
        p.hiTex.dispose(); p.hiCream.dispose();
        p.launching = false;
        launches.splice(i, 1);
        L.resolve(p);
      }
    }
  }
  /* an answer arrives: the colour bleeds into the cream, once, and the plane
     joins the answered ones */
  D.onChange(function (ev) {
    if (ev.answered) {
      var item = D.get(ev.answered);
      planes.forEach(function (p) {
        if (p.qid !== ev.answered) return;
        p.kind = 'answered';
        p.item = { q: item.q, a: item.a };
        var old = p.front;
        p.front = frontTexture(p.sheet, p.item, LOW_PPI, p.i + 7);
        if (p.state !== 'away') p.mats[0].map = p.front;
        old.dispose();
        p.bleed = 0; p.bleeding = true;
      });
    }
    S.set({ dataVersion: S.get().dataVersion + 1 });
  });

  /* ------------------------------------------------------------------ loop */
  var lastT = performance.now();
  function frame(now, manual) {
    if (!manual) requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var k = 1 - Math.pow(0.0008, dt);
    cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k;
    camera.position.set(cam.x, cam.y, CAM_Z * (1 + intro.dolly));
    camera.quaternion.set(0, 0, 0, 1);
    camera.updateMatrixWorld();

    pointerHover(now);
    /* the caught plane, and where it sits on screen: the others go a touch
       soft, and any standing in front of it and overlapping it turn
       see-through, so it's never buried */
    var prim = primaryP && primaryP.state !== 'away' && !primaryP.launching ? primaryP : null;
    var pd = prim ? disc(prim) : null;
    var st0 = S.get(), pointerLean = prim && (st0.hoverSource === 'pointer' || st0.hoverSource === 'touch');

    /* The breeze is a smooth field that drifts across the cluster and swells
       and fades over tens of seconds. Each plane responds as a real hanging
       object would: the string is a pendulum (natural frequency sqrt(g/L), so
       longer strings swing slower), lightly damped by the air, deflected by
       about a degree at the strongest gust; the plane weathervanes on its
       string like a slow torsion spring. Nothing is keyframed. */
    var s = now / 1000;
    var gust = 0.45 + 0.3 * Math.sin(s * 0.071) + 0.25 * Math.sin(s * 0.029 + 1.1);
    var sub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / sub, G = 386;    // in/s^2
    var fxK = reduceMotion ? 1 : 1 - Math.exp(-dt / FX_TAU);
    var quick = 1 - Math.exp(-dt / 0.06);
    var hazeK = reduceMotion ? quick : 1 - Math.exp(-dt / 0.13);
    shadowList.length = 0;
    for (var i = 0; i < planes.length; i++) {
      var p = planes[i];
      /* the filter, eased toward its target (after a short per-plane delay,
         so a change ripples across the sky) */
      var fx = p.fx;
      if (now >= fx.at) { fx.dim += (fx.dimT - fx.dim) * fxK; fx.fwd += (fx.fwdT - fx.fwd) * fxK; }
      /* the catch: in over ~300 ms, out over ~600 ms */
      fx.cat += (fx.catT - fx.cat) * (reduceMotion ? quick : 1 - Math.exp(-dt / (fx.catT > fx.cat ? 0.1 : 0.2)));
      if (fx.catT && !fx.caught) { fx.caught = true; if (!reduceMotion) fx.glint = 0; }
      if (!fx.catT) fx.caught = false;
      if (fx.glint >= 0) { fx.glint += dt / 0.7; if (fx.glint >= 1) fx.glint = -1; }
      var hazeT = prim && fx.catT < 0.5 ? 1 : 0, occlT = 0;
      if (prim && p !== prim && p.state !== 'away') {
        var d = disc(p);
        if (d.front && d.dist < pd.dist - 0.5 && Math.hypot(d.x - pd.x, d.y - pd.y) < (d.r + pd.r) * 0.72) occlT = 1;
      }
      fx.haze += (hazeT - fx.haze) * hazeK;
      fx.occl += (occlT - fx.occl) * hazeK;
      /* bank toward the cursor (or, from the panel, a gentle lean its way) */
      var rollT = 0, pitchT = 0;
      if (p === prim && !reduceMotion) {
        if (pointerLean) {
          var dd = pd, ux = Math.max(-1, Math.min(1, (mouse.x - dd.x) / Math.max(dd.r, 20)));
          var uy = Math.max(-1, Math.min(1, (mouse.y - dd.y) / Math.max(dd.r, 20)));
          rollT = -ux * 8 * Math.PI / 180; pitchT = uy * 5 * Math.PI / 180;
        } else rollT = -4 * Math.PI / 180;
      }
      var leanK = 1 - Math.exp(-dt / 0.15);
      fx.roll += (rollT * fx.cat - fx.roll) * leanK; fx.pitch += (pitchT * fx.cat - fx.pitch) * leanK;
      var ts = 1 - 0.8 * fx.cat;                          // its own clock: 20% when caught
      var dist = CAM_Z - p.z;
      var lift = fx.cat * 0.05 * dist;                    // ~5% bigger on screen
      var bob = reduceMotion ? 0 : Math.sin(now / 1000 * Math.PI) * 2.5 * visibleHeight(dist) / window.innerHeight * fx.cat;
      if (fx.cat > 0.02 && p.state !== 'away' && !p.launching) shadowList.push(p);
      if (p.bleeding) {
        p.bleed = Math.min(1, p.bleed + dt / BLEED_S);
        p.mats[0].userData.bleed.value = smooth(0, 1, p.bleed);
        if (p.bleed >= 1) p.bleeding = false;
      }
      var away = p.state === 'away' || p.launching;
      var u = p.mats[0].userData;
      u.dim.value = away ? 0 : fx.dim;
      u.haze.value = away ? 0 : fx.haze;
      u.occl.value = away ? 0 : fx.occl;
      u.glint.value = away || fx.glint < 0 ? -1 : -0.2 + 1.4 * smooth(0, 1, fx.glint);
      var fadeV = away ? 1 : (p.appear == null ? 1 : p.appear) * (1 - 0.65 * (p.cover || 0));
      u.fade.value = fadeV;
      var faded = !away && (fx.dim > 0.01 || fx.occl > 0.01 || fadeV < 0.999);
      if (faded !== p.mats[0].transparent) { p.mats[0].transparent = faded; p.mats[0].alphaToCoverage = !faded; }
      var zoff = -7 * fx.dim + 1.2 * fx.fwd + lift, sc = 1 - 0.1 * fx.dim;
      var leaning = Math.abs(fx.roll) + Math.abs(fx.pitch) > 1e-4;
      if (leaning) qLean.setFromEuler(eLean.set(fx.pitch, 0, fx.roll));
      if (p.flyer) {
        if (!p.launching) {
          placeFlyer(p, reduceMotion ? 0 : dt * ts, zoff, bob);
          if (leaning) p.fly.quaternion.premultiply(qLean);
          if (!away) p.tilt.scale.setScalar(PLANE_SCALE * sc);
        }
        continue;
      }
      p.swing.position.z = p.z + zoff;
      p.hang.position.set(0, p.hangY + bob, 0);              // set whole every frame (the intro adds to it)
      if (!away) p.tilt.scale.setScalar(PLANE_SCALE * sc);
      if (p.stringMat) p.stringMat.opacity = p.stringOpacity * (1 - 0.8 * fx.dim) * (p.threadA == null ? 1 : p.threadA);
      if (reduceMotion) {
        p.hang.rotation.set(0, p.yaw0, 0); p.tilt.rotation.set(p.pitch, 0, p.roll);
        continue;
      }
      var wx = gust * (0.6 * Math.sin(s * 0.35 - p.x * 0.03 + 0.2) +
                       0.4 * Math.sin(s * 0.83 - p.x * 0.05 + p.z * 0.02 + 1.3));
      var wz = gust * (0.5 * Math.sin(s * 0.29 - p.x * 0.025 + 2.1) +
                       0.3 * Math.sin(s * 0.71 + p.z * 0.04 + 0.6));
      var wp = Math.sqrt(G / Math.max(p.len, 4)), cp = 2 * 0.05 * wp;          // pendulum
      var tx = 0.018 * wx, tz = 0.014 * wz;                                   // where the wind holds it
      var heading = p.yaw0 + p.yaw;
      var ty = 0.07 * (wx * Math.sin(heading) - wz * Math.cos(heading));      // weathervaning, a little
      /* a flat sheet turning edge-on through air is heavily damped: it eases
         round and settles rather than swinging back and forth */
      var wt = p.tw, ct = 2 * 0.45 * wt;
      /* a caught plane runs on its own slower clock — it keeps moving, from
         wherever it is, just at a fifth of the pace */
      var hs = h * ts;
      for (var k = 0; k < sub; k++) {
        p.vx += (-wp * wp * (p.ax - tx) - cp * p.vx) * hs; p.ax += p.vx * hs;
        p.vz += (-wp * wp * (p.az - tz) - cp * p.vz) * hs; p.az += p.vz * hs;
        p.vy += (-wt * wt * (p.yaw - ty) - ct * p.vy) * hs; p.yaw += p.vy * hs;
      }
      if (!isFinite(p.ax + p.az + p.yaw + p.vx + p.vz + p.vy)) { p.ax = p.az = p.yaw = p.vx = p.vz = p.vy = 0; }
      p.swing.rotation.z = -p.ax;
      p.swing.rotation.x = p.az;
      if (p.state === 'away') continue;
      /* every angle, every frame: the bank and the intro write into these
         rotations, and a leftover axis would feed back next frame */
      p.hang.rotation.set(0, p.yaw0 + p.yaw, 0);
      p.tilt.rotation.set(p.pitch, 0, p.roll);
      if (leaning) {
        /* the bank is in screen space: turn it into the tilt's own frame */
        p.hang.getWorldQuaternion(qPar);
        qAdj.copy(qPar).invert().multiply(qLean).multiply(qPar);
        p.tilt.quaternion.premultiply(qAdj);
      }
    }
    if (intro.phase === 'ready') {
      intro.ready = dt < 0.03 ? intro.ready + 1 : 0;
      if (intro.ready >= 4 || now - intro.readySince > 900) startIntro();
    }
    introFrame(dt);
    placeShadows();

    runAnim(now);
    if (openP && !anim) {
      var R = readingPose(openP), kk = 1 - Math.exp(-dt / 0.18);
      openP.wrap.position.lerp(R.position, kk);
      openP.wrap.scale.lerp(R.scale, kk);
      placeShadow(openP, 1);
    }
    if (openP) {
      var ar = availRect();
      reader.style.left = ((ar.x0 + ar.x1) / 2) + 'px';
      reader.style.bottom = (window.innerHeight - ar.y1 - 64 + 26) + 'px';
    }
    runLaunches(now, dt);
    draw();
  }
  /* The sky is painted here rather than left to the page behind the canvas:
     the paper's edges feather out through alpha-to-coverage, and that only
     blends right against something already in the frame. The alpha the
     paper leaves behind is then set back to opaque, so the page composites
     the canvas as it is. */
  var gl = renderer.getContext();
  function draw() {
    renderer.setRenderTarget(null);
    renderer.clear();
    HAZE.ambience.value = 1;
    renderer.render(bgScene, bgCam);
    renderer.render(wall, camera);
    if (dimMat.opacity > 0.001) renderer.render(dimScene, dimCam);
    renderer.clearDepth();
    HAZE.ambience.value = 0;                               // the sheet you read keeps its true colour
    renderer.render(stage, camera);                        // the plane you are reading
    HAZE.ambience.value = 1;
    gl.colorMask(false, false, false, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, true);
    renderer.state.reset();
  }

  /* ----------------------------------------------------------------- build
     The fonts have to be in before the type is drawn into the sheets, then
     the planes are folded a few per frame with a count on screen. */
  var loading = document.getElementById('loading');
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('700 40px "Bitter"'),
      document.fonts.load('400 20px "Bitter"'),
      document.fonts.load('500 20px "Bitter"')
    ]).catch(function () {});
  }
  resize();
  var b0 = bounds();
  /* start with the first rows filling the frame; scrolling up shows only
     strings running off the top, never where they are tied */
  cam.tx = cam.x = b0.minX + COL_W * 0.4;
  cam.ty = cam.y = b0.maxY - visibleHeight(CAM_Z) * 0.34; clampTarget();
  cam.x = cam.tx; cam.y = cam.ty;
  requestAnimationFrame(frame);
  fontsReady().then(function () {
    var i = 0, last = performance.now();
    (function more() {
      /* a frame's worth at a time, so the count keeps moving; but if the page
         is in the background and only called now and then, build more each
         time so it still finishes */
      var now = performance.now(), gap = now - last;
      var until = now + (gap > 100 ? 400 : 14);
      while (i < N && performance.now() < until) buildPlane(i++);
      last = performance.now();
      loading.textContent = 'folding planes … ' + i + ' / ' + N;
      if (i < N) requestAnimationFrame(more);
      else {
        D.waiting().forEach(buildWaitingPlane);
        refreshTargets();
        loading.classList.add('done');
        intro.phase = 'ready'; intro.readySince = performance.now();
        window.GARDEN = { planes: planes, open: openPlane, close: closePlane, camera: camera, shadow: shadow,
          /* where a question's plane is on screen, for the panel's pointer line */
          locate: locate,
          /* fold a just-sent question into a plane from the page at `rect`
             and throw it into the holding pattern; resolves when it lands */
          launch: launch,
          isOpen: function () { return !!openP; },
          /* for tuning the intro: GARDEN.intro.scrub(2.1), .replay('full'), .speed = 0.25 */
          intro: {
            get t() { return intro.t; }, get dur() { return intro.dur; }, get phase() { return intro.phase; },
            get kind() { return intro.kind; }, get speed() { return intro.speed; }, set speed(v) { intro.speed = v; },
            scrub: function (t) {
              intro.paused = true; intro.t = Math.max(0, Math.min(intro.dur, t));
              intro.reveal = -1e9; intro.dotAt = null;          // re-derived from where the plane is now
              var tp = intro.throwP;
              if (tp && tp.ent && intro.t > tp.ent.t0 + tp.ent.dur) intro.dotAt = 0;   // long since landed
            },
            play: function () { intro.paused = false; },
            skip: skipIntro,
            replay: function (kind) {
              document.body.classList.add('intro');
              planes.forEach(function (p) { p.appear = 0; p.threadA = 0; });
              intro.phase = 'running'; intro.paused = false;
              planIntro(kind || 'full');
              if (intro.kind === 'full' && intro.throwP) {
                intro.throwP.mats[0].userData.bleed.value = 0;
              }
              intro.t = 0; intro.skipRate = 0; intro.reveal = -1e9; intro.dotAt = null; skyWash.value = INTRO.sky.wash;
            },
            schedule: function () {
              return planes.filter(function (p) { return p.ent; }).map(function (p) {
                return { i: p.i, z: +p.z.toFixed(1), mode: p.ent.mode, t0: +p.ent.t0.toFixed(3), dur: +p.ent.dur.toFixed(3) };
              }).sort(function (a, b) { return a.t0 - b.t0; });
            },
            timings: function () { return { dur: intro.dur, last: intro.last, uiFrom: intro.uiFrom, kind: intro.kind }; }
          },
          /* for checking: the renderer and scenes, read-only use */
          _debug: { renderer: renderer, stage: stage, wall: wall,
            tick: function () { runAnim(performance.now()); },
            /* run the scene forward by `ms` right now, in 16 ms frames (for
               checking in a throttled background tab) */
            advance: function (ms) {
              for (var t = 0; t < ms; t += 16) frame(Math.max(performance.now(), lastT) + 16, true);
            } },
          /* for checking: hold the running animation at a point (null lets it go) */
          _hold: function (v) { if (anim) anim.hold = v; },
          /* read-only: where the running animation is, for checking it */
          _anim: function () {
            if (!anim || !anim.info) return null;
            var q = anim.p.wrap.quaternion.clone().multiply(anim.p.qStand);
            return { kind: anim.kind, progress: anim.progress, step: anim.info.step && anim.info.step.name,
              lead: anim.info.lead, steps: anim.info.steps, tail: anim.info.tail, stack: anim.info.stack,
              toReading: q.angleTo(camera.quaternion) };
          },
          /* a picture of the canvas right now, for checking the layout */
          snap: function () { draw(); return canvas.toDataURL('image/jpeg', 0.85); } };
      }
    })();
  });
})();
