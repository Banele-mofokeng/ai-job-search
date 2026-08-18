# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

**Market: South Africa.** Two SA portal CLIs are installed and run first; the `site:`
templates below are the WebSearch fallback for boards without a CLI.

Primary (CLI-backed, run automatically by `/scrape`):
- **careerjunction.co.za** - `careerjunction-search` CLI. Richest structured data (company, salary line, employment type, expiry). Location is a `/jobs/<city>` path.
- **careers24.com** - `careers24-search` CLI. Broadest sector mix (mining, retail, finance, trades). Employer name only on the detail page.
- **linkedin.com/jobs** - `linkedin-search` CLI, country-agnostic. Pass `-l "Johannesburg, Gauteng, South Africa"` (or your metro).
- **freehire.me** - `freehire-search` CLI, tech/data roles only, many markets.

Secondary (WebSearch fallback - no CLI):
- **za.indeed.com** - large aggregator; heavy bot protection, so `site:` search only
- **pnet.co.za** - major SA board, but its `robots.txt` disallows `/jobs/*?*`, so **no scraper**; browse manually or via `site:` search
- **offerzen.com** - SA developer marketplace; roles sit behind a candidate login, so sign up directly rather than scraping
- **jobmail.co.za**, **careers.govpage.co.za** (public sector), **sayouth.mobi** (youth / entry level)
- Company career pages via Google `site:` searches

## Query Categories

Queries are grouped by priority. Write **each category in every language from your Languages table** (see Language scope above). Combine each query with your location terms (e.g. your city, region, or metro area) where the site supports it.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (a "Data Scientist" role at one employer may be posted as "Insights Analyst" or "Data Consultant" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

### Priority 1: Backend .NET engineering (mid-level)

The core target: building and owning backend services on the .NET stack. Titles vary wildly
across SA employers for the same work, so search several.

```
site:careerjunction.co.za "Software Developer" ".NET" Johannesburg
site:careers24.com "Backend Developer" C# Gauteng
site:za.indeed.com "C# Developer" Sandton OR Johannesburg
site:careerjunction.co.za "Intermediate Developer" ".NET Core" Johannesburg
site:linkedin.com/jobs ".NET Developer" South Africa
site:linkedin.com/jobs "Backend Engineer" C# Johannesburg
```

CLI equivalents (preferred - these run first):
```
careerjunction-search: -q "software developer .NET" -l "Johannesburg"
careerjunction-search: -q "C# developer" -l "Sandton"
careers24-search:      -q "backend developer" -l "Gauteng"
careers24-search:      -q "C# .NET developer" -l "Gauteng"
linkedin-search:       -q ".NET developer" -l "Johannesburg, Gauteng, South Africa"
linkedin-search:       -q "backend engineer C#" -l "South Africa" --remote remote
```

### Priority 2: Logistics, supply chain and fintech domain

Same engineering work, in the domains where the existing courier/WMS and payments experience
shortens the ramp-up and strengthens the cover letter.

```
site:careerjunction.co.za developer logistics OR courier OR "supply chain" Johannesburg OR Gauteng
site:careers24.com developer "warehouse management" OR WMS South Africa
site:careerjunction.co.za "software developer" fintech OR payments Johannesburg
site:linkedin.com/jobs software developer logistics Johannesburg South Africa
```

CLI equivalents:
```
careerjunction-search: -q "developer logistics" -l "Johannesburg"
careerjunction-search: -q "developer payments" -l "Sandton"
careers24-search:      -q "software developer supply chain" -l "Gauteng"
```

### Priority 3: Full-stack and adjacent engineering

Roles where the React/TypeScript half is in scope, or where the title differs but the work is
the same backend engineering.

```
site:za.indeed.com "Full Stack Developer" ".NET" React Johannesburg
site:careerjunction.co.za "Software Engineer" C# SQL Johannesburg
site:careers24.com "Application Developer" ".NET" Gauteng
site:linkedin.com/jobs "full stack developer" ".NET" "React" South Africa
```

CLI equivalents:
```
careerjunction-search: -q "full stack developer .NET React" -l "Johannesburg"
careers24-search:      -q "software engineer C#" -l "Gauteng"
```

### Priority 4: Remote and wider net

Fully remote SA roles, plus a broad sweep for anything .NET/SQL-shaped that the tighter
queries miss.

```
site:careers24.com C# developer remote South Africa
site:linkedin.com/jobs ".NET" developer remote South Africa
site:za.indeed.com "SQL Server" developer Johannesburg
site:careerjunction.co.za "Entity Framework" OR "ASP.NET Core" South Africa
```

CLI equivalents:
```
linkedin-search:       -q ".NET developer" -l "South Africa" --remote remote --jobage 7
freehire-search:       (tech aggregator - query "C# .NET backend", remote)
careerjunction-search: -q "ASP.NET Core"
```

**Deal-breaker filter:** a posting whose stack has no .NET/C# (pure Java, PHP, Ruby, Go,
Node-only) is deprioritised, per CLAUDE.md's Deal-breakers - report it, do not silently drop it.

## Location Filter

Verify each result is within reach of your base. South African commuting is metro-bound,
so treat a different metro as a relocation, not a commute.

- **Sandton, Johannesburg** and its suburbs (Rosebank, Bryanston, Midrand, Fourways, Randburg) - primary
- Rest of **Gauteng** - acceptable where the commute is realistic (Pretoria/Centurion is the outer edge)
- **Remote / work-from-home** - acceptable; SA postings label this "Remote", "Hybrid" or "WFH"
- Other metros (Johannesburg / Cape Town / Durban / Pretoria / Gqeberha, whichever is not yours) - **relocation**, flag rather than silently include
- Rest of Africa / abroad - only if the posting states relocation support or full remote

Note that SA boards mix province and city in the same location field ("Gauteng",
"Sandton", "Cape Town CBD"), so match on both levels rather than an exact city string.

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## South Africa specifics

- **Salary is usually undisclosed** ("Market Related", "Undisclosed"). Do not treat a missing salary as a red flag; benchmark from `salary_data.json` instead.
- **Recruiting agencies dominate** both SA boards. The named "company" is often the agency (Network Contracting Solutions, Sinakho Staffshop, Hire Resolve, MSP Staffing), not the employer - check the description before writing anything company-specific into a cover letter.
- **Employment Equity**: many postings state EE/AA preference or designated-group requirements. Record it as posting context; it is the candidate's call, never an automatic exclusion.
- **Expiry dates matter**: SA adverts carry "Expires in N days" / "Apply before <date>" and vanish afterwards. Scrape and apply promptly, and re-check a posting before drafting.
- **Duplicate adverts** are common - the same role is often posted by several agencies with different reference numbers. Dedupe on title + location + description similarity, not on the portal ID alone.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
