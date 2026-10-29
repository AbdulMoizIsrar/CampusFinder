# CampusFinder — Vercel deployment guide

This is an **incremental deployment patch** for the existing CampusFinder project.
It does **not** delete local data or modify `.env`.

## What's changed

- Root `app.js` exports Express to Vercel and connects to MongoDB Atlas.
- `vercel.json` configures Express and includes Swagger's YAML document.
- Image uploads use **Vercel Blob** when `VERCEL` is set, not the local disk.
- Images are capped at **3 MB** to stay within Vercel's 4.5 MB function request payload limit.
- Because instance-local Socket.IO broadcast is not reliable across serverless function instances, the Vercel client uses **20-second polling** for database notifications instead. Email sending still works through SMTP.
- Local `npm run dev` still runs the original Socket.IO server and keeps saving images locally.

## 1. Apply the patch

In the CampusFinder folder in PowerShell:

```powershell
# Set to the location you downloaded the patch to
$patch = 'D:\Downloads\CampusFinder_Vercel_Deployment.patch'
git apply --check $patch
# Only if the check succeeds:
git apply $patch
npm install @vercel/blob
npm run check
npm test
```

This patch **does not modify package.json**. npm install will record the dependency itself.

## 2. Create MongoDB Atlas

- Visit https://www.mongodb.com/cloud/atlas/register
- Create a free-tier cluster and a database user with a strong password.
- Add the deployed backend to Network Access. Serverless IPs may change; if temporarily using `0.0.0.0/0` for a student demo, understand that it allows IP access from anywhere and **requires strong credentials**. Prefer static egress/private networking for production.
- Copy the Atlas driver URI, like `mongodb+srv://<dbuser>:<password>@<cluster>.mongodb.net/campusfinder?retryWrites=true&w=majority`.
- **Do not publish** the Atlas password or `.env` file. Use Vercel Environment Variables.

## 3. Create Vercel project + Blob

- Visit https://vercel.com/new or deploy using `npx vercel` (login required).
- Choose the `CampusFinder` project root.
- Framework preset: **Express** (or autodetect).
- Under Storage, create and attach a **Public Blob** store to the project; the connection supplies auth credentials. Public pictures are suitable for the public Lost/Found listing; do not upload sensitive ID photos.

## 4. Vercel environment variables (Production)

```
MONGO_URI=<atlas-srv-url>
JWT_SECRET=<your-existing-random-secret-from-.env>
CSRF_SECRET=<a-different-random-secret-from-.env>
CLIENT_ORIGIN=https://<your-production-project>.vercel.app
NODE_ENV=production
JWT_ACCESS_EXPIRES=15m
REFRESH_DAYS=7
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<your-sending-gmail>
SMTP_PASSWORD=<your-gmail-app-password>
MAIL_FROM=<your-sending-gmail>
SECURITY_HELMET=true
SECURITY_RATE_LIMIT=true
SECURITY_CSRF=true
SECURITY_SANITIZE=true
```

**Never set** `MONGO_URI=mongodb://127.0.0.1:27017/campusfinder` on Vercel.
**Never upload `.env` or use `npm run seed` in production** (demo credentials are unsafe).
Make sure `CLIENT_ORIGIN` matches your final site URL exactly, including `https://` and no trailing slash; if deploying a preview URL, set the preview environment separately.

## 5. Deploy from Windows PowerShell

```powershell
npx vercel login
npx vercel
# Once you have set environment variables in the Vercel dashboard:
npx vercel --prod
```

Vercel will print the live `https://...vercel.app` link. If you change environment variables, **redeploy** to pick up changes.

## 6. Smoke test

1. Open `https://YOUR-PROJECT.vercel.app/api/v1/health` → JSON `ok:true`.
2. Sign up with a test email and receive the 6-digit OTP.
3. Report a Lost item without an image; then with a small JPG under 3 MB.
4. Create a corresponding Found report from another account and verify matching/email notifications.
5. Check claim workflows, role permissions and images after a redeploy.
6. Check Vercel runtime logs if an operation fails.

## Important limitations

- The original local MongoDB data is **not automatically migrated** to Atlas. The new cloud DB starts empty until migrated.
- Previously locally uploaded pictures under `public/uploads/items` are **not uploaded** to Blob automatically.
- Browser notifications are refreshed approximately every 20 seconds rather than Socket.IO instantaneous events; email notifications are independent.
- Express rate-limit stores are per function instance; production-grade distributed rate limiting requires Redis or another centralized mechanism.
- Vercel's support for Express/WebSockets can evolve; this patch intentionally uses database-backed polling to avoid relying on instance-local socket broadcasts.
- This is a source-level patch with syntax/unit tests, **not a tested live Vercel deployment**. Verify each feature before sharing with students.
