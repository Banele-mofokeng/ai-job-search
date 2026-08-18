import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Extract the numeric job ID from a bare ID or any CareerJunction job URL. */
export function normalizeId(input: string): string | null {
  const fromUrl = input.match(/job-(\d{5,})(?:\.aspx)?/i)
  if (fromUrl) return fromUrl[1]
  const bare = input.match(/^\d{5,}$/)
  if (bare) return input
  return null
}

/**
 * `/jobs/job-<id>` 301s to the canonical slug URL (`/<slug>-job-<id>.aspx`), so
 * an ID alone is enough — the slug does not have to be known up front.
 */
export function detailUrl(id: string): string {
  return `${BASE_URL}/jobs/job-${id}`
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
    if (!html) {
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
        job.date ? `Posted: ${job.date}` : "",
        job.expires ? `Expires: ${job.expires}` : "",
        job.reference ? `Reference: ${job.reference}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
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
