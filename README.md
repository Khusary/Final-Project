# 🔐 SecureCrypt

**Multi-Layered File Encryption System with Secure Cloud Storage and Digital Signature Verification**

A final-year project demonstrating hybrid AES-256 + RSA encryption, SHA-256 integrity verification, RSA digital signatures, OTP-gated decryption, and encrypted cloud storage — built with Node.js/Express/MongoDB on the backend and vanilla HTML/CSS/JS on the frontend.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Folder Structure](#folder-structure)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Environment Variables](#environment-variables)
7. [Running the Project](#running-the-project)
8. [Creating the First Admin](#creating-the-first-admin)
9. [How the Encryption Flow Works](#how-the-encryption-flow-works)
10. [API Reference](#api-reference)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)
13. [Future Improvements](#future-improvements)

---

## Architecture

**Backend:** Node.js, Express.js, MongoDB (Mongoose), JWT, bcrypt, Multer, Node's built-in `crypto` module, Cloudinary, Nodemailer, Helmet, Morgan, express-rate-limit.

**Frontend:** Plain HTML, CSS, and vanilla JavaScript (no frameworks). Poppins font, dark glassmorphism UI.

---

## Features

- Register / Login / Logout with JWT auth, "remember me", and session expiry
- Email verification via OTP, forgot/reset password via OTP
- Role-based auth: separate user and admin JWT secrets and middleware
- File upload of any type, encrypted client-side-adjacent (server-side) before ever touching the cloud
- Hybrid encryption: AES-256-GCM for the file, RSA-2048-OAEP to wrap the AES key
- SHA-256 hashing of both the original and encrypted file, verified at every stage
- RSA digital signatures on the encrypted file hash, verified before every decryption
- OTP-gated decryption: request code → verify code → time-limited decrypt session → decrypt & download
- Cloudinary storage of ciphertext only — the original file is deleted from disk immediately after encryption/decryption
- Full activity logging (login, upload, download, delete, decrypt, admin actions) with IP + timestamp
- Admin dashboard: platform stats, user management, file management, activity logs, search/filter
- User dashboard: storage used, file count, last upload, recent activity, verification status
- Security hardening: Helmet, rate limiting, CORS allow-list, Mongo sanitize, XSS-clean, centralized error handling

---

## Folder Structure

```
SecureCrypt/
├── backend/
│   ├── config/          # db.js, cloudinary.js, mailer.js
│   ├── controllers/      # authController, fileController, decryptController, adminController, profileController
│   ├── middlewares/      # authMiddleware, errorHandler, uploadMiddleware, rateLimiter, asyncHandler
│   ├── models/            # User, Admin, File, ActivityLog, DecryptSession
│   ├── routes/            # authRoutes, fileRoutes, decryptRoutes, adminRoutes, profileRoutes
│   ├── utils/              # crypto.js, keyManager.js, generateToken.js, sendEmail.js, logActivity.js, seedAdmin.js
│   ├── uploads/            # temp storage for incoming plaintext (auto-cleaned)
│   ├── encrypted/          # temp storage for ciphertext before Cloudinary upload (auto-cleaned)
│   ├── decrypted/          # temp storage during decrypt/download (auto-cleaned)
│   ├── keys/                # auto-generated RSA key pair (private.pem, public.pem)
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── css/                # style.css, auth.css, dashboard.css
│   ├── js/                  # config.js, utils.js, notification.js, auth.js, dashboard.js, upload.js, files.js, decrypt.js, admin.js
│   ├── pages/               # all HTML pages except the landing page
│   └── index.html           # landing page
└── README.md
```

---

## Prerequisites

- Node.js 18+
- A MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A [Cloudinary](https://cloudinary.com) account (free tier is fine)
- An SMTP-capable email account for Nodemailer (Gmail with an App Password works well)

---

## Installation & Setup

```bash
# 1. Clone / unzip the project
cd SecureCrypt/backend

# 2. Install dependencies
npm install

# 3. Copy the environment template
cp .env.example .env

# 4. Fill in .env with your real values (see below)
```

### MongoDB

- Create a free cluster on MongoDB Atlas, or run `mongod` locally.
- Copy the connection string into `MONGO_URI` in `.env`.

### Cloudinary

- Sign up at cloudinary.com → Dashboard → copy your **Cloud Name**, **API Key**, and **API Secret** into `.env`.

### Email (Nodemailer)

- For Gmail: enable 2FA on the account, then generate an **App Password** at myaccount.google.com/apppasswords, and use that as `SMTP_PASS`.
- Any standard SMTP provider (SendGrid, Mailgun, etc.) also works — just update `SMTP_HOST`/`SMTP_PORT` accordingly.

---

## Environment Variables

See `backend/.env.example` for the full list with comments. Key variables:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` / `ADMIN_JWT_SECRET` | Separate signing secrets for user and admin tokens |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Cloud storage credentials |
| `SMTP_HOST/PORT/USER/PASS` | Outgoing email credentials |
| `CLIENT_URL` / `PRODUCTION_CLIENT_URL` | Used for CORS allow-list |
| `OTP_EXPIRES_MINUTES` | Lifetime of email/decrypt OTP codes |
| `DECRYPT_SESSION_EXPIRES_MINUTES` | Lifetime of a verified decrypt session |

**Note on RSA keys:** you do not need to set anything for encryption keys. On first boot, the server automatically generates a 2048-bit RSA key pair and stores it in `backend/keys/`. Keep this folder private and back it up — losing the private key means previously encrypted files can never be decrypted.

---

## Running the Project

**Backend:**
```bash
cd backend
npm run dev      # nodemon, auto-restarts on changes
# or
npm start        # production
```
The API will run on `http://localhost:5000` by default.

**Frontend:**
The frontend is static — no build step required. Serve it with any static server, e.g.:
```bash
cd frontend
npx serve .
# or simply open index.html in a browser / use the VSCode "Live Server" extension
```
By default `frontend/js/config.js` points to `http://localhost:5000/api` when running on `localhost`. Update `PRODUCTION_API_URL` in that file once you deploy the backend.

---

## Creating the First Admin

There is no public admin registration endpoint (by design). Create the first admin via the seed script:

```bash
cd backend
SEED_ADMIN_EMAIL=admin@yourdomain.com SEED_ADMIN_PASSWORD=YourStrongPassword123! node utils/seedAdmin.js
```
Then log in at `frontend/pages/admin-login.html`. Change the password immediately after first login (via the API — a `PUT /api/profile/password`-style admin endpoint can be added if needed).

---

## How the Encryption Flow Works

**Upload:**
1. File is temporarily saved to `backend/uploads/`.
2. SHA-256 hash of the plaintext is computed (`originalHash`).
3. A random AES-256 key + IV is generated; the file is encrypted with AES-256-GCM into `backend/encrypted/`.
4. The AES key is encrypted ("wrapped") with the server's RSA public key.
5. SHA-256 hash of the ciphertext is computed (`encryptedHash`) and signed with the RSA private key (digital signature).
6. The encrypted file is uploaded to Cloudinary; local temp files are deleted.
7. All metadata (hashes, IV, auth tag, wrapped key, signature, Cloudinary URL) is stored in MongoDB — the plaintext never touches the database or persists on disk.

**Decrypt:**
1. User requests a decrypt OTP for a specific file → emailed a 6-digit code.
2. User submits the OTP → a `DecryptSession` is created, valid for `DECRYPT_SESSION_EXPIRES_MINUTES` (TTL-indexed in MongoDB, auto-expires).
3. User calls the download endpoint with that session ID: the ciphertext is fetched from Cloudinary, its hash is re-verified against the stored `encryptedHash` (tamper check), the digital signature is verified against the RSA public key, the AES key is unwrapped with the RSA private key, and the file is decrypted.
4. The recovered plaintext's hash is checked against the original `originalHash` as a final integrity check before streaming it back to the user. Temp files are deleted immediately after.

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/verify-email` | — | Verify email with OTP |
| POST | `/auth/resend-verification` | — | Resend verification OTP |
| POST | `/auth/login` | — | Login |
| POST | `/auth/logout` | User | Logout |
| POST | `/auth/forgot-password` | — | Request password reset OTP |
| POST | `/auth/reset-password` | — | Reset password with OTP |
| GET | `/auth/me` | User | Current user info |
| GET | `/files/dashboard/stats` | User | Dashboard summary |
| POST | `/files/upload` | User (verified) | Upload + encrypt a file |
| GET | `/files` | User | List own files |
| GET | `/files/:id` | User | Get one file's metadata |
| DELETE | `/files/:id` | User | Delete a file |
| POST | `/decrypt/:fileId/request-otp` | User (verified) | Send decrypt OTP |
| POST | `/decrypt/:fileId/verify-otp` | User (verified) | Verify OTP, create session |
| POST | `/decrypt/session/:sessionId/download` | User (verified) | Decrypt + download |
| GET / PUT | `/profile` | User | View / update profile |
| PUT | `/profile/password` | User | Change password |
| POST | `/admin/login` | — | Admin login |
| GET | `/admin/dashboard` | Admin | Platform stats |
| GET / DELETE | `/admin/users(/:id)` | Admin | List / delete users |
| GET / DELETE | `/admin/files(/:id)` | Admin | List / delete files |
| GET | `/admin/logs` | Admin | Activity log feed |

---

## Deployment

**Backend → Render**
1. Push the `backend/` folder to a GitHub repo (or the whole project with Render's root directory set to `backend`).
2. Create a new Web Service on Render, connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add all variables from `.env.example` in Render's Environment settings.
5. Note: Render's filesystem is ephemeral — the auto-generated RSA keys in `backend/keys/` will regenerate on every deploy/restart unless you persist them (e.g. via a Render Disk, or by storing the PEM contents as environment variables and writing them to disk on boot). For a class demo this is usually fine; for anything persistent, use a persistent disk or an external secrets store.

**Frontend → Vercel**
1. Push `frontend/` to a repo (or point Vercel's root directory to `frontend`).
2. No build step needed — deploy as a static site.
3. Update `PRODUCTION_API_URL` in `frontend/js/config.js` to your Render backend URL before deploying.
4. Update `PRODUCTION_CLIENT_URL` in the backend's `.env` (on Render) to your Vercel URL so CORS allows it.

---

## Troubleshooting

- **"Not allowed by CORS"** — check `CLIENT_URL` / `PRODUCTION_CLIENT_URL` in the backend `.env` match your frontend's exact origin.
- **Emails not sending** — verify SMTP credentials; for Gmail you must use an App Password, not your regular password.
- **"OTP has expired"** — codes expire after `OTP_EXPIRES_MINUTES` (default 10). Request a new one.
- **Decrypt session expired** — sessions expire after `DECRYPT_SESSION_EXPIRES_MINUTES` (default 10) and are single-use. Restart the decrypt flow.
- **Cloudinary upload fails** — double-check `CLOUDINARY_*` env vars and that your account has raw file upload enabled (default on new accounts).
- **RSA key errors after redeploy** — see the deployment note above about ephemeral filesystems; a new key pair means old encrypted files become undecryptable, since the old private key is gone.

---

## Future Improvements

- Persist RSA keys via a managed secrets store for zero-downtime redeploys
- Per-file or per-user RSA key pairs instead of one server-wide pair
- Two-factor authentication (TOTP) as an alternative to email OTP
- Chunked/resumable uploads for very large files
- Admin ability to reset a user's password or force email re-verification
- Automated tests (Jest/Supertest for backend, Playwright for frontend flows)
