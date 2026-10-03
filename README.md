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
