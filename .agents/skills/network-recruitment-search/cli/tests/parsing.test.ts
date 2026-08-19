import { describe, expect, test } from "bun:test"
import {
  advertUrl,
  htmlToText,
  isoDate,
  matchesTown,
  resolveRegion,
  toCard,
  toDetail,
  withinJobage,
  buildSearchUrl,
  type Advert,
} from "../src/helpers.js"
import { normalizeRef } from "../src/commands/detail.js"

const ADVERT: Advert = {
  company_ref: "network1",
  vacancy_ref: "ITA006188/Mel",
  job_title: "Fullstack Developer (SQL / C#)",
  region: "Gauteng",
  town: "Johannesburg East",
  sector: "Software Development",
  brief_description: "<div>Build &amp; support business-critical applications.</div>",
  detail_description: "<div><h3>Key Requirements</h3><ul><li>.NET Core</li><li>MSSQL</li></ul></div>",
  salary_min: "Market Related",
  salary_max: "Market Related",
  start_date: "2026-08-19T00:00:00",
  expiry_date: "2026-09-18",
  consultant_name: "A Consultant",
  branch_name: "IT Accelerate",
}

describe("resolveRegion", () => {
  test("matches a province regardless of case and spacing", () => {
    expect(resolveRegion("gauteng")).toBe("Gauteng")
    expect(resolveRegion("KwaZulu Natal")).toBe("KwaZulu-Natal")
    expect(resolveRegion("  western cape ")).toBe("Western Cape")
  })

  test("returns null for a town, which the caller filters client-side", () => {
    expect(resolveRegion("Johannesburg")).toBeNull()
    expect(resolveRegion(undefined)).toBeNull()
  })
})

describe("isoDate", () => {
  test("trims a timestamp to a date", () => {
    expect(isoDate("2026-08-19T00:00:00")).toBe("2026-08-19")
    expect(isoDate("2026-09-18")).toBe("2026-09-18")
  })

  test("returns null on junk rather than throwing", () => {
    expect(isoDate(null)).toBeNull()
    expect(isoDate("not a date")).toBeNull()
  })
})

describe("htmlToText", () => {
  test("decodes entities, strips tags and keeps list breaks", () => {
    const text = htmlToText(ADVERT.detail_description)
    expect(text).toContain("Key Requirements")
    expect(text).toContain("- .NET Core")
    expect(text).not.toContain("<")
  })

  test("decodes ampersands", () => {
    expect(htmlToText("<div>C# &amp; SQL</div>")).toBe("C# & SQL")
  })

  test("returns null for empty input", () => {
    expect(htmlToText(null)).toBeNull()
    expect(htmlToText("")).toBeNull()
  })
})

describe("toCard", () => {
  test("maps an advert onto the portal-skill contract", () => {
    const c = toCard(ADVERT)!
    expect(c.id).toBe("ITA006188/Mel")
    expect(c.title).toBe("Fullstack Developer (SQL / C#)")
    expect(c.company).toBe("Network Recruitment (IT Accelerate)")
    expect(c.location).toBe("Johannesburg East, Gauteng")
    expect(c.date).toBe("2026-08-19")
    expect(c.url).toContain("vacancy_ref=ITA006188%2FMel")
  })

  test("collapses an identical salary range to one value", () => {
    expect(toCard(ADVERT)!.salary).toBe("Market Related")
    expect(toCard({ ...ADVERT, salary_min: "R30 000", salary_max: "R45 000" })!.salary).toBe(
      "R30 000 - R45 000",
    )
    expect(toCard({ ...ADVERT, salary_min: null, salary_max: null })!.salary).toBeNull()
  })

  test("drops an advert with no vacancy reference instead of inventing an id", () => {
    expect(toCard({ ...ADVERT, vacancy_ref: null })).toBeNull()
    expect(toCard({ ...ADVERT, vacancy_ref: "  " })).toBeNull()
  })

  test("survives a nearly empty advert", () => {
    const c = toCard({ vacancy_ref: "X1" })!
    expect(c.title).toBe("(untitled)")
    expect(c.location).toBeNull()
    expect(c.company).toBe("Network Recruitment")
  })
})

describe("toDetail", () => {
  test("adds the description and a working apply URL", () => {
    const d = toDetail(ADVERT)!
    expect(d.description).toContain(".NET Core")
    expect(d.expiryDate).toBe("2026-09-18")
    expect(d.applyUrl).toContain("id=network1")
    expect(d.applyUrl).toContain("vacancy_ref=ITA006188%2FMel")
  })

  test("falls back to the brief description when there is no detail body", () => {
    const d = toDetail({ ...ADVERT, detail_description: null })!
    expect(d.description).toContain("business-critical")
  })
})

describe("withinJobage", () => {
  const cards = [
    { ...toCard(ADVERT)!, date: new Date().toISOString().slice(0, 10) },
    { ...toCard(ADVERT)!, id: "OLD", date: "2020-01-01" },
    { ...toCard(ADVERT)!, id: "NODATE", date: null },
  ]

  test("keeps fresh adverts and drops stale ones", () => {
    const kept = withinJobage(cards, 7).map((c) => c.id)
    expect(kept).not.toContain("OLD")
    expect(kept).toContain("ITA006188/Mel")
  })

  test("keeps undated adverts rather than silently hiding them", () => {
    expect(withinJobage(cards, 7).map((c) => c.id)).toContain("NODATE")
  })

  test("is a no-op without a window", () => {
    expect(withinJobage(cards, undefined)).toHaveLength(3)
  })
})

describe("matchesTown", () => {
  test("matches case-insensitively on a substring of the location", () => {
    const c = toCard(ADVERT)!
    expect(matchesTown(c, "johannesburg")).toBe(true)
    expect(matchesTown(c, "Cape Town")).toBe(false)
  })
})

describe("buildSearchUrl", () => {
  test("always sends region and department, even when empty", () => {
    const url = buildSearchUrl({ query: "C# developer" })
    expect(url).toContain("region=")
    expect(url).toContain("department=")
    expect(url).toContain("keywords=C%23+developer")
  })

  test("omits keywords entirely when there is no query", () => {
    expect(buildSearchUrl({ region: "Gauteng" })).not.toContain("keywords=")
  })
})

describe("normalizeRef", () => {
  test("accepts a bare vacancy reference", () => {
    expect(normalizeRef("ITA006188/Mel")).toBe("ITA006188/Mel")
  })

  test("extracts and decodes a reference from a job-details URL", () => {
    expect(normalizeRef(advertUrl(ADVERT))).toBe("ITA006188/Mel")
  })

  test("rejects a URL with no vacancy_ref", () => {
    expect(normalizeRef("https://www.networkrecruitmentinternational.com/it-jobs")).toBeNull()
    expect(normalizeRef("   ")).toBeNull()
  })
})
