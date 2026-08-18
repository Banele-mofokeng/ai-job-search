---
framework_version: 1.0.0
---

# Interview Preparation Guide

<!-- SETUP: STAR examples are personalized by running /setup based on your actual experience -->

## STAR Format

Structure answers as: **Situation** (context), **Task** (your responsibility), **Action** (what you did), **Result** (outcome).

Keep answers to 1-2 minutes. Be specific. End with what you learned or would do differently.

## STAR Candidates (Complete Manually)

<!-- Seeded by /setup (Path A) from documents/cv/Banele_Mofokeng_CV.docx, 2026-08-18.
Each stub below is a real, verifiable achievement. Fill in the S/T/A/R detail from memory -
only you know the surrounding context, and an interviewer will ask for it. -->

### Redis timeout misconfiguration causing 30-second request delays
**Source:** CV - Nucleus Supply Chain
**What happened:** Traced 30-second request delays to a Redis client timeout misconfiguration and corrected it, cutting the synchronous timeout from 15 seconds to 2 and removing the worst-case stall when the cache was slow or unavailable.
**Why it matters:** Debugging under pressure, production troubleshooting, "tell me about a difficult bug", "a time you improved performance".
**S/T/A/R stub:**
- Situation: (who reported it, what were users/operations seeing, how long had it been happening)
- Task: (were you assigned it or did you pick it up)
- Action: (how did you isolate Redis as the cause - Application Insights? logs? timing?)
- Result: (measured before/after, who confirmed it, did it recur)

### Manifest view rewritten from O(orders) lookups to a single JOIN
**Source:** CV - Nucleus Supply Chain
**What happened:** Replaced per-manifest and per-order lookups with one SQL JOIN using EF Core projection and AsNoTracking().
**Why it matters:** Query optimisation, ownership of a subsystem, "a time you improved something nobody asked you to".
**S/T/A/R stub:**
- Situation: (how slow was the manifest view, at what data volume)
- Task:
- Action: (how did you find the pattern, how did you verify the rewrite was equivalent)
- Result: (page load before/after, any regression risk you handled)

### N+1 elimination on the order list (1,200 calls per page to three queries)
**Source:** CV - Nucleus Supply Chain
**What happened:** Contributed to replacing up to 1,200 per-page database calls with three batched queries.
**Why it matters:** Collaboration ("contributed to" - scope it honestly), performance work, "a time you worked with others on a hard problem".
**S/T/A/R stub:**
- Situation:
- Task: (be precise about which part was yours vs. the team's)
- Action:
- Result:

### Primary authorship of five subsystems
**Source:** CV - Nucleus Supply Chain
**What happened:** Primary author of the proof-of-delivery, customer service desk, manifest, notification and configuration subsystems (76 entities, 246 endpoints, 39 controllers).
**Why it matters:** Ownership and scope - the strongest answer to "what have you actually built?" and to a Junior title being questioned.
**S/T/A/R stub:**
- Situation: (what existed before, why were these needed)
- Task:
- Action: (design decisions you made, what you would do differently now)
- Result: (who uses them, what volume, how long have they run)

### WMS inbound processes built from the ground up
**Source:** CV - Nucleus Supply Chain
**What happened:** Built the inbound processes of a separate warehouse management system, alongside the tech lead on the wider platform architecture.
**Why it matters:** Greenfield capability plus honest scoping of shared work - "a time you built something new", "how do you work with senior engineers".
**S/T/A/R stub:**
- Situation:
- Task: (state clearly which parts were yours and which were the tech lead's)
- Action:
- Result:

### Independent products: spaza-shop POS and single-operator courier platform
**Source:** CV - Selected Projects
**What happened:** Building a .NET/React POS with Paystack and Ozow integration, and a Python/FastAPI delivery platform with a WhatsApp-native ordering flow.
**Why it matters:** Initiative, product thinking, SA market understanding, and the answer to "what do you do outside work?"
**S/T/A/R stub:**
- Situation: (what problem in the market made you start these)
- Task:
- Action: (why Paystack and Ozow, why WhatsApp ordering)
- Result: (users? revenue? still in build? say so plainly)

## Common Tough Questions

### "Why are you leaving Nucleus Supply Chain?"
> Prepare this before the first interview. Forward-looking framing that is true: you are carrying
> subsystem-owner scope on a Junior title and want a mid-level role with senior engineers to learn
> architecture from. No criticism of the employer, no salary complaint as the headline reason.

### "You have not finished your degree."
> The honest answer, prepared: 16 credits outstanding on the BSc at North-West University,
> coursework otherwise complete, and 18 months of production delivery since. State the plan for
> finishing it if you have one. Never imply it is done.

### "You only have 18 months of experience / you have only worked in one codebase."
> Bridge to depth: five subsystems as primary author, 76 entities, 246 endpoints, seven courier
> partner integrations, plus production performance fixes. Add the independent projects as evidence
> of working outside that stack (Python/FastAPI, payment integrations).

### "Where do you see yourself in 5 years?"
> Aligned with the stated career goal: senior backend engineer with architecture responsibility,
> having finished the degree, still hands-on. Tie it to the specific team's growth path.

### "What's your biggest weakness?"
> Pick a real one with a concrete mitigation. Candidate material: breadth across stacks and
> platforms is narrower than the depth in .NET/SQL Server - mitigated by the Python/FastAPI side
> projects and by wanting a team with code review. Do not use a fake weakness.

### "Why this company specifically?"
> Customize per company. Must reference: specific projects, company values, market position, or team structure. Never give a generic answer.

## Questions You Should Ask Interviewers

### About the Role
- "What does a typical week look like in this role?"
- "What would success look like in the first 6 months?"
- "What's the biggest challenge the team is facing right now?"

### About the Team
- "How big is the team, and how do you divide work?"
- "What does the development/project lifecycle look like, from idea to production?"
- "How do you onboard new team members?"

### About Tech & Growth
- "What's your current tech stack for [relevant area]?"
- "Is there room to grow into more architectural or strategic decisions?"
- "How does the team stay current with new tools and methods?"

### About Culture (use these to prevent disappointment)
- "How would you describe the team culture?"
- "What does professional development look like here?"
- "Is there flexibility for remote/hybrid work?"
- "What's the balance between development/new projects and maintenance work?"
- "How would you describe the leadership style in this team?"
- "What do people who thrive here have in common?"

## Phone/Video Interview Tips
- Have STAR examples written out (use this file)
- Keep a glass of water nearby
- Smile when speaking (it changes your tone)
- Ask for clarification if a question is vague
- It's OK to take 5 seconds to think before answering
- End with: "Is there anything else you'd like to know about my background?"

## After the Application (Best Practice)

### Follow-Up Etiquette
- **Don't call to "stand out"** or to learn more about the role post-submission - this risks a negative impression
- If the employer specified a timeline, respect it and wait
- If no timeline was given and significant time has passed (2+ weeks), a brief call to ask about status is acceptable
- If you have genuinely new, relevant information to share, a short follow-up is fine

### Thank-You Notes
- When you receive any update (interview invitation, rejection, or status update), send a brief thank-you message
- Express appreciation for their time and the process
- Keep it short (2-3 sentences)

## Roleplay Guidelines
When the user asks for interview practice:
1. Ask which role/company to simulate
2. Start with easy warm-up questions ("Tell me about yourself")
3. Progress to role-specific technical questions
4. Include 1-2 behavioral questions using the competencies from the job posting
5. End with a tough question or curveball
6. After each answer, give brief feedback: what worked, what to sharpen
7. Suggest which STAR example would work best for each question
