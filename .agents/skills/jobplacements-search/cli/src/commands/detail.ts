import { BASE, htmlGet, normalizeId, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const input = opts.id.trim()
  const isUrl = /^https?:\/\//i.test(input)

  // Advert URLs on this board are slug-based and carry no lookup endpoint: a bare
  // numeric id cannot be turned back into its URL (cvs.asp?jobID= serves the CV
  // upload form, not the advert). Say so rather than guessing a URL that 404s.
  if (!isUrl) {
    writeError(
      `Job Placements advert URLs are slug-based, so a bare id cannot be resolved. ` +
        `Pass the full advert URL — it is the "url" field of each search result ` +
        `(e.g. ${BASE}/Jobs/T/Some-Role-${normalizeId(input) ?? "1234567"}-Job-Search-....asp).`,
      "NEED_URL",
    )
    return 1
  }

  const id = normalizeId(input)
  if (!id) {
    writeError(`Could not parse a job id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  if (!input.toLowerCase().includes("jobplacements.com")) {
    writeError(`"${opts.id}" is not a jobplacements.com URL`, "BAD_ID")
    return 1
  }

  try {
    const html = await htmlGet(input)
    if (!html) {
      writeError("Advert not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id, input.split("?")[0])

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.date ? `Posted: ${job.date}` : "",
        job.jobRef ? `Job ref: ${job.jobRef}` : "",
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
