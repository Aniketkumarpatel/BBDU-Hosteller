# BBDU Hosteller

**Smart Hostel Management & Complaint Escalation Platform**

> Status: **Feature build complete (Steps 1 to 18). Pilot-staged, hardening required before real student data.** The roadmap, pilot blockers, and open questions are in `report.md` Sections 15 and 18 to 21.

## Tech Stack

| Layer | Tech |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS v4, React Router 7, Axios |
| **Backend** | Node.js >= 22 (LTS 22.x), Express.js 5, MongoDB, Mongoose, bcryptjs, jsonwebtoken, zod, express-rate-limit |
| **Engines** | Central SLA & Escalation Engine, In-App Notification Engine, Work Order Engine, Preventive Maintenance Engine, Mess Management Engine, Housekeeping Engine, Visitor & Outpass Engine, AI Operational Intelligence Engine |
| **Middleware** | cors, helmet, morgan, dotenv, rateLimit, requireAuth, requireRole |

---

## First Pilot: Complaint-to-Resolution Core Focus

The platform architecture is complete across 24 subsystems and 37 models, but field deployment begins with a tightly scoped pilot in a single hostel or block:
- **Core Workflow**: Student submits issue > Warden triages & assigns owner > Staff acknowledges & resolves > Student verifies fix or reopens > Warden monitors resolution trail.
- **Proposed USP**: Every hostel complaint has an owner, a deadline, and a visible resolution trail.
- **Deferred for Pilot (Deployment Boundary)**: Finance, asset scrap, mess menus, cleaning checklists, gate outpass, and the AI command center are deferred from pilot navigation to eliminate operational friction.
- **Auto-Escalation**: Deferred until university executives confirm escalation authority and threshold expectations; notification reminders and countdown deadlines remain active. **Note**: this is the intended policy. The backend does not yet enforce it (seeded SLA rules still escalate), which is the first Phase 5 task (DEC-020).
- **Demo Accounts**: The accounts below and the shared password are for development only. They must be disabled before any real pilot data (Go-Live Gate item 4).

---

## Role-Based Access Control (RBAC)

The platform enforces five strictly bounded system roles across backend middleware and frontend route guards:

| Role | Operational Scope & Permissions | Dashboard Route |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Full system control: user provisioning, SLA configuration, inventory, escalations | `/admin/dashboard` |
| **`AUTHORITY`** | University executive oversight: Chief Warden & Proctor office monitoring | `/authority/dashboard` |
| **`WARDEN`** | Assigned hostel operations: triage complaints, create/reassign work orders, manage assets | `/warden/dashboard` |
| **`HOSTEL_STAFF`** | Maintenance technicians: accept/start/hold/complete assigned work orders | `/staff/dashboard` |
| **`STUDENT`** | Resident account: submit issues, track progress, verify or reopen resolutions | `/student/dashboard` |

### Security Model:
- **Strict Role Boundaries**: Students are strictly forbidden from creating, modifying, reassigning, or completing work orders.
- **No Privilege Escalation**: Public registration (`POST /api/auth/register`) permits only `STUDENT` accounts.
- **Zero Leakage**: `passwordHash` is `select: false` at schema level and stripped during serialization.
- **Stateless Tokens**: JWTs contain minimal claims (`userId`, `role`) signed using `JWT_SECRET`.

---

## Demo Accounts

Pre-seeded accounts for testing each role (All passwords: `Password@123`):

| Role | Email | Password | Description |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `admin@bbdu.ac.in` | `Password@123` | System Administrator |
| **AUTHORITY** | `authority@bbdu.ac.in` | `Password@123` | Chief Warden Office |
| **WARDEN** | `warden@bbdu.ac.in` | `Password@123` | Boys Hostel 1 Warden |
| **HOSTEL_STAFF** | `staff@bbdu.ac.in` | `Password@123` | Maintenance & Facilities Staff |
| **STUDENT** | `student@bbdu.ac.in` | `Password@123` | Resident student (BH1 / Room 101) |

To re-seed demo accounts and hostel hierarchy:
```bash
cd backend
npm run seed
```

---

## Core Systems & Engines (Steps 1–8)

1. **Authentication & RBAC (Step 3)**: Secure JWT bearer-token authentication (`Authorization` header, no cookies) with 5 roles. Password change and reset are available in the API (`POST /api/auth/change-password`, `POST /api/auth/users/:id/reset-password`; SUPER_ADMIN any user, WARDEN student and staff of own hostel) with forced first-login change and session revocation. Screens: `/change-password` (forced after a reset), `/warden/people` (Warden), and a Reset action on the admin Users page (DEC-022).
2. **Location Hierarchy (Step 4)**: Hostels, Blocks, Floors, Rooms, and Departments with capacity checks.
3. **Complaint Lifecycle Engine (Steps 5.1–5.4)**: `SUBMITTED → TRIAGED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → STUDENT_VERIFICATION → RESOLVED / CLOSED` (with student `REOPENED` loop).
4. **SLA Countdown & Automatic Escalation (Steps 5.5–6)**: 60-second central scheduler monitoring deadlines, breach warnings, and multi-tier escalations (Staff → Warden → Authority).
5. **Admin SLA Configuration (Step 5.7)**: Real-time SLA rules configuration for Super Admins.
6. **In-App Notification Engine (Step 5.8)**: In-app alerts and unread counters, delivered by REST polling (no WebSocket push, no SMS or email yet).
7. **Analytics & Operational Intelligence (Step 7)**: Aggregations, mean time to resolve (MTTR), department performance, and SLA breach trends.
8. **Maintenance & Work Order Engine (Step 8)**:
   - **Bridging Gap**: Converts student complaints into physical engineering tickets (`WO-2026-XXXXX`).
   - **Asset Management**: Complete equipment registry (`AST-2026-XXXXX`), status/condition tracking, and failure history.
   - **Full Work Order Lifecycle**: `CREATED → ASSIGNED → ACCEPTED → IN_PROGRESS → ON_HOLD → COMPLETED / CANCELLED`.
   - **SLA Breach Monitoring**: Work order deadlines integrated into the single existing background worker.
   - **Audit Logs**: Chronological event logs with user stamps, timestamps, and note capture.
9. **Preventive Maintenance & Smart Maintenance Scheduling (Step 9)**:
   - **Proactive Equipment Care**: Schedules recurring servicing, inspections, and filter replacements (`MP-2026-XXXXX`).
   - **Zero Duplicate Schedulers**: Integrated into the central 60-second scheduler loop (`slaScheduler.js`).
   - **Idempotent Work Order Auto-Generation**: Automatically spawns linked work orders (`WO-YYYY-XXXXX`) when maintenance is due without creating duplicates.
   - **Safe Calendar Computation**: Strict month-boundary date math (e.g. Jan 31 + 1 month = Feb 28/29).
   - **Asset Health Scoring (Deterministic)**: Classifies equipment health (`HEALTHY`, `MAINTENANCE_DUE`, `OVERDUE`, `FREQUENTLY_FAILING`, `CRITICAL`) using explicit operational thresholds without ML/AI.
   - **Cycle Tracking & History**: Retains full historical cycles (`CYC-YYYY-XXXXX`) with scheduled dates, completion notes, and overdue status.
10. **Mess & Food Quality Management Module (Step 10)**:
    - **Hostel Mess Infrastructure**: Multi-mess registry (`MESS-2026-XXXXX`) with hostel links, manager assignments, and capacity tracking.
    - **Weekly & Daily Menu Timetable**: Day-of-week meal schedules (`MENU-2026-XXXXX`) for Breakfast, Lunch, Snacks, and Dinner with draft/published controls.
    - **Student Meal Feedback**: Daily resident feedback (`FB-2026-XXXXX`) with multi-dimension rating (Rating 1-5, Food Quality, Taste, Hygiene, Quantity).
    - **Duplicate Review Prevention**: Strict unique compound constraint `{ studentId, messId, mealDate, mealType }` ensuring one submission per student per meal per day.
    - **Operational Hygiene Monitoring**: Deterministic rolling score calculation alerting Wardens and Authorities (`MESS_HYGIENE_ALERT`) if average hygiene drops below 3.0 stars.
    - **Seamless Complaint Integration**: Mess complaints enter the existing Complaint Engine (`category: 'MESS'`), mapped to `MESS_SERVICES` department with full SLA tracking, auto-escalation, and student verification.
    - **Mess Notices & Bulletins**: Real-time broadcasts (`MNOT-2026-XXXXX`) with priority tags (`NORMAL`, `IMPORTANT`, `URGENT`) and in-app notifications.

---

## Key API Endpoints

### Mess & Food Quality Module (`/api/messes`, `/api/mess-feedback`, `/api/mess-notices`)
- `GET    /api/messes` — List all dining facilities with hostel associations
- `GET    /api/messes/:id` — Mess facility details
- `POST   /api/messes` — Register new hostel mess (Warden, Authority, Admin)
- `PATCH  /api/messes/:id` — Update mess metadata and capacity
- `GET    /api/messes/dashboard` — Unified dining dashboard metrics, today's meals, hygiene status & recent reviews
- `GET    /api/messes/analytics` — Operational analytics: meal breakdown, 14-day rating trend, recurring low-rated meals & repeated complaints
- `GET    /api/messes/:messId/menus` — Retrieve weekly menu schedule
- `GET    /api/messes/:messId/menus/today` — Retrieve today's meal offerings
- `POST   /api/messes/:messId/menus` — Create or update meal menu (Staff, Warden, Authority, Admin)
- `POST   /api/messes/menus/:id/publish` — Publish menu and broadcast notification to hostel residents
- `POST   /api/messes/menus/:id/unpublish` — Unpublish menu back to draft state
- `POST   /api/mess-feedback` — Submit student meal rating (Student only, duplicate protected)
- `GET    /api/mess-feedback/my` — Student's personal meal feedback history
- `GET    /api/mess-feedback` — Filtered meal feedbacks queue
- `GET    /api/mess-notices` — Active mess notices and dining announcements
- `POST   /api/mess-notices` — Post new announcement with priority level (Staff, Warden, Authority, Admin)
- `PATCH  /api/mess-notices/:id/toggle` — Activate or deactivate mess notice

### Maintenance & Preventive Engine (`/api/maintenance-plans` & `/api/maintenance`)
- `GET    /api/maintenance/dashboard` — Unified dashboard metrics (active plans, upcoming, due, overdue, frequent failures)
- `GET    /api/maintenance/upcoming` — Equipment due for servicing within 7 days
- `GET    /api/maintenance/due` — Maintenance jobs currently due
- `GET    /api/maintenance/overdue` — Maintenance jobs past their due date
- `GET    /api/maintenance-plans` — Filtered maintenance plans queue (search, status, department)
- `GET    /api/maintenance-plans/:id` — Plan detail view with historical maintenance cycles
- `POST   /api/maintenance-plans` — Create new recurring maintenance plan (Warden, Authority, Super Admin)
- `PUT    /api/maintenance-plans/:id` — Update maintenance plan details
- `PATCH  /api/maintenance-plans/:id/pause` — Pause active plan (stops auto-generation)
- `PATCH  /api/maintenance-plans/:id/resume` — Resume paused plan and recalculates next due date
- `DELETE /api/maintenance-plans/:id` — Soft-deactivate maintenance plan

### Work Orders Engine (`/api/work-orders`)
- `GET    /api/work-orders` — Filtered work order queue (search, status, priority, overdue)
- `GET    /api/work-orders/stats` — Executive summary metrics (total, in progress, on hold, completed, overdue, avg hours)
- `GET    /api/work-orders/:id` — Detailed work order view with audit logs and complaint link
- `POST   /api/work-orders` — Create new work order (Warden, Authority, Super Admin)
- `PATCH  /api/work-orders/:id/assign` — Assign or reassign technician
- `PATCH  /api/work-orders/:id/accept` — Technician accepts assigned order
- `PATCH  /api/work-orders/:id/start` — Start physical maintenance work
- `PATCH  /api/work-orders/:id/hold` — Place work order on hold with reason
- `PATCH  /api/work-orders/:id/resume` — Resume work from on-hold state
- `PATCH  /api/work-orders/:id/complete` — Mark work complete with completion notes
- `PATCH  /api/work-orders/:id/cancel` — Cancel work order with explanation

### Asset Management (`/api/assets`)
- `GET    /api/assets` — Asset inventory listing with filters (type, condition, hostel, search)
- `GET    /api/assets/:id` — Asset specifications and status
- `POST   /api/assets` — Register new hostel asset (Warden, Authority, Super Admin)
- `PATCH  /api/assets/:id` — Update asset status/condition
- `GET    /api/assets/:id/maintenance-history` — Chronological work orders, failure rates, deterministic health, and maintenance cycles

### Cleaning & Housekeeping Management (`/api/cleaning`)
- `GET    /api/cleaning/dashboard` — Unified housekeeping KPIs (tasks today, verified, overdue, missed, avg quality score, staff workload)
- `POST   /api/cleaning/scheduler/run` — Manual trigger for idempotent recurring task generator & overdue batch checks
- `GET    /api/cleaning/areas` — Query registered hostel cleaning areas (rooms, washrooms, corridors, lobbies)
- `POST   /api/cleaning/areas` — Register new cleaning location with custom checklist (Warden, Authority, Admin)
- `GET    /api/cleaning/areas/:id` — Cleaning area details
- `PATCH  /api/cleaning/areas/:id` — Update area details and custom checklist
- `GET    /api/cleaning/plans` — Query recurring cleaning schedules
- `POST   /api/cleaning/plans` — Create recurring schedule (daily/weekly/monthly) with default assignees
- `GET    /api/cleaning/plans/:id` — Plan detail view
- `PATCH  /api/cleaning/plans/:id` — Update plan specifications
- `PATCH  /api/cleaning/plans/:id/status` — Activate or pause recurring cleaning plan
- `GET    /api/cleaning/tasks` — Filtered cleaning tasks queue (date, status, area, overdue, assignee)
- `POST   /api/cleaning/tasks` — Create manual cleaning task (`CLN-YYYY-XXXXX`)
- `GET    /api/cleaning/tasks/:id` — Detailed task view with audit trail, checklist items, and quality score
- `POST   /api/cleaning/tasks/:id/assign` — Assign staff member to cleaning task
- `POST   /api/cleaning/tasks/:id/accept` — Staff accepts assigned cleaning task
- `POST   /api/cleaning/tasks/:id/start` — Staff starts physical cleaning work (`IN_PROGRESS`)
- `POST   /api/cleaning/tasks/:id/hold` — Place task on hold with reason
- `POST   /api/cleaning/tasks/:id/resume` — Resume cleaning task from hold
- `POST   /api/cleaning/tasks/:id/complete` — Staff completes task with itemized checklist results and notes
- `POST   /api/cleaning/tasks/:id/verify` — Supervisor/Warden inspects quality with score (1–5) and remarks (self-verification strictly prevented)
- `POST   /api/cleaning/tasks/:id/reject` — Supervisor rejects task for rework back to `IN_PROGRESS`
### Visitor & Outpass Management (`/api/outpass`)
- `GET    /api/outpass/dashboard` — Operational KPIs (students currently outside, pending reviews, overdue alerts, today's returns, active visitors)
- `POST   /api/outpass/scheduler/run` — Manual trigger for overdue student return detection & warden alert dispatching
- `POST   /api/outpass/verify-token` — QR pass token verification for gate security scanning
- `GET    /api/outpass` — Filtered student outpass registry (hostel, status, emergency, search)
- `POST   /api/outpass` — Submit outpass request (Student only; validates dates, overlaps, and emergency priorities)
- `GET    /api/outpass/:id` — Detailed outpass view with audit log and emergency contact
- `GET    /api/outpass/:id/digital-pass` — Render official digital gate pass with verification token
- `POST   /api/outpass/:id/approve` — Warden review & digital pass issuance (self-approval strictly prohibited)
- `POST   /api/outpass/:id/reject` — Warden rejection with mandatory explanation
- `POST   /api/outpass/:id/cancel` — Student cancels pending/approved outpass before exit
- `POST   /api/outpass/:id/verify-exit` — Gate officer verifies student exit (`OUTSIDE`, records exit timestamp and verifier)
- `POST   /api/outpass/:id/verify-return` — Gate officer verifies student return (`RETURN_VERIFIED`, records return timestamp and verifier)
- `GET    /api/outpass/visitors` — Hostel visitor registry
- `POST   /api/outpass/visitors` — Register visitor (privacy enforced: only last 4 digits of government ID stored)
- `GET    /api/outpass/visitors/:id` — Detailed visitor information
- `POST   /api/outpass/visitors/:id/approve` — Warden approves visitor entry
- `POST   /api/outpass/visitors/:id/check-in` — Gate officer checks in visitor (`CHECKED_IN`, actual check-in timestamp)
- `POST   /api/outpass/visitors/:id/check-out` — Gate officer checks out visitor (`CHECKED_OUT`, actual check-out timestamp)
- `POST   /api/outpass/visitors/:id/reject` — Reject visitor entry

### Step 14: Hostel Inventory & Asset Lifecycle Management
- `GET    /api/assets` — List and filter assets (search, status, condition, operational flag, category, location; room-scoped for students, hostel-scoped for wardens)
- `POST   /api/assets` — Register new physical hostel asset with specifications, purchase cost, warranty window, expected life years
- `GET    /api/assets/dashboard` — Inventory KPI summary (total, active, under maintenance, damaged, frequent breakdown, warranty alerts, asset value, maintenance spend)
- `GET    /api/assets/analytics` — Cost analytics and repair expenditure breakdown
- `GET    /api/assets/:id` — Retrieve comprehensive asset details with warranty countdown, location, and metadata
- `PATCH  /api/assets/:id` — Update asset specifications, notes, or operational flags
- `POST   /api/assets/:id/move` — Relocate asset with destination hierarchy validation, relocation reason, and movement audit trail
- `POST   /api/assets/:id/condition` — Record physical condition audit with historical observation log
- `POST   /api/assets/:id/retire` — Decommission asset from active hostel service while maintaining complete historical record
- `POST   /api/assets/:id/dispose` — Permanent disposal / salvage scrap logging with disposal method and salvage valuation
- `GET    /api/assets/:id/health` — Deterministic asset health score (0–100) with condition penalties, age decay, repair expenditure ratio, and advisory recommendations
- `GET    /api/assets/:id/maintenance-history` — Chronological maintenance work orders, repair costs (labor, parts, service), and breakdown metrics

### Step 15: Hostel Finance & Expense Management
- `GET    /api/finance/financial-years` — Retrieve operational financial years
- `POST   /api/finance/financial-years` — Define new financial year window (Super Admin, Authority)
- `PATCH  /api/finance/financial-years/:id/close` — Close financial year (locks all budget/expense mutations)
- `PATCH  /api/finance/financial-years/:id/reopen` — Reopen closed financial year (Super Admin only)
- `GET    /api/finance/budgets` — List operational budgets with allocated, revised, utilized, and remaining balances
- `POST   /api/finance/budgets` — Allocate category budget for hostel (with duplicate guard per FY)
- `PATCH  /api/finance/budgets/:id` — Revise budget allocations with server-side remaining balance recalculation
- `GET    /api/finance/budgets/utilization` — Real-time budget utilization analytics and category breakdowns
- `GET    /api/finance/vendors` — List registered service & supply vendors (with search & category filters)
- `POST   /api/finance/vendors` — Register vendor profile
- `GET    /api/finance/vendors/:id` — Vendor details
- `PATCH  /api/finance/vendors/:id` — Update vendor profile
- `DELETE /api/finance/vendors/:id` — Soft-delete vendor (marks inactive if historical expenses reference vendor)
- `GET    /api/finance/expenses` — Query hostel operational expenses with pagination and filters
- `POST   /api/finance/expenses` — Create operational expense draft with work order, asset, and vendor links
- `GET    /api/finance/expenses/:id` — Expense details with complete chronological audit trail
- `PATCH  /api/finance/expenses/:id` — Update expense details in DRAFT or REJECTED status
- `POST   /api/finance/expenses/:id/submit` — Submit expense draft for warden review and approval
- `POST   /api/finance/expenses/:id/review` — Mark expense under administrative review
- `POST   /api/finance/expenses/:id/approve` — Approve expense with self-approval guard, atomically updating budget utilization
- `POST   /api/finance/expenses/:id/reject` — Reject expense with mandatory justification reason
- `POST   /api/finance/expenses/:id/cancel` — Cancel expense with automatic budget utilization reversal if approved
- `GET    /api/finance/traceability/:id` — Deep operational traceability (Expense $\rightarrow$ Work Order $\rightarrow$ Complaint $\rightarrow$ Asset $\rightarrow$ Vendor)
- `GET    /api/finance/dashboard` — Financial KPI summary (budgets, spend, remaining, pending approvals, top spends)

### Step 17: Advanced Security, Compliance & System Audit
- `GET    /api/admin/security-audit` — Query immutable security audit events (`AUD-YYYY-XXXXX`) with filters, search, and pagination (Super Admin only)
- `GET    /api/admin/security-audit/stats` — Aggregate security intelligence stats (24h event count, severity breakdown, top event types) (Super Admin only)
- **Global NoSQL Injection Sanitizer** — Native recursive inspection rejecting keys containing `$` or `.` across `req.body`, `req.query`, and `req.params`
- **Hardened HTTP Security Headers** — Helmet configured with Clickjacking defense (`X-Frame-Options: DENY`), MIME-sniffing prevention (`X-Content-Type-Options: nosniff`), and strict referrer policy
- **Origin-Checked CORS** — Whitelisting authorized domains with rejection of unauthorized origins
- **Tiered Rate Limiting** — Targeted rate limiters for authentication brute force, AI queries, analytics aggregates, and DoS mitigation
- **Immutable Security Audit Trail** — Dedicated `SecurityAuditLog` schema tracking failed logins, unauthorized access attempts, privilege escalations, and sensitive data mutations with automated redaction of passwords and tokens
- **Cross-Hostel Isolation Enforcement** — Strict server-side verification ensuring residents cannot forge cross-hostel service requests or access unassigned resources

---

## Frontend Routes

| Path | Access Level | Description |
| :--- | :--- | :--- |
| `/` | Public | Landing page |
| `/login` | Public | Role-based login |
| `/register` | Public | Student registration |
| `/student/*` | `STUDENT` | Resident portal & complaint tracking |
| `/warden/*` | `WARDEN` | Hostel management, triage & analytics |
| `/staff/*` | `HOSTEL_STAFF` | Technician queue & complaint execution |
| `/authority/*` | `AUTHORITY` | Campus-wide complaint & operational oversight |
| `/admin/*` | `SUPER_ADMIN` | Administration console, SLA control & master data |
| `/work-orders` | Staff, Warden, Authority, Admin | Maintenance work order list & KPI metrics |
| `/work-orders/:id` | Staff, Warden, Authority, Admin | Detailed work order timeline & lifecycle controls |
| `/assets` | Student, Staff, Warden, Authority, Admin | Asset Inventory catalog, KPI cards, filter toolbar & registration |
| `/assets/:id` | Student, Staff, Warden, Authority, Admin | Asset details, deterministic health gauge, warranty countdown, multi-tab history & lifecycle actions |
| `/maintenance` | Staff, Warden, Authority, Admin | Preventive maintenance dashboard, upcoming/overdue tabs & plan wizard |
| `/maintenance/plans/:id` | Staff, Warden, Authority, Admin | Maintenance plan detail, pause/resume/deactivate controls & cycle timeline |
| `/mess` | Student, Staff, Warden, Authority, Admin | Mess & dining dashboard, today's meals, student ratings, hygiene metrics & notices |
| `/cleaning` | Staff, Warden, Authority, Admin | Cleaning & Housekeeping dashboard, checklist executor, supervisor verification & area registry |
| `/outpass` | Student, Staff, Warden, Authority, Admin | Visitor & Outpass dashboard, digital passes, QR gate verifier, overdue monitor & visitor log |
| `/ai-command-center` | Warden, Authority, Admin | AI Hostel Command Center: transparent health score (0-100), explainable breakdown, live operational assistant, ranked advisory recommendations, risk matrix |
| `/finance` | Staff, Warden, Authority, Admin | Hostel Finance & Expense Management: operational budgets, visual utilization bars, approvals queue, vendor registry, and financial years |
| `/finance/expenses/:id` | Staff, Warden, Authority, Admin | Detailed expense view, full operational traceability (Asset/WO/Vendor), approval controls & audit log |
| `/student-services` | Student, Staff, Warden, Authority, Admin | Student Services & Digital Communication dashboard: targeted bulletins, service requests, 24x7 emergency contacts, student feedback |
| `/student-services/requests/:id` | Student, Staff, Warden, Authority, Admin | Service request detail: workflow status management, staff assignment, resolution verification & audit timeline |

---

## Automated Verification

### Running Backend Tests
```bash
cd backend
npm test
```
### Step 18: Final Production Readiness & Complete Project Audit
- **Full Architecture Audit** — Verified all 24 logical subsystems across frontend (React + Vite + Tailwind), backend (Express + Node.js), and database (MongoDB 37 models)
- **Dependency Security Audit** — `npm audit` verified 0 vulnerabilities in both backend and frontend environments
- **Model & Index Integrity Check** — Automated index synchronization (`npm run db:check`) verified all collections and compound indexes with 0 collisions
- **Multi-Tenant Isolation Audit** — Enforced cross-hostel data separation between all residential units with zero data leakage
- **Scheduler Idempotency** — Multi-cycle validation confirmed non-duplicating executions across background jobs

---

## Automated Verification

### Running Backend Tests
```bash
cd backend
npm test
```
Result at the Step 18 audit (20 suites):
- **Tests**: 248 total
- **Passed**: 235
- **Failed**: 0
- **Skipped**: 13 (standalone URI requirement checks)

Latest executed run (2026-10-10, after Phase 5 task 5.3b): **290 tests, 290 passed, 0 failed, 0 skipped, 23 suites** (hostel allocation, pilot gating and password lifecycle suites were added after Step 18). A running MongoDB is required, and the suites drop their database, so never point `TEST_MONGODB_URI` at data you want to keep. Details in `report.md` Section 2.

Pilot deployments must set `PILOT_MODE=true` in `backend/.env` (see `backend/.env.example`) and `VITE_PILOT_MODE=true` in `frontend/.env`.

### Database Model & Index Verification
```bash
cd backend
npm run db:check
```
Result:
- **Status**: CONNECTED (`bbdu_hosteller`)
- **Models Verified**: 37 models and compound index specifications loaded cleanly

### Running Frontend Build
```bash
cd frontend
npm run build
```
Result:
- **Build Status**: PASS (Clean Vite bundle output in `dist/` with 0 errors)



