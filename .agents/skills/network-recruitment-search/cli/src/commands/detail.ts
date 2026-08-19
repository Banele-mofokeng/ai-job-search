import { buildSearchUrl, jsonFetch, toDetail, writeError, type Advert } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * Accept a bare vacancy reference (`ITA006188/Mel`) or any URL carrying one in a
 * `vacancy_ref` query parameter — the site's job-details and apply links both do.
 */
export function normalizeRef(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const fromQuery = trimmed.match(/[?&]vacancy_ref=([^&#]+)/i)
  if (fromQuery) {
    try {
      return decodeURIComponent(fromQuery[1])
    } catch {
      return fromQuery[1]
    }
  }
  if (/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeRef(opts.id)
  if (!ref) {
    writeError(
      `Could not parse a vacancy reference from "${opts.id}" (expected e.g. ITA006188/Mel, or a URL with vacancy_ref=)`,
      "BAD_ID",
    )
    return 1
  }
  try {
    // There is no per-advert endpoint: the search API matches the reference as a
    // keyword and already returns the full description in the same payload.
    const adverts = (await jsonFetch<Advert[]>(buildSearchUrl({ query: ref }))) ?? []
    if (!Array.isArray(adverts) || adverts.length === 0) {
      writeError("Advert not found", "NOT_FOUND")
      return 1
    }
    const exact = adverts.find(
      (a) => (a.vacancy_ref ?? "").toString().trim().toLowerCase() === ref.toLowerCase(),
    )
    const job = toDetail(exact ?? adverts[0])
    if (!job) {
      writeError("Advert not found", "NOT_FOUND")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.sector ? `Sector: ${job.sector}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.expiryDate ? `Expires: ${job.expiryDate}` : "",
        job.consultant ? `Consultant: ${job.consultant}` : "",
        "",
        job.description || "(no description)",
        "",
        `Reference: ${job.id}`,
        `URL: ${job.url}`,
        job.applyUrl ? `Apply: ${job.applyUrl}` : "",
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
