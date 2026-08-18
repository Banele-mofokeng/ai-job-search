---
name: careers24-search
version: 1.0.0
description: >
  Use this skill to search live job listings on Careers24 (careers24.com), one of
  South Africa's largest general job boards, covering every sector — finance,
  mining, IT, engineering, retail, admin, sales, healthcare — across Gauteng,
  the Western Cape, KwaZulu-Natal and the rest of South Africa. Invoke for open
  positions, vacancies and hiring in South Africa. Trigger phrases: South
  African jobs, jobs in Johannesburg, jobs in Cape Town, jobs in Durban, SA
  vacancies, Careers24, werk soek, vakatures, poste beskikbaar, look up this
  Careers24 advert.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/careers24-search/cli/src/cli.ts *)
---

# Careers24 Search Skill

Search live job adverts from Careers24's public job board (South Africa).
No authentication, no API key, **zero runtime dependencies** — it runs with just `bun`.

Careers24 carries a broad, non-tech-heavy mix (mining, retail, finance, admin, trades)
and reports a total match count per query, which makes it useful for gauging how large a
market a search term actually has.

## Access

`careers24.com/robots.txt` disallows a named list of crawler user-agents (Scrapy,
SemrushBot, Baiduspider, Yandex, …) and defines **no** `User-agent: *` group, so an
honest, non-listed agent is not excluded from the public job pages this skill reads.
Keep volume low — a handful of queries per run, not a crawl.

## When to use this skill

- Search South African job adverts by keyword and/or province/city
- Gauge market size for a search term (`meta.total` = the board's own match count)
- Get the full advert text, salary line, sector, reference and application deadline

## Commands

### Search job listings

```bash
bun run .agents/skills/careers24-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keywords (title, skill, role).
- `--location <text>` / `-l <text>` — province or city, e.g. `"Gauteng"`, `"Western Cape"`, `"Johannesburg"`, `"Cape Town"`, `"Durban"`. Becomes the `/jobs/lc-<location>/` path segment — which **must precede** the keyword segment, and the CLI handles that ordering.
- `--jobage <days>` — keep adverts from the last N days. **Client-side**: the portal has no posting-age parameter, so cards are filtered on their "Posted: <d Mon yyyy>" text. Cards with an unparseable date are kept, never dropped.
- `--page <n>` — 1-indexed page (10 results/page).
- `--limit <n>` / `-n <n>` — cap results emitted.
- `--format json|table|plain` — default `json`.

At least one of `--query` or `--location` is required.

### Fetch full job detail

```bash
bun run .agents/skills/careers24-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

Accepts a bare advert ID (`2380724`) or any Careers24 advert URL. The employer name,
which the search card never carries, appears here.

## Examples

```bash
# Data roles in Gauteng
bun run .agents/skills/careers24-search/cli/src/cli.ts search -q "data analyst" -l "Gauteng" --format table

# Recent finance roles in the Western Cape, last two weeks
bun run .agents/skills/careers24-search/cli/src/cli.ts search -q "financial accountant" -l "Western Cape" --jobage 14 --format table

# Second page, no location filter
bun run .agents/skills/careers24-search/cli/src/cli.ts search -q "project manager" --page 2 --limit 10

# Full advert text, employer, deadline
bun run .agents/skills/careers24-search/cli/src/cli.ts detail 2380724 --format plain
```

## Output format

Search results (`meta` also carries `total`, the board's own match count):

| Field | Notes |
|-------|-------|
| `id` | Careers24 advert ID |
| `title` | Job title |
| `company` | Always `null` on search cards — the board does not put the employer on the card; run `detail` to get it |
| `location` | Province, city or suburb as rendered |
| `date` | Posted date (`17 Aug 2026`) |
| `url` | Canonical advert URL |
| `employmentType` | e.g. `Permanent`, `Contract` |
| `daysLeft` | e.g. `61 Days left` |

`detail` adds `salary`, `sectors`, `reference`, `deadline` (`Apply before`), `description`
and `applyUrl`, and fills `company`.

Errors go to **stderr** as `{ "error": ..., "code": ... }` with exit code 1.

## Notes

- **Employer is detail-only.** Search cards deliberately omit it. `/scrape` and `/rank` should expect `company: null` from this board's search output and fetch `detail` before drafting anything company-specific.
- **Salary lines are usually vague** — `"Market Related"` or absent — so salary benchmarking has to come from `salary_data.json`, not from the board.
- **Segment order is load-bearing**: `/jobs/lc-gauteng/kw-data-analyst/` filters; `/jobs/kw-data-analyst/lc-gauteng/` silently returns the unfiltered set. The CLI always builds the working order.
- **Province vs city**: province slugs (`lc-gauteng`, `lc-western-cape`) behave as broad filters that can still surface neighbouring metros; city slugs (`lc-johannesburg`) are tighter. If a filtered result set looks off, check the location string.
- **Expired adverts** redirect to a search page with HTTP 200 rather than 404; the CLI detects the missing vacancy header and reports `NOT_FOUND`.
- **No age parameter**: `--jobage` is applied after fetching, so pair a wide window with `--page` to walk deeper history.
