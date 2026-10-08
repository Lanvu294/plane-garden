# Questions, folded

A hanging garden of 160 paper planes. Scroll sideways and down to wander
through it; click a plane and it comes off its string, unfolds into a flat
sheet in front of you, and you read the question printed on it and its answer.
Fold it back and it hangs itself up again.

```bash
cd plane-garden && python3 serve.py 8732
```

then open <http://localhost:8732/>.

## Getting around

| | |
| --- | --- |
| trackpad / mouse wheel | scroll in both directions (shift + wheel goes sideways) |
| drag | pan |
| arrow keys | pan; when a sheet is open, ← → go to the previous / next plane |
| click a plane | unfold it |
| click anywhere, Esc, or *fold it back* | fold it up and hang it back |
| Tab | moves through every plane as a button (for keyboards and screen readers); Enter opens it |

## What the planes are

Every plane is folded by the same engine as the reference tools —
`lib/paperkit.js` is a copy of `motion-reference/common.js` — so each one is a
real sheet cut along its creases and turned about them. That is what lets a
plane unfold by running its own folds backwards. All ten plane types are in the
garden, sixteen of each, hung at 1.4× their true size.

Each sheet has two faces:

- **front** — off-white paper, #F1EFEA, ruled in #638097, with the question and
  answer set on the ruling in Bitter (the site's one typeface, from Google
  Fonts), and the IEX contact at the foot;
- **back** — one of the sixteen IEX gradients (`gradients.js`, copied from the
  fold plan's presets), stop 0 at the top of the sheet.

Folded, a plane shows both, the way the printed ones do. While a plane hangs,
its sheet is drawn small (40 px per inch); when you open it, the front is
redrawn sharp (150 px per inch) so the type is crisp, and the real creases —
from the engine's crease pattern — are pressed into the paper the way real
ones show: a broad, faint shade on one side and a lift on the other, coming
and going along each crease, some folds pressed harder than others, and a
hairline only where it was pressed hardest (`pressCreases`).

What keeps the paper from reading as a rendered, crisp graphic:

- **Feathered cut edge.** The outermost pixel and a half of every sheet fades
  out by an amount that wanders along the edge (alpha-to-coverage). This is
  why the sky is painted inside the canvas rather than behind it.
- **Crease memory.** An opened sheet never lies quite flat. Each panel gets
  the light it would catch if every crease kept 4° of its fold
  (`CREASE_MEMORY`), at most about ±5%. Only the shading is used; bending the
  geometry that far tears the crease pattern apart.
- **A soft shadow** settles under the sheet as it opens out, and the reading
  dim is a warm grey at 42% (`DIM`), not a cold near-black, so the outline
  doesn't cut out against it.
- **Edge falloff.** The paper darkens about 9% over the last third of an inch
  toward its edges.
- **Printed finish.** A little less contrast and colour on the paper, done in
  its shader, so the sky keeps its exact colours. The canvas also gets a
  0.35 px softening, with grain over everything.

## Questions: the panel and the sky

The panel and the sky are one system. Whatever the panel shows is what the sky
shows.

**Files:**
- `store.js`: the one shared state (`panelOpen`, `view`, `mode`, `query`,
  `hoveredId`, `openId`, `suggestIds`, `locateId`, and so on). Both sides read
  it, and both change it only through `set()`.
- `copy.js`: every word the panel says, to edit with IEX.
- `data.js`: answered questions (stable ids `a01`…`a50`), waiting questions,
  the visitor's own, search, "similar" matching, and the check for
  identifying details.
- `panel.js` and `panel.css`: the panel.
- `garden.js`: the sky. It subscribes to the store and eases each plane's
  fade, highlight and depth toward its target every frame.

**In the sky:**
- **Answered:** gradient planes hanging on strings.
- **Waiting:** plain cream lined paper with no gradient, flying slow loose
  ovals in the upper third. Your own plane carries a small pencil tick.
- **Filtering:** the Answered/Waiting tabs and the search filter the sky live.
  Planes that don't match fade to about 15%, grey, soften and drift back.
  They keep their place and motion and can't be clicked. Matching planes come
  slightly forward. The change ripples left to right over about 400 ms.
  Closing the panel clears the filter; the search text is kept.
- **Linked hover:** hovering (or arrowing to) a row lifts its planes and draws
  a dotted line to the nearest one. If none is in view, the sky pans to one
  after half a second. Hovering a plane highlights its row.

**Opening and asking:**
- **Opening an answer:** "Unfold full answer →" (or Enter on a row, or a click
  on a plane) flies the plane to the free space beside the panel and unfolds
  it. The panel dims. Folding it back marks the row read.
- **Asking:** reassurance first, then the writing sits on its own ruled lines.
  Likely names, emails, phone numbers, rooms, buildings and dates get a dotted
  underline and one gentle note, never a block. After three words, "Others
  asked something similar" offers up to three answers, and their planes lift.
  Topics are optional. Cancel with text asks "Discard this question?" inline.
- **Fold & send:** the page lifts out of the panel, folds into a plane (the
  shared fold timeline played forward, centre crease included), and is thrown
  into the holding pattern. With reduced motion it just fades in where it
  flies.
- **When an answer arrives:** the colour bleeds into the cream once, and the
  question moves to Answered. Your own adds "1 of yours answered" to the tab.

**Keys:** ↑/↓ move through rows, Enter opens, "/" searches, and Esc folds the
sheet first, then closes the panel.

**Phones (under 768 px):** the panel is a bottom sheet with a grip and three
heights (peek, half, full). It steps down to peek while you read.

**Submissions are mock for now** (`SUBMIT_MODE` in `data.js`).
- Your own questions are kept on your device (`localStorage`) and show to you
  as "yours · in review".
- `?demo` fills Waiting with sample questions ("+ 3 in review"). It answers
  one sample after 35 s, and anything you send after 20 s, to show the colour
  bleed.
- `'remote'` posts to `/api/questions` (Upstash on Vercel). That endpoint
  publishes immediately, so it needs a review step before the copy's "reviewed
  before they're posted" is true live. To hide a submission there, set
  `ADMIN_TOKEN` and:

```bash
curl -X DELETE "https://plane-garden.vercel.app/api/questions?id=ID" -H "x-admin-token: $ADMIN_TOKEN"
```

## The intro: one, then many

**The words never wait for the 3D.** The title, subtitle, buttons and footer
are HTML and fade in by themselves with CSS:
- title at 0.1 s;
- subtitle at 0.3 s, lines 100 ms apart;
- buttons and footer at 0.5 s;
- each a 400 ms fade with a 5 px rise.

The panel script loads before the 3D. The font stylesheet doesn't block the
first paint, so the words can show in Georgia for a moment before Bitter
arrives.

**Loading.** The sky textures are drawn in code, not downloaded.
- **Shared layers:** the paper fibres, grain and cut edge are drawn once, in
  four variants, and stamped onto each sheet. Drawing them per sheet was
  ~2.8 s of the old load; it's now ~0.1 s for all 160 sheets.
- **Order:** the planes in view are folded first, far to near, which is the
  wave's order.
- **Start:** as soon as the first 10 are ready and on the GPU (shader compiled,
  textures uploaded), the wave starts. Each sheet folded after that is
  uploaded straight away and joins the wave when ready. A plane is never drawn
  without its textures.
- **Waiting:** if the planes take more than 1.2 s, a small "folding…" fades in
  under the subtitle.
- **three.js** is served from `lib/`, so there's no extra connection.
- **Timings:** `GARDEN.timings()` (or `?timing` in the URL) reports when the
  fonts, the first batch and the last plane were ready.

**The wave** has one clock (`intro.t`), and every timing is in `INTRO`.
- **Order:** everything in view, far to near.
- **Pacing:** start times accelerate. The first gap is ~120 ms, shrinking to
  a few ms by the end, with ±40 ms jitter. The starts span 0.65 s.
- **Flights:** each takes 0.9 s ±15%, easing out. The wave takes about 1.5 s
  in all.
- **Near planes** fly in from beyond the nearest edge on a curve.
- **Far planes** rise out of the haze: from deeper, scale 0.7 → 1, soft to
  sharp.
- **Fades:** the only one is the first 200 ms of each flight.
- **Arrival:** each plane lands on its live pose, so there's no snap at the
  handoff. A damped roll wobble then settles within 1.6 s.
- **Hover:** a plane can be hovered as soon as it lands.

**Skip:** any click, key, scroll or drag on the sky catches up over about
0.4 s, and does nothing else. Typing in the panel is never caught.

**Other versions:**
- **Repeat visit in the same session:** the same wave, ~0.8 s.
- **Reduced motion:** every plane crossfades in place, together, over 500 ms.

**Tuning:** add `?introSpeed=0.25` to watch it slowly.
`GARDEN.intro.replay('full' | 'repeat' | 'reduced')` and `.schedule()` help
in the browser console.

**Afterwards:**
- **Legibility:** the title block, the footer and the hint (while it shows)
  each sit on a soft, edgeless haze. The corners use the sky's own colour
  down there, which keeps at least 4.5:1 contrast for the text, measured at
  4.77:1 at the darkest point. Planes passing behind any of them thin to 35%,
  and threads fade where they cross.
- **Threads:** always behind every plane. They're drawn first and write no
  depth. Each fades in at its final opacity once its plane is built.
- **Dimming:** once you've unfolded something or opened the panel, the
  subtitle drops to 45%. While a sheet or the panel is open, the title block
  dims to 30%.
- **The hint:** it only appears after 2 s with no interaction, and goes for
  good after the first scroll, drag or click.

**Tuning:** add `?introSpeed=0.25` to watch it slowly. `GARDEN.intro.scrub(t)`,
`.play()`, `.replay('full' | 'repeat' | 'reduced')`, `.schedule()` and
`.timings()` help with tuning in the browser console.

## The catch (hover)

A plane under the pointer "catches" it like a breeze, rather than lighting up.
All of this eases in and out:
- it slows to a fifth of its speed, on its own clock, so it keeps drifting
  from wherever it is;
- it bobs about ±2.5 px;
- it banks toward the cursor, up to 8° of roll and 5° of pitch;
- it lifts about 5% nearer and casts a shadow in its own shape. The shadow
  is its pieces drawn again a little further back, 4 px right and 8 px down
  (away from the light), in a darker shade of the sky behind. It's very faint
  (~15%) and softened by drawing it seven times in a 3 px ring, with a
  stencil so folded layers don't stack. It comes and goes with the lift;
- **the wing breath:** both wing creases open about 7° more over 280 ms (a
  quick lift), then settle to 2.5° above rest over 500 ms (soft, no bounce).
  This uses the same crease rotations as the unfold. The paper beyond each
  crease flexes up another 2° toward the tip, 60 ms behind, then relaxes.
  While caught, the wings breathe ±1° on a 2.5 s cycle. On release they ease
  back to rest over 400 ms. A quick away-and-back always starts from the
  current angle.

**Nothing else in the sky changes:** no other plane's colour, opacity or
material.

**Paper material:** the paper uses one material per plane, fixed for life and
never switched. It renders as opaque, drawn back to front. The cut edge's
feather uses alpha-to-coverage, and a plane's overall opacity (arriving, behind
the title, filtered out) is a constant blend set per draw.

**Hit testing:**
- The frontmost mesh hit wins, skipping filtered-out planes.
- **Intent delay:** a plane needs about 80 ms under the cursor before it
  catches.
- **Stickiness:** it holds while the cursor is on the plane or within 8% of
  its size from its edge (never the empty sky inside its bounding box), plus
  a 70 ms grace period. A plane passing in front must also rest 80 ms under
  the cursor to take over.
- **Letting go:** the catch, the tag and the shadow all follow the same
  `hoveredId`, and fade together in about 150 ms. Hover also clears when the
  pointer leaves the sky, the window loses focus, or the panel or a sheet
  opens. The tag never shows without a caught plane; if it ever does, a
  console warning says so.
- **Release:** it lets go at the screen edge or under the panel.

**The tag:** a caught plane shows its question in a small dark card beside
the cursor, with what a click does under it in small type ("unfold →", or
"waiting for IEX" / "your question" on a waiting plane). The card wraps at
270 px and flips to the cursor's other side near the right or bottom edge so
the question is never cut off.

**Inputs:** one system, four inputs (`hoverSource`):
- **pointer:** shows the cursor tag;
- **panel row:** same catch, no tag;
- **keyboard focus:** same catch;
- **touch:** the first tap catches and shows the question ("tap to unfold →"), the second unfolds, and
  a tap on empty sky lets go.

**Reduced motion:** keeps only the slow-down, the lift and its shadow, as
quick fades. No wing breath and no bank.

## How a plane opens

Every plane opens and closes through the same code, so a fix there reaches
all of them.

- **The recipe is data.** `rig.foldSteps()` (in `lib/paperkit.js`) lists the
  steps in folding order. Each step has its crease line, its end angle(s), a
  duration weight, and `usedWhen`:
  - `'both'` for a real fold;
  - `'fold'` for a pre-crease, like folding in half and opening again to
    find the centre.

  A left/right pair made together is one step.
- **One timeline.** `PK.createFoldTimeline(rig, {mode, lead, steps, tail})`
  drives everything from a single progress value from 0 to 1. Each step gets
  its own slice of time, the slices never overlap, and each step is clamped
  and eased on its own. A crease only moves during its own step, from wherever
  the earlier steps left it.
  - **Unfolding** plays the real folds in reverse and skips the fold-only
    ones, so there's no extra half fold at the end. The centre crease still
    shows, pressed into the paper.
  - **Folding back** plays every step in order, the pre-crease included.
- **One connected sheet.** Each piece hangs from the chain of creases that
  moved it, and every link is a rotation about that crease's own line. No
  piece is ever moved on its own. Pieces overlap by a hair (`seam`), so
  T-junctions can't crack.
- **One turn.** The plane flies to the middle exactly as it hung, then turns
  to the single reading orientation (cream side to the camera, upright) with
  one shortest-path slerp, over the first 60% of the folds (`ROTATE_UNTIL`).
- **Faces.** The material is double-sided, with cream on the front and the
  gradient on the back. Where paper lies flat on paper, the stack order comes
  from replaying only the folds made so far (`rig.ranksAt(k)`), not from the
  finished plane, so the right face is always on top. A piece's rank is its
  height in the stack: the longest chain of overlapping paper beneath it.
  The shader draws each rank a fixed 0.0004 units nearer along the line of
  sight (`RANK_STEP`). Don't make that offset scale with the surface's slope:
  a panel seen nearly edge-on mid-fold would then be pushed several units
  forward and drag the paper behind it through the paper in front (the white
  flashes). The camera's near/far planes (10 and 1000) hug the scene so the
  depth buffer is fine enough for a step that small.
- **The type is on the sheet the whole time.** It's printed into the paper,
  so it's there from the click to the moment the plane is back on its string.
  The soft cut edge comes in once the sheet lies flat; while folding, flaps
  butt edge to edge and the feather would show the paper beneath.
- Clicks while a plane is moving are ignored. Pressing Esc while one is
  opening folds it back once it has landed.

## How depth is built

Distilled from painted references — misty gum-tree landscapes in watercolour and
oil, a backlit forest, skies of carp streamers and kites — into principles, each
mapped to something the garden does:

1. **The air takes the colour of the light.** Distance isn't grey; far things
   wash toward the sky behind them. → Far planes mix toward the sky colour at
   their height on the screen, cooled and lifted slightly toward a lavender mist.
2. **Values compress with distance.** The darkest darks and strongest contrast
   live only in front; the back is a narrow band of light values. → Near planes
   get a touch more contrast; the haze squeezes far ones toward the mist.
3. **Form flattens with distance.** Near objects are modelled light to shade;
   far ones are flat silhouettes. → Shading fades out with distance until far
   planes are flat shapes in their paper's own colour.
4. **Detail falls away, edges don't.** Far things are simplified shapes, not
   blurred ones. → Far sheets are read at a coarser level of their own picture,
   so ruling, type and grain melt into plain colour while silhouettes stay
   sharp. Nothing is blurred.
5. **Depth comes in planes.** Painters group a scene into foreground, middle
   ground and background, each with its own value range. → The planes hang in
   groups: about a third in the background, half in the middle ground, the rest
   in front, and a few very near.
6. **Big, cropped foreground shapes.** A huge kite or carp cut off by the frame
   pushes everything else back. → The very near planes hang large and close,
   cropped by the window, and sweep past fastest as you scroll.
7. **Warm and saturated near, cool and pale far.** → Near planes get a little
   extra warmth and saturation.

A second set of references — toys and kites against flat yellow and teal,
silhouette scenes washed in one golden light — added:

8. **Shadows take the colour of the world around them.** The toys' shade sides
   go yellow, the kites' teal; never grey. → The darker a face is than its own
   paper, the more it turns toward the sky colour behind it — blue up high,
   apricot low down.
9. **Light wraps turning forms.** Faces turning away catch the backlight and
   lift off the background. → Faces seen edge-on get a soft warm glow.
10. **One light bathes everything.** → A light tint of the sky's own colour over
    every plane, so they all sit in the same air.
11. **Contre-jour.** The nearest silhouettes are the deepest in value against a
    bright distance. → The very nearest planes go a touch deeper.

The sheet being read is drawn without 8–11, so the paper stays true.

Plus the physical cues: real perspective (near planes larger, faster parallax)
and strings that are dark up front and faint at the back. The settings are in
`garden.js`: `depthFor` (the groups), `HAZE` (`hazeAmount`, `mist`, where the
mist starts and ends), and the fragment shader in `paperMaterial`.

## Changing the questions

`questions.js` is one list of `{ q, a }`. There are 50; each flies on three or
four planes, far apart. Add more and the garden uses them — with 160 or more,
every plane is different. Keep answers to about 60 words; even the longest question and answer
now use under half the sheet.

**The copy is a draft.** It was written to be general and careful, not as
policy. Have IEX review every answer — wording, accuracy, and anything CMU does
differently — before this is shown to anyone.

## Changing the garden

At the top of `garden.js`: `N` (planes), `COLS`, `COL_W` / `ROW_H` (spacing in
inches), `PAPER` / `RULE` / `INK`, and `LOW_PPI` / `HIGH_PPI`. The hang of each
plane — which way it faces, its bank and pitch, how it sways — comes from a
seeded random, so the garden hangs the same way on every visit. People who ask
their system for reduced motion get still planes and short transitions.

If `motion-reference/common.js` gains new planes, copy it over
`lib/paperkit.js` to bring them into the garden.
