# CampusFinder — Campus Lost & Found Portal

**CSC337 Advanced Web Technologies (Lab) · COMSATS University Islamabad · Fall 2026**

CampusFinder is a responsive, text-only campus lost-and-found application. Community members report missing/found items, search the directory, submit proof-based claims and get private live updates when something relevant happens. Campus security reviews claims and administrators manage users and review statistics.

## What is included

- Node.js **22**, Express **5**, MongoDB **7**, Mongoose **9**, modular monolith with routes/controllers/services/models.
- REST CRUD under `/api/v1` with pagination, sorting, date/status/category filters, location/keyword search and sparse field selection.
- Account registration, bcrypt password hashing, 15-minute JWT access token, rotating/revocable opaque refresh token in **HttpOnly** cookie; User, Moderator, Admin roles and item/notification ownership checks.
- Lost/found posts, manual proof-of-ownership claims, pending/approved/rejected decisions, a single approved claim per item, and transition `open → claim_pending → claimed → returned` (or `claim_pending → open` on last rejection).
- Keyword, category, and location-based match suggestions and private Socket.IO notifications plus category-room live feeds, acknowledgements, reconnect synchronization.
- Read-only Apollo GraphQL statistics for moderators/admins at `POST /graphql`.
- Swagger UI at **`/api-docs`**, OpenAPI YAML, 5-page editable **draw.io** diagrams, 5 SVG exports, architecture decision record and security test instructions.
- Vanilla HTML/CSS/JavaScript responsive frontend (no React/Next.js), sample users/items/claim seed, Docker Compose, syntax and domain unit tests.

The current version is intentionally **text-only**: no photo uploads, email/SMS, payment or mobile application, following the supplied project scope.

## Quick start — Option A (recommended for VS Code)

Requires **Node.js 22+** and **MongoDB 7** (locally installed, Docker, or Atlas).

```bash
# Open the extracted CampusFinder folder in VS Code's terminal.
npm install
npm run setup
```

`npm run setup` generates `.env` with random JWT and CSRF secrets. Edit `.env` if MongoDB is not at `mongodb://127.0.0.1:27017/campusfinder`.

To start **just the MongoDB container**, install Docker Desktop and run:

```bash
docker compose up -d mongo
npm run doctor
npm run seed
npm run dev
```

Open **http://localhost:3000**. The API docs are at **http://localhost:3000/api-docs**.

> If you use MongoDB Atlas instead: set `MONGO_URI=mongodb+srv://...` in `.env`, skip the Docker step, then run `npm run doctor`, `npm run seed`, `npm run dev`.

## Quick start — Option B (Docker Compose only)

Requires Docker Desktop / Docker Engine with Compose (Node.js is needed only for generating `.env`, or you can edit `.env.example` yourself).

```bash
npm run setup
docker compose up --build -d
# optional demo data after app is running:
docker compose exec app npm run seed
```

Go to **http://localhost:3000**. Logs: `docker compose logs -f app`. Stop: `docker compose down` (preserves DB volume). Reset local demo DB: `docker compose down -v` (**deletes all stored demo data**).

## Demo accounts (after `npm run seed`)

| Role | Email |
| --- | --- |
| Administrator | `admin@campus.edu` |
| Moderator | `security@campus.edu` |
| User | `sara@campus.edu` |
| User | `ahmed@campus.edu` |

Password for seeded accounts: `SEED_DEFAULT_PASSWORD` from your own local `.env` (default example is `Demo12345!`). Change it for any environment accessible to other people; the seed script refuses to run with `NODE_ENV=production`. The seed is safe to rerun: it doesn't duplicate the example reports/claim and does not reset existing accounts' passwords.

### Demonstrating the real-time flow (two browsers)

1. Browser A: log in as `sara@campus.edu`; Browser B/incognito: log in as `ahmed@campus.edu`.
2. Browser A posts a **found** report; Browser B posts a **lost** report in the same category with overlapping keywords or location. Browser A receives a possible-match notification (and B may receive one too).
3. Browser B searches Browser A's found report, opens it, enters **specific private proof** and submits a claim.
4. Browser A sees the new notification in real time, opens **My reports → View claims**, and approves/rejects it. The claimant gets a private live notification.
5. If approved, Browser A can click **Mark returned**. Open the **Claim queue** and **Statistics** pages using the moderator account.
6. The **Explore items** filter by category subscribes to that Socket.IO category room so fresh reports appear while browsing. On reconnect, unread messages are retrieved from MongoDB.

## Important configuration (.env)

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP/Socket.IO server port, default `3000`. |
| `MONGO_URI` | MongoDB connection URI; Docker app overrides to `mongo` host. |
| `JWT_SECRET`, `CSRF_SECRET` | Unique secrets of 32+ characters; auto-generated by setup. |
| `JWT_ACCESS_EXPIRES` | Access token validity, default `15m`. |
| `REFRESH_DAYS` | HttpOnly refresh cookie duration, default 7 days. |
| `CLIENT_ORIGIN` | Exact allowed browser origin; if you change port, update it too. |
| `CAMPUS_EMAIL_DOMAIN` | Optional email domain enforcement, e.g. `comsats.edu.pk`; blank allows any valid email. |
| `SECURITY_HELMET`, `SECURITY_RATE_LIMIT`, `SECURITY_CSRF`, `SECURITY_SANITIZE` | Lab 06 test toggles. **Keep all `true` outside controlled local experiments.** |

When running behind HTTPS in production, set `NODE_ENV=production`, serve the app over HTTPS and update `CLIENT_ORIGIN` to the HTTPS site. Refresh/CSRF cookies then become `Secure` automatically. Configure an HTTPS reverse proxy and keep all security defenses enabled.

## API reference

Common routes:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/auth/csrf` | Issue a signed CSRF token/cookie for refresh and logout. |
| POST | `/api/v1/auth/register` | Register and sign in. |
| POST | `/api/v1/auth/login` | Sign in and receive access token plus HttpOnly refresh cookie. |
| POST | `/api/v1/auth/refresh` | Rotate refresh cookie; send `X-CSRF-Token` header. |
| POST | `/api/v1/auth/logout` | Revoke refresh cookie; Bearer + `X-CSRF-Token`. |
| GET | `/api/v1/auth/me` | Get current signed-in user. |
| GET/POST | `/api/v1/items` | Search/list or create item. |
| GET | `/api/v1/items/mine` | Your items. |
| GET/PATCH/DELETE | `/api/v1/items/:id` | Details / owner update / deletion. |
| GET | `/api/v1/items/:id/matches` | Owner/moderator match suggestions. |
| POST/GET | `/api/v1/items/:id/claims` | Submit claim / view private item claims. |
| GET | `/api/v1/claims/mine` | Your claim statuses. |
| PATCH | `/api/v1/claims/:id` | Owner or moderator approves/rejects. |
| GET | `/api/v1/notifications` | Private notification list with unread count. |
| PATCH | `/api/v1/notifications/:id/read` | Mark your notification read. |
| GET | `/api/v1/admin/claims` | Moderator/admin pending claim queue. |
| GET | `/api/v1/admin/users` | Admin users list. |
| PATCH | `/api/v1/admin/users/:id/role` | Admin role update. |
| POST | `/graphql` | Moderator/admin query: itemStats, recentClaims, claimsPerDay. |

Bearer token header: `Authorization: Bearer <accessToken>`.

Item filtering example:

```http
GET /api/v1/items?type=found&category=Electronics&status=open&location=library&sort=newest&page=1&limit=10&fields=title,description,category,location,date,type,status
Authorization: Bearer <accessToken>
```

All errors follow `{ "error": { "code": "...", "message": "..." } }`. HTTP status codes include 201 for item creation (with `Location`), 204 for deletion, 401 unauthenticated, 403 access denied, 409 conflict/invalid transition, 415 incorrect JSON content type and 422 validation failure.

GraphQL example, **only for moderators/admins**:

```graphql
query Dashboard {
  itemStats { total byStatus { label count } byCategory { label count } }
  claimsPerDay(days: 7) { date count }
  recentClaims(limit: 5) { id status createdAt item { title } claimant { name } }
}
```

## Design & documentation

- `docs/openapi.yaml`: OpenAPI 3 contract; the same contract powers Swagger UI.
- `docs/diagrams/CampusFinder.drawio`: 5 editable diagrams — Layered Architecture, C4 Context/Container, ER Model, Claim Sequence, Deployment.
- `docs/diagrams/svg/`: exported SVGs for each of those pages.
- `docs/adr-001.md`: modular monolith design decision and tradeoffs.
- `docs/security-tests.md`: Lab 06 scenarios with commands, expected results and manual attack/defense procedure.
- `docs/requests.http`: ready-to-edit VS Code REST Client requests.

## Test commands

```bash
npm run check       # Node syntax checker for JS files, does not require packages
npm test            # Built-in Node test runner for matching/state pure functions
npm run doctor      # Env and MongoDB connection check (requires npm install and MongoDB)
```

`npm install` needs internet access to download runtime dependencies. Third-party dependencies and the MongoDB database are **not** bundled into the ZIP. Until `npm install` and MongoDB are available, syntax/unit tests can run but a real two-browser end-to-end integration run cannot be performed. See `docs/security-tests.md` for manual functional test coverage.

## Source code structure

```text
src/
  config/       environment, MongoDB connection
  models/       User, Item, Claim, Notification, RefreshToken
  middleware/   JWT, roles, validation, security, error handling
  routes/       REST route declarations
  controllers/  HTTP requests/responses
  services/     shared business rules
  graphql/      read-only Apollo queries
  realtime/     Socket.IO rooms/events
  utils/        errors, matching score, claim transitions
public/         complete responsive frontend (HTML/CSS/vanilla JS)
scripts/        setup, seed, doctor, syntax checker
tests/          Node built-in unit tests
docs/           API specs, drawings, architecture/security notes
```

### Security boundaries and known local-demo limitations

Security measures include bcrypt cost 12, signed JWTs, hashed rotating refresh tokens, strict SameSite cookies, HMAC-signed double-submit CSRF for cookie-backed endpoints, input validation, HTML sanitization, server-side authorization, origin allowlist, query validation, safe regular expressions, Helmet CSP and per-IP rate limiting. Client input is escaped before insertion into HTML.

- This is a teaching prototype, not a production-audited service; conduct dependency/security audits and integrated testing before real deployment.
- The claim-approval step uses a conditional atomic item update to ensure only one claim can become the item winner. It does not use a MongoDB multi-document transaction (standalone MongoDB 7 does not support transactions); a process crash between writes may require moderator reconciliation. Production deployments should use a replica set and transactions.
- Socket.IO's default in-memory adapter is intended for a **single** Node.js server process. For scale-out you would need a distributed adapter, excluded from this lab's scope.
- Rate-limit counters are in process memory; use a shared store if deploying multiple server instances.
- Do not reveal proof of ownership publicly; it is limited to reporter/moderator claim listing and the claimant's own record. Account-level notifications may mention an item title.

### Optional domain restriction

To require COMSATS domain emails, set `CAMPUS_EMAIL_DOMAIN=comsats.edu.pk` before accepting registrations; the seed script creates `@campus.edu` demo accounts regardless, so skip seeding (or adjust seed emails) when testing strict campus-domain behavior.

### Color, brand, date and optional photo matching

The item report includes an optional brand and a single expandable color picker (all CSS color names, Transparent, Multicolor, Not sure, or a custom HEX shade). The date continues to be required; the matching algorithm now considers the chronological gap. Photos are optional. If two photos exist, the server compares simple 64-bit visual difference hashes built with `sharp` to rank similarly composed photos. This is **not** visual AI: different camera angles/backgrounds of the same item may not be recognized. The score is a heuristic match recommendation, never proof of ownership.

One-time setup after applying the incremental matching patch: `npm install sharp`, then `npm run backfill-images` to fingerprint earlier locally uploaded photos, and `npm run check`, `npm test`, `npm run dev`. For photos uploaded later, hashes are generated automatically.
