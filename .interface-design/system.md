# ResearchGraph design system: "the research desk"

**Who and what:** someone with a real question who wants a sourced brief they can trust, and who checks *how* seven agents got there. The UI is an editorial fact-checking desk: paper and ink, footnotes, a routing slip. Not a neon AI console.

## Tokens (`frontend/src/styles/index.css`, mapped into Tailwind v4 with `@theme inline`)
- **Surfaces:** one warm hue, lightness only: `paper` (page) → `sheet` (panels) → `raised` (dialogs, popovers). `well` is darker than its surroundings, for inputs, selected rows and inset blocks.
- **Text tiers:** `ink`, `ink-2`, `ink-3` (all ≥ 4.5:1 on `sheet` in both themes), and `ink-4` (decorative or disabled only).
- **Rules:** `rule` for hairlines, `rule-strong` for control borders and emphasis.
- **One accent:** `accent` ("blue pencil") for primary actions, focus rings, links, citations and the working-desk pulse. `accent-ink` is text on accent.
- **Status (never decorative):**
  - `verified` (done / verified)
  - `pencil` (critic returned the draft, failed)
  - `caution` (no results, fallback used, offline)
  
  Each has a `*-soft` tint for stamp backgrounds. Always pair colour with an icon and a word.
- **Themes:** `<html data-theme="light|dark">`, set before first paint by `index.html` (saved choice, else the OS). The `dark:` variant is bound to it. `.theme-switching` disables transitions for the one frame of a switch.

## Type and spacing
- **Fonts:** IBM Plex Sans for UI, IBM Plex Mono for model ids, timestamps and counters, and Newsreader for headlines and the report (`.report`: 18 px / 1.65, 68ch measure). Loaded with one Google Fonts link.
- **Scale (ratio 1.25):** 12 · 14 · 16 · 18 · 22 · 28 · 36 (`text-xs` to `text-3xl`). 12 px is the minimum. Hierarchy comes from weight and ink tier before size. Headings use `text-wrap: balance`.
- **Spacing:** 4 px base. Panel padding 16, panel header 12×16, section gap 24. Page gutters 16 / 24 / 32.
- **Radius:** `control` 6, `panel` 8, `dialog` 12. Stamps 4.
- **Depth:** hairline rules plus tonal surfaces only. `shadow-pop` is used on dialogs only. No glass, no glows, no gradients.

## Signature components
- **RoutingSlip:** the pipeline as the slip clipped to a manuscript.
  - Numbered rows `01–08`: label, status stamp, then kind · model used (mono) · duration on a second line.
  - The three gatherers are indented under "In parallel".
  - A red-pencil "Returned to the writer N×" line appears when the critic sends a draft back.
  - Answers from a lower fallback tier are marked "(fallback)".
  - Rows are the navigation (`aria-current`). Below 1024 px the slip becomes a horizontal strip of chips.
- **Citation chips `.cite`:** `[n]` in the report becomes a mono superscript chip that opens the Sources tab and highlights source *n*.
- **Status stamps (`StatusBadge`):** Working (pulse dot), Queued/Waiting, Done, No results, Fallback used, Failed, Returned, Not run.

## Components (`frontend/src/components/ui`)
- `Button`: primary / secondary / ghost / danger. 36 px tall (44 px below 768 px). `as={Link}` supported. Press scale .97.
- `Badge` / `StatusBadge`, `Panel` / `PanelHeader`
- `Tabs`: `role=tablist`, arrow / Home / End keys.
- `Select`: native `<select>`, always labelled.
- `EmptyState`, `ErrorNotice` (with retry), `Skeleton`
- `ConfirmDialog`: native `<dialog>`.

## Layout
- **Workspace:** composer is the focal point (serif headline, 22 px serif input), example prompts, recent runs in a 340 px aside.
- **Run page:** brief header (status · time · model setting, serif question). On desktop, a 300 px sticky slip column plus the main column (report and chat, or the selected desk). Below 1024 px everything stacks.
- **History:** a single 4xl column list with search, load more and delete.

## Interaction and motion
- 150–200 ms `ease-out-quint`, transform / opacity / colour only.
- The only perpetual motion is the working-desk pulse and skeleton shimmer.
- `prefers-reduced-motion` stops all animation.
- Focus ring: 2 px accent, 2 px offset. Skip link in the header.
- Inputs use 16 px text below 768 px (no iOS zoom).
