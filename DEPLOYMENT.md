# Staging deployment

The web app is hosted on Cloudflare Pages. The existing Express API runs on
Render, backed by a separate Neon staging project. The database URL already in
the repository's `.env` is not used by this setup.

## 1. Create an isolated staging database

Create a new PostgreSQL project in Neon in the Singapore region and a separate
Firebase project for staging. Do not reuse the database or Firebase project
configured in `.env`. Enable the sign-in methods used by the app in the staging
Firebase project. Keep the pooled Neon connection string private; enter it
only in Render's `DATABASE_URL` environment variable.

After confirming the new staging database is selected, initialize its schema
from the repository root in PowerShell:

```powershell
$previousDatabaseUrl = $env:DATABASE_URL
try {
  $env:DATABASE_URL = Read-Host "Staging database connection string"
  pnpm --filter @workspace/db push
} finally {
  if ($null -eq $previousDatabaseUrl) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_URL = $previousDatabaseUrl
  }
}
```

Enter the URL only in your local terminal; do not paste it into chat or commit
it. Do not run this command against a production database. It applies the
current Drizzle schema; it is not an automatic production migration.

## 2. Create the Cloudflare Pages project

Create a Pages project named `navodaya-connect-staging` connected to this
repository, using the repository root as the project root. If that Pages name
is unavailable, update `name` in `wrangler.toml` to the chosen project name.
The project hostname will be shown in Cloudflare after creation. Add that
hostname to the staging Firebase project's Authentication authorized domains.

The first Pages build will intentionally stop until the API URL is configured;
the build guard prevents publishing a frontend that points to localhost.

## 3. Deploy the API to Render

Create a Render Blueprint from this repository and select `render.yaml`. The
service uses the Singapore region, checks `/api/healthz`, and has automatic
deploys disabled. Enter the staging `DATABASE_URL`, staging Firebase Web API
key, Cloudflare Pages origin for `PUBLIC_APP_URL`, and a unique random value
for `ANALYTICS_SALT` when Render prompts for environment values. Deploy the API
manually after setting these values and initializing the Neon schema. Copy the
Render service URL shown in its dashboard.

- Email verification: `EMAIL_OTP_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.
- Memory media uploads: `AWS_ENDPOINT_URL_S3`, `AWS_REGION`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `NEON_STORAGE_BUCKET`.
- PARAM AI: `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`).
- Store payments: test-mode `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.

These integrations are optional; add their variables in Render only when
enabling the corresponding feature.

Never put provider secrets in this repository or in the mobile-app build
variables.

## 4. Configure and deploy the web app

In Cloudflare Pages, configure:

- Build command:
  `pnpm install --frozen-lockfile && pnpm --filter @workspace/mobile build:cloudflare`
- Build output directory: `artifacts/mobile/dist`

Set these build environment variables in the Pages project before building:

- `EXPO_PUBLIC_API_URL`: the Render service URL followed by `/api`.
- `EXPO_PUBLIC_APP_URL`: the Pages site origin.
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

Firebase Web configuration values are embedded in the public frontend build;
they are not server secrets. Keep database and provider credentials exclusively
in Render's server-side environment.

Add the Cloudflare Pages hostname to Firebase Authentication's authorized
domains before testing sign-in.

Use the staging Firebase project's values. The `build:cloudflare` script
validates these settings and rejects missing values, localhost API URLs, and
non-HTTPS origins. After the Cloudflare build succeeds, update
`PUBLIC_APP_URL` in Render if the Pages hostname changed.

## 5. Verify staging

Check `https://<render-service-host>/api/healthz`, then test sign-in, profile
loading, Memories, and the features whose provider credentials were configured.
The free Render plan may sleep while idle, so the first request can be delayed.
