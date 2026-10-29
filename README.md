# DevOps Hub

DevOps Hub is a centralized infrastructure dashboard for freelancers, agencies, and developers to track projects, websites, domains, hosting, spend, uptime, and usage quotas from a single operational view.

## Phase 1 delivered

This phase establishes the foundation:

- React + TypeScript + Vite app scaffold
- Tailwind-based dashboard with a professional light theme and optional dark mode
- Protected routing with demo-mode login flow
- Supabase configuration and database migration template
- Demo data architecture for overview and project pages
- Automated tests for the dashboard render

## Local setup

1. Copy [.env.example](.env.example) to `.env.local` and fill in the values.
2. Install dependencies:
   npm install
3. Start the app:
   npm run dev
4. Run tests:
   npm run test -- --run

## Free-tier and provider notes

- The app prefers free-tier services and supports a provider-independent design.
- Supabase requires a real project and credentials; the frontend must not expose service-role keys.
- Analytics, monitoring, billing, and Telegram integrations are designed as modular adapters and are not hardcoded into the UI.
- Demo mode is clearly labeled and intentionally separated from live provider data.

## Important configuration guidance

- Public config: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Private config: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, API tokens for Telegram, GitHub, and others
- Never commit secrets to GitHub and keep private credentials server-side

## Database migration

Apply the SQL files in `supabase/migrations/` to your Supabase project in filename order. Migrations `001`-`006` create core tables, profiles, operational-data policies, monitor history, notification rules, and encrypted provider connections; [007_project_detail_data.sql](supabase/migrations/007_project_detail_data.sql) adds project-specific resource associations, deployments, and error events with project-owner RLS. Migration 007 is already applied to Supabase and must not be re-applied. [008_project_sync_history.sql](supabase/migrations/008_project_sync_history.sql) adds project-scoped usage snapshots and sync history for future provider workers.

With `VITE_DEMO_MODE=false`, create an account or sign in from the login screen. Supabase Auth manages credentials and sessions; `public.profiles` stores app-specific profile data. The profile trigger migration must be applied before creating projects.

## Current status

Live mode supports Supabase Auth, profile preferences, project/domain/service/expense CRUD, project-linked monitor registration and controls, incident resolution, recipient notifications and rules, project-specific resource associations, and an all-project dashboard at `/dashboard` with project detail pages at `/projects/:projectId` and scoped section routes. Demo mode remains available.

The aggregate dashboard uses primary analytics sources and sums page views across projects. Monthly unique visitors, bandwidth, and database usage display as unavailable unless a provider supplies accurate project-level data; daily unique visitors are never added to estimate monthly uniques. Provider resource associations are project-specific, but provider resource discovery and sync are only implemented for Cloudflare billing so far.

Cloudflare billing sync is implemented but requires migrations `006` and `008`, Edge Function deployment, and server-side secrets. Its sync outcomes are persisted per project in `sync_runs`. Google Analytics, Firebase, Cloudinary, GitHub, Telegram, scheduled uptime checks, SSL/DNS checks, and non-Cloudflare provider synchronization are not configured in this repository and remain explicitly unavailable in live mode. Uptime monitor records and check history are supported, but scheduled checks still require a secure server-side worker. Conversion funnels and notification rules also need provider/event sources before they can be live.

## Implementation checklist

- [x] Audit migration 007 in the repository: project integrations, deployments, error events, indexes, and project-owner RLS are present. Do not recreate migration 007.
- [x] Preserve the all-project dashboard and project-specific routes and data filters.
- [x] Add project-scoped sync history and usage-snapshot storage in migration 008.
- [x] Record Cloudflare billing sync success and failure states without exposing credentials.
- [x] Add and deploy a protected scheduled uptime-check Edge Function that records monitor history and updates project-scoped monitor status.
- [ ] Implement authenticated provider adapters beyond Cloudflare: Supabase, Cloudinary, Firebase, Google Analytics, GitHub, and hosting providers.
- [ ] Implement project-specific usage synchronization for each supported provider.
- [ ] Implement Google Analytics visitors and page views, including source freshness checks.
- [ ] Implement GitHub repository and deployment monitoring.
- [ ] Runtime-test scheduled uptime checks; apply migration 009 and verify DNS/HTTPS reachability records. Certificate expiration still requires a certificate-aware worker/API.
- [ ] Implement automatic Telegram delivery from evaluated notification rules.
- [ ] Make remaining project detail sections editable and backed by live records.
- [ ] Add sync scheduling, retries, provider rate-limit handling, and operator-visible error recovery.
- [x] Run the Vitest suite and production build after the current implementation slice.

### Cloudflare billing connector

After applying migration `006`, deploy `supabase/functions/cloudflare-billing` with the Supabase CLI. Set the Edge Function secret `PROVIDER_ENCRYPTION_KEY` to a base64-encoded random 32-byte key. Supabase supplies its URL and service-role key to deployed Edge Functions; never add them to a `VITE_` variable. In Integrations, connect a Cloudflare account with an API token limited to Billing Read, then choose a project and sync. The token is AES-GCM encrypted server-side; rotate/reconnect if the encryption key changes.

### Scheduled uptime connector

Deploy `supabase/functions/scheduled-uptime-check` as a server-side scheduled function. Set the private `UPTIME_CRON_SECRET` secret and invoke it with `POST` plus the `x-uptime-cron-secret` header. The worker reads enabled monitors with the service role, records `monitor_checks`, and updates monitor status; it rejects localhost and `.local` targets. Configure the scheduler only after testing against real project URLs, and never expose the cron secret in the frontend.

Migration `009_domain_check_history.sql` adds project-scoped DNS and HTTPS reachability history used by the same worker. Apply it only after confirming the remote migration history; do not use an unrestricted `db push` when the remote migration table is not reporting applied versions.
