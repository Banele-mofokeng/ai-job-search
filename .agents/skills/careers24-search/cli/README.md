# careers24-cli

Zero-dependency Bun CLI for Careers24 (careers24.com), South Africa.

## Install

```bash
cd .agents/skills/careers24-search/cli && bun install
```

`bun install` only pulls TypeScript dev types — there are no runtime dependencies.

## Usage

```bash
bun run src/cli.ts search -q "data analyst" -l "Gauteng" --format table
bun run src/cli.ts search -q "financial accountant" -l "Western Cape" --jobage 14
bun run src/cli.ts detail 2380724 --format plain
bun run src/cli.ts --help
```

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run start` | Run the CLI |
| `bun run test` | Unit tests plus live search and not-found smoke tests (needs network) |
| `bun run typecheck` | `tsc --noEmit` |

## Contract

- Commands: `search`, `detail <id|url>`
- JSON shape: `{ "meta": { "count", "page", "total" }, "results": [...] }`; missing values are `null`
- Errors: JSON on **stderr**, exit code 1
- Search cards never carry the employer — run `detail` for the company name
- Parsing anchors are documented in `../url-reference.md`
