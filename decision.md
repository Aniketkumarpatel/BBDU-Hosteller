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

### DEC-016: Mandatory Pull-Before-Push Git Protocol
- **Date**: 2026-10-09
- **Status**: Accepted
- **Context**: In multi-device or collaborative development environments, remote changes can land while local work is underway. Pushing directly without synchronizing causes non-fast-forward push rejections and dirty merge graphs.
- **Alternatives Considered**:
  - *Alternative A: Push and resolve errors on failure*: Reactive, prone to non-fast-forward failures and panic merges.
  - *Alternative B: Force pushing (git push --force)*: Extremely dangerous; overwrites remote commits and destroys teammate work.
  - *Alternative C: Mandatory Pull with Rebase Before Push (Selected)*: Enforce running `git pull --rebase origin <branch>` before every `git push`.
- **Rationale**: Guarantees clean, linear git commit history, instantly surfaces any upstream changes before pushing, and eliminates broken push rejections.
- **Consequences**: Codified as Rule 13 in `CLAUDE.md` and integrated into all deployment and session procedures.

---

### DEC-017: Frontend Pilot Mode Navigation Scoping (DEC-015 Implementation)
- **Date**: 2026-10-09
- **Status**: Accepted
- **Context**: To implement DEC-015 (First Pilot Scope - Single-Workflow Complaint-to-Resolution MVP), pilot users (students, wardens, staff) needed a focused navigation experience without cognitive friction from deferred modules.
- **Alternatives Considered**:
  - *Alternative A: Deleting or commenting out unused routes and components*: Destructive, risks merge conflicts, and discards finished engineering work.
  - *Alternative B: Runtime role permission rewrites in backend*: Over-complicated for an initial pilot, risks backend permission regression for admin users.
  - *Alternative C: Configurable Frontend Pilot Mode Flag (VITE_PILOT_MODE) (Selected)*: A lightweight environment toggle (`IS_PILOT_MODE`) in `DashboardLayout.jsx` that presents only the core Complaint-to-Resolution navigation links to students, wardens, and staff, while keeping all routes compiled and available when set to `false`.
- **Rationale**: Completely non-destructive, zero impact on backend business logic or test suites, instantaneous to toggle on or off, and provides a clear visual "Pilot Focus" indicator.
- **Consequences**: Deferred modules remain fully accessible via direct URLs for administrators, but regular pilot participants see only their relevant complaint workflows.

---

### DEC-018: End-to-End Runtime Pilot Loop Verification and Centralized Rate Limiter Calibration
- **Date**: 2026-10-09
- **Status**: Accepted
- **Context**: DEC-015 defined the Phase 1 Complaint-to-Resolution pilot workflow across 5 core stages: Student Submission, Warden Triage and Assignment, Staff Acknowledgment and Start Work, Staff Resolution, Student Verification or Reopen Loop, and Warden Resolution Audit. We required automated verification that exercises the exact live HTTP API against a running database without mock shortcuts, and ensures authentication rate limiters do not deadlock development or continuous verification cycles.
- **Alternatives Considered**:
  - *Alternative A: Rely purely on unit and controller tests*: Unit tests test mocked controllers in isolation but do not test real session handoffs, live database transactions across roles, or network-level rate limiting behavior.
  - *Alternative B: Manual QA via browser only*: Time-consuming, subjective, prone to human error, and lacks repeatable audit logging across multiple role personas.
  - *Alternative C: Standalone Automated E2E Runtime Script with Centralized Rate Limiting Calibration (Selected)*: Created `backend/scripts/verify-pilot-complaint-loop.mjs` verifying all 12 operational steps across Student, Warden, and Staff personas against the live server. Calibrated `authLimiter` to centralize in `middleware/rateLimiter.js` and allow 500 requests per 15 minutes in non-production environments (retaining 20 in production).
- **Rationale**: Proves 100% operational readiness of the core state machine (`SUBMITTED` -> `TRIAGED` -> `ASSIGNED` -> `ACKNOWLEDGED` -> `IN_PROGRESS` -> `STUDENT_VERIFICATION` -> `REOPENED` -> `IN_PROGRESS` -> `STUDENT_VERIFICATION` -> `CLOSED`). Eliminates false 429 lockouts during automated test cycles while maintaining production brute-force security.
- **Consequences**: Continuous development verification can be executed in seconds. The full 12-step complaint loop is empirically proven functional before live pilot deployment.

---

### DEC-019: Pilot Cohort Seeding and Facility Maintenance Department Alignment
- **Date**: 2026-10-09
- **Status**: Accepted
- **Context**: The pilot required dedicated credentials and realistic test fixtures for Boys Hostel 1 (BBDU A and B Block, Block 1) across all three pilot roles (1 Warden, 2 Technicians, 3 Resident Students). Furthermore, the core complaint engine expected maintenance department codes (`PLUMB`, `ELEC`, `HOUSEKEEPING`, etc.), but previously only `CSE` existed in `seed.js`.
- **Alternatives Considered**:
  - *Alternative A: Require manual browser registration during testing*: Prone to misconfigured room numbers, unassigned staff departments, and wasted setup time.
  - *Alternative B: Overwrite the entire database with a destructive reset*: Destructive, risks wiping existing test records and indexes.
  - *Alternative C: Idempotent Pilot Cohort Seeder (`backend/scripts/seed-pilot-cohort.mjs`) and Main Seeder Alignment (`seed.js`) (Selected)*: Created an idempotent script that establishes all 7 maintenance departments, links the Pilot Hostel hierarchy (Hostel, Block 1, Floor 1, Rooms 101-105), provisions Warden (`warden@bbdu.ac.in`), Plumber (`staff@bbdu.ac.in`), Electrician (`electrician@bbdu.ac.in`), and 3 Students (`student@bbdu.ac.in`, `rohan@bbdu.ac.in`, `kabir@bbdu.ac.in`), and populates 5 baseline complaints spanning all 5 lifecycle states (`SUBMITTED`, `ASSIGNED`, `IN_PROGRESS`, `STUDENT_VERIFICATION`, `CLOSED`).
- **Rationale**: Enables immediate field testing and developer QA out of the box without manual setup steps or risk of database corruption.
- **Consequences**: Seeded complaints provide rich realistic state for all pilot dashboards (Student, Warden, Staff).

---

### DEC-020: Backend Pilot Gating Switch and Warden-Only Breach Notification
- **Date**: 2026-10-09
- **Status**: Accepted and implemented 2026-10-09 (Phase 5 task 5.1). Verified: 7 new tests and the full suite (277 of 277) pass.
- **Context**: DEC-015 and DEC-017 scoped the pilot, but only the frontend navigation is gated (`VITE_PILOT_MODE`). A code audit found: (a) all seeded SLA rules have `escalationEnabled: true`, so a breach auto-reassigns Staff to Warden to Authority; (b) five deferred-module scheduler jobs (preventive maintenance, cleaning, outpass, asset, finance) run for pilot users; (c) with escalation disabled the scheduler marks `BREACHED` but sends no notification, so nobody is told; (d) the 75 percent reminder only goes to the assignee, so unassigned complaints get none.
- **Alternatives Considered**:
  - *Alternative A: Set `escalationEnabled: false` on the seeded SLA rules only*: Smallest change, works through existing code. But it is data, not enforcement: an Admin editing a rule in the UI, a re-seed, or a new rule silently re-enables executive escalation, and it does nothing for the deferred scheduler jobs or the silent breach.
  - *Alternative B: Hide the Authority and Super Admin accounts so escalation notifications go nowhere*: Hides the symptom, leaves state transitions (reassignment to Authority) happening, and corrupts the pilot metrics.
  - *Alternative C: Backend `PILOT_MODE` environment switch enforced in code (Selected)*: When on, `escalateComplaint` is never called, deferred job groups are skipped, a breach notifies only the assigned Warden once per SLA cycle, and unassigned complaints remind the Warden. Default is off, so all existing tests and the full-platform behavior are unchanged when the flag is absent.
- **Rationale**: The pilot promise is explicit in the USP ("wardens can see what is stuck") and DEC-015 forbids executive paging. Only an enforced switch makes the boundary independent of data and of administrator actions. A flag also gives a clean rollback path: each later module wave can remove its job from the skip list when its gate opens.
- **Consequences**: New env variable documented in `.env.example`. New tests must prove no Authority notification or reassignment occurs under `PILOT_MODE`. Scheduler job list in `report.md` Section 12 and `architecture.md` updated.
- **Implementation notes (2026-10-09)**:
  - The flag is read in one place for runtime (`slaScheduler.js` passes `env.PILOT_MODE`). `processSlaAndEscalations({ pilotMode = false })` defaults to off so every existing test and verify script is unaffected, and so a developer's `.env` cannot change test outcomes.
  - Q5 resolved by evidence: job 3 (work order SLA) and job 9 (student services: auto-publish and expire scheduled notices) act only on records the pilot never creates, so they keep running. Gating them would add code for no benefit. This reverses the earlier recommendation to skip them.
  - Wardens are found by the complaint's own `hostelId` only. There is deliberately no fallback to wardens of other hostels (unlike `findEscalationTarget`), to preserve cross-hostel isolation. If a hostel has no active warden, a warning is logged and no notice is sent.
  - A breach also marks the active `ComplaintSlaCycle` as `BREACHED` (the pre-existing non-pilot `escalationEnabled: false` path leaves the cycle `ACTIVE`; that path was intentionally not changed).
  - `escalateComplaint` is called only by the scheduler (no manual escalation endpoint exists), so gating the scheduler closes every escalation path.
  - **Known trade-off**: the default is fail-open (flag absent means full escalation), chosen so existing behavior and tests are unchanged. Mitigations: the startup log states the active mode, `.env.example` documents it, and it is Go-Live Gate item 6. A fail-closed production default can be revisited in Phase 7 when per-hostel policy exists.

---

### DEC-021: Complaint Photo Handling for the Pilot
- **Date**: 2026-10-09
- **Status**: Proposed (decision on exposure pending user, open question Q4)
- **Context**: Photo upload is already implemented (multer, 5 MB, JPG/PNG/WEBP, local disk) though earlier docs listed it as not built. Files are served by an unauthenticated `express.static('/uploads')`, type is trusted from the client MIME header, EXIF metadata is retained, and storage is local disk. Photos may show student rooms and belongings.
- **Alternatives Considered**:
  - *Alternative A: Leave as is, add an access note*: Zero effort, but any URL holder can view the image and EXIF can carry location data. Fails Go-Live Gate item 3.
  - *Alternative B: Disable the photo field for the pilot, revisit in wave 8*: Fastest and safest. Loses a useful diagnostic input for plumbing and electrical faults; technicians may ask for it.
  - *Alternative C: Harden then keep (Selected as the recommended direction)*: Replace public static with an authenticated route enforcing the same visibility rules as the complaint (owner student, assigned staff, hostel Warden, Admin), verify file content by magic bytes, strip metadata, serve with `nosniff` and a private cache policy, make the storage directory configurable for a persistent volume, and set a retention rule.
- **Rationale**: Authorization is already solved for complaints, so reusing it for files is cheap and removes the exposure class entirely. Whether to ship it in the pilot at all is a product call, hence open question Q4. If the user prefers B, Alternative C still happens before wave 8.
- **Consequences**: Possible new dependency for image re-encoding (needs its own approval). Existing stored URLs change shape. Frontend image components must send credentials, because plain `<img src>` cannot attach a bearer token; implementation must choose between short-lived signed URLs and fetch-to-blob.

---

### DEC-022: Password Lifecycle and Pilot Credential Provisioning
- **Date**: 2026-10-09
- **Status**: Accepted. Backend (5.3a) and frontend (5.3b) implemented and verified 2026-10-10. Provisioning script, seed guard and demo-credential audit script (5.3c) still open.
- **Context**: No endpoint exists for changing or resetting a password (verified by search). Seeds use the shared `Password@123` and public demo emails. Go-Live Gate item 4 requires unique credentials, which is unenforceable without a way to change or recover them.
- **Alternatives Considered**:
  - *Alternative A: Provision unique passwords once, tell users never to forget them*: No code. Any lost password needs a database edit by the project team, which does not scale past a handful of users and encourages sharing.
  - *Alternative B: Email-based reset links*: Standard, but requires an email provider, deliverability work, and domain ownership, none of which exist yet. Also couples the pilot to wave 8 infrastructure.
  - *Alternative C: Self-service change, admin-initiated reset with a one-time temporary password, forced change on first login, and a provisioning script (Selected)*: Needs only existing infrastructure. Adds a `mustChangePassword` flag on `User`. The provisioning script generates unique random passwords and prints them once for hand-off. Seeds refuse to create demo accounts when `NODE_ENV=production`.
- **Rationale**: Meets the gate with zero external services, keeps the Warden or project team as the reset authority during the pilot, and leaves a clean upgrade path to email reset in wave 8.
- **Consequences**: Schema change on `User` (index and model tests to update). Reset actions must write `SecurityAuditLog` events. Temporary password is shown once and never logged. Rate limiting on the change endpoint reuses the auth limiter.
- **Implementation notes and scope changes (2026-10-10)**:
  - **Reset scope (user decision, RBAC extension)**: SUPER_ADMIN may reset any other account. WARDEN may reset only STUDENT and HOSTEL_STAFF of their own hostel; an out-of-role attempt is audited as `PRIVILEGE_ESCALATION_ATTEMPT` and a cross-hostel attempt as `CROSS_HOSTEL_ACCESS_ATTEMPT`, both refused with 403. Chosen over "Super Admin only" because forgotten passwords are the most common support request and the Warden is on site. Nobody resets their own password through this endpoint.
  - **Session revocation was added** (not in the original draft). JWTs are stateless, so a reset that leaves old tokens alive does not remove a shared or stolen credential. `User.passwordChangedAt` plus a check in `requireAuth` revokes older tokens. Alternatives rejected: a server-side token denylist (new storage and lookup on every request) and shortening token lifetime (does not revoke, hurts usability). Known tolerance: JWT `iat` has one-second precision, so a token issued in the same second as the change is accepted. This is deliberate, otherwise the fresh token returned by change-password would be rejected.
  - **Forced-change gate is enforced in the backend** (`requireAuth`), not only in the UI. Allow-list via `requireAuthAllowPasswordChange`: `/auth/me` and `/auth/change-password` (logout has no auth). Anything else returns 403 `PASSWORD_CHANGE_REQUIRED`.
  - **Wrong current password returns 400, never 401**, because the frontend interceptor treats 401 as an expired session and clears credentials.
  - **A weak side door was closed**: `PUT /api/admin/users/:id` accepted a 6-character `password` with no audit. All entry points (registration, change, reset, admin create, admin update) now share one `passwordPolicySchema`. Admin-created users must change their initial password. An admin cannot set their own password through the user form.
  - The reset endpoint lives under `/api/auth/users/:id/reset-password` because the `/api/admin` router is SUPER_ADMIN-only. It is intentionally not behind `authLimiter`, since a Warden resetting several residents from one campus IP would otherwise hit the shared limit (see DEC-025).
  - **Frontend and Warden list endpoint (5.3b)**: a Warden cannot reach `/api/admin/users`, so a hostel-scoped `GET /api/auth/hostel-users` was added (WARDEN only, own-hostel STUDENT and HOSTEL_STAFF, escaped literal search so regex metacharacters cannot cause regex injection or ReDoS, capped at 100 rows, an out-of-scope `role` filter is ignored rather than honored). The temporary password lives only in React component state inside `TemporaryPasswordModal`, is never put in a URL, localStorage or log, and is cleared when the dialog closes (verified in a real browser). The forced-change redirect is mirrored in `ProtectedRoute` but the backend gate remains the real control. The wrong-current-password error is a 400 so the axios 401 interceptor does not sign the user out.
  - **Pre-existing defect found while verifying, fixed minimally**: the admin Users page crashed at HEAD because the API wraps lists (`{ users, total }`) and returns `id`, while the page expected bare arrays with `_id`. Fixed only on that page via a small `toList` normalizer. Sibling admin pages share the pattern and are NOT fixed (report.md D1); that is deliberately a separate concern.
  - Audit details never contain the temporary password, current password, or any hash. The audit logger already redacts keys containing `password`; tests assert the absence of the temporary password and bcrypt hashes in all audit documents.

---

### DEC-023: Roadmap Sequencing - Fixed Pilot Phases, Evidence-Gated Candidate Waves, Campus-Wide End State
- **Date**: 2026-10-09
- **Status**: Accepted (confirmed by the user on 2026-10-09)
- **Context**: The project had a pilot plan but no defined end. The user defined the end state as campus-wide rollout and asked that the order of post-pilot work be decided after pilot feedback. A 4-week pilot duration was chosen.
- **Alternatives Considered**:
  - *Alternative A: Fully scripted calendar roadmap now*: Gives a tidy plan, but fixes the order of modules before any user evidence exists. That repeats the mistake DEC-015 corrected (assuming completeness equals adoption).
  - *Alternative B: Only a pilot, no plan beyond it*: Honest but leaves the "till the end of project" request unmet and gives the university no view of the destination.
  - *Alternative C: Fixed Phases 5, 6 and 12, candidate waves 7 to 11 with evidence gates and dependency rules (Selected)*: The near term and the finish line are concrete, the middle is explicit about what evidence would justify each wave.
- **Rationale**: Preserves DEC-015's principle that user evidence, not code completeness, drives scope. Dependency rules (19.4) stop module waves from being enabled before the core loop is stable.
- **Consequences**: Phase 6 exit must produce a written wave ranking and the agreed numeric thresholds as a new decision entry. Waves have gates, not dates. Phase 12 defines project completion.

---

### DEC-024: Documentation Governance - Verified Facts, Static Versus Executed Counts, User-Owned Git Commits
- **Date**: 2026-10-09
- **Status**: Accepted (user confirmed git ownership on 2026-10-09)
- **Context**: A code audit found the reference docs had drifted: git history, test suites, upload support, registration allocation, the scheduler job list, and script inventory were stale. MongoDB was not reachable during the audit, so the test suite could not be executed. The user also stated they commit to git themselves.
- **Alternatives Considered**:
  - *Alternative A: Update docs from memory of the last known state*: Fast, and it repeats the exact failure that caused the drift.
  - *Alternative B: Update numbers by static count and present them as results*: Looks complete, but a count of `test(` declarations is not a pass result and would overstate verification.
  - *Alternative C: Verify each claim against code, label static versus executed figures, and leave all git actions to the user (Selected)*.
- **Rationale**: The Quality Standards forbid guessing and require honest reporting. Labeling the unexecuted test count keeps the record truthful and creates a tracked task (5.9) to close it.
- **Consequences**: Claude edits files only and never runs `git commit` or `git push`; Rule 13 (pull before push) and the one-concern-per-commit rule are applied by the user when committing. Suggested commit grouping for this change set: (1) docs audit corrections, (2) roadmap and decisions.

---

### DEC-025: Production Proxy Trust and Per-User Rate Limit Keying
- **Date**: 2026-10-09
- **Status**: Proposed (Phase 5 task 5.4, depends on the hosting answer Q1)
- **Context**: Rate limiters in `rateLimiter.js` use the default IP key and no `trust proxy` is set anywhere. In production the auth limit is 20 per 15 minutes. Behind a reverse proxy, every request appears to come from the proxy IP, and on a campus network many users may share one NAT address. The whole cohort would share one login budget, and could lock itself out on the first morning.
- **Alternatives Considered**:
  - *Alternative A: Raise or remove the production auth limit*: Removes the lockout but also removes brute-force protection that DEC-013 established.
  - *Alternative B: Set `trust proxy` only*: Fixes the proxy case (real client IP from `X-Forwarded-For`), but not campus NAT where many students genuinely share one public IP.
  - *Alternative C: `trust proxy` set to the exact proxy hop count, plus auth routes keyed on IP combined with the submitted email (Selected)*: Brute force is limited per account and per source, a shared NAT no longer pools the cohort into one bucket.
- **Rationale**: Keeps DEC-013's security intent while making the limit fit the real network. The hop count must match the real deployment, otherwise `X-Forwarded-For` can be spoofed to dodge limits, so the value is set only after Q1 is answered.
- **Consequences**: New tests for the limiter key function. The global limiter (1000 per 15 minutes) should be re-sized against expected cohort traffic during load testing in 5.4. Keying by submitted email needs care not to create an account-lockout denial of service; use a per-email budget that is sized above realistic mistyped-password counts.

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
