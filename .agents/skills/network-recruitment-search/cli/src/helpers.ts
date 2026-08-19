// Data source: Network Recruitment's public Placement Partner advert API, the same
// endpoint the networkrecruitmentinternational.com jobs pages call from the browser.
// No authentication. It returns JSON, so there is no HTML parsing here.
//
// Two quirks drive the design of this file, both verified against the live API:
//   1. `pageSize` is accepted but ignored — every call returns the full match set.
//      Paging and limiting are therefore client-side.
//   2. The search response already carries `detail_description`, so `detail` is a
//      filtered search rather than a second endpoint.

export const API_URL =
  "https://az-jhb-was-rescr-duda-api-prod-networkrecruitint.azurewebsites.net" +
  "/placementpartnerxml/api/getallnetworkrecruitmentsadsbysearchterm"

export const SITE = "https://www.networkrecruitmentinternational.com"
export const APPLY_URL = "https://webapp.placementpartner.com/wi/application_form.php"

/** Provinces the API accepts in its `region` parameter. Anything else is a town filter. */
export const REGIONS = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; network-recruitment-search-cli/1.0)"

/** Resolve a user-supplied location to the API's province spelling, or null. */
export function resolveRegion(input: string | undefined): string | null {
  if (!input) return null
  const norm = input.trim().toLowerCase().replace(/[\s-]+/g, "")
  for (const r of REGIONS) {
    if (r.toLowerCase().replace(/[\s-]+/g, "") === norm) return r
  }
  return null
}

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch<T>(url: string): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-ZA,en;q=0.9",
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
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    const text = await response.text()
    if (!text.trim()) return null
    try {
      return JSON.parse(text) as T
    } catch {
      throw new Error("Upstream returned a non-JSON body")
    }
  }
  throw new Error("Request failed after max retries")
}

/** One advert as the upstream API returns it. Every field may be absent or null. */
export interface Advert {
  company_ref?: string | null
  vacancy_ref?: string | null
  job_title?: string | null
  region?: string | null
  town?: string | null
  sector?: string | null
  brief_description?: string | null
  detail_description?: string | null
  salary_min?: string | null
  salary_max?: string | null
  start_date?: string | null
  expiry_date?: string | null
  consultant_name?: string | null
  branch_name?: string | null
  [k: string]: unknown
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  sector: string | null
  salary: string | null
  briefDescription: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  expiryDate: string | null
  consultant: string | null
  branch: string | null
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

/** HTML advert body -> readable plain text, keeping paragraph and list breaks. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    // `li` is deliberately absent: the opening tag already starts the line, so
    // closing on it too puts a blank line between every bullet.
    .replace(/<\/(p|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** "2026-08-19T00:00:00" -> "2026-08-19". Returns null for anything unparseable. */
export function isoDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const t = Date.parse(raw)
  return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10)
}

function salaryOf(a: Advert): string | null {
  const min = (a.salary_min ?? "").toString().trim()
  const max = (a.salary_max ?? "").toString().trim()
  if (!min && !max) return null
  if (min && max) return min === max ? min : `${min} - ${max}`
  return min || max
}

/** Public advert URL on the Network Recruitment site. */
export function advertUrl(a: Advert): string {
  const instance = encodeURIComponent((a.company_ref ?? "").toString())
  const ref = encodeURIComponent((a.vacancy_ref ?? "").toString())
  return `${SITE}/job-details?instance=${instance}&vacancy_ref=${ref}`
}

/**
 * Map one upstream advert to the portal-skill contract shape. Adverts without a
 * vacancy reference are unusable as records (no stable id, no URL) and are dropped
 * by the caller rather than emitted with a synthetic id.
 */
export function toCard(a: Advert): JobCard | null {
  const id = (a.vacancy_ref ?? "").toString().trim()
  if (!id) return null
  const town = (a.town ?? "").toString().trim()
  const region = (a.region ?? "").toString().trim()
  const location = [town, region].filter(Boolean).join(", ") || null
  const branch = (a.branch_name ?? "").toString().trim()
  return {
    id,
    title: (a.job_title ?? "").toString().trim() || "(untitled)",
    // The advertiser is the agency; the end client is not disclosed on the board.
    company: branch ? `Network Recruitment (${branch})` : "Network Recruitment",
    location,
    date: isoDate(a.start_date),
    url: advertUrl(a),
    sector: (a.sector ?? "").toString().trim() || null,
    salary: salaryOf(a),
    briefDescription: htmlToText(a.brief_description ?? null),
  }
}

export function toDetail(a: Advert): JobDetail | null {
  const card = toCard(a)
  if (!card) return null
  const instance = encodeURIComponent((a.company_ref ?? "").toString())
  const ref = encodeURIComponent((a.vacancy_ref ?? "").toString())
  return {
    ...card,
    description: htmlToText(a.detail_description ?? null) ?? card.briefDescription,
    expiryDate: isoDate(a.expiry_date),
    consultant: (a.consultant_name ?? "").toString().trim() || null,
    branch: (a.branch_name ?? "").toString().trim() || null,
    applyUrl: `${APPLY_URL}?id=${instance}&vacancy_ref=${ref}`,
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

/** Case-insensitive substring match against the location string. */
export function matchesTown(card: JobCard, town: string): boolean {
  return (card.location ?? "").toLowerCase().includes(town.trim().toLowerCase())
}

export function buildSearchUrl(opts: {
  query?: string
  region?: string | null
  department?: string
  pageSize?: number
}): string {
  const params = new URLSearchParams()
  params.set("region", opts.region ?? "")
  params.set("department", opts.department ?? "")
  if (opts.query) params.set("keywords", opts.query)
  params.set("pageSize", String(opts.pageSize ?? 200))
  return `${API_URL}?${params.toString()}`
}
