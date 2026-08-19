# network-recruitment-cli

Search Network Recruitment's South African job adverts (IT, Finance, Engineering) from
the command line. Reads the public Placement Partner JSON API that the agency's own
site calls — no authentication, no API key, **zero runtime dependencies**.

## Install

```bash
cd .agents/skills/network-recruitment-search/cli && bun install
```

`bun install` pulls dev types only (`typescript`, `@types/bun`). The CLI itself runs on
`bun` with nothing installed.

## Usage

```bash
bun run src/cli.ts search -q ".NET developer" -l Gauteng --format table
bun run src/cli.ts search -d "Software Development" -l "Western Cape" --jobage 14
bun run src/cli.ts detail ITA006188/Mel --format plain
bun run src/cli.ts --help
```

See `../SKILL.md` for the full flag reference and `../url-reference.md` for the endpoint
documentation.

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run start` | Run the CLI |
| `bun run test` | Unit tests plus a small live smoke test against the API |
| `bun run typecheck` | `tsc --noEmit` |

The test suite makes a handful of real requests. If you are iterating offline, run only
the parsing tests: `bun test tests/parsing.test.ts`.

## Layout

```
src/
  cli.ts              flag parsing, help text, command dispatch
  helpers.ts          endpoint URLs, fetch with backoff, advert -> contract mapping
  commands/search.ts  search, client-side location/jobage filtering, paging, rendering
  commands/detail.ts  reference normalisation, exact-match lookup
tests/
  helpers.ts          runCLI / parseJSON utilities
  parsing.test.ts     pure mapping and filtering tests (offline)
  cli.test.ts         flag validation and live smoke tests
```

## Design notes

- **Paging is client-side.** The upstream API accepts `pageSize` and ignores it, returning
  the whole match set every time. `meta.total` reports the real count.
- **`--jobage` is client-side** for the same reason: there is no posting-age parameter.
  Adverts with an unparseable date are kept, not dropped.
- **`company` is the agency, not the employer.** Network Recruitment advertises for client
  companies and does not name them.
- The consultant's email address is present in the API payload and is deliberately not
  emitted — it is an individual's contact detail, and the advert URL is the right route in.
