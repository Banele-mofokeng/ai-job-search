# Network Recruitment — endpoint reference

What a future maintainer needs when the portal changes. Verified live 2026-08-19.

## Site

- Public site: `https://www.networkrecruitmentinternational.com`
- `https://www.networkrecruitment.co.za` **301-redirects** to the international domain,
  including its `robots.txt`. Treat the international domain as canonical.
- Listing pages (`/jobs-in-south-africa`, `/it-jobs`, `/finance-jobs`, `/engineering-jobs`)
  are Duda-built and render adverts **client-side** from the API below. Fetching the HTML
  gives you the page shell and the calling JavaScript, not the adverts — which is why this
  skill calls the API directly instead of parsing HTML.

## robots.txt

```
Sitemap: https://www.networkrecruitmentinternational.com/sitemap.xml
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
```

One `User-agent: *` group, **no `Disallow` rules**, and an affirmative content signal.
Nothing this skill reads is excluded.

## Search endpoint

```
GET https://az-jhb-was-rescr-duda-api-prod-networkrecruitint.azurewebsites.net
    /placementpartnerxml/api/getallnetworkrecruitmentsadsbysearchterm
```

Discovered in the inline `getAdvertsBySearchTerm()` function on `/jobs-in-south-africa`.
No authentication, no key, no cookie. Responds `application/json`.

| Parameter | Required | Notes |
|-----------|----------|-------|
| `region` | sent always, may be empty | Province name, exactly as listed below. Empty = all |
| `department` | sent always, may be empty | Specialisation label. Empty = all |
| `keywords` | optional | Free text, matched as a **phrase** — see below. The site omits it entirely when blank |

### `keywords` is a phrase match, not an AND

Measured 2026-08-19 against the live API: `developer` → 174 matches, `logistics` → 59,
`developer logistics` → **0**, `logistics developer` → **0**. Order matters too:
`SQL developer` → 1, `developer SQL` → **0**. Real job-title phrases work
(`software developer` → 109).

The upstream is a Placement Partner text search over the advert body, and it is looking
for the string, not the set of words. This is why the skill's own guidance is "one strong
keyword plus `-d`/`-l`", and why a zero result on a multi-word query is not evidence the
portal is broken. Any health check that assumes AND semantics will misread this portal.
| `pageSize` | optional | **Accepted and ignored** — every call returns the full match set |

The site's own JavaScript sends `pageSize=50` and still receives everything; verified by
requesting `pageSize=2` for `keywords=developer` and getting all 174 matches back, with
`pageCount: 1` on every element. `pageNumber` and `page` are not recognised. **Paging is
therefore client-side.**

### Valid `region` values

`Eastern Cape`, `Free State`, `Gauteng`, `KwaZulu-Natal`, `Limpopo`, `Mpumalanga`,
`Northern Cape`, `North West`, `Western Cape` (plus `All`, which the site sends as a
literal string; this skill sends an empty value instead, which behaves the same).

Extracted from the `.regionDdl` `<select>` on the listing page — re-read that element if
the province list ever changes.

### Valid `department` values

From the `.departmentDdl` `<select>`. Finance: `Actuarial`, `Analytics, Quantitative and
Prudential Risk`, `Auditing`, `Capital Markets`, `Finance CA(SA)`, `Finance Non-CA(SA)`,
`Governance, Risk and Compliance (GRC)`, `Payroll`, `Taxation`. Engineering: `Artisan`,
`Building and Construction`, `Chemical`, `Civil and Structural`, `Industrial`, `Mining`,
`Property Development`, `Electrical`, `Electromechanical`, `Electronic`, `Mechanical`,
`Metallurgical`. IT: `Architecture`, `Big Data, SQL and Analytics`, `Database
Administration`, `DevOps`, `Digital`, `ERP`, `Infrastructure`, `Leadership / Management`,
`Software Development`, and others further down the list.

## Response structure

A **bare JSON array** of advert objects — no envelope, no wrapper. Empty result sets come
back as `[]`.

| Field | Example | Used as |
|-------|---------|---------|
| `vacancy_ref` | `ITA006188/Mel` | `id` — stable; adverts without one are dropped |
| `company_ref` | `network1` | Path component in the advert and apply URLs |
| `job_title` | `Fullstack Developer (SQL / C#)` | `title` |
| `region` | `Gauteng` | second half of `location` |
| `town` | `Johannesburg East` | first half of `location` |
| `sector` | `Software Development` | `sector` |
| `brief_description` | HTML | `briefDescription` (tags stripped) |
| `brief_description_html` | HTML | unused — same content as above |
| `detail_description` | HTML | `description` on `detail` |
| `salary_min` / `salary_max` | `Market Related` | `salary`; often a literal string, not a number |
| `start_date` | `2026-08-19T00:00:00` | `date`, trimmed to `YYYY-MM-DD` |
| `expiry_date` | `2026-09-18` | `expiryDate` |
| `consultant_name` | `Melody Nandalall` | `consultant` |
| `branch_name` | `IT Accelerate` | appended to `company` |
| `response_email` | consultant's address | **not emitted** — a named individual's contact detail |
| `pageCount` | `1` | always 1; not usable for paging |

`id` on the upstream object is always `null` — do not mistake it for a usable identifier.
The reference lives in `vacancy_ref`.

## Detail

There is **no per-advert endpoint**. The search response already carries
`detail_description`, so `detail <ref>` calls the search endpoint with
`keywords=<ref>` and takes the element whose `vacancy_ref` matches exactly. Verified:
`keywords=ITA006188/Mel` returns exactly one element.

## Public URLs

- Advert page: `{SITE}/job-details?instance={company_ref}&vacancy_ref={vacancy_ref}`
- Apply form: `https://webapp.placementpartner.com/wi/application_form.php?id={company_ref}&vacancy_ref={vacancy_ref}`

Both reference values need URL-encoding — references contain `/`.

## Other endpoints seen on the page (not used)

- `…/Notifications/createalert` and `…/PlacementPartnerApi/api/createalert` — job-alert
  signup. Writes data on the user's behalf; deliberately not wired up.
- `…/PlacementPartnerXml/api/login` — the site calls this commented-out; search works
  without it.
- `https://fdmiddlewareapi20220125085125.azurewebsites.net/placementpartner/api/getadvertsbysearchterm`
  — an older middleware host referenced elsewhere in the page. Untested; the Azure
  `az-jhb-was-rescr-duda-api-prod-networkrecruitint` host is what the live listing pages use.

## If it breaks

1. Load `https://www.networkrecruitmentinternational.com/jobs-in-south-africa` and search
   the HTML for `getallnetworkrecruitmentsadsbysearchterm` — the calling function sits
   directly above it and shows the current parameter set.
2. Re-read `.regionDdl` and `.departmentDdl` for the current option lists.
3. The Azure host name is environment-specific and is the most likely thing to change.
