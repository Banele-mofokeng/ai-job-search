---
name: jobplacements-search
version: 1.0.0
description: >
  Use this skill to search live job adverts on Job Placements (jobplacements.com),
  a high-volume South African job board carrying roughly 2000 new vacancies a week
  across every sector — IT, finance, engineering, sales, admin, logistics, retail —
  in Johannesburg, Pretoria, Cape Town, Durban and the rest of South Africa. Most
  adverts are posted by recruitment agencies. Invoke for South African vacancies,
  open positions or hiring in South Africa, or to read a Job Placements advert in
  full. Trigger phrases: Job Placements, jobplacements, South African jobs, jobs in
  Johannesburg, jobs in Pretoria, jobs in Cape Town, jobs in Durban, SA vacancies,
  werk soek, vakatures, poste beskikbaar.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/jobplacements-search/cli/src/cli.ts *)
---

# Job Placements Search Skill

Search live job adverts on **Job Placements** (`jobplacements.com`), a general South
African job board. Sister site to `executiveplacements.com` and largely agency-fed.

No authentication, no API key, **zero runtime dependencies** — it runs with just `bun`.

## Access

`jobplacements.com/robots.txt` declares a single `User-agent: *` group with
`Allow: /` and one `Disallow: /Jobs/Jobs-2021.asp` (a legacy path this skill never
touches). The header comment asks that the robots exclusion standard be obeyed, which
this skill does. Keep volume low — a handful of queries per run, not a crawl.

## When to use this skill

- Broad South African job search by keyword and/or city, across all sectors
- Walk several pages of results for a common search term
- Pull the full advert text, salary line, recruiter and reference for one posting

## Commands

### Search job adverts

```bash
bun run .agents/skills/jobplacements-search/cli/src/cli.ts search [flags]
```

| Flag | Description |
|------|-------------|
| `--query`, `-q` | Keywords — job title, skill or technology |
| `--location`, `-l` | City or town, e.g. `Johannesburg`, `Cape Town`, `Durban`, `Pretoria` |
| `--jobage <days>` | Keep adverts posted within N days (applied client-side — see Notes) |
| `--page <n>` | 1-indexed page. **10 results per page, fixed by the board** |
| `--limit`, `-n` | Cap results emitted |
| `--format` | `json` (default), `table`, `plain` |

At least one of `--query` or `--location` is required — an unfiltered crawl of the
whole board is not what this skill is for.

### Get one advert

```bash
bun run .agents/skills/jobplacements-search/cli/src/cli.ts detail <advert-url> [--format json|plain]
```

Takes the **full advert URL**, which is the `url` field of every search result.
See Notes for why a bare id will not do.

## Examples

```bash
# .NET roles in Johannesburg
bun run .agents/skills/jobplacements-search/cli/src/cli.ts search -q ".NET developer" -l Johannesburg --format table

# Anything C#/SQL posted in the last week, nationwide
bun run .agents/skills/jobplacements-search/cli/src/cli.ts search -q "C# SQL" --jobage 7 --format table

# Second page of Cape Town developer roles
bun run .agents/skills/jobplacements-search/cli/src/cli.ts search -q developer -l "Cape Town" --page 2 --format table

# Five results as JSON, for feeding into /rank
bun run .agents/skills/jobplacements-search/cli/src/cli.ts search -q "software engineer" --limit 5 --format json

# Full advert text
bun run .agents/skills/jobplacements-search/cli/src/cli.ts detail "https://www.jobplacements.com/Jobs/T/TJ-19258-…-1319116-Job-Search-….asp" --format plain
```

## Output format

`--format json` (default) emits the standard portal-skill envelope:

```json
{
  "meta": { "count": 2, "page": 1, "pageSize": 10 },
  "results": [
    {
      "id": "1319116",
      "title": "TJ 19258 - Software Developer (C# / VB.NET / SQL Server)",
      "company": null,
      "location": "Johannesburg",
      "date": "2026-08-17",
      "url": "https://www.jobplacements.com/Jobs/T/TJ-19258-…-1319116-Job-Search-….asp",
      "salary": "R35 000 Negotiable based on Experience",
      "briefDescription": "…"
    }
  ]
}
```

`detail` adds `description`, `recruiter`, `jobRef`, `region`, `country` and `applyUrl`,
and fills in `company`.

Errors go to **stderr** as `{"error": "...", "code": "..."}` with exit code 1.
Codes: `BAD_CMD`, `BAD_ARG`, `NO_CRITERIA`, `NO_ID`, `NEED_URL`, `BAD_ID`, `NOT_FOUND`,
`SEARCH_FAILED`, `DETAIL_FAILED`, `INTERNAL_ERROR`.

## Notes

- **`company` is null in search results.** The board's results page prints the title,
  location, age, salary and blurb — but never the recruiter. `detail` fills it in from
  the advert page. This is a property of the source, not a parsing gap.
- **Most adverts are agency-posted**, so `company` is usually the recruiting agency
  (e.g. `Professional Career Services`), not the end employer.
- **Pagination needs POST.** The search form posts to `jobList.asp`; passing the same
  `start` value as a query string silently returns page 1 every time. The CLI posts.
- **`detail` needs the advert URL, not an id.** Advert URLs are slug-based
  (`/Jobs/T/<slug>-<id>-Job-Search-<date>.asp`) and the board offers no id-to-URL
  lookup — `cvs.asp?jobID=<id>` serves the CV upload form, not the advert. Passing a
  bare id fails with `NEED_URL` rather than guessing a URL that 404s.
- **Dates are relative at source** ("Today", "1day ago", "5 days ago") and are converted
  to absolute ISO dates so results compare cleanly with other portals. `--jobage`
  filters on the converted value client-side; adverts with an unparseable age are kept.
- **`jobRef` is often truncated by the board itself** (`TJ 19258 - Software ..`). That
  ellipsis is in their data.
- Detail parsing reads the page's schema.org `JobPosting` JSON-LD, which is far more
  stable than the surrounding markup. Its `baseSalary` block is placeholder junk
  (`currency: "vvvvv"`, empty values), so the salary comes from the visible label.
