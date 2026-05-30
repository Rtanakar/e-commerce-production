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

| Jar | Cookies | Refresh path |
|---|---|---|
| Customer | `at`, `rt`, `csrf` | `/api/v1/auth` |
| Seller | `s_at`, `s_rt`, `s_csrf` | `/api/v1/auth/seller` |

**Why:** seller session theft can't compromise shop session (different sid in Redis, different rotation chain). Logout of one portal doesn't drop the other. Customer + seller can be active simultaneously on same User row.

**Backend changes:**
- `utils/cookies.ts` — sab helpers scope-aware (`AuthScope = "customer" | "seller"`). Default `customer` backward-compatible.
- `middlewares/require-auth.ts` — `requireSellerAuth` (reads `s_at`, enforces VENDOR) + `requireAnyAuth` (dual-jar fallback for `/onboarding-status`)
- `middlewares/csrf.ts` — factory-based, `requireCsrf` (customer) + `requireSellerCsrf` (seller)
- `modules/auth/seller-auth.controller.ts` + `seller-auth.routes.ts` — `/api/v1/auth/seller/{register,verify-otp,resend-otp,login,refresh,logout,me}`
- `modules/vendor/vendor.service.upgradeToSeller` — customer session NOT revoked anymore; mints fresh seller session for s_* cookies
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
  - Seller:   `POST /api/v1/auth/seller/phone/{send-otp,verify}` (requireSellerAuth + requireSellerCsrf)

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
  + 10 stub route pages under `app/(seller)/seller/*`

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
