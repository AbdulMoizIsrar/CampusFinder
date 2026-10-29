# CampusFinder: Reporter contact + signup email code

Apply this patch **after** optional photo upload AND advanced matching/color patch.

## Install

```powershell
npm install
npm run check
npm test
npm run dev
```

`npm install` installs `nodemailer` from the updated package.json; MongoDB is the local Windows service, Docker is not required.

## SMTP configuration (required for signup code and match emails)

Open `.env` and add these values. **Never paste SMTP passwords into chats, commits, screenshots, or public repositories.**

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-sending-account@gmail.com
SMTP_PASSWORD=your-Google-App-Password
MAIL_FROM=your-sending-account@gmail.com
CLIENT_ORIGIN=http://localhost:3000
```

For Gmail SMTP, enable 2-Step Verification and create an **App Password** at https://myaccount.google.com/apppasswords (if your Google account is eligible). Use the App Password, NOT your normal Gmail password. Restart `npm run dev` after editing `.env`.

Without working SMTP, the code-request endpoint returns HTTP 503 and new registration will not work. Existing users and seeded demo users can still log in. Email match sending is best-effort and will never undo a successfully stored report.

## Workflow

1. Sign up: name, email, strong password; click **Send code**; retrieve 6-digit code; enter it; click **Create account**. Code expires in 10 minutes, five incorrect attempts max, 60-second resend cooldown, and per-IP rate limiting.
2. Report Lost or Found: enter mandatory full name (letters/spaces only), mandatory registration number, optional WhatsApp and separate sharing consent. `fa21bee091` automatically becomes `FA21-BEE-091`.
3. Both parties receive an email when a new report is matched, as long as SMTP is configured. A match is only a suggestion, not ownership verification. In-app notifications continue as before.
4. A WhatsApp number can be included **only in the email** if that report's owner checked the consent box and the match score is >=80. Contact details and registration number are excluded from public item endpoints, including Explore Items. The report owner can view their own private details for editing.
5. Existing historical reports remain viewable and can still be edited after supplying the newly required fields. To edit older reports, provide the newly required name and registration number.

## Security/production note

Email delivery here is synchronous best effort, not a durable queue; consider a delivery outbox/queue for production. This is a campus prototype. Sharing phone numbers on heuristic matches can still expose contact information to someone who submits a deceptive matching report; for stronger protection, exchange numbers only after a manually approved ownership claim.
