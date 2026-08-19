import {
  buildSearchUrl,
  jsonFetch,
  matchesTown,
  resolveRegion,
  toCard,
  withinJobage,
  writeError,
  type Advert,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  department?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export const PAGE_SIZE = 20

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const id = (c.id || "").slice(0, 16).padEnd(16)
    const title = (c.title || "").slice(0, 40).padEnd(40)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const sector = (c.sector || "—").slice(0, 20).padEnd(20)
    return `${id} ${title} ${loc} ${sector} ${c.date || "—"}`
  })
  const header =
    "ID".padEnd(16) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "LOCATION".padEnd(24) +
    " " +
    "SECTOR".padEnd(20) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // A location that names a province is pushed to the API; anything else
    // (a town, a suburb) is filtered client-side, because the API only
    // understands provinces.
    const region = resolveRegion(opts.location)
    const townFilter = opts.location && !region ? opts.location : null

    const url = buildSearchUrl({
      query: opts.query,
      region,
      department: opts.department,
    })
    const adverts = (await jsonFetch<Advert[]>(url)) ?? []
    if (!Array.isArray(adverts)) {
      writeError("Upstream returned an unexpected payload shape", "BAD_PAYLOAD")
      return 1
    }

    let cards = adverts
      .map(toCard)
      .filter((c): c is JobCard => c !== null)
    if (townFilter) cards = cards.filter((c) => matchesTown(c, townFilter))
    cards = withinJobage(cards, opts.jobage)

    const total = cards.length
    // The API ignores pageSize and returns the whole match set, so paging is ours.
    const start = (opts.page - 1) * PAGE_SIZE
    cards = cards.slice(start, start + PAGE_SIZE)
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        (cards.length
          ? cards
              .map(
                (c) =>
                  `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  ${
                    c.salary || "salary not stated"
                  }\n  id: ${c.id}\n  ${c.url}`,
              )
              .join("\n\n")
          : "No results.") + "\n",
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
