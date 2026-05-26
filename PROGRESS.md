# PROGRESS — E-Commerce Production

> Multi-vendor e-commerce backend (Amazon/Flipkart pattern). NestJS-style modular monolith. No monorepo.

---

## 🏗️ Final Architecture

```
e-commerce-production/
├── services/                      ← ALL BACKEND (single Node app, modular)
│   ├── server.ts                  ← entry (root, NOT in src/)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── app.ts                 ← Express app factory (Netflix-grade middleware order)
│   │   ├── @types/
│   │   │   └── express.d.ts       ← req.id, req.user, req.log augmentation
│   │   ├── config/
│   │   │   └── env.ts             ← zod-validated env (fail-fast)
│   │   ├── db/
│   │   │   └── prisma.ts          ← Prisma singleton + event logging
│   │   ├── interfaces/
│   │   │   └── api-response.ts    ← ApiResponseBuilder + types
│   │   ├── lib/
│   │   │   ├── redis.ts           ← Upstash + RateLimiters
│   │   │   ├── password.ts        ← PasswordService class (bcrypt)
│   │   │   └── tokens.ts          ← TokenService class (JWT + Redis sessions)
│   │   ├── mails/                 ← (future) React Email templates
│   │   ├── middlewares/
│   │   │   ├── async-handler.ts
│   │   │   ├── error-handler.ts   ← AppError + Zod + Prisma + JWT
│   │   │   ├── require-auth.ts    ← AuthGuard class
│   │   │   ├── validate.ts        ← zod validators
│   │   │   ├── rate-limit.ts      ← Upstash backed
│   │   │   └── security.ts        ← permissions-policy, no-store, request-id, response-time, HPP
│   │   ├── modules/
│   │   │   └── auth/              ← FULL NestJS-style feature module
│   │   │       ├── auth.controller.ts
│   │   │       ├── auth.service.ts
│   │   │       ├── auth.repository.ts
│   │   │       ├── auth.routes.ts
│   │   │       └── auth.validator.ts
│   │   ├── queues/                ← (future) BullMQ producers
│   │   ├── workers/               ← (future) BullMQ + Kafka consumers
│   │   └── utils/
│   │       ├── errors.ts          ← AppError hierarchy (12 classes)
│   │       ├── logger.ts          ← Logger class (Pino wrapper)
│   │       └── http-status.ts     ← HttpStatus + ErrorCode constants
│   ├── tests/                     ← (future) Vitest
│   ├── .env.example
│   ├── .gitignore
│   ├── .prettierrc.json
│   ├── .prettierignore
│   ├── eslint.config.mjs
│   ├── package.json
│   └── tsconfig.json
├── web/                           ← (future) Next.js 16 frontend
└── docker-compose.yml             ← Postgres + Redis + Upstash emulator
```

---

## 🎯 Design Principles (Industry standard for Express ecosystem)

| Layer | Responsibility | Pattern |
|---|---|---|
| **Routes** | URL → middleware → controller | `Router()` |
| **Validator** | Zod schemas (DTOs) | schema objects |
| **Controller** | HTTP req/res ↔ Service | named `async function` exports |
| **Service** | Business logic | named `async function` exports |
| **Repository** | DB queries | named `async function` exports |
| **Lib (tokens, password)** | Reusable utilities | named function exports |
| **Middlewares** | Cross-cutting | named functions |
| **Errors** | Typed error hierarchy | **`class AppError`** + 12 subclasses |
| **Logger** | Structured logging | singleton (Pino instance) |

**Why function-based for most things?**
- Express middleware ARE functions — class wrapper is indirection
- Stateless: no `this` confusion, no constructor DI ceremony
- `import * as authService from "./auth.service"` clean grouping
- Test mocking: `jest.mock("./auth.repository")` simpler than class mocks
- Aligns with Express community standard (Stripe SDK, Vercel, Cal.com)

**Why class-based for Errors?**
- `instanceof AppError` is the IDIOMATIC way to discriminate error types
- Sentry/Datadog auto-classify by class name (analytics grouping)
- Inheritance — common fields in `AppError`, specifics in subclasses
- Native `Error.captureStackTrace` works best with classes

**NestJS uses classes everywhere** because of its DI container. Plain Express has no DI — so functions win on simplicity.

---

## 🛡️ Security Stack (Netflix/Uber-grade)

Middleware order in `app.ts`:

1. **Express hardening** — `x-powered-by` disabled, `etag` disabled, `trust proxy`
2. **Helmet** — CSP (prod), HSTS, COOP, CORP, X-Frame-DENY, Referrer-Policy
3. **Permissions-Policy** — camera/mic/geo/FLoC blocked
4. **No-store cache** — sensitive responses CDN/proxy leak prevention
5. **Request ID** — distributed tracing (X-Request-Id, child logger)
6. **Response time** — X-Response-Time header for APM (SLO/SLI)
7. **CORS** — whitelist origins, credentials, preflight 24h
8. **Compression** — gzip 70% reduction
9. **Body parsers** — 1mb limit (DoS prevention)
10. **Cookie parser**
11. **HPP prevention** — `?id=1&id=2` array → single value
12. **Morgan → Pino** — structured request logging
13. **Routes** — `/api/v1/*`
14. **404 handler**
15. **Error handler** — AppError + Zod + Prisma + JWT auto-mapped

---

## 🔐 Auth Module (Complete)

**Endpoints** (all under `/api/v1/auth`):
- `POST /register` — public, rate-limited, creates user + vendor profile if VENDOR
- `POST /login` — public, rate-limited, same error for "no user" + "wrong pwd"
- `POST /refresh` — token rotation (OWASP), reuse detection kills all sessions
- `POST /logout` — protected, revokes current session
- `POST /logout-all` — protected, revokes all device sessions
- `GET /me` — protected, safe user fields only
- `POST /change-password` — protected, revokes all sessions after change

**Security:**
- JWT access (15m) + refresh (30d) — hybrid stateless/stateful
- Refresh tokens stored in Redis — revocable
- bcrypt 12 rounds
- Token rotation on every refresh
- Reuse detection = aggressive: kill ALL sessions (theft signal)
- Issuer/audience JWT claims

**Error classes used:**
- `EmailExistsError` (409)
- `InvalidCredentialsError` (401)
- `AccountSuspendedError` (403)
- `InvalidTokenError` (401)
- `SessionRevokedError` (401)
- `NotFoundError` (404)

---

## 🚀 Setup Steps (Tumhe karna hai)

```bash
# 1. services/ folder me jao
cd services

# 2. Dependencies install
pnpm install
# ya: npm install

# 3. .env banao
cp .env.example .env
# Edit karke JWT secrets generate karo:
# openssl rand -base64 64

# 4. Docker start (Postgres + Redis + Upstash emulator)
cd ..
docker-compose up -d

# 5. Database setup
cd services
pnpm db:generate    # Prisma client generate
pnpm db:push        # schema → DB push (dev mode)
pnpm db:seed        # admin@shop.local / Admin@12345

# 6. Server chalao
pnpm dev            # http://localhost:4000

# 7. Test
curl http://localhost:4000/api/v1/health

curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test@1234","name":"Test User"}'
```

---

## 📋 Next Phase TODOs

### Modules to add (same NestJS-style pattern):
- [ ] **users** — profile, addresses (`/api/v1/users`)
- [ ] **products** — CRUD, search, vendor scoped
- [ ] **vendors** — onboarding, KYC, payouts
- [ ] **cart** — Redis-backed (fast, ephemeral)
- [ ] **orders** — state machine, transactions
- [ ] **payments** — Razorpay/Stripe
- [ ] **uploads** — ImageKit/Cloudinary presigned URLs
- [ ] **search** — Meilisearch index
- [ ] **reviews** — products + vendor ratings
- [ ] **notifications** — web push + SMS

### Cross-cutting:
- [ ] OTP login (phone)
- [ ] OAuth (Google/Apple)
- [ ] Email verification flow (mails/)
- [ ] BullMQ workers (email send, search index sync)
- [ ] Kafka producer/consumer for order events
- [ ] WebSocket gateway (live order tracking, vendor chat)
- [ ] Sentry integration
- [ ] OpenTelemetry tracing
- [ ] Multi-stage Dockerfile
- [ ] GitHub Actions CI

---

## 📝 Session History

### Session 2 — 2026-05-25 (rebuild)
- ❌ Monorepo deleted (Turborepo, packages/, apps/ — all gone)
- ✅ `services/` single Node backend - NestJS-style folder layout
- ✅ `server.ts` at services root (not in src/)
- ✅ Netflix-grade middleware stack in `app.ts`
- ✅ Auth module complete

### Session 3 — 2026-05-25 (pattern refinement)
- 🔄 Converted to **function-based** (industry-standard for Express):
  - `logger` → singleton Pino instance (was: `class Logger`)
  - `tokens` → named function exports (was: `class TokenService`)
  - `password` → `hashPassword`, `verifyPassword`, `needsRehash` (was: `class PasswordService`)
  - `require-auth` → `requireAuth`, `optionalAuth`, `requireRole`, `requireOwnership` (was: `class AuthGuard`)
  - `auth.repository` → named function exports (was: `class AuthRepository`)
  - `auth.service` → named function exports (was: `class AuthService`)
  - `auth.controller` → named function exports (was: `class AuthController`)
- ✅ **Errors KEPT class-based** — `AppError` + 12 subclasses (only place classes belong in Express)
- ✅ Routes use `import * as authController` pattern (cleaner grouping)

**Next session start:** Run setup steps → build `modules/users` or `modules/products` next, same function-based pattern.
