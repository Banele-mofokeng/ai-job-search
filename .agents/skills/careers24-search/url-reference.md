# Careers24 — endpoint and parsing reference

Recorded 2026-08-18. Update this file whenever the portal changes its markup.

## Access

- `https://www.careers24.com/robots.txt` lists specific crawler user-agents
  (`Scrapy`, `SemrushBot`, `Baiduspider`, `Yandex`, `Twitterbot`, `PetalBot`, …)
  followed by `Disallow: /`. There is **no** `User-agent: *` group, so agents outside
  that list are not excluded.
- No authentication, no API key. Server-rendered ASP.NET HTML.
- User-Agent used by the CLI: `Mozilla/5.0 (compatible; careers24-search-cli/1.0)`
  (accepted; no bot challenge).

## Endpoints

| Purpose | URL | Notes |
|---------|-----|-------|
| Search | `/jobs/[lc-<location>/][kw-<keywords>/]?page=<n>` | 10 cards/page |
| Detail | `/jobs/adverts/<id>-<slug>/` | Slug is decorative — `<id>-x` resolves the same advert |
| Apply | `/jobs/apply/<id>` | Requires a Careers24 account (page links via `/login/?returnurl=`) |
| Sector browse | `/jobs/se-<sector>/` | e.g. `/jobs/se-mining/` |

### Parameters and path segments

| Segment / param | Values | Notes |
|-----------------|--------|-------|
| `lc-<location>` | province or city slug (`lc-gauteng`, `lc-western-cape`, `lc-johannesburg`, `lc-south-africa`) | **Must come before `kw-`.** Verified: `/jobs/kw-data-analyst/lc-gauteng/` returns the same 27 unfiltered results as `/jobs/kw-data-analyst/`, while `/jobs/lc-western-cape/kw-data-analyst/` narrows to 9. |
| `kw-<keywords>` | hyphenated keyword slug | `kw-data-analyst` |
| `page` | 1-indexed integer | Query parameter, not a path segment; omitted for page 1 |
| posting age | — | **No parameter exists.** The CLI filters client-side on the card's posted date. |

## Search-result structure

Results live inside `<div id="divSearchResults">`. Two hidden inputs carry paging metadata:

| Field | Anchor |
|-------|--------|
| total matches | `<input id="NumFound" name="NumFound" value="27">` |
| current page | `<input id="VacancySearchParameters_PageIndex" ... value="1">` |

Each card is `<div class="job-card" data-control="job-card" data-id="<id>">`. The CLI
splits on that marker and parses each chunk independently.

| Field | Anchor |
|-------|--------|
| id | `data-id` attribute on the card div |
| title + url | `<a href="/jobs/adverts/<id>-<slug>/?jobindex=N" data-control="vacancy-title"><h2>Title</h2></a>` |
| location | first `<li>` inside `div.job-card-left > ul` (unlabelled) |
| employment type | `<li>Job Type: Permanent</li>` |
| posted date + days left | `<li>Posted: 17 Aug 2026 <br /><span>61 Days left</span></li>` |
| company | **not present** — the card carries no employer; the mail-icon `data-*` attributes hold only id/title/location/url |

## Detail-page structure

| Field | Anchor |
|-------|--------|
| title | `h1.vacancy-detail-head > span` |
| icon list | `div.detailsList > ul` — `<li>` items for location (unlabelled, with `/jobs/lc-…` link), `Salary:`, `Job Type:`, `Sectors:`, `Benefits:`, `Reference:` |
| employer | `<p class="mb-15">Employer: <a href="/"><strong>Name</strong></a></p>` inside `div.row.c24-vacancy-details` |
| description | one or more `<div class="v-descrip">` blocks (advert body, then "Candidate Requirements") |
| deadline | `Apply before Oct 17 2026 | 61 Days left` in `div.row.smallest-text` |
| apply link | `<a href="/login/?returnurl=/jobs/apply/<id>">` |

## Quirks

- A removed/expired advert **302s to a search page with HTTP 200**, not a 404. The CLI
  treats a page without `vacancy-detail-head` as `NOT_FOUND`.
- `/jobs/adverts/<id>/` (no slug) also redirects away; a non-empty slug is required, so
  the CLI uses `<id>-x`.
- Word-pasted adverts can contain bytes that decode to U+FFFD; the parser strips them so
  they never reach a generated CV or cover letter.
- Dates render `dd MMM yyyy` on cards (`17 Aug 2026`) but `MMM d yyyy` in the detail
  deadline (`Oct 17 2026`) — two different formats on the same site.
