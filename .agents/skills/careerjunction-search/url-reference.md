# CareerJunction — endpoint and parsing reference

Recorded 2026-08-18. Update this file whenever the portal changes its markup.

## Access

- `https://www.careerjunction.co.za/robots.txt` → `User-agent: *` / `Allow: /`, with
  `Disallow: /myprofile/applied-jobs` and `Disallow: /myprofile/EditProfile`.
  `MJ12bot` is fully disallowed. Public search and job pages are permitted.
- No authentication, no API key, no rate-limit header observed. Server-rendered HTML.
- User-Agent used by the CLI: `Mozilla/5.0 (compatible; careerjunction-search-cli/1.0)`
  (accepted; no bot challenge).

## Endpoints

| Purpose | URL | Notes |
|---------|-----|-------|
| Search (no location) | `/jobs/results?keywords=<terms>&page=<n>` | ~25 cards/page |
| Search (location) | `/jobs/<city-slug>?keywords=<terms>&page=<n>` | Location is a **path segment** |
| Detail (canonical) | `/<title-slug>-job-<id>.aspx` | Linked from each card |
| Detail (by id) | `/jobs/job-<id>` | 301s to the canonical slug URL |
| Apply | `/apply/<id>` | Requires a CareerJunction account |
| Company profile | `/companies/<companyId>/<slug>` | Linked from card and detail |

### Parameters

| Parameter | Values | Notes |
|-----------|--------|-------|
| `keywords` | free text (`+`-encoded) | Matches title and description |
| `page` | 1-indexed integer | Omitted for page 1 |
| `location=` | — | **Ignored by the site.** Verified: `?keywords=data+analyst&location=cape-town` returns the same unfiltered result set as `?keywords=data+analyst`. Use the `/jobs/<city-slug>` path instead. |
| posting age | — | **No parameter exists.** The CLI filters client-side on the card's posted date. |

## Search-result structure

Each card is a `<div class="module job-result  ">` block. The CLI splits the page on
`<div class="module job-result` and parses each chunk independently.

| Field | Anchor |
|-------|--------|
| id + url + title | `<h2><a jobId="<id>" href="<url>" ...>Title</a>` |
| company | `<h3><a href="/companies/<id>/<slug>">Name</a></h3>` (absent on blind ads) |
| logo | `div.job-result-logo > a > img` (S3, pre-signed URL — expires, do not cache) |
| salary | `<li class="salary">` — usually `Undisclosed` |
| employment type | `<li class="position">` e.g. `Permanent Intermediate position` |
| location | `<li class="location"><a href="/jobs/<slug>">City</a></li>` |
| posted date | `<li class="updated-time">Posted 24 Jul 2026</li>` |
| expiry | `<li class="expires">Expires in 9 days</li>` |
| reference | `<li class="cjun-job-ref">Job 2642998 - Ref 24658</li>` |

Result count / paging metadata is not exposed in a machine-readable field; the CLI
reports the count of cards it parsed on the requested page.

## Detail-page structure

| Field | Anchor |
|-------|--------|
| title | `div.name-wrapper > h1` |
| company | `div.name-wrapper > h2` |
| overview list | `ul.job-overview` — same `li` classes as the card |
| description | `div.job-desc-on-expired job-details-description` → inner `div.job-details`, starting with `<h2>About the position</h2>` |
| apply link | `<a href='/apply/<id>' class="btn-apply ...">` |

Description extraction uses a depth-aware `<div>` walker (`extractDivContent`) because
the block nests several `<div>`s; `<script>`/`<style>` are stripped before tag removal.

## Quirks

- An unknown or expired job ID redirects to `/not-found` with **HTTP 200**. `htmlFetch`
  treats a final URL containing `/not-found` as a miss and returns `""` → `NOT_FOUND`.
- `/job-<id>.aspx` (without a slug prefix) 404s; any prefix works (`/x-job-<id>.aspx`),
  but `/jobs/job-<id>` is the documented redirect and is what the CLI uses.
- Employer logos come from a pre-signed S3 URL valid ~24h — never persist them.
- Dates are rendered `d MMM yyyy` (`24 Jul 2026`); the client-side age filter parses that
  format and keeps anything it cannot parse.
