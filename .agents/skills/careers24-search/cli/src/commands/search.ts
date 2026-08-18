import {
  BASE_URL,
  htmlFetch,
  parseJobCards,
  parseNumFound,
  withinDays,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** Careers24 URL segments are lowercase, hyphen-joined slugs. */
export function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Search is a path-based URL: `/jobs/[lc-<location>/][kw-<keywords>/]`.
 * Order matters — a `lc-` segment placed *after* `kw-` is ignored by the site,
 * so the location segment always comes first.
 */
export function buildUrl(opts: SearchOpts): string {
  const segments: string[] = []
  if (opts.location) segments.push(`lc-${slug(opts.location)}`)
  if (opts.query) segments.push(`kw-${slug(opts.query)}`)
  const path = segments.length > 0 ? `/jobs/${segments.join("/")}/` : "/jobs/"
  const qs = opts.page > 1 ? `?page=${opts.page}` : ""
  return `${BASE_URL}${path}${qs}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 46).padEnd(46)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const type = (c.employmentType || "—").slice(0, 12).padEnd(12)
    return `${c.id.padEnd(9)} ${title} ${loc} ${type} ${c.date || "—"}`
  })
  const header =
    "ID".padEnd(9) +
    " " +
    "TITLE".padEnd(46) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "TYPE".padEnd(12) +
    " POSTED"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    const total = parseNumFound(html)
    let cards = parseJobCards(html)
    cards = cards.filter((c) => withinDays(c.date, opts.jobage))
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.location || "—"} · ${c.employmentType || "—"} · ${c.date || "—"}` +
              `${c.daysLeft ? ` · ${c.daysLeft}` : ""}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: opts.page, total }, results: cards },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
