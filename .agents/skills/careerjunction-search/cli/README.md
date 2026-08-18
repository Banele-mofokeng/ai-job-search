# careerjunction-cli

Zero-dependency Bun CLI for CareerJunction (careerjunction.co.za), South Africa.

## Install

```bash
cd .agents/skills/careerjunction-search/cli && bun install
```

`bun install` only pulls TypeScript dev types — there are no runtime dependencies.

## Usage

```bash
bun run src/cli.ts search -q "data analyst" -l "Johannesburg" --format table
bun run src/cli.ts search -q "financial manager" -l "Cape Town" --jobage 14
bun run src/cli.ts detail 2642998 --format plain
bun run src/cli.ts --help
```

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run start` | Run the CLI |
| `bun run test` | Unit tests plus one live search smoke test (needs network) |
| `bun run typecheck` | `tsc --noEmit` |

## Contract

- Commands: `search`, `detail <id|url>`
- JSON shape: `{ "meta": { "count", "page" }, "results": [...] }`; missing values are `null`
- Errors: JSON on **stderr**, exit code 1
- Parsing anchors are documented in `../url-reference.md` — start there when the portal
  changes its markup.
