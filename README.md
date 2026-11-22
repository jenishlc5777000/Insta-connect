# JenCorps Influencer Hub

Influencer referral, AI-workshop registration and commission management platform.

- **Public site**: `jencorps.com` and every influencer subdomain (`arun.jencorps.com`, `priya.jencorps.com`, …) serve the same workshop landing page. The visit is credited to the influencer automatically.
- **Influencer dashboard** (`/influencer/dashboard`): clicks, leads, conversion, earnings, referral links + QR, marketing resources, profile and payout details.
- **Admin console** (`/admin/dashboard`): influencers, workshops, leads, payments and refunds, commissions, payouts, reports (CSV and Excel), marketing resources, settings and the audit log.

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite 6, Tailwind CSS 4, React Router, React Hook Form + Zod, Recharts |
| Backend | Node.js 20+, Express 4, Mongoose 8 (MongoDB), Zod, JWT in HTTP-only cookies |
| Integrations | Razorpay (orders, checkout signature, webhooks, refunds), Nodemailer (SMTP), Cloudinary (or local disk) |

---

## 1. Project structure

```text
jencorps-influencer-platform/
├── backend/
│   ├── server.js                 # boots DB + HTTP server
│   ├── scripts/                  # createAdmin, seed (dev), devMemory (dev)
│   ├── tests/                    # Jest + Supertest + in-memory MongoDB replica set
│   └── src/
│       ├── app.js                # Express app (helmet, CORS, CSRF origin check, rate limits)
│       ├── config/               # env, db, constants
│       ├── models/               # User, Influencer, Workshop, Lead, ReferralClick, Payment,
│       │                         # Commission, Payout, AuditLog, Setting, WebhookEvent, Resource…
│       ├── services/             # business logic (referral, lead, payment, commission, payout…)
│       ├── controllers/  routes/  middleware/  validators/  utils/
├── frontend/
│   └── src/
│       ├── pages/{public,influencer,admin}/
│       ├── components/{ui,landing}/   layouts/   dashboards/ (charts)
│       ├── context/ (auth, referral, site)   hooks/   services/api.js   routes/   utils/
├── deploy/                       # nginx.conf, PM2 ecosystem
├── .env.example
└── package.json                  # npm workspaces
```

All REST endpoints live under `/api/v1`: `auth`, `users`, `influencers`, `workshops`, `leads`, `referrals`, `payments`, `commissions`, `payouts`, `analytics`, `reports`, `admin`, `public`. Every response uses the same JSON envelope: `{ success, data, meta? }` on success and `{ success: false, error: { code, message, details? } }` on failure. List endpoints accept `page`, `limit`, `sort` (for example `-createdAt`), `search` and filter parameters.

**Money is stored as integers in paise** everywhere: ₹2,000 is stored as `200000`.

---

## 2. Local development

### Prerequisites
- Node.js 20 or newer (tested on Node 24)
- MongoDB: a local server, MongoDB Atlas, **or nothing at all** (see the quickest start below)

### Quickest start (no MongoDB needed)

```bash
npm install
npm run dev:memory
```

This starts an in-memory MongoDB replica set, seeds sample data, and runs the API (`:5000`) and Vite (`:5173`). The data is lost when you stop it.

| URL | What |
|---|---|
| http://localhost:5173 | Main site |
| http://arun.localhost:5173 | Arun's influencer site (the same site, credited to INF-1001) |
| http://localhost:5173/admin/login | `admin@jencorps.test` / `Admin@12345` |
| http://localhost:5173/influencer/login | `arun@jencorps.test` / `Influencer@123` |

Payments use a **mock gateway** while Razorpay keys are empty. The payment screen shows "Simulate success / failure" buttons. The mock gateway can never run when `NODE_ENV=production`.

### With your own MongoDB

```bash
cp .env.example backend/.env       # then fill in the values
npm install
npm run seed                       # optional: sample data (refuses to run in production)
npm run dev                        # API on :5000 + web on :5173
```

`*.localhost` resolves to 127.0.0.1 in Chrome, Edge and Firefox. Vite forwards the original `Host` header to the API, so influencer subdomains work locally.

> **Dev-only caveat:** browsers do not share cookies between `arun.localhost` and `localhost`. To test attribution locally, stay on the subdomain while you register. In production the referral cookie is scoped to `.jencorps.com`, so attribution survives moving between a subdomain and the main domain.

### Tests

```bash
npm test
```

There are 73 tests across 6 suites. They run against a real MongoDB replica set in memory, so transactions are exercised; the first run downloads a MongoDB binary of about 600 MB. They cover:

- registration, login, refresh-token rotation and reuse detection, password reset
- subdomain resolution, first-touch and last-touch attribution, the attribution window, tampered cookies, influencer IDs sent by the frontend being ignored
- attribution surviving navigation before registration
- leads, duplicate prevention (including concurrent submissions)
- Razorpay signature and webhook verification, webhook idempotency
- 50% commission calculation, refund reversal and clawback, payouts
- influencer data isolation (changing the IDs in API calls), admin authorisation, validation

---

## 3. Environment variables

Copy `.env.example` to `backend/.env`. The required production values are:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas SRV string (Atlas is a replica set, so transactions are enabled) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `DATA_ENCRYPTION_KEY` | Long random strings: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. **Never change `DATA_ENCRYPTION_KEY` after go-live.** It decrypts stored bank and UPI details. |
| `FRONTEND_URL` | `https://jencorps.com` (used in emails and to build referral URLs) |
| `BASE_DOMAIN` | `jencorps.com` (only `<label>.jencorps.com` hosts are treated as influencer subdomains) |
| `TRUST_PROXY` | `1` behind Nginx |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Backend only, never exposed to React |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | When empty, emails are printed to the console |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | When empty, uploads go to `backend/uploads` (served at `/uploads`) |

The server refuses to start in production if any required secret is missing.

---

## 4. MongoDB setup (Atlas)

1. Create a cluster (M10 or larger is recommended for production; M0 works for staging).
2. **Database Access**: create a user with `readWrite` on the `jencorps` database.
3. **Network Access**: allow your server's public IP. Avoid `0.0.0.0/0`.
4. Copy the connection string into `MONGODB_URI`, for example `mongodb+srv://user:pass@cluster.mongodb.net/jencorps?retryWrites=true&w=majority`.
5. On first boot the API creates every collection and index, including the unique constraints used for duplicate-registration and duplicate-commission protection.

## 5. Create the first admin

```bash
npm run create-admin -- --email admin@jencorps.com --name "JenCorps Admin"
# prints a generated password once; or pass --password "YourStr0ngPass"
```

Running it again for an existing email promotes that user to admin and resets the password. Then log in at `/admin/login`. Add influencers from **Admin → Influencers → Add influencer**. Each influencer gets a referral ID (`INF-1001`, …), a subdomain and a temporary password, which they must change on first login.

---

## 6. Production deployment (single VPS + Nginx)

```bash
# on the server (Ubuntu 22.04+)
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

git clone <your repo> /var/www/jencorps && cd /var/www/jencorps
npm ci
cp .env.example backend/.env && nano backend/.env     # production values
npm run build                                          # -> frontend/dist
npm run create-admin -- --email admin@jencorps.com

pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
sudo cp deploy/nginx.conf /etc/nginx/sites-available/jencorps.conf
sudo ln -s /etc/nginx/sites-available/jencorps.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

There is **one deployment for every influencer**. Nginx sends `jencorps.com` and `*.jencorps.com` to the same React build and proxies `/api` on every host to the same API. Because the API is served from the same origin on every host, the referral and auth cookies are first-party and no CORS is involved. The API validates the forwarded host against `BASE_DOMAIN` and the reserved-subdomain list before looking up the influencer.

**Other hosts**: the frontend is a static SPA, so it can run on Vercel, Netlify or Cloudflare Pages with a wildcard domain and an SPA fallback. The API can run on Render, Railway, Fly.io or a VM. Make sure `/api/*` is **proxied (rewritten)** to the API on the same host, not called cross-origin, and that the proxy forwards `X-Forwarded-Host`.

## 6b. Deploy to Vercel (website + API in one project)

The repo is ready for Vercel. `vercel.json` builds the React app, and `api/index.js` runs the whole Express API as one serverless function at `/api/*`, on the same domain, so cookies keep working.

1. **Create a database** at [MongoDB Atlas](https://www.mongodb.com/atlas) (the free M0 tier works):
   - Add a database user.
   - Under **Network Access**, allow `0.0.0.0/0`. Vercel's IPs change, so they can't be allow-listed.
   - Copy the connection string.
2. **Create a Cloudinary account** (free) for uploads such as banners, avatars and promo kits. Vercel can't store files.
3. In Vercel, go to **Add New → Project → Import** `jenishlc5777000/Insta-connect`. Keep the detected settings: the root directory is the repo root, and the build settings come from `vercel.json`.
4. Under **Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string, e.g. `mongodb+srv://user:pass@cluster.mongodb.net/jencorps` |
   | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `DATA_ENCRYPTION_KEY` | four **different** long random strings; generate each with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `FRONTEND_URL` | `https://<your-project>.vercel.app` (later `https://jencorps.com`) |
   | `BASE_DOMAIN` | `<your-project>.vercel.app` (later `jencorps.com`) |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from the Cloudinary dashboard |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | from Razorpay (test keys first) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | your email provider (optional at first) |

5. Click **Deploy**.
6. **Create the first admin** from your computer, pointing at the Atlas database:
   ```bash
   cd backend
   MONGODB_URI="<atlas uri>" NODE_ENV=production JWT_ACCESS_SECRET=x JWT_REFRESH_SECRET=x DATA_ENCRYPTION_KEY="<same DATA_ENCRYPTION_KEY as Vercel>" \
     node scripts/createAdmin.js --email you@company.com --name "Your Name"
   ```
   In Windows PowerShell, set each variable first with `$env:MONGODB_URI="..."` and so on, then run `node scripts/createAdmin.js ...`.
7. Set the Razorpay webhook URL to `https://<your-domain>/api/v1/payments/webhook`.

Every push to `main` redeploys automatically, and pull requests get preview URLs.

**Referral links on `*.vercel.app`:** Vercel doesn't allow `arun.<project>.vercel.app` subdomains. While `BASE_DOMAIN` ends in `.vercel.app`, influencer links therefore use `?ref=INF-1001` (for example `https://<project>.vercel.app/?ref=INF-1001`), with the same tracking, cookie and commission. To use real subdomains:
- In **Vercel → Settings → Domains**, add both `jencorps.com` and `*.jencorps.com`. Wildcard domains require Vercel's nameservers.
- Set `FRONTEND_URL=https://jencorps.com` and `BASE_DOMAIN=jencorps.com`, then redeploy.

Links then switch to `https://arun.jencorps.com` automatically. You can also force either style with `REFERRAL_LINK_MODE=subdomain` or `query`.

## 7. Wildcard DNS and SSL

**DNS** (at your registrar or Cloudflare):

| Type | Name | Value |
|---|---|---|
| A | `@` | server IP |
| A | `*` | server IP (covers every influencer subdomain) |
| CNAME | `www` | `jencorps.com` |

**Wildcard certificate** (Let's Encrypt needs a DNS-01 challenge for wildcards):

```bash
sudo apt install -y certbot python3-certbot-dns-cloudflare
# /root/.secrets/cloudflare.ini  ->  dns_cloudflare_api_token = <token with Zone:DNS:Edit>
sudo chmod 600 /root/.secrets/cloudflare.ini
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d jencorps.com -d '*.jencorps.com'
```

Renewal runs automatically through the certbot timer. If your DNS is not on Cloudflare, use the matching certbot DNS plugin, or `--manual --preferred-challenges dns`, which has to be renewed by hand. If you proxy through Cloudflare, set SSL mode to **Full (strict)**. A wildcard proxied record needs a paid Cloudflare plan or Advanced Certificate Manager.

New influencers need **no DNS or deployment change**: creating them in the admin console is enough.

## 8. Razorpay configuration

1. In the Razorpay Dashboard, go to **Account & Settings → API Keys** and generate keys. Use test mode first. Put them in `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Under **Webhooks → Add new webhook**:
   - URL: `https://jencorps.com/api/v1/payments/webhook`
   - Secret: a random string, copied into `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`, `payment.dispute.lost`
3. Under **Payment capture**, keep automatic capture on. The backend also captures `authorized` payments itself if needed.

How payments are processed:

- The order amount always comes from the workshop record in the database, never from the browser.
- Checkout success is accepted only after the backend verifies `HMAC_SHA256(order_id|payment_id, key_secret)`. Webhooks are verified against the raw request body.
- Capture is an atomic state change, and each webhook event ID is processed once. A unique index on `Commission.paymentId` means each payment produces at most one commission, even when the checkout callback and the webhook arrive at the same time.
- Refunds can be started from **Admin → Payments → Refund** or from the Razorpay dashboard. A full refund reverses the commission and cancels the registration. A partial refund recalculates it. If the commission was already paid out, a clawback amount is recorded.

---

## 9. Business rules

**Attribution**
- The influencer is found from the validated subdomain, or from a `?ref=INF-1001` link. A signed, HTTP-only first-party cookie (`jc_ref`, 30 days by default) keeps the attribution.
- The default is first-touch: the first valid referral within the window wins. Admins can switch to last-touch in Settings.
- Every candidate influencer is re-validated in the database: it must exist and be active. A referral code typed into the form is checked the same way. Influencer IDs sent by the frontend are ignored.
- Admins can re-attribute a lead. A reason is required, and the change is written to the audit log. Unpaid commissions move to the new influencer at that influencer's rate.

**Becoming an influencer**
- Creators apply at `/become-influencer` (also `/join`). They give their Instagram handle, follower range, average video views per channel (Instagram Reels required; YouTube and Facebook optional, with a channel link) and a preferred link name, which is checked for availability as they type.
- Admins review applications in **Admin → Applications**. Approving creates the account (referral ID, subdomain, temporary password, welcome email) and copies the audience details onto the influencer's profile. Rejecting can send a polite email, and the person may re-apply later.

**Commission**
- Each influencer can have their own rate. Click the **Commission %** value in **Admin → Influencers** or on an influencer's page; leave it blank to use the default. You can also apply the new rate to that influencer's *pending* commissions. Approved and paid commissions are never re-priced, and every change is written to the audit log.
- Rate precedence: the influencer's own rate, then the workshop's campaign rate, then the platform default (50%).
- Eligible net revenue = amount paid − refunds − GST (optional, prices treated as tax-inclusive) − gateway fee (optional). Commission = eligible net revenue × rate, rounded to the nearest paisa.
- Statuses: `pending → approved → paid`, or `rejected` / `reversed`. Admins can turn on auto-approval in Settings.

**Duplicates**
- One registration per email and one per phone number in each workshop. This is enforced by unique indexes, and phone numbers are normalised first, so `+91 98765-43210` and `9876543210` count as the same number.
- The same person can register for other workshops.

**Privacy**
- Influencers see only their own leads, with masked email addresses and phone numbers.
- Bank account numbers and UPI IDs are encrypted at rest (AES-256-GCM). They are decrypted only for admins.

## 10. Security checklist

Already built in:
- bcrypt password hashing (cost 12)
- 15-minute access JWT and rotating 7-day refresh token, both in HTTP-only `SameSite=Lax` cookies (`Secure` in production), with refresh-token reuse detection
- login, sensitive-action, registration and API rate limits
- Helmet headers, a CORS allow-list limited to the base domain and its subdomains, and an Origin check that blocks cross-site state-changing requests
- Zod validation on every input, removal of `$`-prefixed and dotted keys (NoSQL injection), and HTML-tag stripping
- ownership checks inside every influencer query
- an audit log for admin changes

Before launch:
- Set strong secrets and HTTPS-only `FRONTEND_URL`.
- Restrict Atlas network access.
- Use Razorpay live keys and a webhook secret.
- Configure SMTP with SPF and DKIM for your sending domain.
- Have your legal counsel review `/terms` and `/privacy`.
