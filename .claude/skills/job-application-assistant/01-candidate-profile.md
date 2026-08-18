---
framework_version: 1.1.1
---

# Candidate Profile

<!-- Populated by /setup (Path A) from documents/cv/Banele_Mofokeng_CV.docx, 2026-08-18 -->

## Identity
- **Name:** Banele Mofokeng
- **Location:** Sandton, Johannesburg, South Africa
- **Phone:** 081 313 0871
- **Email:** mofokengbanele9@gmail.com
- **LinkedIn:** linkedin.com/in/banele-mofokeng
- **GitHub:** github.com/Banele-mofokeng
- **Status:** Employed - Junior Software Developer at Nucleus Supply Chain (since February 2025). Notice period: 30 days.
- **Work authorisation:** South African citizen. No work permit or sponsorship required.
- **Constraints:** Greater Johannesburg, including the Ekurhuleni metro. Confirmed 2026-08-18 as willing to commute daily to Alberton (~35-40 km from Sandton) for a full-time on-site role, so the acceptable zone is wider than the northern suburbs alone: Sandton, Midrand, Rosebank, Bryanston, Pretoria at the edge, plus Alberton/Germiston/Boksburg. Remote also acceptable. Cape Town / Durban roles count as relocation, not commute.

### Languages

| Language | Level | Notes |
|----------|-------|-------|
| English | Native / fluent | Working language; all professional work and documentation |

<!-- Only English is declared. Per the Language Gate in 04-job-evaluation.md, a posting that
requires any other language as a job condition is a hard exclusion. If that becomes wrong,
re-run /setup --section skills rather than editing around it. -->

## Education

| Degree | Period | Institution | Key Topics |
|--------|--------|-------------|------------|
| BSc Mathematics and Computer Science (in progress - 16 credits outstanding) | 2018 - 2024 | North-West University, South Africa | Software development, data structures and algorithms, database systems, mathematics |

**State this honestly in every application:** coursework completed, 16 credits outstanding
toward completion. Never describe the degree as awarded or completed.

## Professional Experience

### Junior Software Developer - Nucleus Supply Chain (February 2025 - Present)
Sandton, Johannesburg
- Primary author of the proof-of-delivery, customer service desk, manifest, notification and configuration subsystems of the company's courier logistics platform (.NET 8, Entity Framework Core 8, SQL Server, Redis, Azure). **Scope note (confirmed 2026-08-18):** the 76 entities, 246 API endpoints and 39 controllers describe the **whole platform**, not his five subsystems. Never write these counts as a measure of his personal authorship.
- Merged over 40 pull requests into a 37,000-line production codebase serving seven integrated courier partners. (The source CV said "across 14 months", measured around April 2026; tenure is longer now, so the duration is left off rather than restated. The seven partners qualify the **platform** - do not claim authorship of all seven integrations.)
- Rewrote the manifest view data access to replace per-manifest and per-order lookups with a single SQL JOIN, reducing an O(orders) query pattern to one query using EF Core projection and `AsNoTracking()`.
- Traced 30-second request delays to a Redis client timeout misconfiguration and corrected it, cutting the synchronous timeout from 15 seconds to 2 and removing the worst-case stall when the cache was slow or unavailable.
- Contributed to eliminating an N+1 query pattern on the order list, replacing up to 1,200 per-page database calls with three batched queries.
- Built the inbound processes of the company's separate warehouse management system (WMS) from the ground up, working alongside the tech lead on the wider platform architecture.
- Diagnoses and resolves production defects on live client systems, frequently while courier and warehouse operations are still running.
- Takes requirements from business analysts, though most reach him through the tech lead (confirmed 2026-08-18).

## Independent Projects
- **Point-of-sale platform for South African spaza shops and independent supermarkets** (ongoing): .NET backend, React frontend, Paystack and Ozow payment integration.
- **Delivery fleet platform for single-operator courier businesses** (ongoing): Python and FastAPI, WhatsApp-native ordering flow, configurable cash-on-delivery thresholds.

## Technical Skills

### Programming & Frameworks
- **C#** (primary): .NET 8, ASP.NET Core, Entity Framework Core 8, LINQ, Clean Architecture
- **SQL** (primary): Microsoft SQL Server, query optimisation, execution-plan-level debugging
- **TypeScript / JavaScript**: React
- **Python** (exposure): FastAPI, Azure OpenAI, RAG pipelines

### Domain Expertise
- Courier and logistics systems: orders, waybills, manifests, proof of delivery, billing
- Warehouse management (WMS) inbound processes
- Multi-partner integration (seven integrated courier partners)
- Production performance work: N+1 elimination, query batching, cache timeout tuning

### Software & Tools
Microsoft Azure (Blob Storage, File Shares, SignalR), Application Insights, Azure DevOps, Visual Studio (daily, confirmed 2026-08-18), Git, REST APIs, Redis (StackExchange.Redis), MongoDB, Paystack, Ozow

## Publications
None.

## Awards
None recorded.

## References
Available on request. No referee has been recorded in this repo yet - never name one in an
application until it is listed here with their agreement.
