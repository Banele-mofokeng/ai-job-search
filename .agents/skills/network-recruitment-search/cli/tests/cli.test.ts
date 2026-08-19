import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResponse {
  meta: { count: number; page: number; total: number }
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

  test("detail without an id exits 1 with NO_ID", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_ID")
  })

  test("a non-numeric --limit exits 1 with BAD_ARG", async () => {
    const r = await runCLI(["search", "--limit", "many"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ARG")
  })

  test("a bare URL with no vacancy_ref exits 1 with BAD_ID", async () => {
    const r = await runCLI(["detail", "https://www.networkrecruitmentinternational.com/it-jobs"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ID")
  })
})

// Live smoke tests. They hit the public API, so they are deliberately few and small.
describe("live search", () => {
  test("returns contract-shaped results for a real query", async () => {
    const r = await runCLI(["search", "-q", "developer", "--limit", "3"])
    const data = parseJSON<SearchResponse>(r)
    expect(data.results.length).toBeGreaterThan(0)
    for (const job of data.results) {
      expect(job.id).toBeTruthy()
      expect(job.title).toBeTruthy()
      expect(job.url).toContain("networkrecruitmentinternational.com")
    }
    expect(data.meta.count).toBe(data.results.length)
  })

  test("detail resolves an id taken from search", async () => {
    const search = parseJSON<SearchResponse>(
      await runCLI(["search", "-q", "developer", "--limit", "1"]),
    )
    const id = search.results[0]!.id
    const r = await runCLI(["detail", id])
    const job = parseJSON<{ id: string; description: string | null }>(r)
    expect(job.id).toBe(id)
    expect(job.description).toBeTruthy()
  })

  test("table format prints a header and no JSON", async () => {
    const r = await runCLI(["search", "-q", "developer", "--limit", "2", "--format", "table"])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain("TITLE")
    expect(r.stdout.startsWith("{")).toBe(false)
  })
})
