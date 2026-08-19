---
name: network-recruitment-search
version: 1.0.0
description: >
  Use this skill to search live job adverts from Network Recruitment
  (networkrecruitmentinternational.com), a South African specialist recruitment
  agency placing permanent and contract roles in IT, Finance and Engineering
  across Gauteng, the Western Cape, KwaZulu-Natal and the rest of South Africa.
  Strong coverage of software development, DevOps, ERP, database and data roles
  in Johannesburg, Pretoria and Cape Town. Invoke for South African developer,
  engineering or finance vacancies, agency-advertised roles, or to look up a
  Network Recruitment advert by its vacancy reference. Trigger phrases: Network
  Recruitment, South African jobs, jobs in Johannesburg, jobs in Pretoria, jobs
  in Cape Town, Gauteng vacancies, IT recruitment South Africa, werk soek,
  vakatures, poste beskikbaar.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/network-recruitment-search/cli/src/cli.ts *)
---

# Network Recruitment Search Skill

Search live job adverts from Network Recruitment, a South African specialist agency
(founded 1987, offices in Johannesburg, Pretoria and Cape Town) covering **IT,
Finance and Engineering**.

No authentication, no API key, **zero runtime dependencies** — it runs with just `bun`.

## Access

The site reads its adverts from a public Placement Partner JSON API, and this skill
calls the same endpoint the browser does. `networkrecruitmentinternational.com/robots.txt`
declares a single `User-agent: *` group with **no `Disallow` rules** and an explicit
`Content-Signal: search=yes, ai-input=yes, ai-train=yes`, so nothing here is excluded
from automated reading. Keep volume low anyway — a handful of queries per run, not a crawl.

## What it returns

Because the source is a JSON API rather than scraped HTML, the search response is
unusually complete: every result already carries the sector, salary line, posting
date and a brief description, and `detail` returns the full advert body.

**The end employer is not disclosed.** Network Recruitment advertises on behalf of
client companies, so `company` reports the agency and its specialist branch
(e.g. `Network Recruitment (IT Accelerate)`), never the hiring company. Treat this
the same way you would any agency listing when evaluating a role.

## When to use this skill

- Search South African IT, finance and engineering vacancies by keyword, province or specialisation
- Pull the full advert text, salary line, sector, consultant and closing date
- Resolve a vacancy reference (e.g. `ITA006188/Mel`) seen elsewhere back to its advert

## Commands

### Search job adverts

```bash
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts search [flags]
```

| Flag | Description |
|------|-------------|
| `--query`, `-q` | Keywords — job title, skill or technology |
| `--location`, `-l` | A **province** is filtered upstream; anything else (a town or suburb) is matched client-side against the advert location |
| `--department`, `-d` | Specialisation as the board spells it: `Software Development`, `DevOps`, `ERP`, `Database Administration`, `Big Data, SQL and Analytics`, `Infrastructure`, … |
| `--jobage <days>` | Keep adverts first posted within N days (applied client-side — see Notes) |
| `--page <n>` | 1-indexed page, 20 results per page. Default 1 |
| `--limit`, `-n` | Cap results emitted |
| `--format` | `json` (default), `table`, `plain` |

Provinces accepted by `--location`: `Eastern Cape`, `Free State`, `Gauteng`,
`KwaZulu-Natal`, `Limpopo`, `Mpumalanga`, `Northern Cape`, `North West`, `Western Cape`.

### Get one advert

```bash
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts detail <vacancy_ref|url> [--format json|plain]
```

Accepts a bare reference (`ITA006188/Mel`) or any URL carrying `vacancy_ref=`.

## Examples

```bash
# .NET roles in Gauteng, as a table
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts search -q ".NET developer" -l Gauteng --format table

# C# and SQL roles in Johannesburg posted in the last two weeks
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts search -q "C# SQL" -l Johannesburg --jobage 14 --format table

# Everything in the Software Development specialisation, Gauteng
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts search -d "Software Development" -l Gauteng --limit 10 --format table

# DevOps in the Western Cape
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts search -d DevOps -l "Western Cape" --format table

# Full advert text for one reference
bun run .agents/skills/network-recruitment-search/cli/src/cli.ts detail ITE007941/STU --format plain
```

## Output format

`--format json` (default) emits the standard portal-skill envelope:

```json
{
  "meta": { "count": 2, "page": 1, "total": 48 },
  "results": [
    {
      "id": "ITA006188/Mel",
      "title": "Fullstack Developer (SQL / C#)",
      "company": "Network Recruitment (IT Accelerate)",
      "location": "Johannesburg East, Gauteng",
      "date": "2026-08-19",
      "url": "https://www.networkrecruitmentinternational.com/job-details?instance=network1&vacancy_ref=ITA006188%2FMel",
      "sector": "Software Development",
      "salary": "Market Related",
      "briefDescription": "…"
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `id` | Vacancy reference — stable, and what `detail` takes |
| `company` | The agency and branch, **not** the end employer |
| `date` | First posted date (`start_date`), `YYYY-MM-DD` |
| `total` | Matches before paging and `--limit` |

`detail` adds `description`, `expiryDate`, `consultant`, `branch` and `applyUrl`.

Errors go to **stderr** as `{"error": "...", "code": "..."}` with exit code 1.
Codes: `BAD_CMD`, `BAD_ARG`, `NO_ID`, `BAD_ID`, `NOT_FOUND`, `SEARCH_FAILED`,
`DETAIL_FAILED`, `BAD_PAYLOAD`, `INTERNAL_ERROR`.

## Notes

- **`--query` is matched as a phrase, and the word order matters.** This is the single
  most surprising thing about this portal. The API does not AND the terms together:

  | Query | Matches |
  |---|---|
  | `developer` | 174 |
  | `logistics` | 59 |
  | `developer logistics` | **0** |
  | `SQL developer` | 1 |
  | `developer SQL` | **0** |

  So a two-word query returns nothing unless that exact phrase appears in the advert.
  **Prefer one strong keyword** (`-q "SQL"`, `-q ".NET"`) and narrow with `-d` and `-l`,
  or use a phrase that really is a job title (`-q "software developer"` → 109). A zero
  result from a multi-word query is almost always the phrase rule, not an empty market —
  re-run with a single word before concluding the portal is broken.
- **`pageSize` is ignored upstream.** The API returns the entire match set on every
  call regardless of what is asked for, so `--page` and `--limit` are applied
  client-side after fetching. `meta.total` is the true match count.
- **`--jobage` is client-side too** — the API has no posting-age parameter. Adverts
  with no parseable date are kept rather than silently dropped.
- **`--location` is two behaviours in one flag** because the API only understands
  provinces. A province goes upstream; a town is matched against the returned
  `town, region` string. Town names on the board are granular
  (`Johannesburg East`, `Cape Town: City Bowl`), so a substring match is the honest option.
- **There is no separate detail endpoint.** `detail` matches the reference as a
  keyword and takes the exact `vacancy_ref` hit, because the search payload already
  contains the full description.
- Adverts arrive with `salary_min`/`salary_max` often set to the literal string
  `Market Related` rather than a number; `salary` collapses an identical pair to one value.
