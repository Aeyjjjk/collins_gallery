# Echezonachi Collins UGWUJA: portfolio

React + TypeScript + Vite, with Supabase for admin login, database and file storage.
Public site: `/`. Private dashboard: `/admin/login` (not linked from the public site).

> Status: written but **not yet installed, built or run**. Run `npm install && npm run typecheck && npm run build` first and fix anything it reports.

## 1. Run locally
```bash
npm install
cp .env.example .env     # fill in the two Supabase values (step 2)
npm run dev
```
Without `.env` the public site shows no work and the admin shows "Backend is not configured".

## 2. Connect Supabase (one time)
1. Create a project at supabase.com.
2. **SQL Editor**: paste and run `supabase/migrations/001_init.sql`. This creates tables, Row Level Security, the `portfolio` storage bucket (public read, admin-only write) and your 7 starter categories.
3. **Project Settings > API**: copy *Project URL* and *anon public key* into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never use the `service_role` key here.
4. **Authentication > Providers > Email**: turn **off** "Allow new users to sign up" so nobody can register.
5. **Authentication > URL Configuration**: add your site URL and `https://YOUR-DOMAIN/admin/dashboard` to Redirect URLs (needed for password reset).

### Keep the free project from pausing
Free Supabase projects pause after about 7 days without activity. A ping from inside the database or the browser is unreliable (the browser only runs when someone visits), so this repo pings from outside:
1. Run `supabase/migrations/002_ping.sql` in the SQL Editor.
2. Push this project to a GitHub repo, then add repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings > Secrets and variables > Actions).
3. `.github/workflows/keep-supabase-awake.yml` then calls the ping every 2 hours. Run it once from the Actions tab to confirm it shows HTTP 200.
GitHub disables scheduled workflows after 60 days with no repo activity; re-enable it in the Actions tab if that happens. If you don't use GitHub, point any cron service (cron-job.org, UptimeRobot) at `POST $URL/rest/v1/rpc/ping` with the `apikey` and `Authorization: Bearer` headers.

## 3. Create the first administrator (no public sign-up)
1. **Authentication > Users > Add user**: your email and a strong password (tick auto-confirm).
2. **SQL Editor**:
```sql
insert into public.admins (user_id)
select id from auth.users where email = 'YOU@EXAMPLE.COM';
```
Only rows in `admins` count. Clients cannot insert there (no policy), so signing up or editing user metadata cannot grant access. Database and storage policies call `is_admin()`, so security does not depend on the frontend.

## 4. Using the dashboard
- **Upload Media**: pick a category/subcategory, drop files, edit titles, Upload. Each file shows its own progress and status; failed ones can be retried. Thumbnails are generated in the browser. Untick "Publish immediately" to save drafts.
- **Website, app or prototype** entries: use the second chip in Upload Media (screenshot plus optional live URL).
- **All Media**: search/filter; View, Edit, Replace file, Feature, reorder (pick a category first), Delete (with confirmation).
- **Categories**: add, rename, describe, set preview image, edit subcategories, hide, reorder, delete (projects must be moved first).
- **Featured Work**: pick which projects lead their category.
Changes show on the public site on next load; no redeploy needed.

## 5. Add your own things
| What | Where |
|---|---|
| Name, subtitle, socials, email, About text | `src/config/site.ts` |
| Hero photo | `public/images/profile-hero.webp` (optional mobile crop: set `hero.mobile`) |
| Primus font (licensed) | `public/fonts/Primus-Regular.woff2`, `Primus-Bold.woff2` |
| Portfolio media | Dashboard (stored in Supabase, not in the repo) |

## 6. Deploy
`npm run build` outputs `dist/`. Set the two `VITE_` variables in your host (Vercel/Netlify). SPA rewrites are included (`vercel.json`, `public/_redirects`).

## Limits and known gaps
- Supabase free plan: 50 MB per file, 1 GB storage. Larger videos need a paid plan and a higher bucket limit (SQL file and `site.ts`).
- Uploads are single-request with real progress, **not resumable**. For big videos, compress first.
- Reordering uses up/down buttons (no drag and drop).
- Each project has one main file plus thumbnail; multi-image project galleries are not built.
- Renaming a subcategory that has projects is blocked until they are moved.