import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Extract the numeric advert ID from a bare ID or any Careers24 advert URL. */
export function normalizeId(input: string): string | null {
  const fromUrl = input.match(/\/adverts\/(\d{5,})/i)
  if (fromUrl) return fromUrl[1]
  const bare = input.match(/^\d{5,}$/)
  if (bare) return input
  return null
}

/**
 * The advert slug is decorative — `/jobs/adverts/<id>-x/` resolves to the same
 * posting as the full slug URL, so the ID alone is enough.
 */
export function detailUrl(id: string): string {
  return `${BASE_URL}/jobs/adverts/${id}-x/`
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const url = detailUrl(id)
    const html = await htmlFetch(url)
    // A removed or expired advert 302s back to a search page (HTTP 200), which has
    // no vacancy-detail header — that is how a miss is detected.
    if (!html || !/vacancy-detail-head/i.test(html)) {
      writeError("Job not found (it may have expired and been removed)", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id, url)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Type: ${job.employmentType}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.sectors ? `Sectors: ${job.sectors}` : "",
        job.deadline ? `Apply before: ${job.deadline}` : "",
        job.daysLeft ? `Time left: ${job.daysLeft}` : "",
        job.reference ? `Reference: ${job.reference}` : "",
        "",
        job.description || "(no description)",
        "",
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
