import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResponse {
  meta: { count: number; page: number; pageSize: number }
  results: Array<{
    id: string
    title: string
    company: string | null
    location: string | null
    date: string | null
    url: string
  }>
}

describe("flag validation", () => {
  test("no command prints help and exits 1", async () => {
    const r = await runCLI([])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toContain("USAGE")
  })

  test("unknown command writes a JSON error to stderr", async () => {
    const r = await runCLI(["frobnicate"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(JSON.parse(r.stderr).code).toBe("BAD_CMD")
  })

  test("search with no criteria exits 1 with NO_CRITERIA", async () => {
    const r = await runCLI(["search"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_CRITERIA")
  })

  test("a non-numeric --limit exits 1 with BAD_ARG", async () => {
    const r = await runCLI(["search", "-q", "developer", "--limit", "many"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ARG")
  })

  test("detail without an argument exits 1 with NO_ID", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_ID")
  })

  test("detail with a bare id explains that the advert URL is required", async () => {
    const r = await runCLI(["detail", "1319116"])
    expect(r.exitCode).toBe(1)
    const err = JSON.parse(r.stderr)
    expect(err.code).toBe("NEED_URL")
    expect(err.error).toContain("url")
  })

  test("detail rejects a URL from another site", async () => {
    const r = await runCLI(["detail", "https://example.com/Jobs/T/x-1319116-Job-Search-x.asp"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ID")
  })
})

// Live smoke tests. They hit the public board, so they are deliberately few and small.
describe("live search", () => {
  test("returns contract-shaped results for a real query", async () => {
    const r = await runCLI(["search", "-q", "developer", "-l", "Johannesburg", "--limit", "3"])
    const data = parseJSON<SearchResponse>(r)
    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toMatch(/^\d+$/)
      expect(job.title).toBeTruthy()
      expect(job.url).toContain("jobplacements.com")
    }
    expect(data.meta.count).toBe(data.results.length)
  })

  test("page 2 returns different adverts from page 1", async () => {
    const p1 = parseJSON<SearchResponse>(await runCLI(["search", "-q", "developer", "--page", "1"]))
    const p2 = parseJSON<SearchResponse>(await runCLI(["search", "-q", "developer", "--page", "2"]))
    const ids1 = new Set(p1.results.map((r) => r.id))
    expect(p2.results.some((r) => !ids1.has(r.id))).toBe(true)
  })

  test("detail resolves a URL taken from search", async () => {
    const search = parseJSON<SearchResponse>(
      await runCLI(["search", "-q", "developer", "-l", "Johannesburg", "--limit", "1"]),
    )
    const url = search.results[0]!.url
    const job = parseJSON<{ id: string; company: string | null; description: string | null }>(
      await runCLI(["detail", url]),
    )
    expect(job.description).toBeTruthy()
    // The results page has no recruiter; detail is what fills it in.
    expect(job.company).toBeTruthy()
  })

  test("table format prints a header and no JSON", async () => {
    const r = await runCLI(["search", "-q", "developer", "--limit", "2", "--format", "table"])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain("TITLE")
    expect(r.stdout.startsWith("{")).toBe(false)
  })
})
