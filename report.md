# BBDU Hosteller - Complete System Report

> **Purpose**: This document is the single source of truth for any new agent or developer joining this project. Read it fully before touching any code.

> **Last Updated**: 2026-10-08

---

## 1. Project Identity

**Name**: BBDU Hosteller
**Type**: Smart Hostel Management and Complaint Escalation Platform
**Repository**: Single monorepo with `backend/` and `frontend/` workspaces
**Git History**: Single commit (`32187a8 Hostel project`) - fresh repository
**Status**: Step 18 complete (Final Production Readiness and Complete Project Audit)

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
- 248 tests across 20 integration suites (235 passed, 13 skipped, 0 failed as of last audit)

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

### 4.2 Location Hierarchy (Step 4)
- 5-level hierarchy: Hostels > Blocks > Floors > Rooms > Departments
- Capacity checks at room level
- Student assignment to specific hostel/block/floor/room
- Models: `Hostel`, `Block`, `Floor`, `Room`, `Department`

### 4.3 Complaint Lifecycle Engine (Steps 5.1-5.4)
- State machine: `SUBMITTED > TRIAGED > ASSIGNED > ACKNOWLEDGED > IN_PROGRESS > STUDENT_VERIFICATION > RESOLVED / CLOSED`
- Student `REOPENED` loop for disputed resolutions
- Categories: ELECTRICAL, PLUMBING, CARPENTRY, CIVIL, MESS, CLEANING, SECURITY, IT_NETWORK, OTHER
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
- `GET /api/auth/me` - Current user profile
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

### Warden Portal (`WARDEN`, `SUPER_ADMIN`)
| Route | Component |
|:---|:---|
| `/warden/dashboard` | WardenDashboard |
| `/warden/complaints` | WardenComplaintsPage |
| `/warden/complaints/:id` | ComplaintManageDetailPage |
| `/warden/analytics` | AnalyticsDashboardPage |

### Staff Portal (`HOSTEL_STAFF`, `SUPER_ADMIN`)
| Route | Component |
|:---|:---|
| `/staff/dashboard` | StaffDashboard |
| `/staff/complaints` | StaffComplaintsPage |
| `/staff/complaints/:id` | ComplaintManageDetailPage |

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

## 9. Test Suites (20 Suites, 248 Tests)

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

The `processSlaAndEscalations()` function in `sla.service.js` handles ALL background work:
1. SLA deadline monitoring and breach detection for complaints
2. SLA warning notifications at 75% elapsed time
3. Automatic multi-tier escalation execution
4. Work order SLA breach monitoring
5. Preventive maintenance due date checks and automatic work order generation
6. Cleaning task overdue/missed detection
7. Outpass overdue student return detection

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
- Dependency audit: 0 vulnerabilities in both workspaces

### Requires Setup
- `node_modules/` must be installed: `npm install` in both `backend/` and `frontend/`
- MongoDB must be running locally or Atlas URI configured in `.env`
- `.env` files must be created from `.env.example` templates

### Not Yet Implemented
- File/image upload for complaints and maintenance (no multer, no cloud storage)
- Real-time WebSocket push (currently REST polling only)
- Real LLM integration for AI assistant (currently keyword-based pattern matching)
- Email/SMS notifications (in-app only)
- PWA manifest and service workers
- Docker containerization
- CI/CD pipeline (GitHub Actions)

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
