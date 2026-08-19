#!/usr/bin/env bun
// Self-contained CLI for searching Job Placements (jobplacements.com), a South
// African job board. No authentication, no API key, zero runtime dependencies —
// it runs anywhere `bun` is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `jobplacements-cli — search Job Placements job adverts (South Africa)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <advert-url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (job title, skill, technology).
  --location, -l <text>   City or town, e.g. "Johannesburg", "Cape Town", "Durban".
  --jobage <days>         Keep adverts posted within N days.
  --page <n>              1-indexed page (10 results/page — fixed by the board). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q ".NET developer" -l Johannesburg --format table
  bun run src/cli.ts search -q "C# SQL" --jobage 7 --format table
  bun run src/cli.ts search -q developer -l "Cape Town" --page 2 --format table
  bun run src/cli.ts search -q "software engineer" --limit 5 --format json
  bun run src/cli.ts detail "https://www.jobplacements.com/Jobs/T/…-1319116-Job-Search-….asp" --format plain

NOTES
  The results page does not name the recruiter — "company" is null in search output
  and is filled in by "detail". Advert URLs are slug-based, so "detail" takes the
  full URL from a search result rather than a bare id.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
    const val = parseInt(raw as string, 10)
    if (isNaN(val)) {
      process.stderr.write(
        JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n",
      )
      return null
    }
    return val
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    for (const name of ["jobage", "page", "limit"]) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    const stringFlag = (k: string): string | undefined =>
      typeof flags[k] === "string" && (flags[k] as string).trim() !== ""
        ? (flags[k] as string)
        : undefined

    if (!stringFlag("query") && !stringFlag("location")) {
      process.stderr.write(
        JSON.stringify({
          error: "search needs at least --query/-q or --location/-l",
          code: "NO_CRITERIA",
        }) + "\n",
      )
      return 1
    }

    const opts: SearchOpts = {
      query: stringFlag("query"),
      location: stringFlag("location"),
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(
        JSON.stringify({ error: "detail requires an <advert-url>", code: "NO_ID" }) + "\n",
      )
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
