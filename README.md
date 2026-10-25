# Solar Mitra Connect

Mobile-first lead reporting app for door-to-door Solar Mitra executives, with an admin panel.
Runs entirely on **Netlify** (static site + one serverless function + Netlify Blobs storage). No separate database to set up.

## What it does

**Executive (Solar Mitra)** — logs in with mobile number + password
- **New lead:** customer name, mobile, kW required, village/area, electricity bill (photo or PDF), North / East / West / South site photos, GPS photo, lead stage, comment, next follow-up date
- Photos are compressed and stamped with direction, latitude/longitude, accuracy, IST date-time and executive name. GPS photo is mandatory.
- Duplicate customer mobile numbers are blocked (across all executives).
- **Follow-ups:** Overdue / Today / Upcoming, sorted by follow-up date, with the latest comment. Each follow-up adds a fresh comment, stage and next date; full history is kept.
- **Dashboard:** salary & incentive eligibility (set by admin), target progress (leads, site visits, registrations, kW), achievement chart, leads-per-day chart, stage-wise progress of all leads.
- Missing photos can be added later; existing photos cannot be replaced by the executive.
- **Cannot download data** (export is admin-only on the server).

**Admin**
- Team dashboard (all executives combined) + each executive's dashboard
- Create executive profiles (login, personal, address, area, KYC, bank, emergency contact, photo), edit, reset password
- **Active / Inactive** switch — inactive executives are logged out instantly and can't log in; their leads stay
- Monthly targets per executive (leads, site visits, registrations, kW), salary/incentive eligibility (Pending / Eligible / Not eligible) with a hint showing whether the target is met, note to executive, copy targets from previous month
- All leads with search, executive and stage filters; add follow-ups; delete leads
- **Download** leads report and performance report as CSV (opens in Excel / Google Sheets; includes photo links and full follow-up history)

Lead stages: Interested, Not Interested, Site Visit, Registration Process, Loan Process, Interested but Discom Problem, Interested but Other Problem.
"Site visits" counts leads moved to Site Visit or beyond in that month; "Registrations" counts leads moved to Registration Process or Loan Process in that month.

## Deploy on Netlify (about 10 minutes)

1. Put this folder in a **GitHub** repository (upload the files on github.com, or `git init && git push`).
2. In Netlify: **Add new site → Import an existing project → GitHub** → pick the repo. Leave build settings as they are (they come from `netlify.toml`).
3. Before (or right after) the first deploy, go to **Site configuration → Environment variables** and add:

   | Key | Value |
   |---|---|
   | `APP_SECRET` | a long random string (e.g. 40+ random letters/numbers). Keep it secret and never change it — changing it logs everyone out and breaks old photo links in exports. |
   | `ADMIN_MOBILE` | your 10-digit mobile number |
   | `ADMIN_PASSWORD` | your first admin password |
   | `ADMIN_NAME` | your name (optional) |

4. **Deploys → Trigger deploy** so the variables take effect.
5. Open the site, log in with the admin mobile + password, then change your password from **More → Change password**.
6. Add executives under **Team**, set targets under **Targets**, and share the site link with them. On Android/iPhone they can use **Add to Home Screen** so it opens like an app.

> Drag-and-drop deploys (Netlify Drop) do **not** work for this app, because it needs the server function. Use GitHub (above) or the Netlify CLI: `npm i -g netlify-cli && netlify deploy --prod`.

Optional: add your own domain under **Domain management**. HTTPS is automatic (required for GPS and camera).

## Notes
- Storage: Netlify Blobs (included with Netlify). Data and photos stay in your Netlify account.
- Photo links in the exported CSV are private, unguessable links — anyone you send the CSV to can open those photos.
- Executives can't download reports, but no app can stop someone taking a screenshot on their phone.
- Field tip: location must be ON and allowed for the site in the browser; the GPS photo waits for a location fix before stamping.

## Local testing
```
npm install
npm run dev     # http://localhost:8888  (admin: 9999999999 / admin123, in-memory data)
npm test        # API tests (run against a fresh `npm run dev`)
```
