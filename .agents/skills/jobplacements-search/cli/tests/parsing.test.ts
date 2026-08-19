import { describe, expect, test } from "bun:test"
import {
  labelValue,
  normalizeId,
  parseJobCards,
  parseJobDetail,
  parseJsonLd,
  relativeToIso,
  withinJobage,
  htmlToText,
} from "../src/helpers.js"

// Trimmed from a real jobList.asp response. The crossed <STRONG>/<FONT> tags and
// the uppercase attributes are exactly as the board emits them.
const SEARCH_HTML = `
<div class="entryActive" id="entry1" onclick="showJob(1,1319116);">
<STRONG><FONT size="+1">TJ 19258 - Software Developer (C# / VB.NET / SQL Server)</STRONG></FONT><BR>
Johannesburg<BR>
<FONT color='Grey'>2 days ago</FONT><BR><BR>
Salary: R35 000 Negotiable based on Experience<BR><BR>Software <STRONG>developer</STRONG> role<BR><BR>
<A HREF="https://www.jobplacements.com/Jobs/T/TJ-19258-Software-1319116-Job-Search-8-17-2026.asp?sid=&kwds=developer" target="_blank" class="navsOrange">Details</A>
<A HREF="/cvs.asp?jobID=1319116" target="_blank" class="navsOrange">Upload CV &amp; Apply</A>
</div>
<div class="entry" id="entry2" onclick="showJob(2,1318249);">
<STRONG><FONT size="+1">Salesforce Cloud Developer</STRONG></FONT><BR>
Cape Town<BR>
<FONT color='Grey'>Today</FONT><BR><BR>
Salary: Market related<BR><BR>Salesforce work<BR><BR>
<A HREF="https://www.jobplacements.com/Jobs/S/Salesforce-1318249-Job-Search-8-14-2026.asp" class="navsOrange">Details</A>
</div>
<div class="entry" id="entry3" onclick="showJob(3,999);">
<STRONG><FONT size="+1"></STRONG></FONT><BR>
</div>
`

const DETAIL_HTML = `
<script type="application/ld+json">
{ "@context":"http://schema.org", "@type":"JobPosting",
  "title":"TJ 19258 - Software Developer",
  "hiringOrganization":{"@type":"Organization","name":"Professional Career Services"},
  "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress",
     "addressLocality":"Johannesburg","addressRegion":"Gauteng","addressCountry":"South Africa"}},
  "datePosted":"2026-08-17",
  "baseSalary":{"@type":"MonetaryAmount","currency":"vvvvv","value":{"minValue":"","maxValue":""}},
  "description":"Employer Description Retail shopfitting. Skills C# &amp; SQL Server."
}
</script>
<div class="pure-g overrideFont">
  <div class="pure-u-9-24"><STRONG>Recruiter:</STRONG><BR><BR>
  </div>
  <div class="pure-u-15-24 pure-u-lg-20-24">
    Professional Career Services<BR><BR>
  </div>
</div>
<div class="pure-g overrideFont">
  <div class="pure-u-9-24"><STRONG>Salary:</STRONG><BR><BR>
  </div>
  <div class="pure-u-15-24 pure-u-lg-20-24">
    R35 000 Negotiable based on Experience<BR><BR>
  </div>
</div>
`

describe("relativeToIso", () => {
  const now = new Date("2026-08-19T12:00:00Z")

  test("converts the board's relative ages to absolute dates", () => {
    expect(relativeToIso("Today", now)).toBe("2026-08-19")
    expect(relativeToIso("2 days ago", now)).toBe("2026-08-17")
    expect(relativeToIso("Yesterday", now)).toBe("2026-08-18")
  })

  test("handles the board's spacing bug (\"1day ago\")", () => {
    expect(relativeToIso("1day ago", now)).toBe("2026-08-18")
  })

  test("passes an absolute date straight through", () => {
    expect(relativeToIso("2026-08-01", now)).toBe("2026-08-01")
  })

  test("returns null on junk instead of guessing", () => {
    expect(relativeToIso("last week", now)).toBeNull()
    expect(relativeToIso(null, now)).toBeNull()
    expect(relativeToIso("", now)).toBeNull()
  })
})

describe("parseJobCards", () => {
  const cards = parseJobCards(SEARCH_HTML)

  test("parses every well-formed card", () => {
    expect(cards).toHaveLength(2)
    expect(cards.map((c) => c.id)).toEqual(["1319116", "1318249"])
  })

  test("reads title, location, salary and the advert URL", () => {
    const c = cards[0]!
    expect(c.title).toBe("TJ 19258 - Software Developer (C# / VB.NET / SQL Server)")
    expect(c.location).toBe("Johannesburg")
    expect(c.salary).toBe("R35 000 Negotiable based on Experience")
    expect(c.url).toBe(
      "https://www.jobplacements.com/Jobs/T/TJ-19258-Software-1319116-Job-Search-8-17-2026.asp",
    )
  })

  test("leaves company null — the results page never names the recruiter", () => {
    expect(cards.every((c) => c.company === null)).toBe(true)
  })

  test("skips a malformed card without losing the rest", () => {
    expect(cards.map((c) => c.id)).not.toContain("999")
  })

  test("converts the relative date to an absolute one", () => {
    expect(cards[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("parseJsonLd", () => {
  test("finds the JobPosting block", () => {
    const ld = parseJsonLd(DETAIL_HTML)
    expect(ld?.hiringOrganization?.name).toBe("Professional Career Services")
    expect(ld?.datePosted).toBe("2026-08-17")
  })

  test("returns null when there is no block rather than throwing", () => {
    expect(parseJsonLd("<html><body>nothing</body></html>")).toBeNull()
  })

  test("tolerates a malformed block", () => {
    expect(parseJsonLd('<script type="application/ld+json">{not json</script>')).toBeNull()
  })
})

describe("labelValue", () => {
  test("reads a value out of the sibling cell, not next to the label", () => {
    expect(labelValue(DETAIL_HTML, "Salary")).toBe("R35 000 Negotiable based on Experience")
    expect(labelValue(DETAIL_HTML, "Recruiter")).toBe("Professional Career Services")
  })

  test("returns null for a label that is not on the page", () => {
    expect(labelValue(DETAIL_HTML, "Clearance")).toBeNull()
  })
})

describe("parseJobDetail", () => {
  const job = parseJobDetail(DETAIL_HTML, "1319116", "https://www.jobplacements.com/Jobs/T/x.asp")

  test("prefers the JSON-LD for identity and date", () => {
    expect(job.company).toBe("Professional Career Services")
    expect(job.location).toBe("Johannesburg, Gauteng")
    expect(job.date).toBe("2026-08-17")
    expect(job.country).toBe("South Africa")
  })

  test("takes salary from the visible label, since baseSalary is placeholder junk", () => {
    expect(job.salary).toBe("R35 000 Negotiable based on Experience")
  })

  test("decodes entities in the description", () => {
    expect(job.description).toContain("C# & SQL Server")
  })

  test("builds the apply URL from the id", () => {
    expect(job.applyUrl).toBe("https://www.jobplacements.com/cvs.asp?jobID=1319116")
  })
})

describe("normalizeId", () => {
  test("accepts a bare numeric id", () => {
    expect(normalizeId("1319116")).toBe("1319116")
  })

  test("extracts the id from an advert URL", () => {
    expect(
      normalizeId("https://www.jobplacements.com/Jobs/T/TJ-19258-Software-1319116-Job-Search-8-17-2026.asp"),
    ).toBe("1319116")
  })

  test("extracts the id from a cvs.asp apply link", () => {
    expect(normalizeId("https://www.jobplacements.com/cvs.asp?jobID=1319116")).toBe("1319116")
  })

  test("returns null on input with no id", () => {
    expect(normalizeId("")).toBeNull()
    expect(normalizeId("https://www.jobplacements.com/")).toBeNull()
  })
})

describe("withinJobage", () => {
  const base = parseJobCards(SEARCH_HTML)[0]!
  const cards = [
    { ...base, date: new Date().toISOString().slice(0, 10) },
    { ...base, id: "OLD", date: "2020-01-01" },
    { ...base, id: "NODATE", date: null },
  ]

  test("drops stale adverts", () => {
    expect(withinJobage(cards, 7).map((c) => c.id)).not.toContain("OLD")
  })

  test("keeps undated adverts rather than hiding them", () => {
    expect(withinJobage(cards, 7).map((c) => c.id)).toContain("NODATE")
  })

  test("is a no-op without a window", () => {
    expect(withinJobage(cards, undefined)).toHaveLength(3)
  })
})

describe("htmlToText", () => {
  test("keeps list structure and decodes entities", () => {
    expect(htmlToText("<ul><li>C# &amp; SQL</li><li>REST</li></ul>")).toBe("- C# & SQL\n- REST")
  })

  test("returns null for empty input", () => {
    expect(htmlToText(null)).toBeNull()
  })
})
