# BBDU Hosteller - Decision Log (decision.md)

> **Mandatory Operating Protocol**:
> 1. Every agent and developer must read `CLAUDE.md`, `report.md`, and `architecture.md` before starting any task.
> 2. For every non-trivial decision, add a new numbered decision entry to this file explaining why the choice was made over alternatives.
> 3. After completing any task, update both `decision.md` (for the rationale) and `report.md` (under Section 16 "Completed Work Log").

---

## Decision Protocol & Rules

1. **When to Record a Decision**:
   - Any architectural change, new library addition, or dependency change
   - Any schema modification, new model creation, or compound index addition
   - Any change to the state machine lifecycles (complaints, work orders, outpasses, expenses)
   - Any modification to security policies, RBAC roles, or auth middleware
   - Any modification to the background scheduler interval or job list
   - Skip only for trivial tasks (fixing typos, adjusting spacing, updating comments)

2. **Required Format for New Decisions**:
   - **ID & Title**: `DEC-XXX: Title`
   - **Date**: YYYY-MM-DD
   - **Status**: Proposed / Accepted / Superseded / Deprecated
   - **Context**: The problem being solved and constraints
   - **Alternatives Considered**: At least two alternative approaches with pros and cons
   - **Decision**: The selected approach
   - **Rationale**: Why this option won, including performance, security, and maintenance impact
   - **Consequences**: Trade-offs accepted and follow-up requirements

---

## Historical Decision Records (Steps 1 to 18)

### DEC-001: Monorepo Architecture with Decoupled Backend and Frontend
- **Date**: Initial Architecture
- **Status**: Accepted
- **Context**: BBDU Hosteller required a modern frontend client and a robust REST API backend. We needed to choose between a unified monorepo vs two independent git repositories.
- **Alternatives Considered**:
  - *Alternative A: Separate Git Repositories*: Independent deployment lifecycles, but complicates synchronized documentation, end-to-end integration testing, and issue tracking.
  - *Alternative B: Full Monorepo with Lerna / Turborepo*: Heavy toolchain overhead, complex configuration, unnecessary for a two-workspace project.
  - *Alternative C: Lightweight Monorepo (Selected)*: Single repository with dedicated `backend/` and `frontend/` folders, independent `package.json` files, and shared root documentation.
- **Rationale**: Minimal tooling friction, atomic commits across full-stack features, and zero orchestrator bloat while keeping dependencies cleanly isolated.

---

### DEC-002: Native Node.js Test Runner (node:test) Over Jest or Mocha
- **Date**: Initial Setup
- **Status**: Accepted
- **Context**: Automated testing needed to cover 20 integration suites and 240+ tests across database models, controllers, and scheduler jobs.
- **Alternatives Considered**:
  - *Alternative A: Jest*: Broad ecosystem, but heavy memory footprint, slow startup time, complex ESM configuration issues with native Node.js ES modules.
  - *Alternative B: Mocha + Chai*: Requires multiple disparate packages, extra configuration, and maintenance overhead.
  - *Alternative C: Native `node:test` and `node:assert/strict` (Selected)*: Built directly into Node.js 22+, zero external dependencies, instant test startup, native ESM support.
- **Rationale**: Reduced attack surface (0 supply chain vulnerabilities in testing), lightning-fast test boots, and eliminates test framework version drift. 248 tests run with zero npm install dependencies for the test runner.

---

### DEC-003: Single Central Scheduler Loop Over Distributed Task Queues
- **Date**: Step 5.5 (SLA & Escalation Engine)
- **Status**: Accepted
- **Context**: Background monitoring required running recurring jobs: SLA countdowns, breach alerts, multi-tier escalations, work order generation, cleaning checks, and outpass curfew monitoring.
- **Alternatives Considered**:
  - *Alternative A: Redis + BullMQ / Agenda*: Powerful distributed queues, but adds external infrastructure dependency (Redis), increasing deployment complexity and hosting costs for campus infrastructure.
  - *Alternative B: Multiple Independent setInterval Timers*: Spawns separate uncoordinated timers per module, risking duplicate runs, race conditions, and orphan intervals.
  - *Alternative C: Single Central 60-second Scheduler with Idempotency Guard (Selected)*: One master interval in `slaScheduler.js` invoking `processSlaAndEscalations()` with an `isProcessing` concurrency lock.
- **Rationale**: Zero external infrastructure requirements (runs entirely in Node.js process), completely deterministic, eliminates orphan intervals, and centralizes background logging.

---

### DEC-004: Five Strictly Bounded RBAC Roles with Server-Side Enforcement
- **Date**: Step 3 (Authentication & RBAC)
- **Status**: Accepted
- **Context**: The platform serves five distinct user personas: students, hostel wardens, maintenance staff, university executives, and system admins.
- **Alternatives Considered**:
  - *Alternative A: Permission Strings / Matrix (e.g. `complaints:write`, `workorder:approve`)*: Highly granular, but over-engineered for university hostel operations with fixed statutory duties.
  - *Alternative B: 3 Roles (Admin, Staff, Student)*: Collapses Wardens and Chief Proctor into generic admins, losing operational segregation and audit accountability.
  - *Alternative C: 5 Strictly Bounded Roles (Selected)*: `SUPER_ADMIN`, `AUTHORITY`, `WARDEN`, `HOSTEL_STAFF`, `STUDENT`.
- **Rationale**: Aligns 1:1 with university administrative hierarchy. Student self-registration is strictly sandboxed to `STUDENT`. Wardens manage hostel-specific operational boundaries, while Authorities hold campus-wide executive oversight.

---

### DEC-005: Schema-Level Password Hash Exclusion (select: false)
- **Date**: Step 3 (Security Model)
- **Status**: Accepted
- **Context**: Password hashes must never be accidentally leaked in API responses, logs, or downstream database queries.
- **Alternatives Considered**:
  - *Alternative A: Serializer-Only Deletion*: Stripping `passwordHash` in controller responses via helper functions (e.g. `delete user.passwordHash`). Prone to developer oversight on new endpoints.
  - *Alternative B: Schema-Level `select: false` + Serializer Dual Defense (Selected)*: Configure `select: false` on Mongoose schema, plus runtime sanitization in `userSerializer.js`.
- **Rationale**: Defense in depth. Queries like `User.find()` or `User.findById()` omit the hash by default. Auth login explicitly opts in via `.select('+passwordHash')`.

---

### DEC-006: Express.js 5.x Over Express 4.x
- **Date**: Initial Setup
- **Status**: Accepted
- **Context**: Choosing the core HTTP backend framework. Express 4 had been the industry standard for a decade, but Express 5 offers native Promise support.
- **Alternatives Considered**:
  - *Alternative A: Express 4.x*: Stable, but requires wrapping every async route handler in custom `asyncHandler` wrappers to prevent unhandled promise rejections from crashing the process.
  - *Alternative B: Fastify*: High performance, but smaller ecosystem for standard university management plugins and steeper learning curve.
  - *Alternative C: Express 5.2.1 (Selected)*: Native promise rejection handling directly in route handlers and middleware, updated router matching, modern security defaults.
- **Rationale**: Modern async/await ergonomics without third-party error wrapping dependencies, while maintaining standard Express middleware compatibility.

---

### DEC-007: Zod Over Joi for Input Validation
- **Date**: Step 3 (Validation)
- **Status**: Accepted
- **Context**: Request body validation required strict schemas, typed error messages, and security privilege escalation checks.
- **Alternatives Considered**:
  - *Alternative A: Joi*: Mature and capable, but larger bundle size and legacy syntax patterns.
  - *Alternative B: express-validator*: Ties validation logic directly to Express route declarations, making schemas non-reusable across service layers.
  - *Alternative C: Zod 4.x (Selected)*: Modern, lightweight, composable schemas, powerful `.refine()` rules for privilege escalation checks, seamless compatibility with JavaScript and TypeScript.
- **Rationale**: Clean declarative schemas in `/validators` with built-in defense against student privilege escalation (e.g., rejecting non-STUDENT roles during public registration).

---

### DEC-008: React 19 + Vite 8 + Tailwind CSS v4 Frontend Stack
- **Date**: Initial Setup
- **Status**: Accepted
- **Context**: Choosing frontend tooling for fast development, modern CSS compilation, and future-proof UI architecture.
- **Alternatives Considered**:
  - *Alternative A: Create React App / Webpack*: Deprecated, slow build times, massive dependency tree.
  - *Alternative B: Next.js (SSR)*: Added server-side rendering complexity unnecessary for an authenticated dashboard behind a login wall.
  - *Alternative C: React 19 SPA with Vite 8 and Tailwind CSS v4 (Selected)*: Lightning-fast Vite HMR, pure client-side SPA architecture, and modern Tailwind v4 plugin compilation directly in Vite.
- **Rationale**: Instant hot-reloading during development, clean build output in `dist/`, and simplified CSS configuration via `@import "tailwindcss"` without legacy `tailwind.config.js` bloat.

---

### DEC-009: Deterministic Mathematical Health Scoring Over Opaque LLM Scoring
- **Date**: Step 13 (AI Command Center)
- **Status**: Accepted
- **Context**: The hostel operational command center required an overall health score (0-100) and actionable operational risk insights across 7 subsystems.
- **Alternatives Considered**:
  - *Alternative A: Direct LLM Prompting (e.g. asking Gemini to evaluate health)*: Nondeterministic, unpredictable scores between queries, potential hallucination, requires external API keys, ongoing token costs, fails if internet connection drops.
  - *Alternative B: Deterministic Operational Scoring Formula (Selected)*: Explicit mathematical formula calculating 5 weighted subsystem scores (Complaints 30 pts, Maintenance 20 pts, Cleaning 20 pts, Mess 15 pts, Security 15 pts) with transparent penalty breakdowns and deterministic keyword-driven NL assistant.
- **Rationale**: 100% explainable to university management, zero token costs, works offline, completely reproducible, and provides clear audit rationale for why a hostel dropped into a risk band. Ready for optional Gemini LLM enhancement via `.env.example` extension.

---

### DEC-010: Month-Boundary Safe Calendar Math for Maintenance Cycles
- **Date**: Step 9 (Preventive Maintenance Engine)
- **Status**: Accepted
- **Context**: Preventive maintenance schedules recurring jobs (monthly, quarterly, semi-annually). Standard JavaScript `Date` addition causes calendar overflow bugs (e.g., adding 1 month to January 31 produces March 2/3 instead of February 28/29).
- **Alternatives Considered**:
  - *Alternative A: Adding 30 Fixed Days*: Drifts calendar dates over time, throwing off monthly inspection cycles.
  - *Alternative B: External Date Library (Moment.js / date-fns)*: Adds heavy external package dependencies for a single date math requirement.
  - *Alternative C: Custom Calendar-Safe Math in `dateUtils.js` (Selected)*: Native date calculation that clamps the resulting day to the last valid day of the target month.
- **Rationale**: Zero dependencies, completely accurate calendar scheduling, prevents duplicate or skipped maintenance cycles.

---

### DEC-011: Compound Unique Indexes for Duplicate Prevention
- **Date**: Step 10 (Mess Feedback) & Step 15 (Budgeting)
- **Status**: Accepted
- **Context**: Students submitting meal reviews or administrators allocating category budgets could accidentally create duplicate records under network retries or concurrent clicks.
- **Alternatives Considered**:
  - *Alternative A: Application-Level Pre-Query (`findOne` before `create`)*: Vulnerable to race conditions under concurrent requests.
  - *Alternative B: Database Compound Unique Indexes (Selected)*: Enforced at MongoDB storage engine level via compound unique index `{ studentId: 1, messId: 1, mealDate: 1, mealType: 1 }` with `unique: true`.
- **Rationale**: Impossible to bypass even under high concurrency. Database rejects duplicate attempts with E11000, gracefully mapped to HTTP 409 Conflict by `errorHandler.js`.

---

### DEC-012: Sequential Human-Readable Identifiers via Atomic Counter
- **Date**: Step 5.1 (Complaint Engine) & Step 8 (Work Orders)
- **Context**: MongoDB ObjectIds (e.g. `64a7f8e...`) are impractical for students, wardens, and gate staff to reference verbally, in SMS, or on physical receipts.
- **Alternatives Considered**:
  - *Alternative A: Raw MongoDB ObjectId*: Hard to read, prone to transcription errors.
  - *Alternative B: Random UUID*: Long and user-unfriendly.
  - *Alternative C: Prefixed Sequential Counters (Selected)*: `CMP-2026-00001`, `WO-2026-00001`, `AST-2026-00001`, `CLN-2026-00001`, `OUT-2026-00001` generated using atomic `Counter.findOneAndUpdate({ $inc: { seq: 1 } })`.
- **Rationale**: Immediate human recognition of entity type, creation year, and sequence number. Atomic increment guarantees non-colliding sequential numbers.

---

### DEC-013: Tiered Rate Limiting Strategy
- **Date**: Step 17 (Security Hardening)
- **Status**: Accepted
- **Context**: Different API endpoints have vastly different resource costs and threat profiles.
- **Alternatives Considered**:
  - *Alternative A: Single Global Rate Limiter*: Either too loose for login endpoints (permitting credential stuffing) or too tight for dashboard metrics.
  - *Alternative B: Tiered Rate Limiters (Selected)*:
    - Auth endpoints: 20 req / 15 min (credential brute force defense)
    - AI & Analytics queries: 30-60 req / 15 min (protects compute and aggregations)
    - Global API: 1000 req / 15 min (general DDoS defense)
- **Rationale**: Precision protection without impacting standard resident and warden navigation. Automatically disabled during test suites (`NODE_ENV === 'test'`).

---

### DEC-014: Recursive NoSQL Operator Sanitization Middleware
- **Date**: Step 17 (Security Hardening)
- **Status**: Accepted
- **Context**: MongoDB queries can be compromised if user-supplied JSON bodies contain operator injection keys such as `$gt`, `$ne`, or dot notation.
- **Alternatives Considered**:
  - *Alternative A: Express-Mongo-Sanitize Package*: External package with maintenance dormancy concerns.
  - *Alternative B: Native Custom Middleware `mongoSanitize.js` (Selected)*: Recursively inspects `req.body`, `req.query`, and `req.params`. Instantly rejects requests containing `$` or `.` with HTTP 400.
- **Rationale**: Zero external dependency, clean fail-fast behavior, and guarantees no operator injection payload reaches Mongoose query builders.

---

### DEC-015: First Pilot Scope - Single-Workflow Complaint-to-Resolution MVP
- **Date**: 2026-10-09
- **Status**: Accepted
- **Context**: BBDU-Hosteller has 24 subsystems, 37 models, and passed 248 integration tests. However, software completeness does not prove user adoption, operational fit, or field reliability. A strategy decision was required on whether to launch the full platform simultaneously or validate a single core workflow first.
- **Alternatives Considered**:
  - *Alternative A: Full Platform Launch (All 24 Subsystems)*: Exposing finance, asset retirement, mess menus, cleaning checklists, outpasses, and the AI command center simultaneously. High risk of cognitive overload, training friction, incomplete adoption, and high support burden.
  - *Alternative B: Multi-Hostel Campus Rollout of Core Complaints*: Rolling out complaints to all university hostels at once. High operational exposure if initial SLA settings or technician workflows have unforeseen defects.
  - *Alternative C: Single-Workflow Pilot in One Hostel/Block (Selected)*: Constraining the initial pilot to one hostel or block, one warden, and a small technician group focusing exclusively on Complaint-to-Resolution (Submit > Triage/Assign > Work/Resolve > Student Verify/Reopen > Warden Oversight).
- **Rationale**: Validates the core value proposition ("Every hostel complaint has an owner, a deadline, and a visible resolution trail") with minimal operational risk. Deferring automatic escalations prevents alarm fatigue among campus executives. Peripheral modules remain preserved in the codebase (deployment boundary, not code deletion) for subsequent rollout phases.
- **Consequences**: Peripheral modules (finance, assets, cleaning, mess, outpass, AI command center) are deferred at the deployment boundary for pilot users. Baseline empirical metrics (time to acknowledge, time to resolve, reopened rates) must be gathered before expanding scope.

---

## Decision Log Template (For New Tasks)

When making any new non-trivial decision, copy and fill out this template at the bottom of this file:

```markdown
### DEC-XXX: [Short Descriptive Title]
- **Date**: YYYY-MM-DD
- **Status**: Proposed / Accepted / Superseded / Deprecated
- **Context**: [What problem are we solving? What are the constraints?]
- **Alternatives Considered**:
  - *Alternative A*: [Description, Pros, Cons]
  - *Alternative B*: [Description, Pros, Cons]
  - *Alternative C*: [Selected approach, Pros, Cons]
- **Rationale**: [Why this option was chosen over the alternatives. Performance, security, or maintenance impact]
- **Consequences**: [What trade-offs were accepted? What follow-up work is required?]
```
