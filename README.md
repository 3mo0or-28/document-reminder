# Vaulta — production setup

**Status: written, NOT deployed, NOT tested end-to-end.** I had no network access, no Supabase project and no deploy access. Only the JavaScript syntax and the build script were checked. The SQL has never been run. Expect to fix small issues on first run, and run the checklist at the bottom before real clients use it.

## 1. Technologies
- **Supabase** (hosted): Postgres database, Auth (email + password, JWT sessions), private Storage, `pg_cron` for scheduled reminders.
- **Frontend:** the same static single-page UI, now calling Supabase directly with the public anon key. Row Level Security (RLS) makes the database enforce who can see what. There is no custom server.
- **Hosting:** Vercel (or any static host) serving `dist/`.

## 2. What changed from the local version
- Local accounts, localStorage and IndexedDB replaced by Supabase Auth, Postgres and Storage. Sample data removed; new accounts start empty with the six default folders.
- The page keeps an in-memory copy and saves changes to the database automatically.
- Reminders are no longer computed in the browser; the database creates the notifications.
- Added forgot/reset password, delete account, an email-reminder preference, security headers and a CSP.
- The UI is unchanged.

## 3. Accounts needed
Supabase (free tier works to start; use a paid plan with backups for real clients), Vercel (or Netlify/Cloudflare Pages), a GitHub account (optional), and later an email provider (Resend or Postmark) for email delivery.

## 4. Environment variables
`SUPABASE_URL` and `SUPABASE_ANON_KEY` only (see `.env.example`). The anon key is designed to be public; RLS protects the data. **The service-role key is never used, so never put it in the frontend or Vercel.** For dev vs production, create two Supabase projects and set different values in Vercel's Preview and Production environments.

## 5. Reminders when nobody is online
Each reminder is a row (`days_before`, computed `remind_at` at 09:00 in the user's signup time zone, `status`). `pg_cron` runs `process_reminders()` every 5 minutes inside the database. It inserts an in-app notification with a unique key (so duplicates are impossible) and sets status `sent`, or `failed`/`skipped`. Browser, device and login state do not matter. "sent" here means the in-app notification was stored. Email is only queued in `email_outbox` as `pending`; no email is sent yet, so none is claimed.

## 6. File protection
The `docs` bucket is private with a 10 MB limit and PDF/JPG/PNG only, enforced by the server. Storage policies allow access only to the folder named after the signed-in user's ID. Files are read through authenticated downloads, with no public URLs.

## 7. Data separation
Every table has RLS with `user_id = auth.uid()`, and `user_id` is set by the database, never sent from the browser. Reminders must point at the user's own documents. Notifications cannot be created by clients, and clients can only change `read`.

## 8. Deploy
1. Create a Supabase project. Database > Extensions: enable `pg_cron`. SQL editor: run `supabase/schema.sql`.
2. Auth > URL Configuration: set Site URL to your production URL and add it to Redirect URLs. Keep email confirmation on. Optionally configure custom SMTP (Supabase's default sender is heavily rate-limited).
3. Push this folder to GitHub. Import it in Vercel, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and deploy (build `npm run build`, output `dist`, already in `vercel.json`).
4. Add your custom domain in Vercel.

## 9. Production URL
None. I could not deploy.

## 10. NOT functional / not done
- **Nothing tested end to end** (signup, upload, cross-device, reset, reminders, RLS). Not tested on real devices or browsers.
- **Email and push** are not sent. Only the outbox structure exists.
- **Rate limiting:** only Supabase Auth's built-in limits. Nothing custom on uploads or database calls.
- **Account deletion** removes files from the browser, then the account and database rows. If it fails midway, files could remain. A server-side cleanup job is better.
- **Document deletion** removes the row and file from the browser; a failure between them could leave an orphan file.
- **Admin dashboard and audit log** do not exist, so no admin access exists.
- **Reminders time zone** is fixed at signup, and there is no privacy policy or retention schedule.
- **Offline** use is not supported, and unsaved changes can be lost if the connection drops.
- **Backups and monitoring** are not set up.

## Test checklist before launch
Sign up with two accounts and confirm A cannot see B's data or files (also try direct API calls). Upload from a laptop and view on a phone. Log out and back in. Set a reminder a few minutes ahead and confirm it appears with the tab closed. Reset the password. Delete the account and check Storage is empty.
