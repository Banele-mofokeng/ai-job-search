---
name: careerjunction-search
version: 1.0.0
description: >
  Use this skill to search live job listings on CareerJunction
  (careerjunction.co.za), a major South African general job board covering IT,
  finance, engineering, sales, admin and more across Johannesburg, Cape Town,
  Durban, Pretoria, Sandton, Gqeberha and the rest of South Africa. Invoke for
  open positions, vacancies, learnerships and hiring in South Africa. Trigger
  phrases: South African jobs, jobs in Johannesburg, jobs in Cape Town, SA
  vacancies, CareerJunction, werk soek, vakatures, poste beskikbaar, look up
  this CareerJunction posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/careerjunction-search/cli/src/cli.ts *)
---

# CareerJunction Search Skill

Search live job listings from CareerJunction's public job board (South Africa).
No authentication, no API key, **zero runtime dependencies** — it runs with just `bun`.

CareerJunction is the richest of the SA boards for structured data: each result carries
company name, salary line, employment type, location, posted date and expiry.

## Access

`careerjunction.co.za/robots.txt` publishes `User-agent: * / Allow: /`, disallowing only
logged-in profile paths (`/myprofile/*`). This skill reads public search and job pages
only. Still keep volume low — a handful of queries per run, not a crawl.

## When to use this skill

- Search South African job openings by keyword and/or city
- Filter to recent postings (`--jobage`, applied client-side from the posted date)
- Get the full description, salary line and employment type of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/careerjunction-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords (title, skill, role).
- `--location <text>` / `-l <text>` — SA city or suburb, e.g. `"Johannesburg"`, `"Cape Town"`, `"Sandton"`, `"Durban"`, `"Pretoria"`. Mapped to the site's `/jobs/<city>` path — CareerJunction **ignores** a `location=` query parameter, so this must be a place the site has a page for.
- `--jobage <days>` — keep postings from the last N days. **Client-side**: the portal has no posting-age parameter, so cards are filtered on their "Posted <d Mon yyyy>" text. Cards with an unparseable date are kept, never dropped.
- `--page <n>` — 1-indexed page (~25 results/page).
- `--limit <n>` / `-n <n>` — cap results emitted.
- `--format json|table|plain` — default `json`.

At least one of `--query` or `--location` is required.

### Fetch full job detail

```bash
bun run .agents/skills/careerjunction-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

Accepts a bare numeric ID (`2642998`) or any CareerJunction job URL — `/jobs/job-<id>`
redirects to the canonical slug page, so the slug never has to be known up front.

## Examples

```bash
# Data roles in Johannesburg, most useful table view
bun run .agents/skills/careerjunction-search/cli/src/cli.ts search -q "data analyst" -l "Johannesburg" --format table

# Recent finance roles in Cape Town, last two weeks
bun run .agents/skills/careerjunction-search/cli/src/cli.ts search -q "financial manager" -l "Cape Town" --jobage 14 --format table

# Second page of results, no location filter
bun run .agents/skills/careerjunction-search/cli/src/cli.ts search -q "supply chain" --page 2 --limit 10

# Full posting text
bun run .agents/skills/careerjunction-search/cli/src/cli.ts detail 2642998 --format plain
```

## Output format

| Field | Notes |
|-------|-------|
| `id` | CareerJunction job number |
| `title` | Job title |
| `company` | Employer or recruiting agency; `null` on recruiter-blind ads |
| `companyUrl` | Company profile page, or `null` |
| `location` | City/suburb as the portal renders it |
| `date` | Posted date, portal format (`24 Jul 2026`) |
| `url` | Canonical posting URL |
| `salary` | Salary line; usually `"Undisclosed"` on SA postings |
| `employmentType` | e.g. `"Permanent Intermediate position"`, `"Contract"` |
| `expires` | e.g. `"Expires in 9 days"` |
| `reference` | Portal reference line (`Job <id> - Ref <agency ref>`) |

Errors go to **stderr** as `{ "error": ..., "code": ... }` with exit code 1.

## Notes

- **Salary is rarely disclosed** on SA postings — expect `"Undisclosed"` on most cards; `/apply`'s salary benchmarking has to come from `salary_data.json`, not from the board.
- **Recruiting agencies dominate** the board. Many cards name the agency (Network Contracting Solutions, Sinakho Staffshop, Hire Resolve, MSP Staffing) rather than the end employer; the description usually hints at the industry instead.
- **Expiry matters**: postings carry an "Expires in N days" line and disappear afterwards. `detail` on an expired job returns `NOT_FOUND` (the site 200s to `/not-found`, which the CLI treats as missing).
- **Location paths**: `/jobs/<city>` exists for main metros and many suburbs (`cape-town-cbd`, `de-waterkant`, `sandton`). An unknown slug returns an unfiltered or empty page rather than an error, so verify the location string if a filtered search looks wrong.
- **No age parameter**: `--jobage` is applied after fetching, so a large `--jobage` window plus `--page` is how to walk deeper history.
