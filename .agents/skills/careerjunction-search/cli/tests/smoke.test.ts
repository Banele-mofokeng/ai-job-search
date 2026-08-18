import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers"
import { buildUrl, locationSlug } from "../src/commands/search"
import { normalizeId, detailUrl } from "../src/commands/detail"
import { withinDays, parsePostedDate } from "../src/helpers"

interface SearchResponse {
  meta: { count: number; page: number }
  results: Array<{ id: string; title: string; url: string; company: string | null }>
}

describe("url building", () => {
  test("location becomes a path segment, not a query parameter", () => {
    expect(buildUrl({ query: "data analyst", location: "Cape Town", jobage: 9999, page: 1, format: "json" })).toBe(
      "https://www.careerjunction.co.za/jobs/cape-town?keywords=data+analyst",
    )
  })

  test("page > 1 adds the page parameter", () => {
    expect(buildUrl({ query: "sql", jobage: 9999, page: 3, format: "json" })).toBe(
      "https://www.careerjunction.co.za/jobs/results?keywords=sql&page=3",
    )
  })

  test("locationSlug normalizes SA place names", () => {
    expect(locationSlug("Cape Town CBD")).toBe("cape-town-cbd")
    expect(locationSlug("  Port Elizabeth ")).toBe("port-elizabeth")
  })
})

describe("id handling", () => {
  test("accepts bare ids and full job URLs", () => {
    expect(normalizeId("2642998")).toBe("2642998")
    expect(normalizeId("https://www.careerjunction.co.za/data-analyst-job-2642998.aspx")).toBe("2642998")
    expect(normalizeId("not-a-job")).toBeNull()
  })

  test("detail URL uses the id-only redirect path", () => {
    expect(detailUrl("2642998")).toBe("https://www.careerjunction.co.za/jobs/job-2642998")
  })
})

describe("client-side age filter", () => {
  test("parses the card's posted date", () => {
    expect(parsePostedDate("24 Jul 2026")?.getUTCFullYear()).toBe(2026)
    expect(parsePostedDate(null)).toBeNull()
  })

  test("keeps undated cards rather than dropping them", () => {
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

  test("non-numeric --limit exits 1 with a JSON error", async () => {
    const result = await runCLI(["search", "-q", "developer", "--limit", "many"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("BAD_ARG")
  })

  test("detail without an id exits 1", async () => {
    const result = await runCLI(["detail"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("NO_ID")
  })

  test("live search returns usable results", async () => {
    const result = await runCLI(["search", "-q", "data analyst", "-l", "Johannesburg", "--limit", "5"])
    expect(result.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(result)
    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toMatch(/^\d+$/)
      expect(job.title.length).toBeGreaterThan(0)
      expect(job.url).toContain("careerjunction.co.za")
    }
  })
})
