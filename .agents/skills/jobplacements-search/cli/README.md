# jobplacements-cli

Search Job Placements (`jobplacements.com`), a general South African job board, from the
command line. Reads the board's public search form and advert pages — no authentication,
no API key, **zero runtime dependencies**.

## Install

```bash
cd .agents/skills/jobplacements-search/cli && bun install
```

`bun install` pulls dev types only (`typescript`, `@types/bun`). The CLI itself runs on
`bun` with nothing installed.

## Usage

```bash
bun run src/cli.ts search -q ".NET developer" -l Johannesburg --format table
bun run src/cli.ts search -q "C# SQL" --jobage 7 --page 2
bun run src/cli.ts detail "https://www.jobplacements.com/Jobs/T/…-1319116-Job-Search-….asp" --format plain
bun run src/cli.ts --help
```

`search` needs at least `--query` or `--location`. See `../SKILL.md` for the full flag
reference and `../url-reference.md` for the parsing anchors.

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run start` | Run the CLI |
| `bun run test` | Parsing tests (offline fixtures) plus a small live smoke test |
| `bun run typecheck` | `tsc --noEmit` |

Offline only: `bun test tests/parsing.test.ts`.

## Layout

```
src/
  cli.ts              flag parsing, help text, command dispatch
  helpers.ts          fetch with backoff, card/detail parsers, date normalisation
  commands/search.ts  POST search, jobage filter, rendering
  commands/detail.ts  URL validation, JSON-LD-first detail parse
tests/
  helpers.ts          runCLI / parseJSON utilities
  parsing.test.ts     parser tests against trimmed real-response fixtures (offline)
  cli.test.ts         flag validation and live smoke tests
```

## Design notes

- **Search is POSTed.** Pagination only works over POST — the same `start` value in a
  query string returns page 1 every time. Page size is 10 and fixed by the board.
- **`company` is null in search output.** The results page never prints the recruiter;
  `detail` supplies it. That is the source's shape, not a parsing gap.
- **`detail` takes a URL, not an id.** Advert URLs are slug-based with no lookup
  endpoint, so a bare id fails with a `NEED_URL` error explaining where to get the URL
  rather than fabricating one.
- **Detail parsing is JSON-LD-first.** The schema.org `JobPosting` block holds the whole
  advert and survives redesigns better than the markup; only `baseSalary` is unusable
  (placeholder currency and empty values), so salary comes from the visible label.
- **Dates are normalised at parse time** from the board's relative ages to absolute ISO
  dates, so results sort and filter alongside the other portal skills.
