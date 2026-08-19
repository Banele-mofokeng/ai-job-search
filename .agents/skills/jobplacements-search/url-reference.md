# Job Placements — endpoint reference

What a future maintainer needs when the board changes its markup. Verified live 2026-08-19.

## Site

- `https://www.jobplacements.com` — classic ASP, server-rendered HTML, no client-side
  job rendering. Sister site `https://www.executiveplacements.com` runs the same engine
  and the same URL shapes; parsers here would likely port with only the host changed.

## robots.txt

```
# Any other use of robots or failure to obey the robots exclusion standards
# set forth at <http://www.robotstxt.org/wc/exclusion.html> is strictly
# prohibited.
#
# Executive Placements

User-agent: *
Disallow: /Jobs/Jobs-2021.asp

Allow: /
```

One `User-agent: *` group, `Allow: /`, and a single disallowed legacy path. This skill
reads `/jobList.asp` and `/Jobs/…` advert pages, neither of which is excluded, and never
requests `/Jobs/Jobs-2021.asp`.

## Search

```
POST https://www.jobplacements.com/jobList.asp
Content-Type: application/x-www-form-urlencoded
```

The page's form is `<form class="pure-form" name="jobSearch" action="jobList.asp" method="post">`.

| Field | Used | Notes |
|-------|------|-------|
| `kwds` | yes | Free-text keywords |
| `city` | yes | City or town name |
| `start` | yes | **Page number**, 1-indexed — not an offset |
| `country`, `countryVal`, `radius`, `remote`, `salary`, `currencyVal`, `recruiterID`, `candidateCategory`, `jobTitleOnly`, `order`, `dateRange`, `jobSource` | no | Present on the form; not wired up |

**Pagination requires POST.** `GET /jobList.asp?kwds=developer&start=2` returns the same
ten adverts as `start=1`; the POST body is honoured. Verified by comparing the id sets:
POST `start=1` → `1319929…1317760`, `start=2` → `1317488…1315510`, `start=3` →
`1315234…1313426`.

Page size is **10**, fixed by the board — there is no page-size parameter.

`dateRange` exists on the form but its option list overlaps `order`'s in the markup and
passing it did not visibly filter the results, so `--jobage` is applied client-side
instead. Re-investigate if the board ever documents it.

## Search response structure

Each advert is one `<div>` whose `onclick` carries the numeric job id:

```html
<div class="entryActive" id="entry1" onclick="showJob(1,1319116);">
<STRONG><FONT size="+1">TJ 19258 - Software Developer (C# / VB.NET / SQL Server) – A</STRONG></FONT><BR>
Johannesburg<BR>
<FONT color='Grey'>2 days ago</FONT><BR><BR>
Salary: R35 000 Negotiable based on Experience<BR><BR>Brief blurb<BR><BR>
<A HREF="https://www.jobplacements.com/Jobs/T/<slug>-1319116-Job-Search-<date>.asp?sid=&kwds=developer" class="navsOrange">Details</A>
<A HREF="/cvs.asp?jobID=1319116" class="navsOrange">Upload CV &amp; Apply</A>
</div>
```

Parsing anchors, in the order the parser uses them:

| Field | Anchor |
|-------|--------|
| `id` | `onclick="showJob(<n>,<id>)"` — the split point for chunking |
| `title` | `<STRONG><FONT size="+1">…</STRONG>` — **the tags are crossed**, so the match closes on `</STRONG>`, not on a well-formed pair |
| `location` | the text line between the title's `</FONT><BR>` and the next `<BR>` |
| `date` | `<FONT color='Grey'>…</FONT>` — relative ("Today", "1day ago", "5 days ago") |
| `salary` | `Salary:` up to the next `<BR>` |
| `briefDescription` | between the salary line and the first `<A HREF=` |
| `url` | the first `<A HREF>` pointing at `/Jobs/` (query string stripped) |

The results page carries **no recruiter/company name**. `company` is therefore `null` in
search output and filled by `detail`.

The first card is `class="entryActive"`, the rest `class="entry"` — do not anchor on the
class, anchor on `showJob(`.

## Detail

```
GET https://www.jobplacements.com/Jobs/<Letter>/<slug>-<id>-Job-Search-<m-d-yyyy-h-mm-ss-AM>.asp
```

Slug-based, with a timestamp baked into the path. **There is no id-to-URL lookup**:
`cvs.asp?jobID=<id>` returns the CV-upload form (title "Job Placements CV Upload"), with
no advert content and no back-link. So `detail` takes the URL from a search result;
`normalizeId` still extracts the id from it for `applyUrl`.

The page carries one `application/ld+json` block of `@type: JobPosting`:

| JSON-LD field | Used as |
|---------------|---------|
| `title` | `title` |
| `hiringOrganization.name` | `company` |
| `jobLocation.address.addressLocality` / `.addressRegion` / `.addressCountry` | `location`, `region`, `country` |
| `datePosted` | `date` (already absolute, `YYYY-MM-DD`) |
| `description` | `description` — **the complete advert**, ~1.7k chars, all sections flattened |
| `baseSalary` | **ignored** — placeholder junk (`currency: "vvvvv"`, empty `minValue`/`maxValue`) |

Visible labels supply what the JSON-LD lacks or gets wrong. They are laid out as two
sibling cells, so the value is never adjacent to its label:

```html
<div class="pure-u-9-24"><STRONG>Salary:</STRONG><BR><BR></div>
<div class="pure-u-15-24 …">R35 000 Negotiable based on Experience<BR><BR></div>
```

`labelValue()` matches `Label:</STRONG>` and then the next `pure-u-15-24` cell. Labels
seen: `Recruiter`, `Job Ref`, `Salary`, `Location`. `Job Ref` is frequently truncated by
the board itself (`TJ 19258 - Software ..`).

The visible description is split across sibling `elementor-widget-text-editor` divs with
no common wrapper, which is why scraping it truncates at the first block and the JSON-LD
is preferred.

## If it breaks

1. `curl -sS -X POST -d "kwds=developer" https://www.jobplacements.com/jobList.asp` and
   look for `showJob(` — if it is gone, the card anchor has changed.
2. On a detail page, check the `application/ld+json` block first; if it disappeared, the
   `labelValue` fallbacks and the elementor scrape are what remain.
3. Confirm pagination is still POST-only before assuming `--page` is broken.
