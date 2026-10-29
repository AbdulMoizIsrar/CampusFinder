# Lab 06 — Security test playbook

These are **reproducible manual test instructions and expected behavior**, not fabricated proof that live attacks were executed. Use demo data only and **never disable defenses on a public network**. In local `.env`, each `SECURITY_*` flag can be set to `false` solely to compare behavior before/after, then restored to `true` and the server restarted.

## Before you start

1. `npm install && npm run setup && docker compose up -d mongo && npm run seed && npm run dev`.
2. Log in at http://localhost:3000 as demo members in two browser sessions. Open Developer Tools → Network to inspect requests.
3. For Postman/REST Client, first sign in using `POST /api/v1/auth/login` and copy `accessToken`. Set `Authorization: Bearer <token>` on protected requests.
4. Use `docs/requests.http` as a request template.

| Threat | Defense used | Manual attempt | Expected result with defense ON |
| --- | --- | --- | --- |
| Password disclosure | bcrypt 12 rounds | Inspect `users` documents in MongoDB | Only bcrypt `passwordHash` values stored; never plaintext or returned in API. |
| Forged/expired JWT | JWT HS256 signature, expiry, DB user lookup | Use `Bearer invalid-token` on GET `/api/v1/items` | `401 TOKEN_INVALID`. |
| IDOR | Ownership + RBAC per request | Log in as Ahmed and PATCH/delete Sara's item | `403 FORBIDDEN`. |
| Mass assignment | Service field allow-list | Supply `{ "role": "admin", "reporter": "..." }` in item creation | These fields are ignored; reporter remains authenticated account. |
| XSS stored/reflected | sanitize-html, HTML text escaping, CSP | Enter `<script>alert(1)</script>` in an item description | Script is stripped/escaped and never executed. |
| CSRF | HMAC signed double-submit cookie, strict SameSite | POST `/api/v1/auth/refresh` with refresh cookie but no `X-CSRF-Token` | `403 CSRF_INVALID` (when CSRF ON). |
| CORS | Origin allowlist | From unrelated origin, send preflight to `/api/v1/items` | Rejected origin; no permissive access-control header. |
| NoSQL injection | Typed validation, safe regular expression construction, Mongoose `sanitizeFilter` | `GET /api/v1/items?type[$ne]=lost` | `422 VALIDATION_ERROR` (or rejected malformed query). |
| Brute force | Rate limit | Send more than 12 login attempts from one IP in 15 minutes | `429` with rate-limit error. |
| Claim spam | Rate limit, duplicate-claim index | Submit same item claim twice | Second gets `409 ALREADY_CLAIMED`; flood gets `429`. |
| Invalid status jump | Service transition guards | `PATCH /api/v1/items/:id` with `{ "status": "returned" }` on an open item | `409 INVALID_TRANSITION`. |
| Multi-approval | Atomic compare-and-set | Concurrent approval of two different claims for one item | Only one item can be assigned approvedClaim; subsequent conflicting approval returns `409`. |

## CSRF repro (cookie-authenticated endpoints)

```bash
# Cookie jar + token response (requires curl and running server):
curl -c cookies.txt http://localhost:3000/api/v1/auth/csrf
# First log in, saving campus_refresh with -b/-c. For refresh:
curl -i -b cookies.txt -X POST http://localhost:3000/api/v1/auth/refresh -H 'Content-Type: application/json' -d '{}'
# With protection enabled, expected 403 CSRF_INVALID.
# With protection disabled in a *local* test, the header is no longer required;
# note that refresh still requires a *valid refresh cookie* from login.
```

## Stored XSS before/after procedure

1. In local `.env` set `SECURITY_SANITIZE=false` and `SECURITY_HELMET=false`, restart.
2. Submit `<img src=x onerror=alert('xss')>` inside a 10+ character item description through the REST API. Server storage can retain the payload when sanitization is off.
3. The **actual frontend still escapes all descriptions**, so it should **not execute**, even if server sanitization is disabled; defense-in-depth intentionally limits visible 'before' vulnerability. The raw database payload illustrates what sanitization mitigates. Do not claim exploit execution.
4. Re-enable both flags and repeat: HTML markup is removed by the server and the UI also escapes it.

## Additional security checks

- Check `Content-Security-Policy`, `X-Content-Type-Options` and other Helmet headers using `curl -I http://localhost:3000`.
- Verify refresh token rotation: each successful refresh invalidates the previous cookie token value in MongoDB.
- Verify a regular user cannot POST `/graphql` or GET `/api/v1/admin/users` (403).
- Disconnect one browser, approve a claim, reconnect: `/api/v1/notifications` restores missed events from MongoDB.
- Verify `GET /api/v1/items/:id/claims` is 403 for anyone other than the owner/moderator.
- Run `npm audit` with connectivity; separately test cookies over HTTPS before production.
