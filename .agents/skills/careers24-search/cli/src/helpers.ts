// Data source: Careers24 (careers24.com), a large South African general job board.
// Search and detail are server-rendered HTML — no API, no auth.
//
// robots.txt blocks a named list of crawler user-agents (Scrapy, SemrushBot,
// Baiduspider, …) with `Disallow: /`; there is no `User-agent: *` group, so an
// honest non-listed agent is not excluded from the public job pages.
//
// Parsing is regex-based, chunked per job card so one malformed card cannot
// break the rest.

export const BASE_URL = "https://www.careers24.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; careers24-search-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-ZA,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  employmentType: string | null
  daysLeft: string | null
}

export interface JobDetail extends JobCard {
  salary: string | null
  sectors: string | null
  reference: string | null
  deadline: string | null
  description: string | null
  applyUrl: string | null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * Some Careers24 ads are pasted from Word and carry bytes that decode to U+FFFD
 * (they render as bullet artefacts). Drop them rather than passing them through
 * into a CV/cover-letter draft.
 */
function dropReplacementChars(text: string): string {
  return text.replace(/�/g, "")
}

function clean(html: string): string {
  return dropReplacementChars(decodeHtmlEntities(stripTags(html)))
}

function orNull(value: string | undefined | null): string | null {
  const v = (value ?? "").trim()
  return v === "" ? null : v
}

export function absolute(href: string): string {
  const decoded = decodeHtmlEntities(href)
  if (decoded.startsWith("http")) return decoded
  return `${BASE_URL}${decoded.startsWith("/") ? "" : "/"}${decoded}`
}

/** Total match count the results page reports in its hidden NumFound input. */
export function parseNumFound(html: string): number | null {
  const m = html.match(/id="NumFound"[^>]*value="(\d+)"/i)
  return m ? parseInt(m[1], 10) : null
}

/**
 * Parse a search-results page. Cards are
 * `<div class="job-card" data-control="job-card" data-id="<id>">` blocks.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/<div class="job-card" data-control="job-card" data-id="/).slice(1)

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^(\d+)"/)
    if (!idMatch) continue
    const id = idMatch[1]

    const linkMatch = chunk.match(
      /<a href="([^"]+)" data-control="vacancy-title"[^>]*>\s*<h2>([\s\S]*?)<\/h2>/i,
    )
    if (!linkMatch) continue
    const url = absolute(linkMatch[1].split("?")[0])
    const title = clean(linkMatch[2])
    if (!title) continue

    // The left column is an unlabelled <li> for location, then labelled items.
    const left = chunk.match(/job-card-left">\s*<ul>([\s\S]*?)<\/ul>/i)?.[1] ?? ""
    const items = [...left.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => clean(m[1]))
    const location = orNull(items[0] ?? "")
    const employmentType =
      orNull(items.find((i) => /^Job Type:/i.test(i))?.replace(/^Job Type:\s*/i, "") ?? "") ?? null
    const postedItem = items.find((i) => /^Posted:/i.test(i)) ?? ""
    const date = orNull(postedItem.replace(/^Posted:\s*/i, "").replace(/\s*\d+\s*Days? left.*$/i, ""))
    const daysLeft = orNull(postedItem.match(/(\d+\s*Days? left)/i)?.[1] ?? "")

    // The card itself never names the employer; the mail-icon data attributes are
    // the only per-card metadata, and they carry title/location only.
    results.push({ id, title, company: null, location, date, url, employmentType, daysLeft })
  }

  return results
}

/** Value of a `<li>` in the detail page's icon list, matched by its label. */
function detailListValue(list: string, label: RegExp): string | null {
  const items = [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => clean(m[1]))
  const hit = items.find((i) => label.test(i))
  if (!hit) return null
  return orNull(hit.replace(label, "").trim())
}

/** Parse a single job's detail page. */
export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const title = orNull(
    clean(html.match(/class="[^"]*vacancy-detail-head"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""),
  )

  const list = html.match(/<div class="detailsList">([\s\S]*?)<\/ul>/i)?.[1] ?? ""
  const items = [...list.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => clean(m[1]))
  const location = orNull(items.find((i) => !/:/.test(i)) ?? "")

  const company = orNull(
    clean(html.match(/Employer:\s*<a[^>]*>\s*<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? ""),
  )

  // Body: the ad text block, plus the "Candidate Requirements" section when present.
  const blocks: string[] = []
  for (const m of html.matchAll(/<div class="v-descrip">([\s\S]*?)<\/div>/gi)) {
    const withBreaks = m[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
    const text = dropReplacementChars(decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " ")))
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    if (text) blocks.push(text)
  }

  const deadlineMatch = html.match(/Apply before\s*([A-Za-z]{3,}\s+\d{1,2}\s+\d{4})/i)
  const applyMatch = html.match(/href="([^"]*\/jobs\/apply\/\d+)"/i)

  return {
    id,
    title: title ?? "(untitled)",
    company,
    location,
    date: null, // the detail page shows a deadline, not a posted date
    url,
    employmentType: detailListValue(list, /^Job Type:\s*/i),
    daysLeft: orNull(html.match(/(\d+\s*Days? left)/i)?.[1] ?? ""),
    salary: detailListValue(list, /^Salary:\s*/i),
    sectors: detailListValue(list, /^Sectors:\s*/i),
    reference: detailListValue(list, /^Reference:\s*/i),
    deadline: deadlineMatch ? deadlineMatch[1] : null,
    description: blocks.length > 0 ? blocks.join("\n\n") : null,
    applyUrl: applyMatch ? absolute(applyMatch[1].replace(/^.*returnurl=/, "")) : null,
  }
}

/** Careers24 has no posting-age parameter; freshness is filtered client-side. */
export function parsePostedDate(text: string | null): Date | null {
  if (!text) return null
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/)
  if (!m) return null
  const parsed = new Date(`${m[1]} ${m[2]} ${m[3]} UTC`)
  return isNaN(parsed.getTime()) ? null : parsed
}

/** True if the card is within `days` of today (undated cards are kept, never dropped). */
export function withinDays(dateText: string | null, days: number): boolean {
  if (!days || days <= 0 || days >= 9999) return true
  const posted = parsePostedDate(dateText)
  if (!posted) return true
  const ageDays = (Date.now() - posted.getTime()) / 86400000
  return ageDays <= days
}
