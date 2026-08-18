import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers"
import { buildUrl, slug } from "../src/commands/search"
import { normalizeId, detailUrl } from "../src/commands/detail"
import { parseNumFound, withinDays } from "../src/helpers"

interface SearchResponse {
  meta: { count: number; page: number; total: number | null }
  results: Array<{ id: string; title: string; url: string; location: string | null }>
}

describe("url building", () => {
  test("location segment precedes the keyword segment", () => {
    // Careers24 ignores an lc- segment placed after kw-, so order is load-bearing.
    expect(buildUrl({ query: "data analyst", location: "Gauteng", jobage: 9999, page: 1, format: "json" })).toBe(
      "https://www.careers24.com/jobs/lc-gauteng/kw-data-analyst/",
    )
  })

  test("query alone and page > 1", () => {
    expect(buildUrl({ query: "project manager", jobage: 9999, page: 2, format: "json" })).toBe(
      "https://www.careers24.com/jobs/kw-project-manager/?page=2",
    )
  })

  test("slug normalizes SA place and role names", () => {
    expect(slug("Western Cape")).toBe("western-cape")
    expect(slug("Data Analyst (AI & Analytics)")).toBe("data-analyst-ai-analytics")
  })
})

describe("id handling", () => {
  test("accepts bare ids and advert URLs", () => {
    expect(normalizeId("2380724")).toBe("2380724")
    expect(normalizeId("https://www.careers24.com/jobs/adverts/2380724-data-analyst-gauteng/")).toBe("2380724")
    expect(normalizeId("data-analyst")).toBeNull()
  })

  test("detail URL uses the slug-agnostic advert path", () => {
    expect(detailUrl("2380724")).toBe("https://www.careers24.com/jobs/adverts/2380724-x/")
  })
})

describe("page parsing", () => {
  test("reads the NumFound total", () => {
    expect(parseNumFound('<input id="NumFound" name="NumFound" value="27">')).toBe(27)
    expect(parseNumFound("<div>no total here</div>")).toBeNull()
  })

  test("age filter keeps undated cards", () => {
    expect(withinDays(null, 7)).toBe(true)
    expect(withinDays("01 Jan 2000", 7)).toBe(false)
  })
})

describe("cli contract", () => {
  test("search with no criteria exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search"])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(JSON.parse(result.stderr).code).toBe("NO_CRITERIA")
  })

  test("non-numeric --page exits 1 with a JSON error", async () => {
    const result = await runCLI(["search", "-q", "developer", "--page", "two"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG")
  })

  test("detail on a non-existent advert exits 1 with NOT_FOUND", async () => {
    const result = await runCLI(["detail", "9999999"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("NOT_FOUND")
  })

  test("live search returns usable results", async () => {
    const result = await runCLI(["search", "-q", "data analyst", "-l", "Gauteng", "--limit", "5"])
    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toMatch(/^\d+$/)
      expect(job.title.length).toBeGreaterThan(0)
      expect(job.url).toContain("careers24.com/jobs/adverts/")
    }
  })
})
