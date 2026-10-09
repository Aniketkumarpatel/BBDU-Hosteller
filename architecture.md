# BBDU Hosteller - System Architecture

> **Purpose**: Complete technical architecture reference covering the full pipeline, folder structure, design patterns, tools, technologies, and the evolution decisions that shaped this system.

> **Last Updated**: 2026-10-09

---

## 1. High-Level System Architecture

```
+------------------+         +-------------------+         +------------------+
|                  |  HTTP   |                   |  TCP     |                  |
|  React 19 SPA    | ------> |  Express 5 API    | -------> |  MongoDB         |
|  (Vite + TW v4)  | <------ |  (Node.js 22+)    | <------- |  (Mongoose 9)    |
|  Port 5173       |  JSON   |  Port 5000        |  BSON    |  Port 27017      |
|                  |         |                   |         |                  |
+------------------+         +-------------------+         +------------------+
        |                           |
        |  Vite Dev Proxy           |  60s setInterval
        |  /api -> :5000            |
        |                    +------+--------+
        |                    |               |
        |                    |  Background   |
        |                    |  Scheduler    |
        |                    |  (Single Loop)|
        |                    |               |
        |                    +---------------+
        |                    Monitors:
        |                    - SLA deadlines
        |                    - Work order due dates
        |                    - Maintenance schedules
        |                    - Cleaning overdue/missed
        |                    - Outpass curfew returns
```

---

## 2. Request Lifecycle Pipeline

Every HTTP request flows through this exact middleware chain in `app.js`:

```
Incoming Request
      |
      v
[1] helmet()                    - Security headers (X-Frame-Options: DENY, nosniff, referrer)
      |
      v
[2] cors()                      - Origin whitelist check (CLIENT_URL, localhost in dev)
      |
      v
[3] globalApiLimiter            - 1000 req / 15 min DDoS shield
      |
      v
[4] morgan()                    - Request logging (skipped in test env)
      |
      v
[5] express.json()              - Body parser (1MB limit)
      |
      v
[6] express.urlencoded()        - Form parser (1MB limit)
      |
      v
[7] mongoSanitize               - NoSQL injection blocker (recursive $ and . key scan)
      |
      v
[8] Router /api/*               - Route matching
      |
      +-- [authLimiter]         - 20 req / 15 min (auth routes only)
      +-- [aiQueryLimiter]      - 30 req / 15 min (AI routes only)
      +-- [analyticsLimiter]    - 60 req / 15 min (analytics routes only)
      +-- [validate(schema)]    - Zod body validation + privilege escalation detection
      +-- [requireAuth]         - JWT verification + user lookup + isActive check
      +-- [requireRole(...)]    - RBAC role gate + security audit logging
      |
      v
[9] Controller                  - Thin request/response handler
      |
      v
[10] Service                    - Domain business logic (all DB operations here)
      |
      v
[11] Response                   - { success: true, data: {...} }
      |
      v
[CATCH] notFoundHandler         - 404 for unmatched routes
      |
      v
[CATCH] errorHandler            - Normalizes Mongoose/JWT/body errors into ApiError
                                - Production: scrubs 5xx messages and stack traces
                                - Response: { success: false, message, details? }
```

---

## 3. Folder Structure

```
BBDU-Hosteller/
|
|-- CLAUDE.md                    # Agent wiring file (read before every session)
|-- report.md                    # Complete system report (every feature documented)
|-- architecture.md              # This file (technical architecture reference)
|-- decision.md                  # Decision log (why choices were made)
|-- README.md                    # Project overview and API documentation
|-- .gitignore                   # Dependencies, env, build output, OS files
|
|-- backend/
|   |-- .env.example             # Environment template (never commit .env)
|   |-- package.json             # Express 5, Mongoose 9, Zod, bcryptjs, helmet, etc.
|   |-- package-lock.json        # Locked dependency tree
|   |-- server.js                # Entry point: DB connect, scheduler start, HTTP listen
|   |
|   |-- src/
|   |   |-- app.js               # Express app assembly (middleware chain + routes)
|   |   |
|   |   |-- config/
|   |   |   |-- env.js           # Frozen environment config (Object.freeze)
|   |   |   |-- db.js            # MongoDB connection with URI redaction and health probe
|   |   |
|   |   |-- constants/           # 14 frozen enum files
|   |   |   |-- roles.js                          # STUDENT, WARDEN, HOSTEL_STAFF, AUTHORITY, SUPER_ADMIN
|   |   |   |-- complaint.constants.js            # 10 categories, 4 priorities, 12 statuses, issue types
|   |   |   |-- sla.constants.js                  # SLA statuses, escalation triggers, default durations
|   |   |   |-- workOrder.constants.js             # WO statuses, priorities, asset types/conditions
|   |   |   |-- aiCommandCenter.constants.js       # Insight categories, modules, health bands
|   |   |   |-- cleaning.constants.js              # Cleaning task statuses, area types
|   |   |   |-- mess.constants.js                  # Meal types, menu statuses
|   |   |   |-- outpass.constants.js               # Outpass statuses, visitor statuses
|   |   |   |-- finance.constants.js               # Expense statuses, budget categories
|   |   |   |-- preventiveMaintenance.constants.js  # Plan statuses, frequency types
|   |   |   |-- inventory.constants.js             # Asset lifecycle statuses
|   |   |   |-- notification.constants.js          # Notification types
|   |   |   |-- studentServices.constants.js       # Notice categories, request types
|   |   |   |-- hostel.js                          # Hostel types
|   |   |
|   |   |-- middleware/          # 5 middleware modules
|   |   |   |-- auth.js          # requireAuth (JWT + user lookup) + requireRole (RBAC gate)
|   |   |   |-- errorHandler.js  # notFoundHandler + centralized errorHandler
|   |   |   |-- mongoSanitize.js # Recursive NoSQL injection prevention
|   |   |   |-- rateLimiter.js   # 4 tiered limiters (global, auth, AI, analytics)
|   |   |   |-- validate.js      # Zod schema validation + privilege escalation detection
|   |   |
|   |   |-- models/              # 37 Mongoose schemas + index.js barrel
|   |   |   |-- index.js         # Central export + allModels dictionary + initModels()
|   |   |   |-- schemaOptions.js # Shared schema options (timestamps, toJSON, toObject)
|   |   |   |-- User.js          # passwordHash select:false, role enum, location refs
|   |   |   |-- Complaint.js     # 12-status state machine, SLA fields, category/issue types
|   |   |   |-- Asset.js         # Health scoring fields, failure count, warranty
|   |   |   |-- ... (34 more model files)
|   |   |
|   |   |-- controllers/         # 26 thin controller files
|   |   |   |-- auth.controller.js
|   |   |   |-- complaint.controller.js
|   |   |   |-- dashboard.controller.js        # Role-aware stats aggregation
|   |   |   |-- ... (23 more controller files)
|   |   |
|   |   |-- services/            # 16 domain logic services (all DB operations)
|   |   |   |-- complaint.service.js           # 47KB - full complaint lifecycle
|   |   |   |-- asset.service.js               # 44KB - asset CRUD + health scoring
|   |   |   |-- studentServices.service.js     # 43KB - notices, requests, feedback
|   |   |   |-- finance.service.js             # 40KB - budgets, expenses, traceability
|   |   |   |-- cleaning.service.js            # 36KB - areas, plans, tasks, verification
|   |   |   |-- sla.service.js                 # 34KB - SLA monitoring + escalation chain
|   |   |   |-- outpass.service.js             # 33KB - outpass + visitor lifecycle
|   |   |   |-- preventiveMaintenance.service.js # 32KB - plans, cycles, calendar math
|   |   |   |-- analytics.service.js           # 31KB - aggregation pipelines
|   |   |   |-- aiInsight.service.js           # 29KB - health score + NL assistant
|   |   |   |-- workOrder.service.js           # 29KB - work order lifecycle
|   |   |   |-- mess.service.js                # 26KB - mess, menus, feedback, hygiene
|   |   |   |-- auth.service.js                # 6KB - registration, login, profile
|   |   |   |-- securityAudit.service.js       # 5KB - immutable audit logging
|   |   |   |-- notification.service.js        # 5KB - notification CRUD
|   |   |
|   |   |-- routes/              # 22 route definition files + index.js barrel
|   |   |   |-- index.js         # Central router mounting all route groups under /api
|   |   |   |-- auth.routes.js   # [authLimiter, validate(schema)] -> controller
|   |   |   |-- complaint.routes.js  # 18+ endpoints with fine-grained RBAC
|   |   |   |-- ... (19 more route files)
|   |   |
|   |   |-- scheduler/
|   |   |   |-- slaScheduler.js  # Single 60s setInterval loop, idempotent guard
|   |   |
|   |   |-- validators/          # 2 validation schema files
|   |   |   |-- auth.validator.js       # Zod schemas for register/login
|   |   |   |-- complaint.validator.js  # Imperative validator for complaint input
|   |   |
|   |   |-- utils/               # 6 utility modules
|   |       |-- ApiError.js      # Operational error class with status code factories
|   |       |-- asyncHandler.js  # Promise.resolve wrapper for Express route handlers
|   |       |-- dateUtils.js     # Calendar-safe month addition for maintenance scheduling
|   |       |-- jwt.js           # signToken (minimal claims) + verifyToken
|   |       |-- password.js      # bcrypt hash (12 rounds) + compare
|   |       |-- userSerializer.js # Strips passwordHash, formats safe user object
|   |
|   |-- seed/
|   |   |-- seed.js              # Idempotent seeder: 5 demo users, hostel hierarchy, SLA/escalation rules
|   |
|   |-- scripts/
|   |   |-- check-db.js          # Database model and index verification script
|   |   |-- verify-step5.2.js    # Complaint lifecycle verification
|   |   |-- verify-step5.3.js    # SLA and escalation verification
|   |   |-- verify-step5.4.js    # Advanced complaint flow verification
|   |
|   |-- tests/                   # 20 integration test suites (node:test)
|       |-- health.test.js
|       |-- auth.test.js
|       |-- complaint.test.js
|       |-- sla.test.js
|       |-- ... (16 more test files)
|
|-- frontend/
    |-- .env.example             # VITE_API_URL template
    |-- index.html               # HTML entry with SVG favicon, viewport meta
    |-- package.json             # React 19, Vite 8, Tailwind v4, React Router 7
    |-- package-lock.json        # Locked dependency tree
    |-- vite.config.js           # React + Tailwind plugins, /api proxy to :5000
    |
    |-- public/                  # Static assets (favicon, etc.)
    |
    |-- src/
        |-- main.jsx             # ReactDOM.createRoot, BrowserRouter wrapping App
        |-- App.jsx              # AuthProvider wrapping AppRoutes
        |-- index.css            # Tailwind v4 import + Inter font + base styles
        |
        |-- context/
        |   |-- AuthContext.jsx  # Auth state, login/register/logout, session re-verify
        |
        |-- routes/
        |   |-- AppRoutes.jsx    # All route definitions with role guards
        |   |-- Guards.jsx       # ProtectedRoute + RoleProtectedRoute (Outlet pattern)
        |
        |-- layouts/
        |   |-- PublicLayout.jsx      # Public pages with nav and footer (Outlet)
        |   |-- AdminLayout.jsx       # Admin sidebar + topbar + Outlet
        |   |-- DashboardLayout.jsx   # Role-aware sub-nav wrapper (children pattern)
        |
        |-- components/
        |   |-- common/          # 14 reusable UI components
        |   |   |-- Sidebar.jsx          # 16-item admin navigation drawer
        |   |   |-- Topbar.jsx           # Top bar with user info
        |   |   |-- NotificationBell.jsx # 417-line notification dropdown
        |   |   |-- DashboardCard.jsx    # KPI metric card
        |   |   |-- DataTable.jsx        # Paginated data table
        |   |   |-- Modal.jsx            # Dialog wrapper
        |   |   |-- ConfirmationDialog.jsx
        |   |   |-- StatusBadge.jsx      # Color-coded status pills
        |   |   |-- LoadingSpinner.jsx
        |   |   |-- EmptyState.jsx
        |   |   |-- ErrorState.jsx
        |   |   |-- FormField.jsx
        |   |   |-- FilterSelect.jsx
        |   |   |-- SearchInput.jsx
        |   |-- sla/             # SLA-specific display components
        |   |-- ApiStatus.jsx    # Backend connectivity indicator
        |
        |-- pages/               # 16 page directories + 4 root pages
        |   |-- LandingPage.jsx
        |   |-- LoginPage.jsx
        |   |-- RegisterPage.jsx
        |   |-- NotFoundPage.jsx
        |   |-- dashboards/      # 5 role-specific dashboards
        |   |-- student/         # Student complaint pages
        |   |-- warden/          # Warden complaint management
        |   |-- staff/           # Staff work queue
        |   |-- authority/       # Authority oversight
        |   |-- admin/           # 11 admin management pages
        |   |-- complaints/      # Shared complaint detail page
        |   |-- workOrders/      # Work order list + detail
        |   |-- assets/          # Asset inventory + detail
        |   |-- maintenance/     # Maintenance dashboard + plan detail
        |   |-- mess/            # Mess dashboard
        |   |-- cleaning/        # Cleaning dashboard
        |   |-- outpass/         # Outpass dashboard
        |   |-- aiCommandCenter/ # AI command center (604 lines)
        |   |-- finance/         # Finance dashboard + expense detail
        |   |-- studentServices/ # Student services dashboard + request detail
        |
        |-- services/            # 23 Axios API client modules
        |   |-- api.js           # Base Axios instance + interceptors
        |   |-- auth.service.js
        |   |-- complaintService.js
        |   |-- ... (20 more service files)
        |
        |-- hooks/               # Empty (.gitkeep) - useAuth is in AuthContext
        |-- utils/               # Empty (.gitkeep) - helpers co-located in components
        |-- assets/              # Static assets (images, icons)
```

---

## 4. Design Patterns

### 4.1 Backend Patterns

**Controller-Service Separation**
- Controllers are thin: extract request params, call service, format response
- Services contain all business logic and database operations
- Controllers never import Mongoose models directly

**Centralized Error Handling**
- `ApiError` class with `isOperational` flag distinguishes expected vs unexpected errors
- `normalizeError()` converts Mongoose ValidationError, CastError, duplicate key, JWT errors into ApiError
- Single `errorHandler` middleware formats all errors into `{ success: false, message }`
- Production: 5xx messages scrubbed to "Internal server error", stack traces hidden

**Frozen Enum Constants**
- All status values, categories, priorities defined as `Object.freeze({})` in `/constants`
- Shared between Mongoose schemas (enum validation) and business logic
- Single source of truth prevents string literal drift

**Sequential Human-Readable IDs**
- `Counter` model stores auto-increment sequence per entity type
- Format: `PREFIX-YYYY-XXXXX` (e.g., `CMP-2026-00001`, `WO-2026-00001`)
- Atomic `findOneAndUpdate` with `$inc` prevents race conditions

**Single Scheduler Pattern**
- One `setInterval` in `slaScheduler.js` runs every 60 seconds
- `isProcessing` boolean prevents overlapping cycles
- All background jobs aggregated into `processSlaAndEscalations()`
- Benefits: no orphan timers, no duplicate schedulers, single point of monitoring

**Credential Security**
- `passwordHash` field uses `select: false` in Mongoose schema
- `userSerializer.js` strips sensitive fields before any API response
- `db.js` redacts credentials from connection string in all logs and errors
- JWT contains only `userId` and `role` (no email, no name, no password hash)

### 4.2 Frontend Patterns

**AuthContext Provider Pattern**
- `AuthProvider` wraps entire app in `App.jsx`
- Exposes `{ user, token, loading, isAuthenticated, login, register, logout }`
- Session re-verification on mount via `authService.getMe()`
- Memoized handlers with `useCallback`

**Two-Tier Route Protection**
- `ProtectedRoute`: checks `isAuthenticated`, redirects to `/login` with return location
- `RoleProtectedRoute`: checks `user.role` against `allowedRoles` array
- Both use React Router's `<Outlet />` pattern for nested routing

**Dual Layout Architecture**
- `PublicLayout` + `AdminLayout`: use `<Outlet />` for route nesting
- `DashboardLayout`: wrapper component receiving `children` prop
- Role-aware sub-navigation computed from `user.role`

**Axios Interceptor Chain**
- Request interceptor: auto-attaches `Authorization: Bearer <token>` from localStorage
- Response interceptor: normalizes error messages, clears stale tokens on 401

**Design System (Tailwind v4)**
- Palette: Slate neutrals, Indigo primary, Emerald success, Rose danger, Amber warning
- Typography: Inter font family via CSS `@theme` directive
- Cards: `rounded-xl border border-slate-200 bg-white p-6 shadow-sm`
- Active nav: `bg-indigo-600 text-white shadow-xs`
- Status badges: color-coded by StatusBadge component
- Hero gradients: `bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900`
- Responsive: overflow-x-auto for mobile, max-w-7xl container

---

## 5. Data Flow Patterns

### Complaint Lifecycle State Machine

```
SUBMITTED
    |
    v  (Warden triages: sets priority, assigns department)
TRIAGED
    |
    v  (Warden assigns to staff member)
ASSIGNED
    |
    v  (Staff acknowledges receipt)
ACKNOWLEDGED
    |
    v  (Staff begins physical work)
IN_PROGRESS
    |
    +--- (Staff resolves) ---> STUDENT_VERIFICATION
    |                              |
    |                              +--- (Student accepts) ---> CLOSED
    |                              |
    |                              +--- (Student rejects) ---> REOPENED ---> IN_PROGRESS
    |
    +--- (SLA breach) ---> ESCALATED (auto-escalation chain)
    |
    +--- (Waiting for info) ---> WAITING_FOR_INFORMATION ---> IN_PROGRESS
```

### SLA Escalation Chain

```
Complaint created with SLA rule
    |
    v
slaDueAt = createdAt + resolutionWindowMinutes
    |
    v
[Scheduler every 60s]
    |
    +-- elapsed >= 75% ---> WARNING notification to assignee
    |
    +-- elapsed >= 100% ---> BREACHED status
            |
            v
    Escalation Level 1: HOSTEL_STAFF -> notify WARDEN (24h window)
            |
            v
    Escalation Level 2: WARDEN -> notify AUTHORITY (24h window)
            |
            v
    Escalation Level 3: AUTHORITY -> notify SUPER_ADMIN (24h window)
```

### Asset Health Score Formula

```
baseScore = 100

conditionPenalty:
  EXCELLENT = 0
  GOOD = -5
  FAIR = -15
  POOR = -30
  CRITICAL = -50

agePenalty:
  yearsInService = (now - purchaseDate) / 365
  if yearsInService > expectedLifeYears:
    penalty = min(20, (yearsInService - expectedLife) * 5)

repairPenalty:
  repairRatio = totalRepairCost / purchaseCost
  if repairRatio > 0.5: penalty = min(15, repairRatio * 20)

failurePenalty:
  penalty = min(15, failureCount * 3)

healthScore = max(0, baseScore - conditionPenalty - agePenalty - repairPenalty - failurePenalty)
```

### Operational Health Score Composition

```
Total = 100 points

Complaints & SLA (30 pts max):
  - Critical open complaints: -5 per (max -15)
  - Breached complaints: -4 per (max -15)
  - Near-deadline warnings: -2 per (max -6)

Maintenance & Equipment (20 pts max):
  - Overdue work orders: -3 per (max -12)
  - Failing assets: -2 per (max -8)

Cleaning & Housekeeping (20 pts max):
  - Avg quality < 3.5: -8 flat
  - Overdue + missed tasks: -2 per (max -10)

Dining & Food (15 pts max):
  - Low-rated meals (7 days): -3 per (max -12)

Outpass & Security (15 pts max):
  - Overdue student returns: -5 per (max -15)

Bands: OPTIMAL(85+), MODERATE_RISK(70-84), HIGH_RISK(50-69), CRITICAL(<50)
```

---

## 6. Security Architecture

```
Layer 1: Network
  +-- Helmet hardened HTTP headers
  +-- CORS origin whitelist
  +-- Global rate limiter (1000/15min)

Layer 2: Input Validation
  +-- express.json body size limit (1MB)
  +-- NoSQL injection sanitizer (mongoSanitize)
  +-- Zod schema validation on write endpoints
  +-- Privilege escalation detection in validate.js

Layer 3: Authentication
  +-- JWT Bearer token verification
  +-- User existence and isActive checks
  +-- Deactivated user audit logging

Layer 4: Authorization
  +-- requireRole RBAC middleware
  +-- Unauthorized access audit logging
  +-- Cross-hostel isolation in service layer

Layer 5: Data Protection
  +-- passwordHash select:false in schema
  +-- userSerializer strips sensitive fields
  +-- Connection string redaction in logs
  +-- Self-approval guards (expenses, cleaning verification)

Layer 6: Audit Trail
  +-- SecurityAuditLog for security events
  +-- Complaint audit log (assignments, escalations, resolutions)
  +-- Work order audit log
  +-- Asset movement audit log
  +-- Expense approval audit log
```

---

## 7. Testing Architecture

```
Test Runner: node:test (native, zero dependencies)
Assertions: node:assert/strict

Test Pattern:
  1. Set NODE_ENV=test, JWT_SECRET, JWT_EXPIRES_IN
  2. Connect to TEST_MONGODB_URI (isolated test database)
  3. Import app.js (Express app without server.listen)
  4. Start ephemeral HTTP server on port 0 (random available port)
  5. Use native fetch() for HTTP assertions
  6. Clean up: close server, disconnect DB

Test Isolation:
  - Each test suite uses its own database connection
  - Collections are created/dropped per suite
  - port 0 prevents port conflicts between parallel suites

Concurrency: --test-concurrency=1 (sequential execution for DB safety)
```

---

## 8. Build and Development Pipeline

### Development Setup
```bash
# 1. Clone and install
git clone <repo>
cd BBDU-Hosteller
cd backend && npm install
cd ../frontend && npm install

# 2. Configure environment
cp backend/.env.example backend/.env    # Edit MongoDB URI and JWT secret
cp frontend/.env.example frontend/.env  # Optional in dev (proxy handles it)

# 3. Start MongoDB (local or Atlas)
mongod                                  # or configure Atlas URI in .env

# 4. Seed demo data
cd backend && npm run seed

# 5. Start development servers
cd backend && npm run dev               # Node --watch on port 5000
cd frontend && npm run dev              # Vite on port 5173 with /api proxy
```

### Verification Commands
```bash
cd backend && npm test                  # 248 tests, 20 suites
cd backend && npm run db:check          # Model and index verification
cd frontend && npm run build            # Production bundle (dist/)
```

### Production Build
```bash
cd frontend && npm run build            # Outputs to frontend/dist/
cd backend && npm start                 # node server.js (no --watch)
```

### Pilot Deployment Boundary (Single-Hostel MVP)
For the initial field pilot (DEC-015), the operational surface is constrained to a single hostel or block focusing solely on Complaint-to-Resolution:
- Active: Authentication, Location hierarchy, Complaints lifecycle, SLA countdown & reminder warnings, Staff work logs, Student verification loop.
- Deferred: Finance, Asset lifecycle, Mess menus, Cleaning tasks, Outpass passes, and AI Command Center are held behind navigation/deployment boundaries.

---

## 9. Key Technical Decisions That Shaped Performance

| Decision | Why | Impact |
|:---|:---|:---|
| First pilot scoping | Validates core complaint workflow in 1 block | Reduces deployment risk, avoids premature executive escalation |
| Express 5 over Express 4 | Native async error handling, cleaner middleware | Eliminates need for extensive asyncHandler usage |
| Native node:test over Jest | Zero dependency bloat, faster boot, smaller install | 248 tests run without any test framework dependency |
| Single scheduler loop | One setInterval instead of per-feature timers | No orphan timers, single monitoring point, idempotent |
| Frozen constants | Object.freeze prevents accidental mutation | Runtime safety across 14 constant files |
| select:false on passwordHash | Schema-level protection, not just serializer | Even direct queries exclude hashes by default |
| Zod over Joi | Smaller bundle, TypeScript-first design, better errors | Cleaner validation with minimal overhead |
| Tailwind v4 Vite plugin | CSS-first config, no tailwind.config.js | Faster builds, simpler setup |
| Mongoose 9 with initModels() | Guaranteed index creation before traffic | Prevents unique constraint race conditions on first deploy |
| Human-readable IDs | CMP-2026-00001 vs ObjectId hex | Users and staff can reference tickets verbally |
| Deterministic AI over LLM | No API key needed, predictable outputs | Works offline, no cost, explainable results |
| Calendar-safe date math | Custom dateUtils.js for month boundaries | Prevents Feb 31 bugs in maintenance scheduling |
| Compound unique constraints | { studentId, messId, mealDate, mealType } | Database-level duplicate prevention, no application logic needed |
| URI redaction in db.js | Regex scrub credentials from all log output | Prevents accidental credential exposure in error logs |

---

## 10. Dependency Graph

### Backend Dependencies (10 production)
```
express@5.2.1          - HTTP framework
mongoose@9.10.4        - MongoDB ODM
zod@4.6.5              - Schema validation
bcryptjs@3.0.3         - Password hashing
jsonwebtoken@9.0.3     - JWT signing/verification
helmet@8.3.0           - HTTP security headers
cors@2.8.6             - Cross-origin resource sharing
express-rate-limit@8.7.0 - Request rate limiting
morgan@1.12.1          - HTTP request logging
dotenv@18.0.5          - Environment variable loading
```

### Frontend Dependencies (4 production, 4 dev)
```
Production:
  react@19.3.0           - UI library
  react-dom@19.3.0       - DOM renderer
  react-router-dom@7.18.4 - Client-side routing
  axios@1.20.0           - HTTP client

Dev:
  vite@8.3.2             - Build tool and dev server
  @vitejs/plugin-react@6.1.1 - React HMR and JSX transform
  tailwindcss@4.3.3      - Utility-first CSS
  @tailwindcss/vite@4.3.3 - Tailwind Vite integration
```

Zero external test dependencies. Zero linting dependencies committed (can be added).

---

## 11. What Is NOT Yet Built

| Feature | Current State | Recommended Approach |
|:---|:---|:---|
| File uploads | No multer, no cloud storage | Multer + Cloudinary or AWS S3 |
| Real-time updates | REST polling only | Socket.IO or Server-Sent Events |
| Real LLM integration | Keyword-based NL matching | Google Gemini 2.0 Flash API |
| Email/SMS notifications | In-app only | Nodemailer + SMTP or Twilio |
| PWA support | No manifest or service worker | Vite PWA plugin |
| Docker | No containerization | Multi-stage Dockerfile + docker-compose |
| CI/CD | No pipeline | GitHub Actions: lint, test, build, deploy |
| Monitoring | Console logging only | Winston/Pino + health check endpoint |
| Search | Basic string matching | MongoDB Atlas Search or text indexes |
| Pagination | Implemented per-endpoint | Could be standardized into shared middleware |
