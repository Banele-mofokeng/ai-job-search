// Data source: Job Placements (jobplacements.com), a South African job board.
// Search is a classic ASP form: results come back as an HTML page of "entry" cards.
// Detail pages carry a schema.org JobPosting JSON-LD block, which is far more stable
// than the surrounding markup, so detail parsing reads that first and falls back to
// the visible labels only for fields the JSON-LD gets wrong or omits.

export const BASE = "https://www.jobplacements.com"
export const SEARCH_URL = `${BASE}/jobList.asp`

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; jobplacements-search-cli/1.0)"

/** Results the board returns per page. Fixed by the site, not configurable. */
export const PAGE_SIZE = 10

async function request(url: string, init: RequestInit): Promise<Response> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-ZA,en;q=0.9",
        ...(init.headers ?? {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
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
    if (response.status === 404) return response
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

/** GET a page. Returns "" on a 404 rather than throwing. */
export async function htmlGet(url: string): Promise<string> {
  const r = await request(url, { method: "GET" })
  if (r.status === 404) return ""
  return r.text()
}

/**
 * POST the search form. Pagination only works over POST — the same `start` value
 * passed as a query string is ignored and page 1 comes back every time.
 */
export async function htmlPost(url: string, form: Record<string, string>): Promise<string> {
  const body = new URLSearchParams(form).toString()
  const r = await request(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })
  if (r.status === 404) return ""
  return r.text()
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
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

export function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** HTML block -> readable plain text, keeping paragraph and list breaks. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    // `li` is deliberately absent: the opening tag already starts the line, so
    // closing on it too puts a blank line between every bullet.
    .replace(/<\/(p|ul|ol|div|h\d|tr)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/**
 * The board prints ages, not dates: "Today", "1day ago", "5 days ago".
 * Convert to an absolute ISO date so results are comparable with other portals.
 * `now` is injectable so the tests are not time-dependent.
 */
export function relativeToIso(raw: string | null | undefined, now: Date = new Date()): string | null {
  if (!raw) return null
  const text = raw.trim().toLowerCase()
  if (!text) return null
  let days: number | null = null
  if (/^today$/.test(text)) days = 0
  else if (/^yesterday$/.test(text)) days = 1
  else {
    // "1day ago" (no space) and "5 days ago" both occur on the board.
    const m = text.match(/^(\d+)\s*days?\s*ago$/)
    if (m) days = parseInt(m[1], 10)
  }
  if (days === null) {
    const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    return direct ? direct[1] : null
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  briefDescription: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  recruiter: string | null
  jobRef: string | null
  region: string | null
  country: string | null
  applyUrl: string | null
}

/**
 * Parse the search results page. Cards are split on the `showJob(n,id)` handler that
 * every entry div carries, and each chunk is parsed independently so one malformed
 * card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/onclick="showJob\(/i).slice(1)

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^\s*\d+\s*,\s*(\d+)\s*\)/)
    if (!idMatch) continue
    const id = idMatch[1]

    // Title: <STRONG><FONT size="+1">TITLE</STRONG></FONT> — note the crossed tags,
    // which is why this matches on </STRONG> rather than a well-formed pair.
    const titleMatch = chunk.match(/<STRONG>\s*<FONT[^>]*>([\s\S]*?)<\/STRONG>/i)
    const title = titleMatch ? clean(titleMatch[1]) : ""
    if (!title) continue

    // The line after the title, before the grey date, is the location.
    let location: string | null = null
    const afterTitle = chunk.slice(titleMatch!.index! + titleMatch![0].length)
    const locMatch = afterTitle.match(/<\/FONT>\s*<BR>\s*([\s\S]*?)<BR>/i)
    if (locMatch) location = clean(locMatch[1]) || null

    const dateMatch = chunk.match(/<FONT\s+color=['"]?Grey['"]?[^>]*>([\s\S]*?)<\/FONT>/i)
    const date = relativeToIso(dateMatch ? clean(dateMatch[1]) : null)

    const salaryMatch = chunk.match(/Salary:\s*([\s\S]*?)<BR>/i)
    const salary = salaryMatch ? clean(salaryMatch[1]) || null : null

    const linkMatch = chunk.match(/<A\s+HREF="([^"]*\/Jobs\/[^"]+)"/i)
    const url = linkMatch
      ? decodeHtmlEntities(linkMatch[1]).split("?")[0]
      : `${BASE}/cvs.asp?jobID=${id}`

    // Brief blurb sits between the salary line and the Details anchor.
    let briefDescription: string | null = null
    if (salaryMatch) {
      const tail = chunk.slice(salaryMatch.index! + salaryMatch[0].length)
      const upToLink = tail.split(/<A\s+HREF=/i)[0]
      briefDescription = clean(upToLink) || null
    }

    results.push({
      id,
      title,
      // The results page never names the recruiter; `detail` fills this in.
      company: null,
      location,
      date,
      url,
      salary,
      briefDescription,
    })
  }

  return results
}

interface JsonLdPosting {
  title?: string
  datePosted?: string
  description?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }
}

/** Pull the schema.org JobPosting block out of a detail page, if present. */
export function parseJsonLd(html: string): JsonLdPosting | null {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim()) as JsonLdPosting & { "@type"?: string }
      if (parsed["@type"] === "JobPosting") return parsed
    } catch {
      // A malformed block is not fatal — fall through to the visible-label parse.
    }
  }
  return null
}

/**
 * Read a labelled field off the detail page. The board lays each one out as two
 * sibling cells — `<STRONG>Label:</STRONG>` in the narrow one, the value in the
 * wide `pure-u-15-24` one that follows — so the value is never adjacent to its
 * label in the source. Falls back to a loose "label then text" match.
 */
export function labelValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const celled = html.match(
    new RegExp(
      `${escaped}\\s*:\\s*</STRONG>[\\s\\S]{0,400}?<div[^>]*class="[^"]*pure-u-15-24[^"]*"[^>]*>([\\s\\S]*?)</div>`,
      "i",
    ),
  )
  if (celled) {
    const value = clean(celled[1])
    if (value) return value
  }
  const loose = html.match(new RegExp(`${escaped}\\s*:\\s*([^<]{1,200})`, "i"))
  return loose ? clean(loose[1]) || null : null
}

export function parseJobDetail(html: string, id: string, url: string): JobDetail {
  const ld = parseJsonLd(html)
  const addr = ld?.jobLocation?.address

  const locality = addr?.addressLocality?.trim() || null
  const region = addr?.addressRegion?.trim() || null
  const country = addr?.addressCountry?.trim() || null
  const location = [locality, region].filter(Boolean).join(", ") || labelValue(html, "Location")

  // The JSON-LD description carries the whole advert (employer blurb, duties,
  // requirements, package) as one flattened string. The visible page splits that
  // same text across sibling widget divs with no single wrapper, so scraping it
  // truncates at the first block — the structured data is the honest source here.
  let description: string | null = ld?.description ? htmlToText(ld.description) : null
  if (!description) {
    const descBlock = html.match(
      /<div[^>]*class="[^"]*elementor-widget-text-editor[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    )
    if (descBlock) description = htmlToText(descBlock[1])
  }

  return {
    id,
    title: (ld?.title && ld.title.trim()) || labelValue(html, "Job Title") || "(untitled)",
    company: ld?.hiringOrganization?.name?.trim() || labelValue(html, "Recruiter"),
    location,
    // baseSalary in the JSON-LD carries placeholder junk (currency "vvvvv", empty
    // min/max), so the visible salary line is the only trustworthy source.
    salary: labelValue(html, "Salary"),
    date: ld?.datePosted?.trim() || null,
    url,
    briefDescription: null,
    description,
    recruiter: labelValue(html, "Recruiter"),
    jobRef: labelValue(html, "Job Ref"),
    region,
    country,
    applyUrl: `${BASE}/cvs.asp?jobID=${id}`,
  }
}

/** Keep adverts posted within `days`. Adverts with no parseable date are kept. */
export function withinJobage(cards: JobCard[], days: number | undefined): JobCard[] {
  if (days === undefined || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = Date.parse(c.date + "T00:00:00Z")
    return isNaN(t) ? true : t >= cutoff
  })
}

/** Accept a bare numeric job id, a /Jobs/... advert URL, or a cvs.asp?jobID= link. */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d{4,}$/.test(trimmed)) return trimmed
  const q = trimmed.match(/[?&]jobID=(\d+)/i)
  if (q) return q[1]
  // Advert URLs embed the id between the slug and "-Job-Search".
  const slug = trimmed.match(/-(\d{4,})-Job-Search/i)
  if (slug) return slug[1]
  const anyDigits = trimmed.match(/(\d{6,})/)
  return anyDigits ? anyDigits[1] : null
}
