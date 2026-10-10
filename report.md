# BBDU Hosteller - Complete System Report

> **Purpose**: This document is the single source of truth for any new agent or developer joining this project. Read it fully before touching any code.

> **Last Updated**: 2026-10-09

---

## 1. Project Identity

**Name**: BBDU Hosteller
**Type**: Smart Hostel Management and Complaint Escalation Platform
**Repository**: Single monorepo with `backend/` and `frontend/` workspaces (`D:\BBDU-Hosteller`, remote `Aniketkumarpatel/BBDU-Hosteller`)
**Git History**: 10 commits on `main` as of 2026-10-09 (feature build, mess/allocation merge, pilot governance, Pilot Phases 1 to 4)
**Status**: Feature build complete (Steps 1 to 18). Pilot-staged, NOT pilot-ready: Phase 5 (Pilot Hardening) must clear the "Pilot Blockers" table in Section 15 before real student data is ingested. See Section 19 for the full roadmap to project completion.

**Core Purpose**: A comprehensive university hostel operations platform that manages the full lifecycle of student complaints, maintenance work orders, preventive equipment care, dining services, housekeeping inspections, visitor and outpass tracking, financial budgeting, and an AI-powered operational health command center. Every subsystem uses mathematical and algorithmic approaches: SLA countdown timers with automatic escalation chains, deterministic health scoring formulas, rolling average hygiene alerts, idempotent background scheduling, and compound constraint-based duplicate prevention.

---

## 2. Technology Stack

### Backend
| Component | Technology | Version |
|:---|:---|:---|
| Runtime | Node.js | >=22 (currently 22.20.0) |
| Framework | Express.js | 5.2.1 |
| Database | MongoDB via Mongoose | 9.10.4 |
| Validation | Zod | 4.6.5 |
| Auth | jsonwebtoken + bcryptjs | 9.0.3 / 3.0.3 |
| Security | helmet, cors, express-rate-limit | 8.3.0 / 2.8.6 / 8.7.0 |
| Logging | morgan | 1.12.1 |
| Config | dotenv | 18.0.5 |
| Module System | ES Modules (`"type": "module"`) | - |

### Frontend
| Component | Technology | Version |
|:---|:---|:---|
| UI Library | React | 19.3.0 |
| Build Tool | Vite | 8.3.2 |
| CSS Framework | Tailwind CSS (Vite plugin) | 4.3.3 |
| Routing | React Router DOM | 7.18.4 |
| HTTP Client | Axios | 1.20.0 |
| Module System | ES Modules | - |

### Testing
- Native `node:test` runner with `node:assert/strict`
- Zero external test dependencies (no Jest, no Mocha, no Vitest)
- Command: `npm test` in backend
- 23 integration suites. **Last executed full run (2026-10-10, after Phase 5 task 5.3b): 290 tests, 290 passed, 0 failed, 0 skipped, 0 cancelled** (277 at the 5.1 run on 2026-10-09, plus 13 in `passwordLifecycle.test.js`). `npm run build` in `frontend` also passes. Run against a temporary local MongoDB (mongodb-memory-server outside the project), with both `MONGODB_URI` and `TEST_MONGODB_URI` overridden so the Atlas dev cluster was never reachable.
- The earlier Step 18 figure (248 tests, 235 passed, 13 skipped, 20 suites) is historical. The 13 skips were checks conditional on `TEST_MONGODB_URI` being set explicitly; they ran in the 2026-10-09 run because the URI was provided.
- Frontend: `npm test` in `frontend` runs 19 native `node:test` unit tests (2026-10-10) covering the English and Hindi dictionary and the technician job rules. They need no database. Frontend screens are otherwise verified by `npm run build` and by driving the app in a browser.
- To reproduce: start any empty MongoDB, then run `npm test` in `backend` with `TEST_MONGODB_URI` pointing at it. Never point `TEST_MONGODB_URI` or `MONGODB_URI` at a database you want to keep: suites call `dropDatabase()`.

### Development Tools
- npm 10.9.3 as package manager
- `package-lock.json` present in both workspaces
- `node_modules/` not committed (listed in `.gitignore`)

---

## 3. Role-Based Access Control (RBAC)

Five strictly bounded system roles enforced at both backend middleware and frontend route guard levels:

| Role | Constant | Scope |
|:---|:---|:---|
| Super Admin | `SUPER_ADMIN` | Full system control: user provisioning, SLA config, inventory, escalations, analytics, finance |
| Authority | `AUTHORITY` | University executive oversight: Chief Warden and Proctor office monitoring |
| Warden | `WARDEN` | Assigned hostel operations: triage complaints, create and reassign work orders, manage assets |
| Hostel Staff | `HOSTEL_STAFF` | Maintenance technicians: accept, start, hold, and complete assigned work orders and cleaning tasks |
| Student | `STUDENT` | Resident account: submit issues, track progress, verify or reopen resolutions, submit meal feedback |

### Security Boundaries
- Students cannot create, modify, reassign, or complete work orders
- Public registration only permits `STUDENT` accounts
- `passwordHash` is `select: false` at Mongoose schema level and stripped during serialization
- JWTs contain minimal claims (`userId`, `role`) signed using `JWT_SECRET`
- Deactivated users are blocked at the `requireAuth` middleware with security audit logging
- Every unauthorized access attempt is logged in `SecurityAuditLog`

### Auth Flow
1. `requireAuth` middleware reads `Authorization: Bearer <token>` header
2. Verifies JWT with `jsonwebtoken`
3. Looks up user by `decoded.userId`
4. Checks `user.isActive`
5. Attaches `req.user` (safe user object) and `req.tokenPayload`
6. `requireRole(...allowedRoles)` checks if `req.user.role` is in the allowed list

### Demo Accounts (all passwords: `Password@123`)
| Role | Email |
|:---|:---|
| SUPER_ADMIN | admin@bbdu.ac.in |
| AUTHORITY | authority@bbdu.ac.in |
| WARDEN | warden@bbdu.ac.in |
| HOSTEL_STAFF | staff@bbdu.ac.in |
| STUDENT | student@bbdu.ac.in |

Re-seed: `cd backend && npm run seed`

---

## 4. Complete Feature Inventory (24 Subsystems)

### 4.1 Authentication and User Management (Step 3)
- JWT-based stateless authentication via Bearer tokens
- Registration with Zod schema validation
- Login with bcrypt password comparison
- Profile retrieval with password hash exclusion
- Frontend stores token in `localStorage` as `bbdu_auth_token`
- Axios interceptor auto-attaches Bearer token to every request
- 401 response interceptor clears stale credentials
- Password lifecycle (post Step 18, DEC-022): self-service change, reset by SUPER_ADMIN (any user) or WARDEN (student and staff of own hostel), forced change after reset or admin provisioning, revocation of older tokens on any password change, one shared password policy (8 to 128 characters with upper, lower and digit). See Section 16 entry for 2026-10-10 for the exact behavior and limits

### 4.2 Location Hierarchy (Step 4)
- 5-level hierarchy: Hostels > Blocks > Floors > Rooms > Departments
- Capacity checks at room level
- Student assignment to specific hostel/block/floor/room
- Models: `Hostel`, `Block`, `Floor`, `Room`, `Department`

### 4.3 Complaint Lifecycle Engine (Steps 5.1-5.4)
- State machine: `SUBMITTED > TRIAGED > ASSIGNED > ACKNOWLEDGED > IN_PROGRESS > STUDENT_VERIFICATION > RESOLVED / CLOSED`
- Student `REOPENED` loop for disputed resolutions
- Categories (verified against `complaint.constants.js` on 2026-10-10; earlier versions of this file listed CARPENTRY, CIVIL and IT_NETWORK, which do not exist): ELECTRICAL, PLUMBING, CLEANING, MESS, INTERNET, FURNITURE, SECURITY, ROOM, WATER, OTHER
- Auto-generates human-readable IDs: `CMP-YYYY-XXXXX`
- Linked models: `Complaint`, `ComplaintAssignment`, `ComplaintResolution`, `ComplaintSlaCycle`, `ComplaintEscalation`

### 4.4 SLA Countdown and Automatic Escalation (Steps 5.5-6)
- Central 60-second background scheduler (`slaScheduler.js`)
- Monitors `slaDueAt` deadlines on every active complaint
- Sends warning notifications at 75% elapsed time
- Marks complaints as `BREACHED` when deadline passes
- Multi-tier automatic escalation: Staff > Warden > Authority
- Idempotent: skips cycle if previous is still processing (`isProcessing` flag)
- Models: `SlaRule`, `EscalationRule`

### 4.5 Admin SLA Configuration (Step 5.7)
- Super Admins can modify SLA resolution windows per category and priority
- Changes take effect immediately for new complaints

### 4.6 In-App Notification Engine (Step 5.8)
- `Notification` model with `isRead` flag and `type` field
- Notification bell with unread counter on frontend
- Notifications generated by: SLA warnings, escalations, complaint status changes, outpass approvals, mess hygiene alerts, maintenance due dates

### 4.7 Analytics and Operational Intelligence (Step 7)
- Aggregation pipelines: mean time to resolve (MTTR), department performance, SLA breach trends
- Time-series complaint volume analysis
- Category and priority distribution breakdowns
- Service: `analytics.service.js` (31,989 bytes - substantial aggregation logic)

### 4.8 Maintenance and Work Order Engine (Step 8)
- Bridges student complaints to physical maintenance work orders
- Full lifecycle: `CREATED > ASSIGNED > ACCEPTED > IN_PROGRESS > ON_HOLD > COMPLETED / CANCELLED`
- Auto-generates IDs: `WO-YYYY-XXXXX`
- Chronological audit logs with user stamps, timestamps, and notes
- SLA breach monitoring integrated into the central scheduler
- Models: `MaintenanceWorkOrder`

### 4.9 Asset Management (Step 8 and Step 14)
- Equipment registry with IDs: `AST-YYYY-XXXXX`
- Status tracking: OPERATIONAL, UNDER_MAINTENANCE, DAMAGED, RETIRED, DISPOSED
- Condition tracking: EXCELLENT, GOOD, FAIR, POOR, CRITICAL
- Deterministic health scoring (0-100): condition penalties, age decay, repair expenditure ratio
- Warranty countdown tracking
- Asset movement audit trail (relocations between rooms/blocks)
- Failure count tracking and breakdown history
- Model: `Asset` (8,399 bytes - complex schema)

### 4.10 Preventive Maintenance and Smart Scheduling (Step 9)
- Recurring maintenance plans: `MP-YYYY-XXXXX`
- Frequency types: daily, weekly, monthly, quarterly, semi-annual, annual
- Safe calendar computation: Jan 31 + 1 month = Feb 28/29 (month-boundary safe)
- Idempotent auto-generation of linked work orders when maintenance is due
- Cycle tracking: `CYC-YYYY-XXXXX` with scheduled dates, completion notes, overdue status
- Health classification: HEALTHY, MAINTENANCE_DUE, OVERDUE, FREQUENTLY_FAILING, CRITICAL
- Integrated into central 60-second scheduler (zero duplicate schedulers)
- Models: `MaintenancePlan`, `MaintenanceCycle`

### 4.11 Mess and Food Quality Management (Step 10)
- Multi-mess registry: `MESS-YYYY-XXXXX`
- Weekly meal timetable: `MENU-YYYY-XXXXX` for Breakfast, Lunch, Snacks, Dinner
- Draft/published menu controls with notification broadcast on publish
- Student meal feedback: `FB-YYYY-XXXXX` with multi-dimension rating (Rating 1-5, Food Quality, Taste, Hygiene, Quantity)
- Compound unique constraint: `{ studentId, messId, mealDate, mealType }` - one review per student per meal per day
- Rolling hygiene monitoring: alerts Wardens and Authorities if average hygiene drops below 3.0
- Mess complaints integrated into complaint engine with `category: 'MESS'`
- Mess notices/bulletins: `MNOT-YYYY-XXXXX` with priority tags (NORMAL, IMPORTANT, URGENT)
- Models: `Mess`, `MessMenu`, `MessFeedback`, `MessNotice`

### 4.12 Cleaning and Housekeeping Management (Step 11)
- Cleaning area registry (rooms, washrooms, corridors, lobbies) with custom checklists
- Recurring cleaning plans (daily/weekly/monthly) with default assignees
- Task lifecycle: `PENDING > ASSIGNED > ACCEPTED > IN_PROGRESS > ON_HOLD > COMPLETED > VERIFIED`
- Task IDs: `CLN-YYYY-XXXXX`
- Itemized checklist completion with quality scores (1-5)
- Supervisor verification with anti-self-verification guard (a technician cannot inspect their own work)
- Rejection sends task back to `IN_PROGRESS` for rework
- Overdue and missed task detection integrated into central scheduler
- Dashboard KPIs: tasks today, verified, overdue, missed, avg quality score, staff workload
- Models: `CleaningArea`, `CleaningPlan`, `CleaningTask`

### 4.13 Visitor and Outpass Management (Step 12)
- Student outpass request and approval workflow
- Outpass lifecycle: `PENDING > APPROVED > OUTSIDE > RETURN_VERIFIED / OVERDUE / CANCELLED / REJECTED`
- Digital gate pass generation with verification token
- QR-ready token verification endpoint for gate security
- Overlap detection: prevents concurrent outpass requests
- Emergency priority outpasses
- Overdue student return detection dispatched by central scheduler
- Gate officer verification: records exit timestamp, exit verifier, return timestamp, return verifier
- Visitor registry with privacy enforcement: only last 4 digits of government ID stored
- Visitor lifecycle: `PENDING > APPROVED > CHECKED_IN > CHECKED_OUT / REJECTED`
- Models: `Outpass`, `Visitor`

### 4.14 AI Hostel Command Center (Step 13)
- Transparent, explainable operational health score (0-100)
- Score composed of 5 weighted subsystems:
  - Complaints and SLA: 30 points max
  - Maintenance and Equipment: 20 points max
  - Cleaning and Housekeeping: 20 points max
  - Dining and Food Quality: 15 points max
  - Outpass and Campus Security: 15 points max
- Each penalty is explicit with factor description and point impact
- Health bands: OPTIMAL (85+), MODERATE_RISK (70-84), HIGH_RISK (50-69), CRITICAL (<50)
- Operational insight generator: scans all subsystems for anomalies
- Executive recommendation engine: converts insights to prioritized action items
- Natural language Q&A assistant using keyword-based pattern matching (5 question categories + fallback)
- Currently uses `local_deterministic` AI provider (no external LLM calls)
- Pre-configured for optional Gemini API key integration
- Service: `aiInsight.service.js` (801 lines, 29,600 bytes)

### 4.15 Hostel Finance and Expense Management (Step 15)
- Financial year management with open/close/reopen controls
- Category-based budget allocation per hostel with duplicate guard per FY
- Budget revision with server-side remaining balance recalculation
- Real-time utilization analytics and category breakdowns
- Vendor registry with search and category filters, soft-delete
- Expense lifecycle: `DRAFT > SUBMITTED > UNDER_REVIEW > APPROVED / REJECTED / CANCELLED`
- Self-approval guard: approver cannot be the expense creator
- Atomic budget utilization updates on approval
- Budget reversal on cancellation of approved expenses
- Deep operational traceability: Expense > Work Order > Complaint > Asset > Vendor
- Models: `FinancialYear`, `HostelBudget`, `HostelExpense`, `Vendor`

### 4.16 Student Services and Digital Communication (Step 16)
- Targeted bulletins and notices: `NOT-YYYY-XXXXX`
- Service requests for non-complaint operational needs
- 24x7 emergency contact directory
- Student feedback collection
- Service request lifecycle with staff assignment, resolution verification, and audit timeline
- Models: `Notice`, `ServiceRequest`, `StudentFeedback`, `HostelContact`

### 4.17 Security Hardening (Step 17)
- Immutable security audit trail: `SecurityAuditLog` with event IDs `AUD-YYYY-XXXXX`
- Global NoSQL injection sanitizer: recursive key inspection rejecting `$` and `.` in `req.body`, `req.query`, `req.params`
- Hardened HTTP headers via Helmet: Clickjacking defense (`X-Frame-Options: DENY`), MIME-sniffing prevention, strict referrer policy
- Origin-checked CORS with authorized domain whitelist
- Tiered rate limiting: auth brute force, AI queries, analytics, and global DoS
- Cross-hostel isolation enforcement at server level

### 4.18 Production Readiness Audit (Step 18)
- Full architecture audit: 24 logical subsystems verified
- Dependency security audit: `npm audit` - 0 vulnerabilities
- Model and index integrity: 37 models, all compound indexes verified
- Multi-tenant isolation audit: zero data leakage between hostels
- Scheduler idempotency: multi-cycle validation confirmed non-duplicating executions

### 4.19 Student Registration with Hostel Allocation (post Step 18, commit `b8531d0`)
- Public registration is still `STUDENT` only, but now requires a complete allocation: hostel, block, floor, room, plus a Student ID
- Email domain must be `@bbdu.ac.in`; duplicate email and duplicate Student ID are rejected
- Hierarchy integrity is validated server-side (block belongs to hostel, floor to block, room to floor)
- Room capacity is enforced: registering into a full room returns HTTP 409
- Seeded official hostels (`OFFICIAL_HOSTELS` in `seed/seed.js`): `BBDU-AB`, `BBDU-CD` (boys), `NDGH`, `DPGGH`, `SDGH`, `SHDGH`, `BBDGH` (girls). This is the campus scale for the end-state rollout (7 hostels).
- Coverage: `tests/hostelAllocationRegistration.test.js` (15 requirement scenarios)

### 4.20 Complaint Photo Attachment (post Step 18, commit `b8531d0`)
- `middleware/upload.js` (multer): one optional `attachment` per complaint, JPG/JPEG/PNG/WEBP only, 5 MB limit, stored on local disk under `uploads/complaints/`
- Complaint model stores `attachmentUrl`, `attachmentFilename`, `attachmentOriginalName`, `attachmentMimeType`, `attachmentSize`
- **Known gap**: files are served by `express.static('/uploads')` with no authentication, so any holder of the URL can view a student's room photo. Content type is trusted from the client MIME header (no magic-byte check) and EXIF metadata is not stripped. Storage is local disk, so it is lost or unsynchronized across redeploys unless a persistent volume is configured. Tracked as Phase 5 task 5.2.
- Pilot status: implemented, not yet validated with pilot users, and not cleared for go-live until the gap above is closed.

---

## 5. Database Models (37 Total)

| # | Model | File | Key Fields |
|:---|:---|:---|:---|
| 1 | User | User.js | name, email, passwordHash (select:false), role, hostelId, blockId, floorId, roomId, isActive |
| 2 | Hostel | Hostel.js | name, code, type, isActive |
| 3 | Block | Block.js | name, hostelId |
| 4 | Floor | Floor.js | name, blockId, floorNumber |
| 5 | Room | Room.js | roomNumber, floorId, capacity, occupants |
| 6 | Department | Department.js | name, code, isActive |
| 7 | Complaint | Complaint.js | complaintId, title, description, category, issueType, priority, status, studentId, hostelId, slaStatus |
| 8 | ComplaintAssignment | ComplaintAssignment.js | complaintId, assignedTo, assignedBy |
| 9 | ComplaintResolution | ComplaintResolution.js | complaintId, resolvedBy, resolutionNotes |
| 10 | ComplaintSlaCycle | ComplaintSlaCycle.js | complaintId, slaRuleId, dueAt, breachedAt |
| 11 | ComplaintEscalation | ComplaintEscalation.js | complaintId, fromTier, toTier, reason |
| 12 | SlaRule | SlaRule.js | category, priority, resolutionWindowMinutes |
| 13 | EscalationRule | EscalationRule.js | triggerType, tier, escalationTarget |
| 14 | Notification | Notification.js | userId, type, title, message, isRead |
| 15 | MaintenanceWorkOrder | MaintenanceWorkOrder.js | workOrderId, title, priority, status, assignedTo, dueAt, complaintId |
| 16 | Asset | Asset.js | assetCode, name, category, status, condition, hostelId, failureCount, healthStatus |
| 17 | MaintenancePlan | MaintenancePlan.js | planId, assetId, frequency, nextDueAt, status |
| 18 | MaintenanceCycle | MaintenanceCycle.js | cycleId, planId, scheduledAt, completedAt |
| 19 | Mess | Mess.js | messId, name, hostelId, managerId, capacity |
| 20 | MessMenu | MessMenu.js | menuId, messId, dayOfWeek, mealType, items, isPublished |
| 21 | MessFeedback | MessFeedback.js | feedbackId, studentId, messId, mealDate, mealType, rating, isLowRated |
| 22 | MessNotice | MessNotice.js | (minimal schema) |
| 23 | CleaningArea | CleaningArea.js | name, areaType, hostelId, checklist |
| 24 | CleaningPlan | CleaningPlan.js | frequency, cleaningAreaId, defaultAssignee |
| 25 | CleaningTask | CleaningTask.js | taskId, cleaningAreaId, status, qualityScore, isOverdue, isMissed |
| 26 | Outpass | Outpass.js | outpassId, studentId, hostelId, destination, status, isOverdue |
| 27 | Visitor | Visitor.js | name, phone, governmentIdLast4, hostelId, status |
| 28 | HostelExpense | HostelExpense.js | expenseId, amount, category, vendorId, workOrderId, status |
| 29 | HostelBudget | HostelBudget.js | hostelId, financialYearId, category, allocated, revised, utilized |
| 30 | FinancialYear | FinancialYear.js | name, startDate, endDate, isClosed |
| 31 | Vendor | Vendor.js | name, category, contactEmail, isActive |
| 32 | Notice | Notice.js | noticeId, title, content, priority, category, targetAudience |
| 33 | ServiceRequest | ServiceRequest.js | requestId, studentId, type, status, assignedTo |
| 34 | StudentFeedback | StudentFeedback.js | feedbackId, studentId, category, rating, comment |
| 35 | HostelContact | HostelContact.js | hostelId, contactType, name, phone, isEmergency |
| 36 | SecurityAuditLog | SecurityAuditLog.js | auditId, eventType, severity, actorId, targetEntity |
| 37 | Counter | Counter.js | modelName, seq (auto-increment counter for human-readable IDs) |

---

## 6. Backend Services (16 Domain Logic Modules)

| Service File | Size | Responsibility |
|:---|:---|:---|
| complaint.service.js | 47,204 B | Full complaint lifecycle: create, triage, assign, acknowledge, progress, verify, resolve, reopen, close |
| asset.service.js | 44,856 B | Asset CRUD, health scoring formula, warranty tracking, movement audit, condition audits, retirement/disposal |
| studentServices.service.js | 43,878 B | Notices, service requests, emergency contacts, student feedback, lifecycle background jobs |
| finance.service.js | 40,386 B | Financial years, budgets, vendors, expenses lifecycle, traceability chain, atomic budget mutations |
| cleaning.service.js | 36,489 B | Areas, plans, tasks, checklist execution, quality scoring, supervisor verification, scheduler integration |
| sla.service.js | 34,698 B | SLA rule application, deadline computation, breach detection, warning dispatch, escalation chain execution |
| outpass.service.js | 33,513 B | Outpass lifecycle, overlap detection, digital pass, gate verification, overdue detection, visitor management |
| preventiveMaintenance.service.js | 32,588 B | Plans, cycles, safe calendar math, idempotent WO generation, health classification, scheduler integration |
| analytics.service.js | 31,989 B | Aggregation pipelines, MTTR, department performance, trend analysis, category distributions |
| aiInsight.service.js | 29,600 B | Health score formula, insight generation, executive recommendations, NL Q&A assistant |
| workOrder.service.js | 29,541 B | Work order CRUD, lifecycle transitions, assignment, audit logging, SLA integration |
| mess.service.js | 26,669 B | Mess CRUD, menus, feedback, hygiene monitoring, notices, analytics |
| auth.service.js | 6,703 B | Registration, login, token generation, profile retrieval |
| securityAudit.service.js | 5,747 B | Immutable audit event logging with automatic redaction |
| notification.service.js | 5,189 B | Notification creation, mark read, unread count, bulk mark |

---

## 7. API Route Map

### Public Routes (No Auth)
- `GET /api/health` - Health check with DB status (connection string never exposed)
- `POST /api/auth/register` - Student-only registration
- `POST /api/auth/login` - JWT token issuance

### Authenticated Routes (All require `requireAuth`)
- `GET /api/auth/me` - Current user profile (also reachable while a forced password change is pending)
- `POST /api/auth/change-password` - Self-service password change; returns a fresh token (also reachable while a forced change is pending)
- `POST /api/auth/users/:id/reset-password` - SUPER_ADMIN (any other user) or WARDEN (student and staff of own hostel); returns a one-time temporary password with `Cache-Control: no-store`
- While `mustChangePassword` is true every other authenticated endpoint returns 403 with `details.code = PASSWORD_CHANGE_REQUIRED`
- `GET /api/dashboard/stats` - Role-based dashboard statistics
- `GET /api/notifications` - User notifications
- `PATCH /api/notifications/:id/read` - Mark notification read
- `PATCH /api/notifications/read-all` - Mark all notifications read

### Complaint Routes (`/api/complaints`)
- Full CRUD and lifecycle transitions (14+ endpoints)
- Student: submit, view own, verify resolution, reopen
- Staff: acknowledge, start progress, request help
- Warden: triage, assign, reassign, resolve
- Authority: escalation oversight

### Work Order Routes (`/api/work-orders`)
- CRUD and lifecycle: create, assign, accept, start, hold, resume, complete, cancel
- Stats endpoint with executive metrics

### Asset Routes (`/api/assets`)
- CRUD, dashboard KPIs, analytics, health scoring, maintenance history
- Movement, condition audit, retirement, disposal endpoints

### Maintenance Routes (`/api/maintenance-plans`, `/api/maintenance`)
- Plan CRUD, pause/resume/deactivate
- Dashboard, upcoming, due, overdue queries

### Mess Routes (`/api/messes`, `/api/mess-feedback`, `/api/mess-notices`)
- Mess CRUD, menu management, publish/unpublish
- Student feedback with duplicate prevention
- Dashboard and analytics endpoints
- Notice management with priority levels

### Cleaning Routes (`/api/cleaning`)
- Area and plan management
- Task lifecycle with supervisor verification
- Dashboard KPIs, manual scheduler trigger

### Outpass Routes (`/api/outpass`)
- Student outpass lifecycle, digital pass, QR verification
- Gate officer exit/return verification
- Visitor registry and lifecycle
- Dashboard KPIs, manual scheduler trigger

### Finance Routes (`/api/finance`)
- Financial years, budgets, vendors, expenses
- Expense lifecycle with approval guards
- Deep traceability endpoint
- Dashboard KPIs, utilization analytics

### Student Services Routes (`/api/student-services`)
- Notices, service requests, emergency contacts, feedback

### AI Command Center Routes (`/api/ai-command-center`)
- Operational overview (health + insights + recommendations)
- NL assistant query endpoint

### Admin Routes (`/api/admin`)
- User CRUD, hostel/block/floor/room/department management
- Security audit log queries and stats
- SLA rule and escalation rule management

---

## 8. Frontend Page Map

### Public Pages
| Route | Component | Purpose |
|:---|:---|:---|
| `/` | LandingPage | Public landing page |
| `/login` | LoginPage | Role-based login form |
| `/register` | RegisterPage | Student self-registration |

### Student Portal (`STUDENT` role)
| Route | Component |
|:---|:---|
| `/student/dashboard` | StudentDashboard |
| `/student/complaints` | MyComplaintsPage |
| `/student/complaints/new` | SubmitComplaintPage |
| `/student/complaints/:id` | ComplaintDetailPage |
| `/change-password` (any signed-in user, outside the role layouts) | ChangePasswordPage |

### Warden Portal (`WARDEN`, `SUPER_ADMIN`)
| Route | Component |
|:---|:---|
| `/warden/dashboard` | WardenDashboard |
| `/warden/complaints` | WardenComplaintsPage |
| `/warden/complaints/:id` | ComplaintManageDetailPage |
| `/warden/analytics` | AnalyticsDashboardPage |
| `/warden/people` | WardenPeoplePage (Residents and Staff, password reset) |

### Staff Portal (`HOSTEL_STAFF`, `SUPER_ADMIN`)
| Route | Component |
|:---|:---|
| `/staff/jobs` | StaffJobsPage (pilot home: "My jobs", own layout `StaffJobsLayout`) |
| `/staff/jobs/:id` | StaffJobPage (one job, next-step button, note sheet) |
| `/staff/dashboard` | StaffDashboard (non-pilot only; forwards to `/staff/jobs` when `VITE_PILOT_MODE=true`) |
| `/staff/complaints` | StaffComplaintsPage (non-pilot only; forwards in pilot mode) |
| `/staff/complaints/:id` | ComplaintManageDetailPage (non-pilot only; forwards to `/staff/jobs/:id` in pilot mode) |

### Authority Portal (`AUTHORITY`, `SUPER_ADMIN`)
| Route | Component |
|:---|:---|
| `/authority/dashboard` | AuthorityDashboard |
| `/authority/complaints` | AuthorityComplaintsPage |
| `/authority/complaints/:id` | ComplaintManageDetailPage |
| `/authority/analytics` | AnalyticsDashboardPage |

### Admin Console (`SUPER_ADMIN` only, nested in AdminLayout)
| Route | Component |
|:---|:---|
| `/admin/dashboard` | AdminDashboard |
| `/admin/analytics` | AnalyticsDashboardPage |
| `/admin/users` | UserManagementPage |
| `/admin/hostels` | HostelManagementPage |
| `/admin/blocks` | BlockManagementPage |
| `/admin/floors` | FloorManagementPage |
| `/admin/rooms` | RoomManagementPage |
| `/admin/departments` | DepartmentManagementPage |
| `/admin/sla-rules` | SlaRulesManagementPage |
| `/admin/escalation-rules` | EscalationRulesManagementPage |
| `/admin/sla-config` | AdminSlaConfigPage |
| `/admin/profile` | AdminProfilePage |

### Shared Operational Pages
| Route | Allowed Roles | Component |
|:---|:---|:---|
| `/work-orders` | Staff, Warden, Authority, Admin | WorkOrderListPage |
| `/work-orders/:id` | Staff, Warden, Authority, Admin | WorkOrderDetailPage |
| `/assets` | All authenticated | AssetManagementPage |
| `/assets/:id` | All authenticated | AssetDetailPage |
| `/maintenance` | Staff, Warden, Authority, Admin | MaintenanceDashboardPage |
| `/maintenance/plans/:id` | Staff, Warden, Authority, Admin | MaintenancePlanDetailPage |
| `/mess` | All authenticated | MessDashboardPage |
| `/cleaning` | Staff, Warden, Authority, Admin | CleaningDashboardPage |
| `/outpass` | All authenticated | OutpassDashboardPage |
| `/ai-command-center` | Warden, Authority, Admin | AiCommandCenterPage |
| `/finance` | Staff, Warden, Authority, Admin | FinanceDashboardPage |
| `/finance/expenses/:id` | Staff, Warden, Authority, Admin | ExpenseDetailPage |
| `/student-services` | All authenticated | StudentServicesDashboardPage |
| `/student-services/requests/:id` | All authenticated | ServiceRequestDetailPage |

### Redirect Routes
- `/home` redirects to `/`
- `/inventory` redirects to `/assets`
- `/expenses` and `/budgets` redirect to `/finance`
- `/notices` redirects to `/student-services`

---

## 9. Test Suites (23 Suites, 290 Tests, all executed and passing on 2026-10-10; see Section 2)

| Test File | Focus Area |
|:---|:---|
| health.test.js | API health endpoint, 404 handling |
| auth.test.js | Registration, login, token lifecycle, RBAC |
| complaint.test.js | Full complaint lifecycle, state transitions, student verification |
| sla.test.js | SLA rule application, countdown, breach, escalation chain |
| notification.test.js | Notification creation, read, unread count |
| analytics.test.js | Aggregation pipelines, MTTR, trend analysis |
| workOrder.test.js | Work order lifecycle, assignment, audit logs |
| models.test.js | Schema validation, required fields, defaults |
| db.integration.test.js | Database connection, model registration |
| preventiveMaintenance.test.js | Plans, cycles, calendar math, idempotent generation |
| mess.test.js | Mess CRUD, menus, feedback, hygiene alerts |
| cleaning.test.js | Areas, plans, tasks, verification, rejection |
| outpass.test.js | Outpass lifecycle, overlap detection, gate verification |
| aiCommandCenter.test.js | Health score, insights, recommendations, NL assistant |
| assetLifecycle.test.js | Asset CRUD, health scoring, movement, retirement |
| financeManagement.test.js | Budgets, expenses, approval guards, traceability |
| studentServices.test.js | Notices, service requests, feedback |
| adminCrud.test.js | User/hostel/block/floor/room/department CRUD |
| securityHardening.test.js | NoSQL sanitization, CORS, Helmet, rate limiting |
| finalProductionAudit.test.js | Cross-cutting production readiness checks |
| hostelAllocationRegistration.test.js | Student registration with hostel/block/floor/room allocation, occupancy conflict, domain and duplicate-ID rules |
| passwordLifecycle.test.js | Password lifecycle (DEC-022): self-service change, wrong-password 400 not 401, policy, session revocation, admin and warden-scoped reset, forced-change gate and its allow-list, audit trail without secrets, admin form policy, temporary password generator, warden-scoped user list (13 tests; a mutation check that disables revocation and the gate makes tests 4, 6 and 9 fail) |
| pilotGating.test.js | `PILOT_MODE` (DEC-020): no escalation or reassignment, hostel-warden-only breach and unassigned-reminder notices, executives untouched, deferred jobs skipped, control run still escalates, scheduler reads the env flag (7 tests) |

### Non-test verification and operations scripts
| Script | Purpose |
|:---|:---|
| `backend/scripts/verify-pilot-complaint-loop.mjs` | Live-server 12-step pilot loop across Student, Warden, Staff personas (DEC-018) |
| `backend/scripts/seed-pilot-cohort.mjs` | Idempotent pilot cohort: departments, hierarchy, users, 5 baseline complaints (DEC-019) |
| `backend/scripts/verify-full-runtime-flow.mjs`, `verify-runtime-flow.js`, `scripts/verify-full-runtime-flow.{js,mjs}` | Earlier full-platform runtime flow checks (root `scripts/` copies are duplicates; consolidation is a cleanup candidate) |
| `backend/scripts/verify-step5.2.js`, `5.3`, `5.4` | Historical per-step complaint, SLA, and advanced flow verification |
| `backend/scripts/check-db.js` | Model and index verification (`npm run db:check`) |
| `backend/scripts/allocate_students.js`, `check_student.js` | One-off dev helpers. `allocate_students.js` looks up hostel code `BH1`, which is not in the seeded hostel list (`BBDU-AB`), so it is stale and must not be used for pilot data |

---

## 10. Reusable Frontend Components

### Common Components (`frontend/src/components/common/`)
| Component | Purpose |
|:---|:---|
| Sidebar.jsx | Role-aware navigation sidebar with module links |
| Topbar.jsx | Top navigation bar with user info and logout |
| NotificationBell.jsx | Real-time notification dropdown with unread counter |
| DashboardCard.jsx | KPI metric card with icon, value, label |
| DataTable.jsx | Paginated data table with sorting |
| Modal.jsx | Reusable modal dialog wrapper |
| ConfirmationDialog.jsx | Confirm/cancel action dialog |
| StatusBadge.jsx | Color-coded status badges for complaint/WO/outpass statuses |
| LoadingSpinner.jsx | Loading state indicator |
| EmptyState.jsx | Empty data placeholder |
| ErrorState.jsx | Error state with retry action |
| FormField.jsx | Labeled form input wrapper |
| FilterSelect.jsx | Dropdown filter control |
| SearchInput.jsx | Debounced search input |

### SLA Components (`frontend/src/components/sla/`)
- SLA-specific display components (countdown timers, breach indicators)

---

## 11. Frontend Services (23 API Client Modules)

Each service file wraps Axios calls to specific backend route groups:
`api.js` (base client), `auth.service.js`, `complaintService.js`, `dashboardService.js`, `notificationService.js`, `workOrderService.js`, `assetService.js`, `maintenancePlanService.js`, `messService.js`, `cleaningService.js`, `outpassService.js`, `aiCommandCenterService.js`, `financeService.js`, `studentServicesService.js`, `analyticsService.js`, `slaService.js`, `hostelService.js`, `blockService.js`, `floorService.js`, `roomService.js`, `departmentService.js`, `userService.js`, `health.service.js`

---

## 12. Background Scheduler Architecture

**Single scheduler pattern**: One `setInterval` loop running every 60 seconds in `slaScheduler.js`.

The `processSlaAndEscalations()` function in `sla.service.js` handles ALL background work (verified against code on 2026-10-09):
1. SLA warning notifications at 75% elapsed time (to the assignee only)
2. SLA deadline monitoring, breach detection, and automatic multi-tier escalation. Escalation runs on every breach unless the complaint's `SlaRule.escalationEnabled === false`
3. Work order SLA breach monitoring
4. Preventive maintenance due date checks and automatic work order generation (`processPreventiveMaintenanceJobs`)
5. Cleaning task overdue/missed detection (`processCleaningTasks`)
6. Outpass overdue student return detection (`processOverdueOutpasses`)
7. Asset lifecycle jobs (`processAssetLifecycleJobs`)
8. Finance lifecycle jobs (`processFinanceLifecycleJobs`)
9. Student services lifecycle jobs (`processStudentServicesLifecycleJobs`)

**Pilot gating status (updated 2026-10-09, Phase 5 task 5.1, DEC-020)**: the backend now has a `PILOT_MODE` environment switch (default `false`). When `PILOT_MODE=true`: job 2 never escalates or reassigns (a breach is recorded, the active SLA cycle is marked `BREACHED`, and only the complaint's own hostel wardens are notified, once); an unassigned complaint passing the 75 percent threshold reminds those wardens; jobs 4 to 8 are skipped. Jobs 3 (work orders) and 9 (student services) keep running, because they only act on records the pilot never creates (Q5 resolved). `escalateComplaint` is called only by the scheduler (no manual escalation endpoint exists), so this closes every escalation path. The server logs the active mode at startup. **Verification status**: `tests/pilotGating.test.js` (7 tests) passes, and the full backend suite passes (277 of 277, see Section 2). `VITE_PILOT_MODE` remains a separate, frontend-only navigation flag; both flags must be set for a pilot deployment. Seed data still has `escalationEnabled: true` on every SLA rule, which is now irrelevant in pilot mode but would escalate with `PILOT_MODE=false`.

**Idempotency guarantees**:
- `isProcessing` boolean prevents concurrent execution
- Work order auto-generation checks for existing linked WOs before creating new ones
- Cleaning task scheduler checks for existing tasks on the same date and area

---

## 13. Key Algorithmic Implementations

### SLA Countdown Formula
- `slaDueAt = complaintCreatedAt + slaRule.resolutionWindowMinutes`
- Warning at 75% elapsed: `warningThreshold = slaDueAt - (resolutionWindow * 0.25)`
- Breach: current time > `slaDueAt`

### Asset Health Score (0-100)
- Base score: 100
- Condition penalties: EXCELLENT(0), GOOD(-5), FAIR(-15), POOR(-30), CRITICAL(-50)
- Age decay: penalty based on years of service vs expected life
- Repair expenditure ratio: penalty if cumulative repair cost exceeds purchase price percentage
- Failure frequency: penalty per recorded breakdown event

### Operational Health Score (0-100)
- Complaints & SLA: 30 pts max (critical complaints -5 each, breached -4 each, warnings -2 each)
- Maintenance: 20 pts max (overdue WOs -3 each, failing assets -2 each)
- Cleaning: 20 pts max (quality below 3.5 -8, overdue+missed tasks -2 each)
- Dining: 15 pts max (low-rated meals -3 each)
- Security: 15 pts max (overdue outpasses -5 each)
- Bands: OPTIMAL(85+), MODERATE_RISK(70-84), HIGH_RISK(50-69), CRITICAL(<50)

### Mess Hygiene Alert Threshold
- Rolling average of `hygieneRating` from `MessFeedback`
- Alert dispatched to Wardens and Authorities if average drops below 3.0

### Calendar Safe Month Addition
- Jan 31 + 1 month = Feb 28 (non-leap) or Feb 29 (leap)
- Prevents date overflow in recurring maintenance scheduling

---

## 14. Environment Configuration

### Backend (`backend/.env`)
```
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/bbdu_hosteller
TEST_MONGODB_URI=mongodb://127.0.0.1:27017/bbdu_hosteller_test
JWT_SECRET=<32+ char secret>
JWT_EXPIRES_IN=24h
AI_PROVIDER=local_deterministic
# GEMINI_API_KEY=<optional>
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000/api
```

### Vite Dev Proxy
Frontend proxies `/api` to `http://localhost:5000` during development, so `VITE_API_URL` can be omitted in dev mode.

---

## 15. Current Known State

### Working
- All 37 Mongoose models and compound indexes validated
- 248 backend tests (235 passed, 13 skipped, 0 failed)
- Frontend builds cleanly with Vite (0 errors)
- Dependencies installed in both backend and frontend workspaces (0 vulnerabilities)
- Backend health tests passing (2/2)

### Requires Setup
- MongoDB must be running locally or Atlas URI configured in `.env`
- `.env` files must be created from `.env.example` templates

### Not Yet Implemented
- Cloud or persistent object storage for uploads (multer local-disk upload exists for complaint photos only; none for maintenance)
- Real-time WebSocket push (currently REST polling only)
- Real LLM integration for AI assistant (currently keyword-based pattern matching)
- Email/SMS/WhatsApp notifications (in-app only)
- Pilot user provisioning script, production seed guard, and the demo-credential audit script (Phase 5 task 5.3c)
- PWA manifest and service workers
- Docker containerization
- CI/CD pipeline (GitHub Actions)
- Pilot baseline metrics report (the data exists as timestamps, but no report or export is built for the Section 17.6 measures)

### Pilot Blockers (must close in Phase 5 before real student data)
| # | Blocker | Evidence | Phase 5 task |
|:---|:---|:---|:---|
| B1 | Auto-escalation to Authority is active, contradicting DEC-015 | `escalationEnabled: true` on all seeded SLA rules; `escalateComplaint` called on any breach | 5.1 (CLOSED 2026-10-09 when `PILOT_MODE=true`; verified by tests) |
| B2 | Deferred modules' scheduler jobs run for pilot users | 5 deferred-module job groups (Section 12 items 4 to 8) ungated in `processSlaAndEscalations` | 5.1 (CLOSED 2026-10-09 when `PILOT_MODE=true`; verified by tests) |
| B3 | Complaint photos publicly readable, unvalidated content, local disk | `app.use('/uploads', express.static(...))` in `app.js` | 5.2 |
| B4 | No password change or reset, demo credentials in seed | Backend (5.3a) and frontend screens (5.3b) DONE, tested and driven in a real browser 2026-10-10. STILL OPEN (5.3c): provisioning script, production seed guard, `audit-demo-credentials` script; `Password@123` is still in the seeds, and the public login page still shows a "Quick Demo Accounts" panel that prints it (D2 below) | 5.3 (mostly done) |
| D1 | Admin console list pages crash (pre-existing at HEAD, found 2026-10-10) | Every `/api/admin/*` list endpoint returns a wrapped object (`{ users, total }`, `{ hostels }`, `{ departments }`, ...) but pages do `setX(res.data)` and then call `.filter` or `.map`. Fixed ONLY in `UserManagementPage.jsx` (needed for the reset button and for creating accounts). `HostelManagementPage` and `DepartmentManagementPage` have the same `setX(res.data)` pattern (verified by search); Block, Floor and Room pages were not inspected. Admin API tests pass because they never render the UI | Separate task, needs approval |
| D3 | Staff dashboard and staff queue disagree (found 2026-10-10) | In the old staff UI the dashboard showed 0 active tickets while the queue listed 2 tasks. Cause not investigated. Not visible to pilot technicians because pilot mode forwards them to `/staff/jobs`, but it affects non-pilot use | Investigate when the old staff screens are next touched |
| D4 | Notifications are not plain language (found 2026-10-10) | `NotificationBell.jsx` shows English text such as "Complaint Reopened by Stu..." and ticket numbers like #CMP-2026-00003, with an "in-app notification center" footer. It fits a phone but is jargon-heavy and untranslated | Task U4 (5.11) |
| D2 | Login page shows demo accounts and the shared password | `LoginPage.jsx` renders "Quick Demo Accounts (Password: Password@123)" buttons to anyone, including in production builds | Gate behind a non-pilot flag or remove (Go-Live Gate item 4); small frontend task |
| B5 | No hosting, HTTPS, backups, or restore test | Go-Live Gate items 1 and 2 not started | 5.4 |
| B6 | Pilot metrics cannot be produced on demand | no TTA/TTR/completion report endpoint or script | 5.5 |
| B7 | Test baseline not re-verified after post-Step-18 changes | CLOSED 2026-10-09: 277 of 277 passed against a temporary MongoDB. Remaining part of 5.9 (frontend build, loop script against the deployed host) is still open | 5.9 (partly done) |
| B8 | Rate limiting keys on IP with no `trust proxy` configured | no `trust proxy` anywhere in `src/`; `rateLimiter.js` has no `keyGenerator`. Behind a reverse proxy all users share the proxy's IP, so the production auth limit (20 per 15 min) and global limit (1000 per 15 min) would apply to the whole hostel combined. Campus NAT has the same effect even without a proxy | 5.4 |

---

## 16. Completed Work Log

| Date | Step | What Was Done |
|:---|:---|:---|
| Initial | Step 3 | Authentication and RBAC with 5 roles |
| Initial | Step 4 | Location hierarchy (Hostels, Blocks, Floors, Rooms, Departments) |
| Initial | Steps 5.1-5.4 | Complaint lifecycle engine with state machine |
| Initial | Steps 5.5-6 | SLA countdown, breach detection, auto-escalation |
| Initial | Step 5.7 | Admin SLA configuration panel |
| Initial | Step 5.8 | In-app notification engine |
| Initial | Step 7 | Analytics and operational intelligence |
| Initial | Step 8 | Work order engine and asset management |
| Initial | Step 9 | Preventive maintenance and smart scheduling |
| Initial | Step 10 | Mess and food quality management |
| Initial | Step 11 | Cleaning and housekeeping management |
| Initial | Step 12 | Visitor and outpass management |
| Initial | Step 13 | AI hostel command center |
| Initial | Step 14 | Asset lifecycle management (enhanced) |
| Initial | Step 15 | Finance and expense management |
| Initial | Step 16 | Student services and digital communication |
| Initial | Step 17 | Security hardening and compliance |
| Initial | Step 18 | Final production readiness audit |
| 2026-10-08 | Docs | Created CLAUDE.md, report.md, architecture.md, decision.md |
| 2026-10-09 | Governance | Defined Section 17 First Pilot Focus (DEC-015), added Rule 13 Pull-Before-Push (DEC-016), reconciled Node.js version |
| 2026-10-09 | Pilot Phase 1 | Implemented frontend Pilot Mode flag (VITE_PILOT_MODE) and navigation scoping in DashboardLayout (DEC-017) |
| 2026-10-09 | Pilot Phase 2 | Streamlined and hardened the 5 core complaint screens (student submit, student verify/reopen, warden triage, staff work queue) and eliminated em dashes |
| 2026-10-09 | Pilot Phase 3 | End-to-end runtime verification of full 12-step complaint loop across Student, Warden, and Staff personas (verify-pilot-complaint-loop.mjs); calibrated centralized auth rate limiter (DEC-018) |
| 2026-10-09 | Pilot Phase 4 | Provisioned dedicated pilot cohort seeder (seed-pilot-cohort.mjs) and aligned 7 facility maintenance departments in seed.js (DEC-019) |
| 2026-10-09 | Phase 5 task 5.1 | Implemented backend `PILOT_MODE` gating (DEC-020): `env.PILOT_MODE`, pilot branch in `processSlaAndEscalations` (no escalation, hostel-warden-only breach and unassigned-reminder notices, deferred jobs 4 to 8 skipped), scheduler reads the flag and logs the mode, `.env.example` documented, new suite `tests/pilotGating.test.js` (7 tests). Files: `config/env.js`, `services/sla.service.js`, `scheduler/slaScheduler.js`, `.env.example`. VERIFIED: new suite 7 of 7 pass; full `npm test` 277 of 277 pass, 0 skipped, run against a temporary MongoDB (mongodb-memory-server installed in a scratch folder outside the project and deleted afterwards; Atlas deliberately never used because suites call `dropDatabase()`). NOT VERIFIED: `npm run build` (no frontend change made) and the live-server loop script. Follow-up: set `PILOT_MODE=true` on the pilot deployment (Go-Live Gate item 6); consider a fail-closed production default in Phase 7. Also closes blocker B7 for the backend. |
| 2026-10-10 | Phase 5 task 5.11 (U1, U2) | Plain-language technician screens (DEC-026, DEC-027). New: `i18n/dictionary.js` (English and Hindi, draft Hindi), `i18n/LanguageContext.jsx`, `components/common/LanguageToggle.jsx`, `utils/jobPresentation.js` (stages, deadlines, ordering, progress), `utils/jobFormat.js`, `components/jobs/*` (JobCard, StageChip, DueLine, ProgressSteps, FinishSheet, icons, stageStyle), `services/jobActionService.js`, `layouts/StaffJobsLayout.jsx`, `pages/staff/StaffJobsPage.jsx` and `StaffJobPage.jsx`, 19 frontend unit tests (`frontend/tests`, `npm test`). Changed: `App.jsx` (LanguageProvider), `AppRoutes.jsx` (new routes, pilot-mode forwards for old staff URLs), `AuthContext.jsx` (pilot technicians land on `/staff/jobs`), `NotificationBell.jsx` (link to the new job screen in pilot mode), `index.css` (Devanagari font fallbacks), `package.json` (test script). Design: home is the job list in working order (student says not fixed, new, ready, being fixed, waiting, done), room and block in the largest type, one big next-step button per job, a four-step progress path, and tap-to-fill work notes so no typing is required. Acknowledge and start stay separate steps so the time-to-acknowledge pilot measure stays meaningful. No backend change. VERIFIED in a real browser at 375 px width against a throwaway MongoDB with `PILOT_MODE=true`: sign-in lands on `/staff/jobs`; sections in the right order; no horizontal overflow; I got it moves a job to Ready with a confirmation; the finish sheet refuses an empty note and saved "Pipe fixed. Leak stopped" with the job moving to student verification; Hindi switch changes every label and persists after reload; old `/staff/dashboard`, `/staff/complaints` and `/staff/complaints/:id` forward correctly; buttons are 56 px tall. The 19 unit tests include a check against the backend category and priority lists, which found that the docs and the first word list used category names that do not exist (fixed). NOT VERIFIED: real devices and real technicians (task U5), the Hindi wording by a native speaker, desktop widths of the new pages beyond a quick look, a screen reader. Follow-up: U3, U4, U5, D3, D4. |
| 2026-10-10 | Phase 5 task 5.3b | Frontend password lifecycle (DEC-022). New: `pages/ChangePasswordPage.jsx` (forced and voluntary modes), `components/common/TemporaryPasswordModal.jsx` (one-time display, component state only, never stored), `utils/passwordPolicy.js` (client mirror of the server policy), `pages/warden/WardenPeoplePage.jsx` at `/warden/people` (search, role filter, reset action), `AuthContext.changePassword`, `ProtectedRoute` redirect to `/change-password` while `mustChangePassword`, login redirect, "Change password" link in both headers, admin Users page Reset action with client policy and helper text. Backend addition needed by the Warden UI: `GET /api/auth/hostel-users` (WARDEN only; own-hostel STUDENT and HOSTEL_STAFF; escaped literal search; 100-row cap) with test 13. Fixed a pre-existing crash on the admin Users page (D1). VERIFIED in a real browser against a temporary MongoDB with `PILOT_MODE=true`: the Warden sees only own-hostel people; the reset dialog and one-time password (12 characters, policy-compliant, absent from DOM, localStorage, sessionStorage and URL after closing); a temporary-password login lands on the forced screen; direct navigation to `/student/dashboard` bounces back; direct API calls get 403 `PASSWORD_CHANGE_REQUIRED` on three endpoints while `/auth/me` is 200; weak password, mismatch and wrong-current-password errors display (the wrong-current case keeps the user signed in); a correct change lands on the dashboard with working API calls; voluntary mode has no banner and shows Cancel; the admin Users page lists 8 users with 7 reset buttons (own row hidden) and its reset dialog issues a password. Also verified: backend 290 of 290 and `npm run build` pass. NOT VERIFIED: narrow mobile layouts of the new header link, Staff and Authority forced-change screens (same page, role-independent), any admin page other than Users. Follow-up: 5.3c, D1, D2. |
| 2026-10-10 | Phase 5 task 5.3a | Backend password lifecycle (DEC-022). New: `POST /api/auth/change-password`, `POST /api/auth/users/:id/reset-password` (SUPER_ADMIN any user, WARDEN own-hostel STUDENT and HOSTEL_STAFF only), `User.mustChangePassword` and `User.passwordChangedAt`, `requireAuthAllowPasswordChange`, session revocation of tokens issued before `passwordChangedAt` (whole-second comparison), backend-enforced 403 `PASSWORD_CHANGE_REQUIRED` gate (allow-list: `/auth/me`, `/auth/change-password`, logout), `utils/temporaryPassword.js`, shared `passwordPolicySchema`, audit events `PASSWORD_CHANGED` and `PASSWORD_RESET` (never contain secrets). Closed a weak side door: admin `PUT /api/admin/users/:id` accepted 6-character passwords with no audit; it now uses the shared policy, forces a change, revokes sessions, audits, and refuses self-edit. Admin-created users must change their initial password. Files: `models/User.js`, `models/SecurityAuditLog.js`, `middleware/auth.js`, `services/auth.service.js`, `controllers/auth.controller.js`, `controllers/adminUser.controller.js`, `routes/auth.routes.js`, `validators/auth.validator.js`, `utils/userSerializer.js`, `utils/temporaryPassword.js`, `tests/passwordLifecycle.test.js`. VERIFIED: 12 new tests pass, full suite 289 of 289, mutation check (revocation and gate disabled) fails tests 4, 6, 9 as expected. NOT VERIFIED: any frontend behavior (no frontend change yet). Known tolerance: a token issued in the same second as a password change is not revoked (JWT `iat` is second precision). Follow-up: 5.3b, 5.3c. |
| 2026-10-09 | Docs Audit and Roadmap | Audited all four docs against code. Corrected stale facts (git history, test suites, upload, allocation registration, scheduler job list, scripts). Recorded pilot blockers B1 to B7. Added Sections 18 to 21 (Pilot Operations Plan, Roadmap Phases 5 to 12, Risk Register, Open Questions) and DEC-020 to DEC-025. No code changed; user performs all git commits. Verification gap: `npm test` not executed (MongoDB unreachable), counts marked static. |

---

## 17. Proposed Product Focus and First Pilot

### 17.1 Status & Purpose
- **Status**: Accepted direction (DEC-015), engineering preparation partly done (Pilot Phases 1 to 4), not yet validated with live hostel residents and staff. The pilot is NOT cleared to start until Phase 5 closes blockers B1 to B7 (Section 15).
- **Strategic Reality**: The platform already contains 24 subsystems, 37 Mongoose models, and passes 248 integration tests. However, software completeness and test suites do not by themselves prove user adoption, operational workflow fit, or production readiness.
- **Core Directive**: Pause platform expansion. Prioritize validating one single end-to-end operational loop in the real world before introducing additional features or external modules.

### 17.2 First MVP Scope: Complaint-to-Resolution Loop
Run a tightly scoped pilot in a single hostel or a single residential block with one assigned Warden and a small group of maintenance technicians (plumbers, electricians).

The pilot workflow is strictly bounded to five steps:
1. **Student Submission & Tracking**: A resident student submits a complaint with category and room/location, receiving an immediate tracking ticket (`CMP-YYYY-XXXXX`), and monitors status changes.
2. **Warden Triage & Assignment**: The Warden reviews incoming tickets, assesses priority, assigns an owner (department and technician), and monitors overdue tasks.
3. **Technician Progress & Resolution**: Assigned staff acknowledge receipt, update operational progress (`IN_PROGRESS`), and submit completion notes when physical work is finished.
4. **Student Verification or Reopen**: The student resident explicitly confirms the physical fix (`CLOSED`) or reopens the complaint (`REOPENED`) with a mandatory explanation if the issue persists.
5. **Warden Resolution Oversight**: The Warden reviews open, overdue, and resolved work through a focused dashboard with baseline resolution-time metrics.

### 17.2.1 Pilot Cohort Definition
- **Hostel**: `BBDU-AB` (BBDU A and B Block). Some scripts and seed descriptions still call it "Boys Hostel 1" or code `BH1`; the canonical code is `BBDU-AB`.
- **Staff**: 1 Warden, 2 technicians (plumbing and electrical, per the seeded `PLUMB` and `ELEC` departments). Additional categories (carpentry, IT, housekeeping) route to the Warden until technicians are named (open question Q3).
- **Residents**: pilot block residents who register themselves (hostel allocation registration, Section 4.19). Count is an open question (Q2).
- **Seeded fixtures** (`seed-pilot-cohort.mjs`: `student@`, `rohan@`, `kabir@`, `warden@`, `staff@`, `electrician@`) are test data. They must be disabled or removed before live data, per Go-Live Gate item 4.
- **Observers**: no Authority or Super Admin involvement in daily operations. Super Admin account is held by the project team for support only.

### 17.2.2 What The Pilot Is Not
- Not a full hostel management rollout, not a performance review of staff, and not a data source for punitive action against technicians. Technicians must be told this explicitly at onboarding; the staff interaction consistency measure (17.6) is a product-usability signal, not an appraisal.
- Not a test of the AI, finance, mess, housekeeping, or gate modules.

### 17.3 Operational SLA Guardrail
- Use clear SLA resolution deadlines and notification reminders only.
- Defer automatic multi-tier escalation to university executives (Chief Warden, Proctor) during the initial pilot until university leadership explicitly confirms jurisdictional responsibility, threshold hours, and notification expectations.
- **Implementation status (updated 2026-10-09)**: enforced in code by `PILOT_MODE=true` (Phase 5 task 5.1, DEC-020). Before this change all seeded SLA rules had `escalationEnabled: true`, so a breach reassigned the complaint to the Warden and then the Authority (blocker B1). With `PILOT_MODE=false` that full chain is unchanged. Verified by `tests/pilotGating.test.js`, including a control run showing the chain still escalates without the flag.
- **Silent breach gap (fixed in pilot mode)**: with `escalationEnabled` false the scheduler only sets `slaStatus = BREACHED` and sends no notification. In pilot mode a breach now notifies only the complaint's own hostel wardens (never Authority or Super Admin, and never a warden of another hostel), once per SLA cycle. The non-pilot `escalationEnabled: false` path is deliberately left unchanged.
- **Reminder behavior (fixed in pilot mode)**: the 75 percent reminder goes to the assignee. If a complaint is unassigned, pilot mode now sends that reminder to the hostel wardens, who are the only people able to assign it.
- **After a breach in pilot mode**: the complaint stays with its current owner and remains `BREACHED` until resolved, reassigned, or resumed after a reopen (which start a new SLA cycle). The Warden decides what to do; the system does not.

### 17.4 Proposed Unique Selling Proposition (USP)
> **"Every hostel complaint has an owner, a deadline, and a visible resolution trail, so students know what is happening and wardens can see what is stuck."**

- Position the explainable operational health score (0-100) strictly as secondary diagnostic evidence once underlying operational records are reliable.
- Do not lead pilot recruitment or university presentations with an "AI" claim. Trust must be earned through basic operational reliability first.

### 17.5 Defer During the First Pilot (Deployment Boundary)
To prevent cognitive overload, training friction, and administrative confusion, the following modules are explicitly deferred from the pilot cohort:
- Hostel Finance and Expense Management
- Asset Lifecycle and Scrap Disposal
- Mess and Dining Timetable Management
- Cleaning and Housekeeping Checklists
- Gate Outpass and Visitor Logs
- AI Command Center and Natural Language Q&A Assistant
- Media file and photo attachments: the code exists (Section 4.20), contradicting the original "not implemented" assumption. Whether the photo field is visible in the pilot is an open decision (Q4). It must not be exposed to real users until blocker B3 (public, unvalidated uploads) is closed.
- SMS / WhatsApp external notifications
- Real-time WebSocket push updates

*Note: This is a deployment and learning boundary, not a recommendation to delete or refactor completed code. Completed modules remain fully preserved in the codebase for subsequent rollout phases.*

### 17.6 Pilot Learning Measures & Baseline Metrics
Track the following empirical indicators during the pilot cohort:
1. **Complaint Volume**: Total tickets raised per week across pilot blocks.
2. **Workflow Completion Rate**: Percentage of submitted complaints that successfully reach `CLOSED` or verified resolution.
3. **Time to Acknowledge (TTA)**: Hours elapsed between student submission and staff acknowledgment.
4. **Time to Resolve (TTR)**: Hours elapsed from assignment to technician resolution.
5. **Overdue Rate**: Percentage of complaints that exceed their configured SLA window.
6. **Reopened Rate**: Percentage of resolved complaints rejected by students during verification.
7. **Staff Interaction Consistency**: Whether technicians consistently update statuses on their own devices or rely on Warden intervention.

No target metrics or artificial benchmarks are assumed until an empirical pilot baseline is observed and reviewed with students, wardens, and staff.

#### 17.6.1 Measurability Audit (verified against code, 2026-10-09)
| Measure | Source fields | Derivable today? | Caveat to resolve in Phase 5 task 5.5 |
|:---|:---|:---|:---|
| Complaint volume per week | `Complaint.createdAt`, `hostelId` | Yes | `getComplaintTrends` and CSV export exist (`exportAnalyticsCsv`) |
| Workflow completion rate | `status = CLOSED` over submitted | Yes (compute) | Define denominator: exclude `REJECTED`, and decide treatment of still-open tickets at the cutoff date |
| Time to Acknowledge | `submittedAt` to `acknowledgedAt` | Yes | `acknowledgedAt` is cleared on reassignment (`acknowledgedBy = null`), so a reassigned ticket loses its first acknowledgment. Report must use the final acknowledgment and count reassignments separately |
| Time to Resolve | `assignedAt` to `ComplaintResolution.resolvedAt` | Yes, per attempt | Complaint-level `resolvedAt` is overwritten by the latest attempt. Use `ComplaintResolution` rows (`attemptNumber`) for first-attempt TTR and total TTR |
| Overdue rate | `slaStatus = BREACHED`, `slaBreachedAt` | Yes | With escalation off, SLA status stays BREACHED. A new `ComplaintSlaCycle` starts on assign, on reassign, and when staff resume work after a reopen (`resumeWorkOnComplaint`). A ticket can therefore breach more than once, so state the unit (tickets or cycles) explicitly |
| Reopened rate | `reopenCount > 0` over resolved | Yes | Per-attempt rejections are in `ComplaintResolution.reopened`; report both ticket-level and attempt-level rates |
| Staff interaction consistency | `acknowledgedBy`, `resolvedBy` versus `assignedTo` | Partial | No actor stamp exists for the start-progress transition, and no general status-history log exists. Report only acknowledge and resolve actor match rates, and add an actor stamp on progress updates if the pilot needs more (decision for Phase 6 review) |

### 17.7 Go-Live Readiness Gate
Before real student records and live university data are ingested:
1. **Production Hosting**: Verified HTTPS endpoints and persistent server deployment.
2. **Database Resilience**: Automated daily MongoDB backups with an active restore verification test.
3. **Access Control & Privacy**: Verify cross-hostel data isolation and ensure government ID truncation (last 4 digits only).
4. **Credential Rotation**: Completely disable demo accounts (`admin@bbdu.ac.in`) and shared passwords (`Password@123`) in production; enforce unique credentials for pilot users.
5. **Documentation Alignment**: Reconcile all version references and steps across README, report, architecture, and decision logs.

Proposed additions to the gate (new, from the 2026-10-09 audit; they extend, not replace, items 1 to 5):
6. **Pilot Gating Enforced**: Backend `PILOT` switch active, auto-escalation off, deferred scheduler jobs off, breach notifies the Warden only (blockers B1, B2; DEC-020).
7. **Upload Safety**: Photo files served only to authorized users, content verified, metadata stripped, or the photo field disabled for the pilot (blocker B3; DEC-021).
8. **Password Lifecycle**: Self-service password change, admin-initiated reset, and forced change on first login exist and are tested (blocker B4; DEC-022). Without this, item 4 cannot be satisfied operationally. Status: backend and frontend done and tested 2026-10-10; the provisioning and audit scripts (5.3c) are pending.
9. **Data Authorization**: Written confirmation from the university data owner (Chief Warden or Proctor office) that pilot residents' names, Student IDs, and room details may be processed, and a short resident-facing notice of what is collected and who sees it.
10. **Test Baseline**: Full `npm test` run executed against MongoDB with results recorded in Section 2 (blocker B7).

Current gate status (2026-10-09): item 1 not started, 2 not started, 3 partial (cross-hostel isolation tested in Step 18; ID truncation implemented), 4 not started, 5 done by this audit, 6 code done and tested 2026-10-09 (still requires `PILOT_MODE=true` and `VITE_PILOT_MODE=true` to be set on the deployment), 7 to 10 not started.

---

## 18. Pilot Operations Plan (Phase 6, 4 weeks)

### 18.1 Timeline (relative, dates fixed only when Phase 5 exits)
| When | Activity |
|:---|:---|
| Pre-pilot | Phase 5 complete, Go-Live Gate items 1 to 10 green, Warden agrees SLA windows and categories |
| Day 0 | Onboarding: Warden session, technician session on their own phones, resident registration drive with a printed link or QR on the block notice board |
| Days 1 to 3 | Daily check-in with the Warden and technicians (15 minutes), fix-forward for P1 defects |
| Weeks 1 to 4 | Live operation. Weekly review (30 minutes) with Warden, plus a technician and a student representative if available |
| End of Week 2 | Joint review of the first baseline. Agree the numeric thresholds for the exit decision (17.6 forbids setting them earlier). Record as a decision entry |
| End of Week 4 | Exit review and Go, Iterate, or Stop decision |

### 18.2 Responsibilities
| Party | Responsibility |
|:---|:---|
| Project team | Support owner, defect triage, weekly metrics pack, deployments, backups, notes for the decision log |
| Warden | Daily triage, assignment, weekly review attendance, escalation of operational blockers to the project team (not to university executives through the system) |
| Technicians | Acknowledge, update progress, and resolve on their own device. Tell the project team honestly when the tool does not fit their work |
| Residents | Submit, track, verify or reopen. Report usability problems through the feedback channel |

### 18.3 Weekly Metrics Pack (produced by Phase 5 task 5.5)
Complaint volume, completion rate, TTA, TTR (first attempt and total), overdue rate (stated unit), reopened rate (ticket and attempt level), actor-match rate for acknowledge and resolve, count of reassignments, count of tickets handled outside the system (reported by the Warden), and a short qualitative section: top 3 resident complaints about the tool, top 3 technician complaints, top 3 Warden complaints.

### 18.4 Defect Severity and Response
| Severity | Definition | Response |
|:---|:---|:---|
| P0 | Data loss, login unavailable for the cohort, one user able to see another hostel's or student's private data, or any executive notified by mistake | Pause the pilot, fix, write a short incident note in `decision.md`, resume only after verification |
| P1 | A step of the 5-step loop is blocked for any role | Fix within the same or next working day |
| P2 | Confusing wording, layout, or slow screen that has a workaround | Batch into the weekly release |

### 18.5 Safety Stop Conditions
Stop and review immediately if any P0 occurs, if the Warden reports the tool is creating more work than the previous process for two consecutive weeks, or if technicians stop using it entirely. These are safety stops, not performance targets.

### 18.6 Exit Decision
| Outcome | Evidence required |
|:---|:---|
| Go (proceed to roadmap Phase 7 candidates) | Baseline recorded for all measures in 17.6.1, no open P0 or P1, the Warden and at least one technician state in writing they would keep using it, thresholds agreed at the Week 2 review are met |
| Iterate (extend or repeat the pilot with changes) | Baseline recorded but thresholds not met, or a P1 root cause needs a design change |
| Stop | A safety stop condition persists after one fix cycle, or the stakeholders withdraw support |

---

## 19. Roadmap to Project Completion

**End state (confirmed with the user, 2026-10-09)**: Campus-wide rollout. All 7 seeded hostels (`BBDU-AB`, `BBDU-CD`, `NDGH`, `DPGGH`, `SDGH`, `SHDGH`, `BBDGH`) are live on the core complaint loop, each enabled module has passed its own field gate, the platform is operated by a named university owner, and the project is handed over with documentation.

**Sequencing policy (confirmed)**: Phases 5, 6, and 12 are fixed. Phases 7 to 11 are candidate waves. Their order is decided at the Phase 6 exit review from pilot evidence, subject to the dependency rules in 19.4. Waves have gates, not calendar dates.

### 19.1 Completed Preparation (Pilot Phases 1 to 4)
Frontend pilot navigation scoping (DEC-017), core complaint screen streamlining, live 12-step loop verification and auth limiter calibration (DEC-018), pilot cohort seeding and department alignment (DEC-019). See Section 16.

### 19.2 Fixed Phases

#### Phase 5: Pilot Hardening and Go-Live Gate (FIXED)
- **Goal**: Make the pilot safe to start with real students.
- **Entry**: This audit accepted.
- **Tasks** (each is one step, one concern, per the Workflow Contract; each needs its own DEC where noted):
  | ID | Task | Closes | Notes |
  |:---|:---|:---|:---|
  | 5.1 | Backend pilot gating switch (`PILOT_MODE` env): force-disable auto-escalation, skip deferred scheduler jobs (items 4 to 8), Warden-only breach notification, Warden reminder for unassigned complaints, tests proving no Authority notification is created | B1, B2 | DEC-020. STATUS: DONE 2026-10-09, 7 new tests plus full suite pass. Items 3 and 9 keep running (Q5 resolved) |
  | 5.2 | Upload safety: authenticated file route replacing public `express.static`, magic-byte validation, metadata stripping, configurable persistent storage path, retention rule. Or disable the photo field for the pilot, depending on Q4 | B3 | DEC-021. Metadata stripping may need an image library, which is a dependency decision |
  | 5.3 | Password lifecycle: self-service change, admin-initiated reset, forced first-login change, pilot provisioning script with unique generated passwords, refuse demo seed in `NODE_ENV=production` | B4 | DEC-022. Adds two fields on `User` (schema change). Split into 5.3a backend and tests (DONE 2026-10-10), 5.3b frontend screens (DONE 2026-10-10), 5.3c provisioning script, production seed guard, demo-credential audit script (open). Reset scope confirmed by the user: SUPER_ADMIN any user, WARDEN student and staff of own hostel |
  | 5.4 | Production deployment: host, HTTPS, `trust proxy` setting, rate limit keying by user for auth routes, daily backups with a restore drill, single-instance guarantee for the scheduler, log retention, uptime check, deployment runbook | B5, B8 | Hosting choice pending Q1 |
  | 5.5 | Pilot metrics pack script producing the 17.6.1 measures with stated semantics (CSV and markdown), plus tests | B6 | Uses `ComplaintResolution` for per-attempt TTR |
  | 5.6 | Real-device QA of the 5 core screens on the phones technicians and residents actually use (low bandwidth, small screens), fix findings | none (risk R2) | Checklist stored in this file when done |
  | 5.7 | Feedback channel: decide whether to reuse the existing `StudentFeedback` model or an external form, ship the simplest one | none | Decision needed from the user |
  | 5.8 | Data and script hygiene: retire `allocate_students.js` (stale `BH1`), consolidate duplicate `scripts/` files, review SLA windows with the Warden (current defaults: CRITICAL 4h, HIGH 24h, MEDIUM 48h, LOW 72h, reminder at 75 percent), define the resident registration drive and room data load for `BBDU-AB` | none | Needs the real block, floor, and room list |
  | 5.9 | Re-run full `npm test` and `npm run build` against MongoDB, update Section 2 and Section 9 with executed numbers, run `verify-pilot-complaint-loop.mjs` against the deployed host | B7 | |
  | 5.10 | Pilot runbook, onboarding sheets per role, resident data notice, data authorization confirmation from the university | Gate item 9 | Non-code deliverables |
  | 5.11 | Plain-language pilot UX for technicians and Wardens (DEC-026, DEC-027). U1 word list (DONE, approved by the user 2026-10-10), U2 technician screens (DONE 2026-10-10), U3 Warden home and assign screens (open), U4 plain-language and Hindi notifications (open), U5 real-user test with the Warden and one technician, then fix what it shows (open, needs the user) | Risks R2, R3 | The Hindi is a DRAFT until a native speaker reviews it. A "Can't finish, need help" action was considered and deliberately left out by the user |
- **Exit gate**: Go-Live Readiness Gate items 1 to 10 are all green and the Warden agrees to start.
- **Risks**: Hosting or university approvals delay the start (R6, R7). Mitigation: start 5.4 and 5.10 first because they depend on other parties.

#### Phase 6: Pilot Execution and Evidence Review (FIXED, 4 weeks)
- **Goal**: Learn whether the loop works in real use and gather the baseline.
- **Entry**: Phase 5 exit gate.
- **Activities**: as Section 18.
- **Exit gate**: Go, Iterate, or Stop per 18.6, plus a written ranking of candidate waves 7 to 11 backed by pilot evidence.
- **Output**: A decision entry fixing the order and entry gates of the waves, and the agreed numeric thresholds.

### 19.3 Candidate Waves (order decided at the Phase 6 exit review)

Each wave records an evidence gate (what pilot or operating data must justify it) so it is not built on assumption.

| Wave | Candidate scope | Evidence gate | Notable prerequisites and warnings |
|:---|:---|:---|:---|
| 7. Campus Core Rollout | Core complaint loop in the remaining hostels in staged groups; hierarchy load for blocks, floors, rooms; Warden and technician provisioning per hostel; bulk student onboarding (CSV import does not exist yet); read-only Authority oversight views; load test at expected concurrency; per-hostel cutover checklist | Phase 6 Go | Executive escalation is activated only after the university signs a jurisdiction matrix (who, after how many hours, which channel). Girls hostels need a privacy review of who may read complaints from female residents. Verify cross-hostel isolation with seeded multi-hostel data before each group |
| 8. Reach and Reliability | SMS, WhatsApp, or email for a small set of critical events (assignment, verification request, breach to Warden); photo attachments if not shipped in the pilot; PWA install and web push; Server-Sent Events for dashboard refresh | Pilot shows acknowledgment or verification delays caused by not opening the app | SMS sender and template registration rules in India and WhatsApp Business template approval and cost must be confirmed at design time; do not assume. Each channel is a new dependency and needs a DEC |
| 9. Dining | Mess module: menus, publish notifications, meal feedback, hygiene alert | Warden or mess manager requests it, and core loop is stable in that hostel | Module pilot in one hostel for at least 2 weeks before extension. Mess complaints already flow through the core loop |
| 10. Housekeeping and Gate | Cleaning checklists with supervisor verification; outpass and visitor logs | Same as wave 9, plus a named gate or security owner | The RBAC has 5 roles and no gate officer role. Confirm which role performs gate verification. A new role needs a DEC under the RBAC change rule. Visitor data is privacy sensitive (keep last 4 digits of government ID only) |
| 11. Assets, Preventive Maintenance, Finance, Intelligence | Asset registry import and lifecycle, preventive plans, finance budgets and expenses, AI Command Center. Optional LLM only after months of reliable data, over aggregated and de-identified data | University accounts or maintenance office demand; clean work order usage | Finance needs a financial year agreed with accounts and an approver chain. Deterministic scoring remains the source of truth (DEC-009). Asset and finance data need bulk import tools that do not exist yet |

### 19.4 Dependency Rules (apply to all waves)
1. No module wave starts in a hostel until the core loop there has had two consecutive weekly reviews with no open P0 or P1.
2. One new module per hostel at a time, each with its own entry gate, exit gate, and rollback (hide navigation and disable its scheduler job).
3. Activating executive escalation requires a written jurisdiction matrix from the university, recorded as a decision.
4. Any RBAC change, schema change, scheduler change, or new dependency requires a decision entry before code.
5. The scheduler must run as exactly one process until a database-backed lock replaces the in-memory `isProcessing` flag.

### 19.5 Cross-Cutting Enablers (schedule inside whichever phase first needs them)
- CI/CD (GitHub Actions: install, `npm test` with a MongoDB service container, `npm run build`), then containerization
- Structured logging and error monitoring, health and uptime alerting
- Standard pagination and search indexes as data volume grows
- Year-end lifecycle: academic-year rollover, room reallocation, deactivation or archival of departing residents (needed before the first academic year ends with real data)
- Data retention and deletion policy for complaints, photos, and audit logs
- Bulk import tools (hierarchy, students, assets)
- Accessibility and language review, including whether Hindi is needed by technicians and residents (open question Q6)

### 19.6 Phase 12: Campus Operate and Handover (FIXED, terminal phase)
- **Goal**: Finish the project as a stable, owned service.
- **Entry**: All 7 hostels live on the core loop, and every enabled module has passed its own gate.
- **Scope**: Final security review (dependency audit, authorization review, optional external penetration test), disaster recovery drill with timed restore, load validation at full campus concurrency, CI/CD and monitoring in place, role-based user guides and an administrator runbook, support model with named owner and response expectations, data retention policy in force, final report and lessons in `report.md`, backlog of deferred ideas handed to the owner.
- **Exit gate (project complete)**: Handover signed by the university owner, restore drill passed in the last 30 days, no open P0 or P1, documentation reconciled across README, report, architecture, and decision logs.

---

## 20. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Phase |
|:---|:---|:---|:---|:---|:---|
| R1 | Executives notified by auto-escalation before the university agrees jurisdiction (B1) | High until 5.1 | High | Backend gating, test proving no Authority notification | 5 |
| R2 | Technicians do not use the tool on their phones (device, language, habit) | Medium | High | Task-first technician screens with English and Hindi (DEC-026, built 2026-10-10), real-device QA, short onboarding on their own phones, daily check-ins in week 1, measure actor-match rate | 5, 6 |
| R3 | Warden overload or abandonment | Medium | High | Keep the Warden flow to the 5 core screens, weekly review, safety stop condition | 6 |
| R4 | Complaint photo of a student's room or person leaks (B3) | Medium | High | Authenticated route, metadata stripping, or disable for the pilot | 5 |
| R5 | Lost or shared credentials with no reset path (B4) | High | Medium | Password lifecycle (5.3), unique provisioning | 5 |
| R6 | No hosting or backup in place at start (B5) | Medium | High | Start 5.4 first, restore drill before go-live | 5 |
| R7 | University approval or data authorization delayed | Medium | High | Start 5.10 early, escalate through the sponsor, do not ingest real data without it | 5 |
| R8 | Whole cohort locked out by shared-IP rate limits (B8) | High in production | High | `trust proxy`, per-user keying on auth routes, load test through the real proxy | 5 |
| R9 | Duplicate scheduler runs if the API is scaled to more than one process | Low in pilot | Medium | Single instance, then DB-backed lock before any horizontal scaling | 5, 7 |
| R10 | Metrics misreported because of reassignment and reopen semantics | Medium | Medium | Explicit semantics in 17.6.1, tests on the metrics script | 5 |
| R11 | Scope creep from enabling modules before the loop is proven | Medium | High | Dependency rules 19.4, evidence gates on waves | all |
| R12 | Local-disk uploads and a single MongoDB lose data or fill disk | Medium | High | Persistent volume or object storage, backups, disk monitoring | 5 |
| R13 | Documentation drifts from code again | High | Medium | Each task updates report and decision entries; re-audit at every phase exit | all |

---

## 21. Open Questions (need user or university input, not to be guessed)

| ID | Question | Blocks |
|:---|:---|:---|
| Q1 | Where will it be hosted (campus server, cloud VM, or PaaS with Atlas) and who owns the budget and domain? | 5.4, gate items 1 and 2 |
| Q2 | How many residents are in the pilot block, and how will they be told to register? | 5.8, 18 |
| Q3 | Who are the real technicians, what categories do they cover, what phones do they have, and what language do they prefer? | 5.6, 5.8 |
| Q4 | Should the pilot allow photo attachments, given blocker B3? (Recommended: ship only after 5.2 closes) | 5.2 |
| Q5 | RESOLVED 2026-10-09: jobs 3 (work order SLA) and 9 (student services lifecycle) keep running in pilot mode. Reason: they only act on work orders and scheduled notices, which the pilot never creates, so gating them adds code and risk for no benefit. Revisit if the Warden starts using notices. | 5.1 (done) |
| Q6 | PARTLY ANSWERED 2026-10-10: Hindi plus English toggle for the technician screens. Still open: Warden and student screens, and who reviews the Hindi wording | 5.11 |
| Q7 | Who is the university sponsor who can sign the data authorization and, later, the escalation jurisdiction matrix? | gate item 9, wave 7 |
