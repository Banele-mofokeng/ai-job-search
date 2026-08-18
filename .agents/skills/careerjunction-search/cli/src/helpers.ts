// Data source: CareerJunction (careerjunction.co.za), a South African general job
// board. Both search and detail are plain server-rendered HTML — no API, no auth.
// robots.txt allows `/` for all agents (only /myprofile/* is disallowed), so the
// public search and job pages this CLI reads are in scope.
//
// Parsing is regex-based on shallow, stable anchors (class names on <li> items),
// chunked per job card so one malformed card cannot break the rest.

export const BASE_URL = "https://www.careerjunction.co.za"
export const SEARCH_URL = `${BASE_URL}/jobs/results`

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; careerjunction-search-cli/1.0)"

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
    // CareerJunction redirects unknown job IDs to /not-found with a 200; treat as missing.
    if (response.url.includes("/not-found")) return ""
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
  companyUrl: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  employmentType: string | null
  expires: string | null
  reference: string | null
}

export interface JobDetail extends JobCard {
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

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

function orNull(value: string | undefined | null): string | null {
  const v = (value ?? "").trim()
  return v === "" ? null : v
}

/** Value of an `<li class="<name>">` item inside a job card / overview list. */
function liValue(chunk: string, className: string): string | null {
  const re = new RegExp(`<li class="${className}"[^>]*>([\\s\\S]*?)</li>`, "i")
  const match = re.exec(chunk)
  return match ? orNull(clean(match[1])) : null
}

/**
 * Inner HTML of the first `<div>` carrying `className`, tracking nesting depth so
 * inner `<div>`s do not truncate the block.
 */
export function extractDivContent(html: string, className: string): string | null {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const openRe = new RegExp(`<div[^>]*class="[^"]*${escaped}[^"]*"[^>]*>`, "i")
  const open = openRe.exec(html)
  if (!open) return null

  let i = open.index + open[0].length
  let depth = 1
  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf("<div", i)
    const nextClose = html.indexOf("</div>", i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 4
    } else {
      depth--
      i = nextClose + 6
    }
  }
  return html.slice(open.index + open[0].length, i - 6)
}

/** Absolute URL from a site-relative href. */
export function absolute(href: string): string {
  const decoded = decodeHtmlEntities(href)
  if (decoded.startsWith("http")) return decoded
  return `${BASE_URL}${decoded.startsWith("/") ? "" : "/"}${decoded}`
}

/**
 * Parse a search-results page. Cards are `<div class="module job-result ...">`
 * blocks; we split on that marker and parse each chunk independently.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/<div class="module job-result/).slice(1)

  for (const chunk of chunks) {
    // Title + URL live in <h2><a jobId="..." href="...">Title</a>.
    const titleMatch = chunk.match(
      /<h2>\s*<a\s+jobId="(\d+)"\s*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    )
    if (!titleMatch) continue
    const id = titleMatch[1]
    const url = absolute(titleMatch[2])
    const title = clean(titleMatch[3])
    if (!title) continue

    // Company: <h3><a href="/companies/<id>/<slug>">Name</a>. Recruiter-blind ads omit it.
    let company: string | null = null
    let companyUrl: string | null = null
    const companyMatch = chunk.match(/<h3>\s*<a href="(\/companies\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (companyMatch) {
      companyUrl = absolute(companyMatch[1])
      company = orNull(clean(companyMatch[2]))
    }

    const postedRaw = liValue(chunk, "updated-time")

    results.push({
      id,
      title,
      company,
      companyUrl,
      location: liValue(chunk, "location"),
      date: postedRaw ? postedRaw.replace(/^Posted\s+/i, "") : null,
      url,
      salary: liValue(chunk, "salary"),
      employmentType: liValue(chunk, "position"),
      expires: liValue(chunk, "expires"),
      reference: liValue(chunk, "cjun-job-ref"),
    })
  }

  return results
}

/** Parse a single job's detail page. */
export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const nameWrapper = html.match(/<div class="name-wrapper">([\s\S]*?)<\/div>/i)?.[1] ?? html
  const title = orNull(clean(nameWrapper.match(/<h1>([\s\S]*?)<\/h1>/i)?.[1] ?? ""))
  const company = orNull(clean(nameWrapper.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? ""))
  const companyLink = html.match(/<a href="(\/companies\/[^"]+)"/i)

  const overview = html.match(/<ul class="job-overview[^"]*">([\s\S]*?)<\/ul>/i)?.[1] ?? ""
  const postedRaw = liValue(overview, "updated-time")

  // Description body lives in `div.job-details-description` ("About the position",
  // requirements, etc.). Scripts and style blocks are dropped before tag stripping.
  let description: string | null = null
  const descHtml = extractDivContent(html, "job-details-description")
  if (descHtml) {
    const withBreaks = descHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, "\n")
    description = orNull(
      decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    )
  }

  // The apply form is always /apply/<id>; prefer the link the page renders.
  const applyMatch = html.match(/href='?"?(\/apply\/\d+)'?"?/i)

  return {
    id,
    title: title ?? "(untitled)",
    company,
    companyUrl: companyLink ? absolute(companyLink[1]) : null,
    location: liValue(overview, "location"),
    date: postedRaw ? postedRaw.replace(/^Posted\s+/i, "") : null,
    url,
    salary: liValue(overview, "salary"),
    employmentType: liValue(overview, "position"),
    expires: liValue(overview, "expires"),
    reference: liValue(overview, "cjun-job-ref"),
    description,
    applyUrl: applyMatch ? absolute(applyMatch[1]) : null,
  }
}

/**
 * CareerJunction has no posting-age request parameter — freshness is filtered
 * client-side from the card's "Posted <d Mon yyyy>" text.
 */
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
