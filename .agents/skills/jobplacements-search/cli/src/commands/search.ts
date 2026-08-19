import {
  PAGE_SIZE,
  SEARCH_URL,
  htmlPost,
  parseJobCards,
  withinJobage,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = (c.id || "").padEnd(9)
    const title = (c.title || "").slice(0, 46).padEnd(46)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const salary = (c.salary || "—").slice(0, 26).padEnd(26)
    return `${id} ${title} ${loc} ${salary} ${c.date || "—"}`
  })
  const header =
    "ID".padEnd(9) +
    " " +
    "TITLE".padEnd(46) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "SALARY".padEnd(26) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // Pagination only works over POST: the same `start` value in a query string
    // is ignored and the board returns page 1 every time.
    const form: Record<string, string> = { start: String(opts.page) }
    if (opts.query) form.kwds = opts.query
    if (opts.location) form.city = opts.location

    const html = await htmlPost(SEARCH_URL, form)
    let cards = parseJobCards(html)
    cards = withinJobage(cards, opts.jobage)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        (cards.length
          ? cards
              .map(
                (c) =>
                  `${c.title}\n  ${c.location || "—"} · ${c.date || "—"}\n  ${
                    c.salary || "salary not stated"
                  }\n  id: ${c.id}\n  ${c.url}`,
              )
              .join("\n\n")
          : "No results.") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: opts.page, pageSize: PAGE_SIZE }, results: cards },
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
