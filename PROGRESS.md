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

| Layer                      | Responsibility                | Pattern                              |
| -------------------------- | ----------------------------- | ------------------------------------ |
| **Routes**                 | URL → middleware → controller | `Router()`                           |
| **Validator**              | Zod schemas (DTOs)            | schema objects                       |
| **Controller**             | HTTP req/res ↔ Service        | named `async function` exports       |
| **Service**                | Business logic                | named `async function` exports       |
| **Repository**             | DB queries                    | named `async function` exports       |
| **Lib (tokens, password)** | Reusable utilities            | named function exports               |
| **Middlewares**            | Cross-cutting                 | named functions                      |
| **Errors**                 | Typed error hierarchy         | **`class AppError`** + 12 subclasses |
| **Logger**                 | Structured logging            | singleton (Pino instance)            |

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

---

### Session 4 — 2026-05-29 (Seller Portal v2 — Amazon-style isolation)

**What changed (major refactor — seller is now a fully separate portal):**

#### 1. Route group restructure (`web/src/app/`)

```
(shop)/    → customer storefront (SiteHeader + CategoryBar)
(seller)/  → seller portal (minimal SellerHeader, no shop chrome)
(auth)/    → centered sign-in/sign-up card
```

Root `layout.tsx` ab sirf providers (ThemeProvider, QueryProvider, NuqsAdapter, Toaster). Har route group apna chrome decide karta hai.

#### 2. `features/seller/` — auth ke jaisa modular structure

```
web/src/features/seller/
├── validators/    account.ts, shop.ts, bank.ts (Zod schemas)
├── constants/     countries.ts, constants.ts
├── hooks/         use-onboarding-status, use-seller-me, use-seller-params,
│                  use-upgrade-to-seller, use-setup-shop, use-connect-bank
├── server/        params-loader.ts (nuqs URL state SSOT)
└── components/    seller-header, stepper, step-account, step-verify,
                   step-upgrade, step-shop, step-bank, step-complete,
                   step-blocked, onboarding-wizard
```

App routes (`(seller)/become-seller/page.tsx`) ab thin shells.

#### 3. Amazon-style auto-seller (no admin gating)

- Anon `/auth/seller/register` → User w/ `role=VENDOR` directly (no admin)
- Customer → Seller upgrade → automatic role flip
- `VendorProfile.status=PENDING_REVIEW` ab **non-blocking flag** — seller instantly portal use kar sakta hai. "You're live! Quality review in progress" badge.

#### 4. **Separate seller cookies (security isolation — Amazon Seller Central pattern)**

| Jar      | Cookies                  | Refresh path          |
| -------- | ------------------------ | --------------------- |
| Customer | `at`, `rt`, `csrf`       | `/api/v1/auth`        |
| Seller   | `s_at`, `s_rt`, `s_csrf` | `/api/v1/auth/seller` |

**Why:** seller session theft can't compromise shop session (different sid in Redis, different rotation chain). Logout of one portal doesn't drop the other. Customer + seller can be active simultaneously on same User row.

**Backend changes:**

- `utils/cookies.ts` — sab helpers scope-aware (`AuthScope = "customer" | "seller"`). Default `customer` backward-compatible.
- `middlewares/require-auth.ts` — `requireSellerAuth` (reads `s_at`, enforces VENDOR) + `requireAnyAuth` (dual-jar fallback for `/onboarding-status`)
- `middlewares/csrf.ts` — factory-based, `requireCsrf` (customer) + `requireSellerCsrf` (seller)
- `modules/auth/seller-auth.controller.ts` + `seller-auth.routes.ts` — `/api/v1/auth/seller/{register,verify-otp,resend-otp,login,refresh,logout,me}`
- `modules/vendor/vendor.service.upgradeToSeller` — customer session NOT revoked anymore; mints fresh seller session for s\_\* cookies
- `modules/vendor/vendor.routes.ts` — `setup-shop` + `connect-bank` use `requireSellerAuth`/`requireSellerCsrf`
- `@types/express.d.ts` — `req.authScope?: AuthScope`

**Frontend changes:**

- `lib/seller-auth/api.ts` — fully separate fetch client (own CSRF memory, hits `/auth/seller/refresh`)
- `features/seller/hooks/use-seller-me.ts` — TanStack Query on `/auth/seller/me`
- `lib/seller/api.ts` — `setupShop`/`connectBank`/`getStatus` ab `sellerHttp`. `upgradeToSeller` still customer client (called from customer-cookie context).
- Wizard considers BOTH seller-me + customer-me to pick initial step

#### 5. nuqs URL state + React 19 cascading-render fix

- `features/seller/server/params-loader.ts` — courses pattern mirror
- `features/seller/hooks/use-seller-params.ts` — client hook
- Wizard old `useState + useEffect setState` chain → `useMemo` derive + async `setSellerParams`. Refresh-resilient + shareable links + warning gone.

**Files touched:**

- Backend: `utils/cookies.ts`, `middlewares/require-auth.ts`, `middlewares/csrf.ts`, `modules/auth/seller-auth.{controller,routes}.ts` (NEW), `modules/vendor/{service,controller,routes}.ts`, `app.ts`, `@types/express.d.ts`
- Frontend: `app/layout.tsx`, `features/seller/**`, `lib/seller-auth/api.ts` (NEW), `lib/seller/api.ts`

**Open / next session:**

1. **`/seller/dashboard` route** — placeholder link in step-complete. Should list products/orders/payouts, show non-blocking "Quality review" banner if status=PENDING_REVIEW.
2. **`/seller/sign-in`** — dedicated page for returning sellers (current step-verify fallback goes to wizard, not ideal).
3. **Customer JWT role staleness** — post-upgrade, customer `at` cookie still says `role=CUSTOMER` for up to 15min (until refresh re-reads DB). Older claim grants less access → safe but worth UX note.
4. **`NEXT_PUBLIC_API_URL` centralization** — duplicated in `lib/api.ts` and `lib/seller-auth/api.ts`.
5. **Stripe Connect** — bank step `stripe` mode still stub.
6. **Pre-existing typecheck noise** (NOT introduced this session): `prisma/seed.ts:11`, `rate-limit.ts:32`, `auth.service.ts:{188,303,355}` null-vs-string, `web/components/ui/calendar.tsx:90`.

---

### Session 5 — 2026-05-30 (True subdomain isolation + scoped secrets)

User-reported issues addressed:

1. DevTools mein customer (`at/rt/csrf`) aur seller cookies dono har page pe dikh rahi thi.
2. `.env` mein `JWT_SELLER_*` + `SELLER_CSRF_SECRET` declare the but code use nahi kar raha tha.
3. Stepper bottom spacing + terminal-step vertical centering.

#### A. Descriptive seller cookie names

`s_at / s_rt / s_csrf` → **`seller-access-token` / `seller-refresh-token` /
`seller-csrf-token`** (DevTools mein clearly readable). Frontend
`lib/seller-auth/api.ts` cookie regex updated to match.

#### B. Scoped JWT + CSRF secrets (cryptographic isolation)

Pehle seller tokens customer secret se sign ho rahe the. Ab:

- `env.ts` — `JWT_SELLER_ACCESS_SECRET`, `JWT_SELLER_REFRESH_SECRET`,
  `SELLER_CSRF_SECRET` (all optional → fall back to customer secrets in dev).
- `lib/tokens.ts` — `accessSecret(scope)` / `refreshSecret(scope)` helpers;
  `signAccess` / `signRefresh` / `verifyAccessToken` / `verifyRefreshToken` /
  `createSession` / `rotateSession` sab `scope` param lete hai.
- `utils/cookies.ts` — `csrfSecret(scope)`; `generateCsrfToken` /
  `verifyCsrfToken` / `setCsrfCookie` / `emitCsrfHeader` scope-aware.
- Wiring: `auth.service.login` + `refreshTokens` accept scope;
  `seller-auth.controller` passes `"seller"`; `requireSellerAuth` +
  `requireAnyAuth` + csrf middleware verify with the right secret.
- Net effect: ek secret leak hone par doosri surface ke tokens forge nahi ho
  sakte (Stripe Connect-style key family separation).

#### C. **True cookie-jar isolation via subdomain + same-origin proxy**

Root cause samjha: cookies us HOST se bind hoti hai jo browser response mein
dekhta hai. Browser ko `localhost:8080` (backend) directly call karne se SAARI
cookies `localhost` ke neeche aati thi → dono jar har jagah dikhti thi.

Amazon/Flipkart pattern = **alag host per portal + same-origin BFF proxy**:

- `web/next.config.ts` — rewrites `/api/:path*` → `API_PROXY_TARGET`
  (`http://localhost:8080`). Browser ab same-origin `/api/v1/*` call karta hai.
- Browser clients (`lib/api.ts`, `lib/seller-auth/api.ts`,
  `google-auth-button.tsx`) → **relative** base `/api/v1` (was absolute).
- `lib/auth/server.ts` (RSC fetcher) → `INTERNAL_API_URL` (absolute, server-only).
- `web/src/proxy.ts` (NEW — Next.js 16 `proxy` convention, see Session 6 note)
  — host-based routing:
  - `seller.localhost:3000/` → rewrite to `/become-seller`
  - shop-only path on seller host → redirect to shop host (and vice versa)
  - `(auth)` pages (`/sign-in` etc.) shared on both hosts (no bounce)
- `lib/portal-urls.ts` (NEW) — `shopUrl()` / `sellerUrl()` for cross-host
  links. Seller header "Back to shop", step-complete, step-blocked ab plain
  `<a href>` cross-origin (clean jar switch), not next/link.
- `*.localhost` auto-resolves to 127.0.0.1 (RFC 6761) — no hosts edit.

Result: `localhost:3000` pe sirf customer cookies, `seller.localhost:3000` pe
sirf seller cookies — exactly like the nx-monorepo screenshot.

**Files touched (Session 5):**

- Backend: `config/env.ts`, `lib/tokens.ts`, `utils/cookies.ts`,
  `middlewares/require-auth.ts`, `middlewares/csrf.ts`,
  `modules/auth/auth.service.ts`, `modules/auth/seller-auth.controller.ts`,
  `modules/vendor/vendor.service.ts`, `.env` (CORS both hosts)
- Frontend: `next.config.ts`, `src/proxy.ts` (NEW; was `middleware.ts`, renamed
  in Session 6), `lib/portal-urls.ts` (NEW), `lib/api.ts`,
  `lib/seller-auth/api.ts`, `lib/auth/server.ts`,
  `features/auth/components/google-auth-button.tsx`,
  `features/seller/components/{seller-header,step-complete,step-blocked,onboarding-wizard}.tsx`,
  `.env.example`

**Open / next session (updated):**

1. **`/seller/dashboard`** — still a placeholder link; build the real page.
2. **`/seller/sign-in`** — dedicated returning-seller login (sets seller jar).
   Currently step-account's "Login" link → shared `/sign-in` (customer jar).
3. **Customer JWT role staleness** — post-upgrade `at` cookie role lags ≤ access TTL.
4. **Prod cookie domains** — set `COOKIE_DOMAIN` per host or rely on host-only;
   verify SameSite when shop + seller are real subdomains of `eshop.com`.
5. **OAuth callback + proxy** — Google callback hits backend directly
   (`localhost:8080/.../callback`); confirm cookie host is correct under proxy.
6. **Stripe Connect** — bank step `stripe` mode still stub.
7. **Pre-existing typecheck noise** (NOT from these sessions): `prisma/seed.ts:11`,
   `rate-limit.ts:32`, `auth.service.ts:{188,303,355}`, `web/components/ui/calendar.tsx:90`.

**Next session start:**

```bash
cd services && pnpm dev    # http://localhost:8080
cd web && pnpm dev         # serves BOTH hosts on :3000

# Shop:   http://localhost:3000
# Seller: http://seller.localhost:3000   (*.localhost auto-resolves)

# Smoke test isolation:
# 1. Open seller.localhost:3000 → register → OTP → verify
#    DevTools (seller.localhost): ONLY seller-access-token / -refresh-token / -csrf-token
#    DevTools (localhost):        ONLY customer at/rt/csrf — no seller cookies
# 2. Customer signed in on localhost:3000, click "Sell on Eshop" → seller.localhost
#    → upgrade → seller cookies set under seller.localhost ONLY
```

---

### Session 6 — 2026-05-30 (Phone verification — SMS OTP)

`phoneVerified` column ab actually use hota hai. Reused the existing OTP core
(identifier-based) — phone bas ek namespaced identifier (`phone:+91...`) hai, so
all the brute-force protection (lockout, timing-safe compare, atomic attempts,
cooldown, spam-lock) free mili.

#### Backend

- `lib/sms.ts` (NEW) — provider-agnostic SMS, mirrors `mailer.ts`:
  - `SMS_PROVIDER=console` (dev) → OTP terminal me print, zero config
  - `SMS_PROVIDER=twilio` (prod) → Twilio REST via `fetch` (NO `twilio` SDK dep)
- `config/env.ts` — `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER/MESSAGING_SERVICE_SID`
- `auth.helper.ts` — `sendOtpSms()` orchestrator + `verifyPhoneOtp()` (phone
  identifier namespacing keeps counters separate from email OTP)
- `auth.repository.ts` — `phoneExists(phone, excludeUserId)`, `updateUserPhone`
  (resets phoneVerified), `markPhoneVerified`
- `auth.validator.ts` — `sendPhoneOtpSchema` (optional E.164 phone),
  `verifyPhoneOtpSchema` (6-digit otp)
- `auth.service.ts` — `sendPhoneOtp(userId, {phone?})` (set/change + uniqueness +
  idempotent if already verified), `verifyPhoneOtpForUser(userId, {otp})` →
  stamps phoneVerified
- `auth.controller.ts` — `sendPhoneOtp` / `verifyPhoneOtp` handlers
  (scope-agnostic, only `req.user.sub`, no cookie writes → safe to share both jars);
  `maskPhone()` so responses never echo the full number
- Routes (same handlers, jar-specific middleware):
  - Customer: `POST /api/v1/auth/phone/{send-otp,verify}` (requireAuth + requireCsrf)
  - Seller: `POST /api/v1/auth/seller/phone/{send-otp,verify}` (requireSellerAuth + requireSellerCsrf)

#### Frontend

- `lib/seller-auth/api.ts` — `sendPhoneOtp({phone?})` / `verifyPhoneOtp({otp})`
- `features/seller/hooks/use-phone-verification.ts` (NEW) — send/verify mutations
  (for future dashboard "verify phone" use)
- `features/seller/components/otp-verify-card.tsx` (NEW) — reusable 6-digit OTP
  card (input + auto-submit + resend cooldown + error reset)
- `features/seller/components/step-verify.tsx` — refactored to **2 phases**:
  email OTP → (auto sign-in) → phone OTP → onDone. Both are sub-states of
  node 1 "Create Account" (matches the "Email + phone verified upfront" hint).
  Phone send failure is non-blocking (skip → verify later from dashboard).

**Flow now:** register (phone stored) → email OTP → auto-login (seller cookies)
→ SMS OTP auto-sent → verify phone → shop setup. Dev: OTP terminal me dikhega.

**Files touched (Session 6):**

- Backend: `lib/sms.ts` (NEW), `config/env.ts`, `modules/auth/auth.helper.ts`,
  `auth.repository.ts`, `auth.validator.ts`, `auth.service.ts`, `auth.controller.ts`,
  `auth.routes.ts`, `seller-auth.routes.ts`, `.env`
- Frontend: `lib/seller-auth/api.ts`, `features/seller/hooks/use-phone-verification.ts`
  (NEW), `features/seller/components/otp-verify-card.tsx` (NEW), `step-verify.tsx`

**Open / next session (updated):**

1. **Customer-side phone verify UI** — backend endpoints ready
   (`/auth/phone/*`); add a settings/profile component using
   `use-phone-verification` pattern.
2. **`/seller/dashboard`** — build it; show "Verify phone" prompt if
   `phoneVerified` null.
3. **`/seller/sign-in`**, **prod cookie domains**, **OAuth+proxy**,
   **Stripe Connect** — carried over from Session 5.
4. **Twilio prod creds** — set `SMS_PROVIDER=twilio` + `TWILIO_*` when going live.
5. **Pre-existing typecheck noise** (NOT from these sessions): `prisma/seed.ts:11`,
   `rate-limit.ts:32`, `auth.service.ts:{188,303,355}`, `web/components/ui/calendar.tsx:90`.

**Phone verify smoke test:**

```bash
# SMS_PROVIDER=console (default) → OTP services terminal me print hota hai
# 1. seller.localhost:3000 → register (phone bharo) → email OTP verify
# 2. Auto: SMS OTP bhejta hai → terminal me "SMS (dev console)" block dekho
# 3. Woh 6-digit code daalo → phone verified → shop setup
# DB: users.phoneVerified ab timestamp set (pehle NULL tha)
```

#### Also this session — Next.js 16 `middleware` → `proxy` migration

Next 16 ne `middleware.ts` ko deprecate karke **`proxy.ts`** kar diya (function
`middleware` → `proxy`, ab Node.js runtime, edge nahi). API same
(NextRequest/NextResponse, `config.matcher`). Migration:

- `web/src/middleware.ts` → **`web/src/proxy.ts`**, `export function proxy(...)`
- Codemod bhi hai: `npx @next/codemod@canary middleware-to-proxy .`
- Ref: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- NOTE: edge runtime chahiye to `middleware.ts` hi rakhna padega — humein host
  routing ke liye Node.js fine hai, so `proxy.ts` use kiya.

---

### Session 7 — 2026-05-30 (Seller dashboard shell + home)

Seller portal ka pura dashboard banaya — sidebar (Zustand-driven), header,
guarded shell layout, aur dashboard home (KPIs + AI insights + recent orders).
**Theme-aware** (shadcn design tokens, light + dark dono — koi hardcoded hex),
accent = `globals.css` ka `--primary`.

#### Sidebar (Zustand + shadcn, image-1 ke exact nav items)

- `features/seller/dashboard/store/use-sidebar-store.ts` (NEW) — Zustand
  `persist` store: desktop expand/collapse, localStorage-backed, `hydrated`
  flag for SSR-safe controlled state.
- `components/seller-sidebar-provider.tsx` (NEW) — binds the store to shadcn
  `<SidebarProvider open onOpenChange>` (controlled). Store = single source of
  truth; shadcn still owns mobile Sheet + keyboard shortcut + rail.
- `config/nav.ts` (NEW) — exact reference groups: **Main Menu** (Dashboard,
  Orders, Payments), **Products** (Create Product, All Products), **Events**
  (Create Event, All Events), **Controllers** (Inbox, Settings, Notifications),
  **Extras** (Discount Codes). Logout = footer action.
- `components/seller-dashboard-sidebar.tsx` (NEW) — shop avatar + name + status
  header, grouped nav (active = `bg-primary/10 text-primary`), profile dropdown
  footer (profile / settings / back-to-shop / logout). Collapses to icon-rail.

#### Header + shell

- `components/seller-dashboard-header.tsx` (NEW) — sticky; SidebarTrigger +
  greeting + inbox/notifications + ThemeToggle.
- `lib/seller-auth/server.ts` (NEW) — `getServerSeller()` + `requireSeller()`:
  reads `seller-access-token` cookie → `/auth/seller/me` → redirect to
  `/become-seller` if not a VENDOR session (server guard, no flash).
- Layout restructure:
  - `(seller)/layout.tsx` → thin pass-through
  - `(seller)/become-seller/layout.tsx` (NEW) → onboarding `SellerHeader`
  - `(seller)/seller/layout.tsx` (NEW) → guarded dashboard shell
    (SellerSidebarProvider + Sidebar + SidebarInset(header + children))

#### Dashboard home (`/seller/dashboard`)

- `components/stat-cards.tsx` (NEW) — KPI grid, trend deltas (emerald/rose)
- `components/ai-insights-panel.tsx` (NEW) — 3-column AI summary
  (Sales Trends / Inventory / Action Items), image-5 inspired
- `components/recent-orders-panel.tsx` (NEW) — order list + status pills
- `views/dashboard-view.tsx` (NEW) — composes heading (real shop name +
  status badge) + KPIs + insights + orders
- `components/coming-soon.tsx` (NEW) — placeholder; all 10 sidebar routes
  stubbed (`orders`, `payments`, `products`, `products/new`, `events`,
  `events/new`, `inbox`, `settings`, `notifications`, `discount-codes`) so the
  sidebar never 404s.
- `lib/utils.ts` — added `getInitials()`.

**REAL vs MOCK:** shop name + status come from the verified seller session
(real). KPIs, AI insights, and orders are clearly-marked MOCK — swap to
`/seller/stats`, `/seller/insights`, `/seller/orders` when those modules land.

**Files touched (Session 7):**

- Frontend only: `lib/seller-auth/server.ts` (NEW), `lib/utils.ts`,
  `features/seller/dashboard/**` (store, config, components, views — all NEW),
  `app/(seller)/layout.tsx`, `app/(seller)/become-seller/layout.tsx` (NEW),
  `app/(seller)/seller/layout.tsx` (NEW), `app/(seller)/seller/dashboard/page.tsx`,
  - 10 stub route pages under `app/(seller)/seller/*`

**Open / next session (updated):**

1. **Build real seller modules** — products (create/list, the image-1 form),
   orders, payments/payouts, events, discount-codes, inbox, notifications,
   settings. Backend `/vendors/*` + new `/seller/*` endpoints needed.
2. **Seller stats/insights/orders APIs** — replace dashboard mocks.
3. **`/seller/sign-in`** — returning-seller login page (sets seller jar).
4. Carried over: prod cookie domains, OAuth+proxy, Stripe Connect, Twilio creds,
   customer-side phone verify UI, pre-existing tsc noise.

#### Hotfix — access cookie path + seller sign-in

- **Bug:** seller/customer access cookie was scoped `path=/api/v1`, so the
  browser never sent it on PAGE/RSC requests (e.g. `/seller/dashboard`).
  `requireSeller()` saw no session → always redirected to `/become-seller`.
- **Fix:** `setAccessCookie` path `/api/v1` → **`/`** (standard access-token
  scope; sent on every request incl. RSC). Refresh cookie stays path-scoped.
  `clearAccessCookie` now clears both `/` + legacy `/api/v1`.
- **Seller sign-in (NEW)** — returning sellers had no way to re-auth:
  - `features/seller/validators/signin.ts`, `components/seller-signin-form.tsx`
  - `app/(seller)/seller-login/{page,layout}.tsx` (outside the guarded tree)
  - `proxy.ts` SELLER_PATHS += `/seller-login`
  - step-account "Login" + step-verify refresh-fallback → `/seller-login`
- ⚠️ After this change, existing sessions have a STALE `/api/v1` cookie →
  clear seller.localhost cookies once + restart backend + sign in fresh.

**Dashboard smoke test:**

```bash
cd services && pnpm dev
cd web && pnpm dev
# Onboard a seller (seller.localhost:3000 → register → verify → shop → bank)
# → step-complete "Go to seller dashboard" → /seller/dashboard
# Sidebar: image-1 items, collapse toggle persists (Zustand+localStorage),
# light/dark toggle works. No seller session → auto-redirect to /become-seller.
```

---

### Session 8 — 2026-05-30 (Dashboard polish + refresh-cookie proxy fix)

Four fixes after first dashboard run-through:

#### 1. Refresh cookie not stored (proxy drops deep-path Set-Cookie)

- **Bug:** `seller-refresh-token` (path `/api/v1/auth/seller`) never appeared in
  DevTools; only access + csrf (path `/`) survived. Same root cause behind the
  customer "Refresh token is required" 400s. The Next.js dev **rewrite proxy**
  does not reliably persist/forward Set-Cookie headers with a DEEP `Path` — only
  `Path=/` cookies make it through.
- **Fix:** `setRefreshCookie` / `clearRefreshCookie` path → **`/`** (both scopes).
  httpOnly so exposure is minimal. Cookie NAME (`rt` vs `seller-refresh-token`)
  - host still isolate the jars. TODO noted: re-scope once we move to a
    Route-Handler BFF proxy (which forwards Set-Cookie correctly via
    `getSetCookie()`).

#### 2. Sidebar header border misaligned with page header

- `SellerDashboardSidebar` `SidebarHeader` → **`h-14` + `border-b`** (removed the
  separate `SidebarSeparator`). Now both the sidebar header and the page header
  (`h-14 border-b`) share the same bottom-border line (y=56px).

#### 3. UserMenu → real Seller Dashboard link

- `components/user-menu.tsx`: the VENDOR-only item was `href="/vendor"` → now a
  cross-host `<a href={sellerUrl("/seller/dashboard")}>` (seller portal lives on
  the seller subdomain / separate cookie jar). Label "Seller Dashboard". Still
  gated by `isVendor` → hidden for non-vendors.

#### 4. Sidebar skeletons (UserMenu pattern)

- `use-seller-me.ts` — now accepts optional `initialData`.
- `SellerDashboardSidebar` no longer takes a `user` prop; it fetches via
  `useSellerMe()` and renders **`ShopBrandSkeleton`** (top) + **`ProfileSkeleton`**
  (bottom) on first mount, then real data (cached 5min) — exactly like the
  customer `UserMenu` skeleton behaviour. Layout still server-guards
  (`requireSeller`) and passes the user to the HEADER (instant greeting).
- `components/dashboard-skeleton.tsx` (NEW) + `app/(seller)/seller/dashboard/loading.tsx`
  (NEW) — full content skeleton (heading + 4 stat cards + insights/orders) shown
  on dashboard navigation.

**Files touched (Session 8):**

- Backend: `utils/cookies.ts` (refresh path `/`)
- Frontend: `components/user-menu.tsx`, `features/seller/hooks/use-seller-me.ts`,
  `features/seller/dashboard/components/seller-dashboard-sidebar.tsx`,
  `app/(seller)/seller/layout.tsx`,
  `features/seller/dashboard/components/dashboard-skeleton.tsx` (NEW),
  `app/(seller)/seller/dashboard/loading.tsx` (NEW)

**⚠️ One-time after this change:** existing sessions still hold the stale
deep-path refresh cookie → clear `seller.localhost` cookies once, restart
backend, sign in fresh via `/seller-login`. Then DevTools shows all three:
`seller-access-token`, `seller-refresh-token`, `seller-csrf-token` (all Path=`/`).

**Open / next session:**

1. **Build real seller modules** — products (image-1 create form), orders,
   payments, events, discount-codes, inbox, notifications, settings.
2. **Seller stats/insights/orders APIs** — replace dashboard mocks.
3. **Route-Handler BFF proxy** — replace Next `rewrites()` so Set-Cookie with
   scoped paths forwards correctly; then re-scope the refresh cookie.
4. Carried over: prod cookie domains, OAuth+proxy, Stripe Connect, Twilio creds,
   customer-side phone verify UI, pre-existing tsc noise.

---

### Session 9 — 2026-05-30 (Catalog backend — Product / Category / Discount / Uploads)

Pura product backend banaya — senior pattern (Routes → Validator → Controller →
Service → Repository), function-based, Hindi inline comments. Migration applied
(`20260530091816_add_catalog_product_models`). Naye files me zero tsc errors
(sirf pehle wala known noise bacha).

#### Prisma schema (catalog models)

- **Category** — self-referencing tree (`parentId`), 2-level (category →
  subcategory). Admin-managed, public read.
- **Product** — vendor-scoped. Fields: slug/title/brand, shortDescription
  (plain text), **description = TipTap HTML string `@db.Text` (JSON nahi)**,
  warranty, videoUrl, category+subcategory, `tags[]`/`colors[]`/`sizes[]`,
  pricing **minor units (Int)** regularPrice/salePrice + cached discountPercent,
  stock, cashOnDelivery, `specifications Json` (custom properties), bannerUrl,
  status (DRAFT/ACTIVE/ARCHIVED/OUT_OF_STOCK), publishedAt, SEO, denormalized
  counters (rating/sold/view), soft-delete `deletedAt`.
- **ProductImage** — gallery (1:N). `productId`+`variantId` dono optional:
  productId set = product gallery, variantId set = variant image (Edit-variant
  modal). Has key (storage cleanup), isPrimary, position, sizeBytes.
- **ProductVariant** — title/color/tags/sku/price/stock + apni images.
- **DiscountCode** — **ALAG table** (M:N with Product), seller-scoped,
  `@@unique([vendorId, code])`, type PERCENT/FLAT, value/minOrder/maxUses/
  perUserLimit/startsAt/endsAt/isActive.
- VendorProfile pe back-relations: `products`, `discountCodes`.

#### Object storage — R2 (primary) + S3 (future), one S3-compatible SDK

- `lib/storage.ts` (NEW) — `STORAGE_PROVIDER` env switch (r2|s3, default r2).
  `putObject` (server-processed buffer direct upload, CacheControl immutable),
  `createPresignedUpload` (video/file — content-type whitelist + size guard),
  `deleteObject`/`deleteObjects` (batch, best-effort), `publicUrl`,
  `keyFromPublicUrl`, `buildKey` (folder = `<kind>/<userId>/<uuid>.<ext>`).
- `config/env.ts` — `STORAGE_*`, `R2_*`, `AWS_*`, `STORAGE_PRESIGN_EXPIRY`.
- deps: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

#### Image optimization — server-side sharp (Amazon/Flipkart style)

**Images backend se guzarti hain** (presigned NAHI), optimize hoke R2 jaati hain
— DB me sirf optimized URL. Verified: worst-case noise pe 57% chhoti (real
photos 70-85%).

- `lib/image-processor.ts` (NEW) — `processImage`: EXIF auto-rotate + metadata
  strip (privacy/size) → resize cap `IMAGE_MAX_DIMENSION` (no upscale) → encode
  **WebP/AVIF** (env `IMAGE_FORMAT`) @ `IMAGE_QUALITY` 80. `processThumbnail`
  (listing card variant). sharp non-image pe throw → content-type spoof block.
- `middlewares/upload-multer.ts` (NEW) — memoryStorage, `IMAGE_MAX_UPLOAD_BYTES`
  (15MB raw) limit, image/\* filter, MulterError → BadRequest map.
- `POST /api/v1/uploads/image` (multipart `file`, `?thumbnail=true` optional) →
  sharp → R2 → `{url,key,format,width,height,sizeBytes,originalBytes}`.
  CSRF+auth (header-based) multer se PEHLE chalte hain.
- `config/env.ts` — `IMAGE_FORMAT/QUALITY/MAX_DIMENSION/THUMB_WIDTH/MAX_UPLOAD_BYTES`.
- deps: `sharp`, `multer` (+`pnpm-workspace.yaml` allowBuilds sharp:true — native).
- Presign route ab sirf video/large files ke liye (sharp un par nahi chalta).

#### Shared utils

- `utils/slugify.ts` (NEW) — `slugify` + `uniqueSlugify` (collision suffix).
- `utils/pagination.ts` (NEW) — `buildCursorArgs`/`processCursorPage`/
  `buildPageMeta`. **Cursor + offset hybrid** (employee/course pattern):
  `take = limit+1`, stable `orderBy [primary, {id}]`, nextCursor = last id.
  Pagination products ke saath dynamically grow karta hai (no SKIP/drift).
- `config/constants.ts` (NEW) — PAGINATION + CATALOG limits.

#### Modules (all under `modules/`)

- **category/** — `GET /api/v1/categories` (tree|flat, public), `GET /:slug`,
  admin `POST/PATCH/DELETE` (requireAuth + requireRole ADMIN + CSRF). Delete
  guard: linked products / children na ho.
- **product/** — endpoints:
  - PUBLIC: `GET /products` (ACTIVE only, filters: category/sub/tag/brand/
    price-range/inStock, sort newest|oldest|price|popular|rating|discount),
    `GET /products/:slug` (detail + view increment).
  - SELLER (seller cookie jar): `GET /products/seller/mine` (DRAFT bhi, status
    filter), `GET /products/seller/:id`, `POST /products` (Save Draft=DRAFT /
    Create=ACTIVE), `PATCH /products/:id` (arrays diye to images/variants/
    discountCodes REPLACE), `POST /:id/archive` (soft), `POST /:id/restore`
    (→DRAFT), `DELETE /:id` (hard + R2/S3 media cleanup incl. TipTap-embedded
    `data-r2-key`/`src` scrape). Ownership: admin any, vendor only own.
    discountCodeIds vendor-owned filter, category exist validate, slug unique.
- **discount/** — seller CRUD `GET/POST/GET:id/PATCH/DELETE /api/v1/discounts`
  (cursor+offset list, search, isActive filter, code uppercase-normalize +
  per-vendor unique, PERCENT value ≤100 guard).
- **upload/** — `POST /api/v1/uploads/presign` (image|video|file) + `DELETE
/api/v1/uploads` (key, folder-prefix ownership guard). Seller cookie jar.
- `app.ts` — 4 modules mounted under `/api/v1/{categories,products,discounts,uploads}`.

**Money convention:** prices minor units (paise/cents) as Int — float rounding
se bachne ke liye. Frontend "20$" → 2000 convert karega.

**Files (Session 9, backend only):**

- Schema: `prisma/schema.prisma` (+catalog models, VendorProfile back-rels)
- New utils/lib/config: `utils/slugify.ts`, `utils/pagination.ts`,
  `config/constants.ts`, `lib/storage.ts`, `config/env.ts` (storage vars),
  `.env.example` (storage section), `package.json` (aws-sdk)
- New modules: `modules/category/*`, `modules/product/*`, `modules/discount/*`,
  `modules/upload/*` (validator+repository+service+controller+routes each)
- `modules/vendor/vendor.repository.ts` (+`findVendorIdByUserId`)
- `app.ts` (route wiring)
- `lib/openapi.ts` — Swagger docs: catalog schemas register kiye, naya
  `sellerCookieAuth` security scheme, 4 tags (Categories/Products/Discounts/
  Uploads), **15 catalog paths** documented (`/uploads/image` multipart binary
  bhi). Verified `generateOpenApiSpec()` bina error chalti hai → `/api/v1/docs`.

**⚠️ Setup before running:** `.env` me R2 creds bharo (STORAGE_BUCKET,
STORAGE_PUBLIC_URL, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) —
warna upload presign route `ServiceUnavailable` dega (baaki product CRUD bina
storage ke kaam karega).

**Open / next session:**

1. **Frontend** — image-1 create-product form ko in endpoints se wire karo
   (presign → R2 PUT → product create), All Products list (cursor pagination),
   edit/archive/restore, discount-codes table, category dropdown.
2. **Category seed** — Electronics/Fashion/Home & Kitchen/Sports & Fitness
   (+subcategories) seed taaki dropdown me data ho.
3. **Order/inventory** — product purchase pe stock decrement + soldCount, status
   auto OUT_OF_STOCK jab stock 0.
4. Carried over: prod cookie domains, OAuth+proxy, Stripe Connect, Twilio creds,
   customer-side phone verify UI, pre-existing tsc noise.

---

### Session 10 — 2026-05-30 (Product FRONTEND — create/edit forms, TipTap, uploaders, list, dashboard charts)

Pura seller product frontend banaya — course module ka 4-export composition
pattern (Container/Loading/Error/Content), RHF + Zod, **theme-aware shadcn
tokens** (hardcoded orange NAHI — light+dark adapt), motion animations. Sab tsc
clean (sirf pre-existing calendar.tsx noise).

#### Foundation (`features/products/`)
- `types.ts` — Product/Variant/Image/Category/Discount + list/detail responses.
- `validators/product-validator.ts` — Zod create/update + slugify. **Form me
  RUPEES, API me minor units (paise)** — mappers convert.
- `lib/product-mappers.ts` — formToCreatePayload / formToUpdatePayload (dirty-only
  PATCH) / detailToFormValues (paise↔rupees).
- `api/products-api.ts` + `api/product-keys.ts` — sellerHttp CRUD (products/
  categories/discounts). `sellerHttp` me `patch`/`del` add kiye.
- `config/constants.ts` (web) — PAGINATION/STALE_TIME/CATALOG/SIZE_OPTIONS/COLORS.
- `lib/upload-media.ts` — `uploadImage` (multipart → /uploads/image sharp
  optimize), `uploadVideo`/`uploadFile` (presign → R2 PUT), `deleteMedia`.

#### Hooks (TanStack Query + nuqs)
- `use-products` — nuqs URL state + 400ms debounced search + keepPreviousData +
  filter/pagination helpers. `use-product-mutations` (create/update/archive/
  restore/delete + useProduct). `use-categories`, `use-discounts`,
  `use-product-analytics` (category + status distribution via useQueries fan-out).
- `server/params-loader.ts` + `use-product-params` — nuqs SSOT.

#### Components (theme-aware + motion)
- `form-fields.tsx` — Text/Number/Price/Textarea/Select/Switch (RHF Controller).
- `product-form-bits.tsx` — SectionCard, TagListInput (motion chips), SizeSelector,
  ColorPicker (swatches + custom popover), SpecificationsInput.
- `media-uploader.tsx` — **ProductImagesUploader** (drag-drop + file table:
  order/name/size/thumb/primary★/delete), **SingleImageUploader** (banner),
  **VideoUploader**. Upload → sonner promise toast.
- `variant-manager.tsx` — **"Edit your variant" shadcn Dialog** (title, color bar,
  tags, image gallery, stock/sku, Delete/Update) + variant list.
- `category-selects.tsx` (category→subcategory cascade), `discount-selector.tsx`
  (multi-select chips), `products-search.tsx` (search + status/category/sort
  filters, animated panel), `products-stats.tsx` (4 KPI cards, count queries),
  `products-table.tsx` (skeleton + row actions + delete dialog + empty state).
- `components/shared/pagination-controls.tsx` (NEW) — numbered + prev/next.

#### TipTap editor (`components/editor/`)
- `image-with-key.ts` (data-r2-key for cleanup), `video-node.tsx` (React NodeView
  + remove btn), `editor-toolbar.tsx` (sticky: history/headings/marks/lists/quote/
  link/image+video upload + status pill), `product-description-editor.tsx`
  (StarterKit + Underline/Link + TaskList + TextStyle/Color + bubble menu +
  external-value sync for edit). **description = HTML string** (JSON nahi).

#### Views + pages
- `create-product-view.tsx` (Save Draft / Create buttons), `edit-product-view.tsx`
  (fetch → map → dirty PATCH + archive/restore/delete dropdown + Loading/Error).
- `products-list-view.tsx` (stats + search + table + pagination).
- Wired: `/seller/products` (list, Suspense for nuqs), `/seller/products/new`,
  `/seller/products/[id]/edit`.

#### Dashboard charts (recharts + shadcn chart)
- `analytics-charts.tsx` — **CategoryPieChart** (products by category, donut) +
  **StatusBarChart** (products by status). Skeleton + empty states, theme chart
  vars (--chart-1..5). `dashboard-view.tsx` me wire kiye (+ real ProductsStats);
  AiInsightsPanel mock hata diya.

**Notes / decisions:**
- Dual zod (v3+v4 in tree) → `zodResolver` types mismatch → `as never` arg cast
  + `as Resolver<...>` result cast (runtime fine, resolvers v5 supports zod 4).
- Client-side TanStack Query + skeletons (project pattern; no HydrateClient infra).

**⚠️ Test karne se pehle:**
1. `.env` me R2 creds (warna image upload fail — baaki sab chalega).
2. **Categories seed karo** — create form ka category dropdown khali rahega warna
   (admin POST /categories ya seed). Bina category product create nahi hoga.

**Open / next session:**
1. **Category seed** + admin category management UI.
2. **Discount Codes management page** (`/seller/discount-codes`) — create/edit/
   delete codes (backend + selector ready, sirf management UI baaki).
3. **Public storefront** product listing/detail pages.
4. Carried over: orders/inventory, prod cookie domains, Stripe Connect, etc.

---

### Session 11 — 2026-05-30 (Full TipTap features + UI polish)

User feedback addressed:
- **Full Notion-grade TipTap** (course reference ke saare features), theme-aware:
  - `editor/colors.ts` (text-color palette), `file-chip-node.ts` (inline PDF/doc
    chip), `cleanup-extension.ts` (node remove → R2 deleteMediaBulk),
    `slash-command-items.ts` + `slash-command-menu.tsx` + `slash-command.ts`
    (`/` menu, grouped, keyboard-nav, portal), `block-handle.tsx` (drag +
    "add block"), `bubble-menu-content.tsx` (heading dropdown + marks + link +
    color picker + clear), `editor-toc.tsx` (heading outline sidebar).
  - `editor-toolbar.tsx` — file upload button add kiya ("image"|"video"|"file").
  - `product-description-editor.tsx` rewrite — sab compose: StarterKit + Underline/
    Link + TaskList + TextStyle/Color + Image/Video/FileChip + SlashCommand +
    CleanupExtension + BlockHandle + BubbleMenu + TOC + image/video/file upload.
  - `app/globals.css` — `.tt-editor`/`.tt-content`/`.tt-*` typography styles
    **theme-aware** (shadcn CSS vars + color-mix, light+dark adapt) — headings,
    lists, blockquote, code, task list, file chip, links, images, video.
- **Dashboard header height** h-14 → **h-16** (sidebar header bhi h-16 align).
- **Banner uploader** aspect 16/6 → 16/4 (kam tall, screenshot feedback).
- **nuqs clarified** — already wired: `NuqsAdapter` (root layout) + `useQueryStates`
  (useProductParams) → use-products me search/status/category/sort/page sab URL
  me sync. Create/edit forms ko URL state ki zaroorat nahi (RHF).

All tsc clean (only pre-existing calendar.tsx noise). Create + Edit forms shared
`ProductFormBody` (DRY, course pattern).

---

### Session 12 — 2026-05-30 (Server nuqs prefetch + scroll fix + single-file form)

3 feedback items:
1. **Server-side nuqs `searchParams` + prefetch** (course /dashboard/courses pattern):
   - `lib/query-client.ts` (getQueryClient via React `cache()`), `lib/hydrate-client.tsx`
     (HydrationBoundary), `features/products/server/prefetch.ts` (cookie-forwarded
     server fetch → prefetchQuery). `params-loader.ts` + `toApiQuery()` (client +
     server SAME query shape → exact queryKey match → hydration cache hit).
   - `/seller/products/page.tsx` ab **server component**: `productParamsCache.parse(
     searchParams)` → `toApiQuery` → `prefetchSellerProducts` → `<HydrateClient>`.
     `use-products` bhi `toApiQuery` use karta (key match).
2. **Double scrollbar fix** — shell ab `h-svh overflow-hidden` (SellerSidebarProvider +
   SidebarInset `flex h-svh min-h-0 flex-col`), sirf `<main>` scroll (`min-h-0 flex-1
   overflow-y-auto overflow-x-hidden`). Pehle body + main dono scroll karte the.
3. **Single self-contained form** (course CreateCourseView pattern) — `form-fields.tsx`
   + `product-form-body.tsx` DELETE. `create-product-view.tsx` me ab sab: Container/
   Error/Content + `ProductFormSections` (shared body) + reusable inputs (SectionCard/
   TextInput/NumberInput/PriceInput/TextareaInput/SwitchInput) + `productResolver` +
   `PRODUCT_DEFAULTS` — sab exported. `edit-product-view.tsx` inhi ko import karke reuse
   karta (no duplication). Heavy widgets (editor, uploaders, variant dialog, tag/size/
   color/spec, category/discount) alag (course bhi aise rakhta).

All tsc clean (only pre-existing calendar.tsx).

---

### Session 13 — 2026-05-31 (Category create + resilient upload + discount UI)

1. **Resilient multi-image upload** (Amazon/Flipkart) — `ProductImagesUploader`
   ab `Promise.allSettled` (parallel, independent). Partial failure pe jo images
   SUCCESS hui woh gallery me add ho jaati hain (kabhi lost nahi) + failures ka
   count toast me. Pehle sequential loop → ek fail pe poora reject → R2 pe chadi
   images UI me dikhti hi nahi thi (orphan). Ab success kept, failed retry-able.
2. **Category create UI** — backend category writes ab **seller cookie jar**
   (requireSellerAuth + requireSellerCsrf, pehle ADMIN customer-jar). Frontend:
   `createCategory` API + `useCreateCategory` + `CategorySelects` me "+ New" inline
   dialog (category + subcategory dono) → create → auto-select.
3. **Discount UI** — `DiscountCreateDialog` (reusable create/edit, PERCENT/FLAT,
   rupees↔paise), `DiscountSelector` me "+ New code" inline (auto-select), aur
   **`/seller/discount-codes`** management page (list/create/edit/delete, skeleton+
   empty). Product form me DiscountSelector pehle se wired.
4. **requireAuth UNAUTHORIZED warning** — product flow se nahi; ye customer-jar
   `/auth/me` seller portal pe (no customer cookie) → 401 WARN, handled, benign.
   Sab product/category/discount/upload calls `sellerHttp` (seller jar) use karte.
5. **Edit form** — create ke same `ProductFormSections` reuse karta → identical
   (all sections) + archive/restore/delete. Confirmed complete.

All tsc clean (backend + web; only pre-existing calendar.tsx).

---

### Session 14 — 2026-05-31 (Draggable image preview + delete/reorder toasts)

`ProductImagesUploader` (gallery, product + variant dono):
- **Drag-to-reorder** — HTML5 DnD on rows (grip handle in Order column, no extra
  dep). Drag → drop pe array reorder + positions recompute. motion `onDragStart`
  gesture-typed tha → DOM DnD ke liye cast kiya. Thumbnail `next/image`
  `draggable={false}` + `pointer-events-none` (native img-drag hijack avoid).
- **Reorder toast** — loading "Reordering…" → success "Image order updated".
- **Delete toast** — optimistic UI remove + `toast.promise(deleteMedia)` (loading
  "Removing image…" → success "Image removed" / error). Key na ho to instant success.
- Visual: dragging row opacity-50, drop-target top border highlight.

tsc clean (web; only pre-existing calendar.tsx).

---

### Session 15 — 2026-05-31 (Discount page rebuilt — products-page architecture)

DiscountSelector (product form) — inline create HATA diya; ab pure SELECTOR
(create discount page pe hota, yahan sirf active chips select + "Manage codes"
link). Empty pe discount page ka link.

Discount-codes page ab products list ke EXACT same architecture:
- `server/discount-params-loader.ts` — nuqs params (search/status all|active|
  inactive/page/pageSize) + `toDiscountApiQuery` (client+server same key).
- `hooks/use-discount-params.ts` (useQueryStates) + `use-discounts.ts` me naya
  **`useDiscountList()`** (nuqs + 400ms debounced search + keepPreviousData +
  filter/pagination helpers) — useProducts ka mirror.
- `server/discount-prefetch.ts` — cookie-forwarded server prefetch.
- `views/discount-codes-view.tsx` rewrite — Container/Content/Error, **table**
  (Code/Title/Value/Uses/Active/Actions) + search + status filter + pagination
  + skeleton + empty. Actions: **active toggle** (Switch, toast), edit dialog,
  delete (confirm + toast). motion rows + keepPreviousData dim.
- `page.tsx` ab server component: parse searchParams → prefetch → HydrateClient.

All tsc clean (web; only pre-existing calendar.tsx).

---

### Session 16 — 2026-05-31 (Brand accent heading + full skeletons everywhere)

1. **Accent heading line** — `components/shared/page-heading.tsx` (NEW): vertical
   bar (`bg-primary`, theme-aware — orange hardcode NAHI) + title + description +
   action slot. Applied: products list, discount codes. Inline accent line bhi:
   create product, edit product, dashboard heading.
2. **Dashboard skeleton rebuilt** — `dashboard-skeleton.tsx` ab new layout 1:1
   mirror karta: heading (accent) + **2 KPI rows** (StatCards + ProductsStats) +
   **2 charts** (pie donut + bar) + recent orders list. Pehle purana layout tha.
3. **Route loading.tsx** — `products/loading.tsx` (heading + 4 stat cards + search
   + table skeleton) aur `discount-codes/loading.tsx` (heading + search + table)
   — server prefetch/navigation ke dauraan full-page skeleton (zero layout shift).
4. Live-data skeletons pehle se: ProductsStats (per-card), CategoryPie/StatusBar
   (ChartSkeleton), products table (ProductsTableSkeleton), discount table.
   Ab har box/graph/list load pe skeleton dikhata (reference jaisa).

All tsc clean (web; only pre-existing calendar.tsx).

---

### Session 17 — 2026-05-31 (Header/content alignment + cleanup)

1. **Content alignment** — sab seller pages se `mx-auto max-w-*` HATA diya →
   ab `w-full p-4 lg:p-6` (full-width, left-aligned). Pehle content centered tha
   → header (Ratnakar) ke left edge se align nahi hota tha, bada gap dikhta. Ab
   form/list/dashboard sab header ke gutter ke barabar (px-4 lg:px-6 = header same).
   Updated: products-list, discount-codes, create-product, edit-product (+ loading),
   dashboard-view, dashboard-skeleton, products/loading, discount-codes/loading.
2. **Header vertical separator** — top bar me trigger aur "Ratnakar" ke beech wala
   `Separator` (vertical border) hata diya (cleaner). Right-side separator (bell ↔
   theme toggle) rakha.
3. Title accent line (`bg-primary` vertical bar) sab pages pe consistent (Session 16).

All tsc clean (web; only pre-existing calendar.tsx).

---

### Session 18 — 2026-05-31 (Create/Edit forms → course pattern, handleSubmit)

User feedback: forms ko course CreateCourseView/EditCourseView jaisa banao —
`form.handleSubmit(onSubmit)` use, sections INLINE, shared "sections component"
nahi.
- `ProductFormSections` (shared body) HATA diya. Ab CreateProductContent +
  EditProductContent dono apne **inline sections** rakhte hain (course pattern).
- Reusable inputs (SectionCard/TextInput/NumberInput/PriceInput/TextareaInput/
  SwitchInput) + PRODUCT_DEFAULTS + productResolver `create-product-view` se
  exported; edit unhe import karta (course-style cross-file input reuse).
- **`<form onSubmit={form.handleSubmit(onSubmit)}>`** dono me — create me 2 submit
  buttons (Save draft → setValue status DRAFT; Create → ACTIVE), dono handleSubmit
  trigger karte (pehle `e.preventDefault()` + submitWith hack tha). Edit pehle se
  handleSubmit use kar raha tha.
- Heavy widgets (editor/uploaders/variant/category/discount/tag/size/color/spec)
  feature components — imported (course bhi CourseDescriptionEditor/MediaUploader/
  TagListInput import karta). Containers `w-full` (Session 17 alignment).

All tsc clean (web; only pre-existing calendar.tsx).

---

### Session 19 — 2026-05-31 (Clean resolver + constants + hook toasts + publish)

1. **Clean `zodResolver`** — dual-zod (v3 from MCP SDK + v4) ke karan `zodResolver`
   ko cast lagana padta tha. `web/package.json` `pnpm.overrides.zod: 4.4.3` se
   resolvers ko zod v4 mila → ab views me **`resolver: zodResolver(createProductSchema)`**
   simple (no cast). `productResolver` helper hata diya.
2. **Default values constants me** — `features/products/constants/product-defaults.ts`
   → `productDefaultValues` (type validator se). Create + edit dono import karte
   (employeeDefaultValues pattern). Inline `PRODUCT_DEFAULTS` hata diya.
3. **Toasts hooks me** (useCourses pattern) — `use-product-mutations`: create
   (published/draft), update, archive, restore khud toast karte + onError. delete
   no-toast (caller wraps). Views ka `onSubmit` ab simple: `mutate(payload,
   { onSuccess })` — no toast.promise/unwrap. create + edit dono.
4. **Drag reorder → `toast.promise`** — media-uploader reorder ab toast.promise
   (loading "Reordering…" → success) use karta (pehle loading+setTimeout tha).
5. **Draft → Publish** — edit view me **Publish** button (DRAFT/OUT_OF_STOCK pe,
   status→ACTIVE) + **Unpublish (to draft)** dropdown item (ACTIVE→DRAFT). Publish
   se pehle image-required guard (no image → toast error). Status PATCH via update.

All tsc clean (web; only pre-existing calendar.tsx).

---

### Session 20 — 2026-06-01 (Soft-delete + 24h auto-purge + PENDING status)

User feedback (delete-product modals screenshots): Delete ab turant permanent
nahi — product ko **delete state** me bhejo, **24h ke andar restore** ho sake,
warna **cron khud DB + Cloudflare R2 se permanent** hata de. Saath me status
dropdown me **Pending** add. Restore wahi (image jaisa). Industry-grade soft-delete.

**Design decisions (user-confirmed via AskUserQuestion):**

- Auto-purge: **in-process interval** (node-cron ki jagah plain `setInterval` —
  extra dep nahi, 24h-purge ke liye second-precision ki zaroorat nahi).
- **Delete = naya `DELETED` state, Archive se ALAG** (archive permanent-hide, koi
  purge nahi; delete 24h recovery + purge). Restore dono se → DRAFT.
- Status dropdown: **Draft / Published / Pending** (`ACTIVE` ka UI label
  "Published"; `PENDING` = admin-approval intezaar — multi-vendor marketplace flow).
- Delete confirm: **type "delete" to confirm** (existing `ConfirmTypeDeleteDialog`),
  bas text badla ("24h me recover kar sakte ho", pehle "cannot be undone" tha).

#### Database (`prisma/schema.prisma` + migration `20260531233124_product_soft_delete`)

- `enum ProductStatus` += **`PENDING`** + **`DELETED`**.
- `Product` += **`purgeAt DateTime?`** (= deletedAt + 24h; cron isse compare karta)
  + `@@index([purgeAt])`. `deletedAt` pehle se tha.

#### Backend (`modules/product/*` + worker)

- `product.service.ts`:
  - `softDeleteProduct()` (NEW) — DELETE button → status=DELETED, deletedAt=now,
    purgeAt=now+24h (`DELETE_RETENTION_MS`). Turant hard-delete NAHI.
  - `restoreProduct()` — ab **ARCHIVED ya DELETED dono** → DRAFT (deletedAt/purgeAt
    null → purge skip).
  - `archiveProduct()` — deletedAt/purgeAt clear bhi karta (DELETED→archive pe purge
    cancel).
  - `purgeExpiredProducts()` (NEW, ex-`deleteProduct`) — NO auth; cron call karta.
    `findDueForPurge` → har product hard `remove()` + R2 `deleteObjects` (media keys
    `extractProductKeys` se, TipTap-embedded bhi). Returns purged count.
  - `goingPublic` guard `!== "DRAFT"` → `=== "ACTIVE"` (PENDING pe publishedAt na set ho).
- `product.repository.ts`: `findDueForPurge(now)` (status=DELETED, purgeAt<=now +
  media keys); `CARD_SELECT` += `deletedAt`/`purgeAt` (frontend countdown).
- `product.controller.ts`: `DELETE /products/:id` ab `softDeleteProduct` call karta
  ("moved to delete state — recover within 24 hours").
- `product.validator.ts`: create status `["DRAFT","PENDING","ACTIVE"]`, update +=
  PENDING, list filter += PENDING/DELETED.
- **`src/workers/product-purge.worker.ts` (NEW)** — `startProductPurgeWorker` /
  `stopProductPurgeWorker`. `setInterval` har 15 min → `purgeExpiredProducts`,
  overlap-guard (`isRunning`), boot pe ek immediate run (downtime catch-up),
  `.unref()` (clean shutdown). `server.ts` boot pe start + graceful-shutdown pe stop.

#### Frontend (`features/products/*`)

- `types.ts` — `ProductStatus` += PENDING/DELETED; `ProductListItem` += `deletedAt`/
  `purgeAt`; `PRODUCT_STATUS_META` += Pending (sky) / Deleted (rose), ACTIVE label
  "Published", ARCHIVED amber.
- `validators/product-validator.ts` — create/update status += PENDING;
  `productStatuses`/`productStatusLabels` += Pending (form dropdown).
- `server/params-loader.ts` — `PRODUCT_STATUS_FILTERS` += PENDING/DELETED;
  `SellerProductsApiQuery.status` union widen.
- `components/products-search.tsx` — `STATUS_LABELS` += Pending/Deleted (+ Published).
- `components/products-table.tsx` — Restore ab ARCHIVED **||** DELETED (green);
  DELETED rows pe **`{hoursLeft}h left`** countdown badge (purgeAt se compute);
  Delete item DELETED pe hidden; modal text → "delete state, 24h recover".
- `views/edit-product-view.tsx` — same `canRestore` logic; Delete dropdown DELETED
  pe hidden; Publish sirf non-(archived/deleted) pe; delete modal text updated.

**Status dropdown create form me pehle se tha** (`SelectInput` + `productStatuses`)
— bas validator/labels me PENDING add karne se aa gaya.

**Files touched (Session 20):**

- Backend: `prisma/schema.prisma` (+migration), `modules/product/{service,repository,
  controller,validator}.ts`, `src/workers/product-purge.worker.ts` (NEW), `server.ts`
- Frontend: `features/products/types.ts`, `validators/product-validator.ts`,
  `server/params-loader.ts`, `components/{products-search,products-table}.tsx`,
  `views/edit-product-view.tsx`

Backend `tsc` clean (mere files; pre-existing seed/rate-limit/auth.service noise
bacha). Web `tsc --noEmit` → **exit 0** (web me `typecheck` script nahi, direct tsc).
Migration applied. `npx prisma generate` chalaya (purgeAt/DELETED/PENDING types).

**Lifecycle (ab):**

```
       Delete(type "delete")        cron @ purgeAt (15-min interval)
 koi bhi ───────────────────► DELETED ──────────────────────────► permanent (DB + R2)
   ▲                            │  deletedAt + purgeAt=now+24h
   │  Restore                   │
   └─────────────────────────────┘ → DRAFT     Archive ──► ARCHIVED (hidden, no purge) ──Restore──► DRAFT
```

**Open / next session:**

1. **Admin approval flow** — PENDING → admin review → ACTIVE/reject. Abhi PENDING
   sirf status hai; admin-side approve/reject endpoint + UI baaki.
2. **Multi-instance purge** — abhi in-process interval (single instance assume).
   Scale pe Redis lock ya BullMQ/QStash worker, taaki duplicate purge na ho.
3. **Coupon final-price calc** — DiscountCode abhi product se link hota hai par
   checkout pe apply (salePrice − coupon) wali calc nahi (cart/order module ke saath).
4. Carried over: orders/inventory, category seed, prod cookie domains, Stripe
   Connect, Twilio creds, pre-existing tsc noise.

**Smoke test:**

```bash
cd services && pnpm dev    # purge-worker boot pe "[purge-worker] started" log
cd web && pnpm dev
# 1. seller.localhost:3000 → /seller/products → kisi product pe Delete → type "delete"
#    → row status "Deleted" + "24h left" badge. Public listing se gayab.
# 2. Dropdown → Restore → status DRAFT wapas (deletedAt/purgeAt null).
# 3. Status dropdown (create/edit) me Draft/Published/Pending teeno dikhein.
# 4. 24h baad (ya purgeAt DB me past kar do) → next 15-min tick pe DB+R2 se permanent.
```

---

### Session 21 — 2026-06-01 (Customer storefront — Cart + Wishlist + location + product card with color variants)

User feedback (Becodemy-style reference code + screenshots): customer-facing
**product card + quick-view + add-to-cart + wishlist** banao, **Zustand** se,
**motion** animations, **backend (DB)** ke saath, aur **location** ka use
delivery-estimate ke liye. Amazon jaisa — ek product ke multiple color variants
card pe swatches se dikhein. NOTE: pasted code dusre project (tRPC+Redux,
apps/user-ui) ka tha; humne apne stack (TanStack Query + Zustand + Prisma +
customer `api` jar) me banaya.

**Design decisions (user-confirmed via AskUserQuestion):**
- Target: **current project `web/` (shop)**, existing stack.
- State: **Zustand** (guest) + TanStack Query (server) hybrid.
- Persistence: **backend (DB)** — Prisma CartItem/WishlistItem + API.
- Location: **delivery estimate + currency** (ip-api + 20-day localStorage cache).

#### Database (`prisma/schema.prisma` + migration `20260601235511_cart_wishlist`)
- **CartItem** — `userId + productId + variantId(nullable)` unique, quantity.
  Price store NAHI (live Product/Variant se; stale-price bug se bachne ko).
- **WishlistItem** — same shape, no quantity (bookmark).
- Back-relations: User (`cartItems`/`wishlistItems`), Product, ProductVariant.

#### Backend (`modules/cart/*` + `modules/wishlist/*`, customer cookie jar)
- **cart** (validator/repository/service/controller/routes):
  - `GET /cart` (lines + computed totals: subtotal/mrpTotal/savings/totalItems),
    `GET /cart/count`, `POST /cart/items` (add/increment, **stock clamp**),
    `PATCH /cart/items` (absolute qty, 0=remove), `DELETE /cart/items` (one),
    `DELETE /cart` (clear), `POST /cart/merge` (guest→server on login).
  - Service guards: product ACTIVE + not-deleted, variant product se match,
    effective price = `variant.price ?? product.salePrice`, stock = variant ya
    product. variantId nullable → repo `findFirst` (Postgres NULL-unique issue).
- **wishlist**: `GET /wishlist`, `/count`, `/ids` (hydration), `POST /toggle`
  (heart), `POST/DELETE /items`, `POST /merge`. Out-of-stock allowed (save for
  later); deleted/archived nahi.
- `app.ts` — mounted `/api/v1/cart` + `/api/v1/wishlist`.
- All requireAuth + requireCsrf (mutations). Naye files zero tsc errors
  (sirf pehle wala seed/rate-limit/auth.service noise bacha).

#### Frontend (`features/shop/*` — NEW customer feature module)
- `utils/currency.ts` (NEW) — `formatMoney` (minor units → ₹, Intl), `computeDiscountPercent`.
- `hooks/use-location.ts` — ip-api + **20-day localStorage cache**, SSR-safe,
  fail-soft; `estimateDelivery(location)` → ETA label (Amazon "Delivery by Tue").
- `types.ts` — ShopProduct/ShopVariant/CartLine/CartResponse/WishlistLine + guest shapes.
- `api/shop-api.ts` — public products + `cartApi`/`wishlistApi` (customer `api` jar).
- `store/use-cart-store.ts` + `use-wishlist-store.ts` — **Zustand + persist**
  (guest localStorage), product+variant unique key, optimistic.
- `hooks/use-cart.ts` + `use-wishlist.ts` — **unified auth-aware**: logged-out →
  guest store, logged-in → server (TanStack Query), **login pe guest→server MERGE
  (ek baar, useRef guard) fir guest clear**. Components ko ek hi API milti.
- `components/add-to-cart-button.tsx` — 3-state (out-of-stock / Add / − qty +
  stepper) **motion** qty-flip, stock clamp.
- `components/wishlist-button.tsx` — heart **motion spring pop** + rose fill toggle.
- `components/product-card.tsx` — Amazon-style: image hover-zoom, **color variant
  swatches** (hover/click → image+price+stock switch), discount/out-of-stock
  badge, rating, wishlist overlay, quick-view "eye", add-to-cart (selected variant).
- `components/product-quick-view.tsx` — screenshot layout: gallery (main+thumbs),
  brand/rating, color variants, price (sale+MRP strike+% off), qty stepper +
  add-to-cart + wishlist, stock, **location-based delivery estimate**.
- `hooks/use-shop-products.ts` + `views/product-grid.tsx` — public grid + shared
  quick-view modal, skeleton + empty states, container-query responsive.
- Home page (`app/(shop)/page.tsx`) — ProductGrid wired (newest, 24).
- `site-header.tsx` — Wishlist/Cart badges ab **live** (`useWishlist`/`useCart`
  count), pehle static 0 the.

Web `tsc --noEmit` → **exit 0** (zero errors).

**⚠️ Known / next session:**
1. **ip-api HTTP (mixed content)** — `http://ip-api.com` HTTPS prod pe block hoga.
   Prod: HTTPS geo provider (ipapi.co) ya Cloudflare `cf-ipcountry` header use karo.
2. **Cart/Wishlist pages** — `/cart` + `/wishlist` routes abhi nahi (header links
   point karte). Full cart page (line items + summary + checkout CTA) + wishlist
   grid banana baaki.
3. **Multi-currency** — location.currency capture hota hai par prices abhi product
   currency (INR) me. FX conversion baad me.
4. **Product detail page** (`/product/[slug]`) — quick-view "View full details"
   link point karta, page abhi nahi.
5. **Seed products** — grid khali rahega jab tak ACTIVE products na hon (+ variants
   with colors taaki swatches dikhein).
6. Carried over: admin PENDING→ACTIVE approval, orders/inventory, prod cookie
   domains, Stripe Connect, pre-existing tsc noise.

**Smoke test:**
```bash
cd services && pnpm dev
cd web && pnpm dev   # localhost:3000 (shop)
# 1. Home pe product grid — ACTIVE products cards (color variants → swatches).
# 2. Card hover → wishlist heart + quick-view eye. Swatch click → image/price switch.
# 3. Add to Cart → stepper (− qty +), header cart badge live (guest = localStorage).
# 4. Heart click → wishlist badge live + toast.
# 5. Quick-view → gallery + variants + delivery estimate (location se).
# 6. Login → guest cart/wishlist server me merge ho jaata (localStorage clear).
```

---

### Session 22 — 2026-06-01 (Storefront polish — banner carousel + card hover-images + variant switch + quick-view fix)

User feedback (reference ProductCard/ProductBanner code + screenshot): card me
**multiple images hover strip** chahiye (reference jaisa), **variant click pe
poora product switch** (Amazon red/black → wahi variant), upar **banner carousel**
(autoplay + framer motion), aur quick-view **close button location chip se overlap**
fix. Sab apne stack me (reference tRPC+Redux tha).

#### Backend (`modules/product/*`)
- `product.repository.ts` — naya **`STOREFRONT_SELECT`**: product-level images
  (saari, variantId null) + **color variants with their images** + category.
  `list()` me `variant: "seller" | "storefront"` param (default seller light card).
- `product.service.ts` — `listPublicProducts` → `runList(where, query, "storefront")`;
  `runList` ko `variant` param. Seller list light hi rehta (CARD_SELECT).
- Net: public `/products` ab har card pe multiple images + color variants bhejta.

#### Frontend (`features/shop/*`)
- **product-card.tsx** (rewrite) — reference jaisa **hover thumbnail strip**
  (thumb hover → main image motion crossfade), **color swatches** (click →
  variant ka poora image-set + price + stock switch, hoverIdx reset), discount/
  out-of-stock badge, wishlist + quick-view hover reveal, motion image transition.
- **product-banner-carousel.tsx** (NEW) — top hero carousel: **dependency-free
  autoplay** (setInterval 5s, pause-on-hover — embla-autoplay installed nahi tha),
  framer-motion slide (direction-aware x-slide + fade), prev/next arrows + dot
  indicators, "popular" products (image wale), Shop Now CTA. Empty pe null.
- **product-quick-view.tsx** (rewrite) — **close button overlap FIX**: default
  Dialog close `showCloseButton={false}`, apna custom close header-row me location
  chip ke saath (ab overlap nahi). Gallery variant-aware (thumb hover/click +
  motion crossfade), color variants click → image+price switch, delivery estimate.
- **page.tsx** (home) — `ProductBannerCarousel` grid ke upar wired.

Backend `tsc` clean (mere files; 5 pre-existing noise). Web `tsc --noEmit` → **exit 0**.

**⚠️ Carried / next:**
1. **Banner = "popular" products** abhi (dedicated banner field/CMS nahi). Real
   promo banners ke liye Product.bannerUrl ya alag Banner model use kar sakte.
2. `/cart`, `/wishlist`, `/product/[slug]` **pages** abhi bhi baaki (Session 21).
3. Seed ACTIVE products **with color variants + multiple images** taaki swatches +
   hover strip dikhein.
4. ip-api HTTP mixed-content (Session 21), admin PENDING→ACTIVE, orders — carried.

---

### Session 23 — 2026-06-02 (Storefront UX fixes — swatch/stars/subcategory + cart-wishlist merge correctness)

User feedback (screenshots): light-theme pe deep-blue swatch invisible, review
stars chahiye, sub-category dikhe, banner Shop-Now hover weak; phir card ka
category-tag top-left transparent badge, variants me sirf ek dikh raha tha,
swatch color theme se na badle; aur cart/wishlist guest↔login persistence
industry-standard hai ya nahi verify.

#### A. Card / quick-view / banner polish
- **star-rating.tsx** (NEW) — reusable Amazon/Flipkart 5-star (half-star support),
  card + quick-view dono use karte (pehle manual loop tha).
- **product-card.tsx** —
  - Category **TAG ab image ke top-left transparent glass badge** (`bg-black/50
    backdrop-blur`), subcategory ho to wahi (specific "Mobiles") warna category.
    Discount/out-of-stock badge usi left-column me niche stack. Content se
    breadcrumb hata (ab badge me), sirf brand bacha.
  - **Default/base swatch wapas** (selected=null) — base product ka **ACTUAL
    color** = `product.colors[0]` hex (image NAHI; pehle thumbnail try kiya tha,
    user ne color maanga). `colors[]` na ho to default swatch skip. Backend
    `STOREFRONT_SELECT` me `colors: true` add (type me `colors?: string[]`).
    Variant fill bhi = **EXACT backend hex** (`style backgroundColor`), sirf patli
    ring border visibility ke liye (light `ring-black/15` + dark `ring-white/25`).
    Koi theme conflict nahi — fill pure hex.
    Issue tha: pehle ke edit me default swatch nikal gaya tha → "sirf ek variant
    dikhta" — ab default + saare color variants dono dikhte.
- **product-quick-view.tsx** — wahi swatch fix (default `bg-muted`→image thumbnail,
  variant `border-transparent`→always-visible ring) taaki white variant bhi dikhe.
- **product-banner-carousel.tsx** — Shop-Now hover industry-grade (`-translate-y-0.5`
  lift + `shadow-lg` + arrow slide + active press); category chip me subcategory
  breadcrumb (`Electronics › Mobiles`, ChevronRight separator).

#### B. Backend subcategory expose
- `product.repository.ts` `STOREFRONT_SELECT` + `FULL_INCLUDE` me **`subcategory`
  { id,name,slug }** add (pehle sirf category aati thi). types.ts me already tha.

#### C. Cart/Wishlist guest→login merge — 2 correctness bugs fix (CRITICAL)
Backend pehle se solid (cart merge additive+stock-clamp, wishlist idempotent,
null-safe `findFirst` uniqueness, logout pe `qc.clear()`). Bugs frontend
orchestration me the:
- **Bug 1 — quantity multiply:** `useCart`/`useWishlist` har card-button me mount
  hote (grid pe N instances). Merge-guard `useRef` **per-instance** tha → login pe
  N concurrent merges → cart qty N× ho jaati.
- **Bug 2 — re-login pe merge skip:** `mergedRef` logout pe reset nahi hota
  (header mounted rehta) → 2nd login pe guest items kabhi merge nahi hote
  (orphan in localStorage, silent loss).
- **Fix:** per-instance `useRef` → **module-level guard** (`cartMerged`/
  `wishlistMerged`, saare instances me shared, sync-claim → ek hi merge), aur
  `isAuthed=false` (logout) pe guard **reset** → har login fresh merge. Error pe
  reset taaki retry ho. `use-cart.ts` + `use-wishlist.ts`.

Result: teeno scenario consistent — (1) guest→login DB merge, (2) login→logout→
guest→login phir merge (additive), (3) grid pe multi-instance pe koi inflation nahi.

Web `tsc --noEmit` → **exit 0**.

**⚠️ Carried / next:**
1. `/cart`, `/wishlist`, `/product/[slug]` **pages** abhi bhi baaki.
2. Optional: guest-add ka `toast.success` mutation `onSuccess` me move (abhi
   turant fire hota — server-add fail pe double toast aa sakta). Consistency par
   asar nahi.
3. Seed ACTIVE products with variants+images; ip-api mixed-content; orders/
   inventory; admin PENDING→ACTIVE — carried.
