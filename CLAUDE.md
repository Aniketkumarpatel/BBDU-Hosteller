# CLAUDE.md

Read `report.md`, `architecture.md`, and `decision.md` in full before starting any task.
Every value, pattern, and convention comes from those files. No inventing.
If something is not covered there, ask the user rather than choosing for yourself.
When you have finished, check your own output against these reference files, fix what fails, and only then show the user.

---

## Session Protocol

1. Read this file at the start of every session. No exceptions.
2. Read `report.md` for full system knowledge: every feature, model, service, route, and test.
3. Read `architecture.md` for the technical pipeline, folder structure, and design patterns.
4. Read `decision.md` for prior decisions and constraints. Never contradict a recorded decision without explicitly flagging it.

---

## Working Rules

### Workflow Contract

1. The user will provide research material, screenshots, or requirements.
2. You must rigorously enhance research into a working plan, or a wireframe into an enhanced design, with explicit warnings and guidance on risks.
3. Implementation proceeds step by step, one step at a time, so that efficiency and quality are maintained. Never batch multiple unrelated changes.

### Quality Standards

1. **Quality over speed.** Understand the instruction and the underlying problem fully before acting. Deliver the best and most correct solution, not a shortcut or "minimal working" fix, unless the user explicitly asks for minimal.
2. **Plan before generating.** Do not produce final output directly. Present the approach and plan first, get explicit confirmation, then generate the result.
3. **Efficient file analysis.** Analyze files thoroughly and precisely, but read only the relevant parts. Avoid re-reading files unnecessarily or burning tokens on irrelevant sections.
4. **Token-conscious output.** Keep responses and generated output efficient. No filler, no repetition, no unnecessary verbosity, but never at the cost of quality or completeness.
5. **Independent, well-scoped prompts/tasks.** When defining a task (including sub-agent prompts): state the problem and expected solution clearly, give enough context and independence to make good decisions without hand-holding, keep it token-efficient, and expect a complete result, not a half-baked one.
6. **Current, real information only.** For research, planning, and technical discussion, use the best and most up-to-date solution and information available. No generic, outdated, or "good enough" answers.
7. **Never use an em dash** in any content. Use a hyphen (-) or restructure the sentence.
8. **Professional disagreement required.** Do not act like a friend or default to agreeing with the user's opinion or suggestion. If the user's idea, suggestion, or approach is wrong, say so directly and explain why, then give the correct alternative. Never rubber-stamp a flawed idea to avoid friction.
9. **Production-grade discipline.** This is treated as a live production system with real operational impact. Be careful and professional on every change; nothing experimental lands without explicit care and approval.
10. **No guessing.** Never predict or guess an answer from general prior knowledge. Check real references and do research, then choose logically what is right or wrong for this specific codebase.
11. **Decision logging mandatory.** For every important task, update `decision.md` explaining why a decision was made over alternatives. Skip this only for trivial tasks (fixing a typo, formatting).
12. **Report completed work.** After completing any task, update `report.md` with what was done, what was verified, and any follow-up items.
13. **Always pull before push.** Always run `git pull --rebase origin <branch>` before executing `git push`. Never attempt a blind push without synchronizing remote commits first.

### Code Conventions (This Project)

- Backend: Node.js 22+, Express 5, ES Modules (`import/export`), Mongoose 9, Zod validation
- Frontend: React 19, Vite 8, Tailwind CSS v4 (plugin-based), React Router 7
- Testing: Native `node:test` and `node:assert/strict` only. No Jest, Mocha, or Vitest.
- Error handling: All errors go through `ApiError` class and centralized `errorHandler` middleware
- Auth pattern: `requireAuth` then `requireRole(...roles)` middleware chain
- Response shape: Always `{ success: true/false, data/message, ... }`
- ID format: Human-readable sequential IDs (`CMP-2026-00001`, `WO-2026-00001`, etc.)
- Security: `passwordHash` is `select: false`, NoSQL injection sanitizer active, Helmet hardened headers
- Scheduler: Single 60-second `setInterval` loop handles all background jobs (SLA, maintenance, cleaning, outpass)
- No em dashes anywhere in generated content

### File Modification & Git Rules

- Never delete or modify existing comments and docstrings unrelated to your change
- Never refactor surrounding code unless explicitly asked
- One concern per commit. Do not mix unrelated changes.
- Run `npm test` in backend after any backend change
- Run `npm run build` in frontend after any frontend change
- Always pull before push: `git pull --rebase origin main` before `git push origin main`

