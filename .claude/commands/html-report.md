# /html-report - Generate Application Tracker Dashboard

Generate a self-contained, **interactive** HTML dashboard from `job_search_tracker.csv` and the application archives under `documents/applications/`. The output is a single `.html` file — no server, no build step, no network — that can be opened directly in a browser.

The page ships three views over the same data (**Board**, **Table**, **Charts**), a shared filter bar, a detail drawer, and light/dark theming.

## Step 0: Parse Arguments

- No argument → output to `reports/application-dashboard.html`
- A path argument (e.g. `/html-report ~/Desktop/report.html`) → use that path
- `--open` flag → after writing, tell the user to open the file (cannot open a browser directly)

Create `reports/` if it does not exist.

---

## Step 1: Collect Data

Read in parallel:

1. **`job_search_tracker.csv`** — the primary source. Parse every row into a record with fields:
   `date`, `company`, `sector`, `role`, `role_type`, `channel`, `status`, `contact_person`, `fit_rating`, `notes`, `cv_file`, `cover_letter_file`, `source`, `deadline`

   Rows written before `deadline` existed have thirteen fields and no fourteenth value. Treat the missing field as empty - never drop the row, and never infer a deadline from its `date`.

   The CSV is RFC-4180 quoted: `notes` routinely contains commas, quotes and newlines. Parse with a real quote-aware pass, never `split(',')`.

2. **`documents/applications/*/outcome.md`** — for each resolved application, read the outcome file to get the exact interview stages reached (the checkboxes) and any notes. Merge this into the matching tracker row by company+role fuzzy match (lowercase, ignore punctuation). If an archive exists for a row but there is no match, attach it as extra context anyway.

Status normalisation — map tracker values to six canonical buckets before computing stats:
- `drafted` → **Drafted** (documents written by `/apply`, not yet submitted)
- `applied` → **Active** (resume submitted, no further signal)
- `interview` → **Interview**
- `offer` → **Offer**
- `hired` → **Hired**
- `rejected` / `no_response` / `no response` / `offer_declined` / `offer declined` / `withdrawn` → **Rejected/Closed**
- anything else → **Rejected/Closed**, and name the unrecognised value once in the status breakdown — matching is case-insensitive

   The bucket map tolerates the legacy space spellings on read so nothing written before
   the canonical forms were locked drops out of the stats; the **Tracker status vocabulary**
   in `/outcome` is the authoritative set.

---

## Step 2: Compute Summary Stats

From the normalised data compute:

**Drafted rows are excluded from every statistic below** — they were never submitted. Report the Drafted count on its own, and include it only in the status breakdown.

- **Total applications**
- **By status bucket:** count per bucket
- **By sector:** count per unique sector value
- **By channel:** portal vs online vs referral vs other
- **By year/season:** group by the `date` field (which may be a year like `2025` or a full date)
- **Funnel rates:** what % progressed past resume screen (reached Interview or beyond)
- **Rejection rate:** Rejected/Closed ÷ Total with a resolved status (exclude Active)

**Deadline urgency** — for every row with a non-empty `deadline`, compute whole days from the generation date to the deadline and bucket it:
- `< 0` → **overdue**
- `0–2` → **critical**
- `3–7` → **soon**
- `> 7` → **ok**

Rows whose status is already resolved (Hired, Rejected/Closed) never carry an urgency flag regardless of deadline.

---

## Step 3: Generate the HTML

Write a single self-contained HTML file. All CSS inline in `<style>`, all JS inline in `<script>`. Charts are hand-generated inline SVG. **No CDN, no Chart.js, no `<canvas>`, no external request of any kind** — the report must render fully offline on every open, including the first.

### Data embedding (required architecture)

Do **not** bake rows into static HTML markup. Emit the normalised records and precomputed stats once, as JSON, into:

```html
<script type="application/json" id="app-data">{ … }</script>
```

The page's JS reads it with `JSON.parse(document.getElementById('app-data').textContent)` and renders every view from that array. This is what makes filtering, sorting and the board view work without regenerating the file.

**Escaping (required, two separate rules):**

1. **In the JSON block** — the only sequence that can break out of `<script>` is a literal `</`. After `JSON.stringify`, replace `<` with `<` (and ` `/` ` with their escapes). Nothing else needs escaping inside a JSON script block.
2. **In the DOM** — every value that came from the CSV or an outcome file is untrusted text (company names and notes copied from postings routinely contain `<`, `&`, quotes). Insert it with `textContent` / `createTextNode` / `createElementNS` + `textContent` for SVG `<text>`. **Never `innerHTML` with interpolated data.** Static chrome may use `innerHTML`; data may not.
3. **Links** — a `source` value only becomes an `<a href>` if it starts with `http://` or `https://` after trimming. Anything else renders as plain text. Set `rel="noopener noreferrer"` and `target="_blank"`.

### Layout

```
┌───────────────────────────────────────────────────────────┐
│  Job Search Dashboard          Generated: DATE   [◐ theme] │
├────────┬────────┬────────┬────────┬────────┬──────────────┤
│ Sent   │Drafted │ Active │Intervw │ Offer  │ Rejected/    │  ← KPI row
│  N     │  N     │  N     │  N     │  N     │ Closed  N    │
├────────┴────────┴────────┴────────┴────────┴──────────────┤
│  [🔍 search]  [Status ▾] [Sector ▾] [Channel ▾]  N shown   │  ← one filter row
│                                            [Clear filters] │
├───────────────────────────────────────────────────────────┤
│  ( Board )  ( Table )  ( Charts )                          │  ← view tabs
├───────────────────────────────────────────────────────────┤
│  … active view …                                           │
└───────────────────────────────────────────────────────────┘
                                    ┌──────────────────────┐
                                    │ detail drawer (right) │
                                    └──────────────────────┘
```

The filter row sits **above** the view tabs and scopes all three views plus the KPI row — the numbers always agree with what is on screen. KPI cards show the filtered count with the unfiltered total as a muted `of N` when a filter is active.

### Palette

Define every colour as a CSS custom property on `:root`, with dark values redeclared under **both** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }`, so the OS setting and the in-page toggle both win in both directions. Never give a colour its only definition inside a media block.

**Chrome & ink**

| Role | Light | Dark |
|---|---|---|
| Page plane | `#f9f9f7` | `#0d0d0d` |
| Card surface | `#fcfcfb` | `#1a1a19` |
| Primary ink | `#0b0b0b` | `#ffffff` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted (axis/labels) | `#898781` | `#898781` |
| Gridline | `#e1e0d9` | `#2c2c2a` |
| Baseline / axis | `#c3c2b7` | `#383835` |
| Border hairline | `rgba(11,11,11,0.10)` | `rgba(255,255,255,0.10)` |

**Status colours.** The pipeline is an *ordinal progression* with two terminal outcomes, so it is encoded as a validated single-hue blue ramp plus two reserved status colours — not six arbitrary hues:

| Bucket | Light | Dark | Rationale |
|---|---|---|---|
| Drafted | `#898781` | `#898781` | muted — not in the pipeline yet |
| Active | `#6da7ec` | `#3987e5` | ramp step 1 |
| Interview | `#2a78d6` | `#6da7ec` | ramp step 2 |
| Offer | `#104281` | `#9ec5f4` | ramp step 3 |
| Hired | `#0ca30c` | `#0ca30c` | status: good |
| Rejected/Closed | `#d03b3b` | `#d03b3b` | status: critical |

Both three-step ramps are validated (`--ordinal`, monotone lightness, ≥0.06 ΔL gaps, light end clears the surface). The ramp direction inverts in dark mode — later stage = lighter — because the dark surface needs the light end. **Colour never carries a status alone**: every pill, card, legend entry and board column also carries its text label.

**Deadline urgency** uses the fixed status palette: overdue `#d03b3b`, critical `#d03b3b`, soon `#fab219`, ok — no colour, muted ink. Warning yellow is sub-3:1 on the light surface by design, so it always ships with its text (`in 5 days`), never as a bare dot.

**Magnitude charts are sequential, not categorical.** Sector and channel bars are all one blue (`#2a78d6` light / `#3987e5` dark) — they compare magnitude, they do not encode identity. Do not hand each sector its own hue.

**Font:** `system-ui, -apple-system, "Segoe UI", sans-serif` only. No web fonts. `font-variant-numeric: tabular-nums` on table cells and axis ticks; proportional figures for the large KPI numbers.

### View 1 — Board (default)

Six columns in pipeline order: **Drafted · Active · Interview · Offer · Hired · Rejected/Closed**. Each column has a header with its label, a count, and a 3px top border in the bucket colour. Empty columns still render (they show the shape of the pipeline) with a muted `—`.

Each card shows:
- Company (bold) and role
- Sector · channel as a muted meta line
- Deadline chip when present, coloured by urgency, text like `overdue`, `in 2 days`, `in 3 weeks`
- Fit rating as a small right-aligned number when present

Cards are `<button>` elements (keyboard reachable) that open the detail drawer. Board is horizontally scrollable in its own container below ~1100px — the page body never scrolls sideways.

### View 2 — Table

Columns: `Date` · `Deadline` · `Company` · `Role` · `Sector` · `Channel` · `Status` · `Fit` · `Notes` (truncated to 80 chars, `title` carries the full text) · `Source`.

- Every header is a sort button: click to sort, click again to reverse, arrow marks the active column and direction. Default sort: `date` descending, then company A→Z.
- Sorting is type-aware — dates chronologically, `fit_rating` numerically, everything else `localeCompare`.
- Status renders as a coloured pill with its label.
- Empty cells render `—`.
- Alternating row shading; the whole row is clickable → detail drawer.
- Columns empty across **all** rows may be omitted.
- The table scrolls inside its own `overflow-x: auto` wrapper.

### View 3 — Charts

Four hand-written `<svg>` charts in a 2-column grid (stacked below ~900px), each in a `.chart-card` with an `<h3>`:

1. **Status breakdown** — doughnut, slices in bucket colours, centre label = total shown
2. **By sector** — horizontal bar, count per sector, sorted descending
3. **By channel** — horizontal bar
4. **Application funnel** — horizontal bar, Applied → Interview → Offer → Hired, each bar the count reaching that stage, in the ordinal ramp

Chart rules:
- Build marks by emitting `<rect>` / `<path>` / `<circle>` / `<text>` directly with computed geometry. No library.
- 4px rounded data-ends on bars, anchored to the baseline. 2px surface-coloured gap between adjacent fills and doughnut slices.
- Each `<svg>` carries `role="img"` and an `aria-label` summarising it (e.g. `"Status breakdown: 3 Active, 2 Interview, 1 Offer"`).
- **Hover layer is part of the deliverable.** Every bar and slice is its own hit target with a `pointermove`/`focus` tooltip showing category and value; the hovered mark lightens. Hit areas extend past the painted pixels. Tooltips enhance — every value is also reachable from the Table view.
- Recessive grid and axes; direct value labels at the end of each bar. Labels wear ink tokens, never the series colour.
- Charts re-render against the active filter along with everything else.

**Empty state:** if the filtered set is empty, or if zero applications have been *sent* (all rows Drafted), replace the chart grid with a single centred message explaining that stats begin once an application is submitted. Do **not** render four empty axes. Small-but-nonzero N still gets real charts.

### Interaction

- **Detail drawer** — slides in from the right, over a scrim. Shows every field of the record: full untruncated notes, contact person, fit rating, CV and cover-letter paths, source link, and any outcome-file stages merged in Step 1. Closes on Esc, on scrim click, and on its close button. Focus moves into the drawer on open and returns to the trigger on close.
- **Keyboard** — `/` focuses the search box (unless already typing in a field); `Esc` clears focus / closes the drawer; tabs are arrow-key navigable.
- **Theme toggle** — cycles system → light → dark, persisted to `localStorage`. Falls back silently to system if storage is unavailable (`file://` in some browsers).
- **Filter state** — mirrored to the URL hash so a filtered view can be bookmarked or re-opened. Restore from the hash on load.
- **Filtering** is client-side and combines with AND: free-text search across company + role + sector + notes, plus the three dropdowns. Dropdown options are derived from the data, not hardcoded.

### Responsive

Usable from 360px up. Grids collapse to one column, the board scrolls horizontally in its own container, the table scrolls in its own container, the drawer becomes full-width below 600px. The page body must never scroll horizontally.

### Footer

`Generated by Claude Code · ai-job-search · {ISO date}` plus the row count.

---

## Step 4: Verify Before Confirming

After writing the file:

1. Extract the inline `<script>` body to a scratch `.js` and run `node --check` on it. A dashboard that throws on load is worse than no dashboard. Fix and rewrite until clean.
2. Confirm the file contains no `http://` or `https://` reference in a `src`, `href` on a stylesheet, or `@import` — i.e. nothing that would fetch at open time. Links inside the data (the `source` column) are the only permitted external URLs.
3. Confirm every record in the CSV appears in the embedded JSON — count them.

## Step 5: Confirm to the User

> **Dashboard generated:** `<output path>`
>
> Open it in any browser — no server needed.
>
> **Summary:**
> - Applications sent: N · drafted, not yet sent: N
> - Active: N · Interview: N · Hired: N · Rejected/Closed: N
> - Funnel: N% progressed past resume screen
> - Deadlines: N overdue · N due within 7 days
>
> Re-run `/html-report` any time after adding entries via `/apply` or `/outcome` to refresh the dashboard.

---

## Design Principles

- **Self-contained.** One file, fully offline — inline SVG, inline JS, inline CSS, zero external requests.
- **Data-only.** This command reads and renders; it never writes to the tracker or archive.
- **Idempotent.** Re-running overwrites the previous report at the same path — no accumulation.
- **Interactive over regenerated.** Filtering, sorting and switching views happen in the browser against embedded JSON. Regenerating is for *new data*, not for a different question.
- **Graceful on sparse data.** A handful of rows still renders correctly; the board and table are the primary value at low N. Only a genuinely empty set gets an empty state.
- **No fabrication.** Every number comes directly from the CSV or outcome files. Never infer or estimate a missing field.
- **Untrusted data.** Company names, roles and notes originate in job postings. They reach the DOM through `textContent` only.
