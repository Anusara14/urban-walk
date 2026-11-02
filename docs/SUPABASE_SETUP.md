# Supabase setup (with Google sign-in and Vercel)

This connects URBAN WALK to a shared backend, so participants sign in with Google and see each other's
photos and observations, and organisers see live numbers on the dashboard. Allow about 30 minutes.

You'll set up three services. Keep a note of the values marked **(copy)**.

| Service | What it's for |
|---|---|
| Supabase | Database, photo storage and sign-in |
| Google Cloud | The "Continue with Google" button |
| Vercel | Hosting the app |

The steps use `YOUR-APP.vercel.app` for your Vercel address and `PROJECT-REF` for your Supabase project
ID. Replace both.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Choose a name (e.g. `urban-walk`) and a strong database password (store it in a password manager).
3. **Region:** pick the one closest to Colombo, **South Asia (Mumbai)**, or **Southeast Asia (Singapore)**.
4. Wait for the project to finish provisioning.
5. Open **Project Settings → API** and note:
   - **Project URL** → `https://PROJECT-REF.supabase.co` **(copy)**
   - **anon / publishable key** **(copy)**. It is safe in the browser; row-level security protects the data.
   - Do **not** copy the `service_role` / secret key anywhere in the app.

## 2. Create the database

1. Open **SQL Editor → New query**.
2. Paste the whole of [`supabase/migrations/0001_urban_walk.sql`](../supabase/migrations/0001_urban_walk.sql)
   and click **Run**.
3. Check **Table Editor**. You should see these tables:
   - `events`, `routes`, `route_segments`, `landmarks`
   - `posts`, `comments`, `post_likes`, `walk_progress`
4. Check **Storage**. You should see a **`photos`** bucket that is public, limited to 3 MB, and accepts
   only WebP and JPEG.

Run the script once. Running it a second time fails on "already exists" for the policies and
triggers. That's harmless, but for a clean redo start from a fresh project.

## 3. Create Google sign-in credentials

In the [Google Cloud Console](https://console.cloud.google.com/):

1. **Create a project** (top bar → project picker → *New project*), e.g. `Urban Walk`.
2. **APIs & Services → OAuth consent screen**
   1. User type: **External**.
   2. Fill in these fields:
      - App name: `URBAN WALK`
      - Support email
      - App logo (optional): `public/brand/urban-walk-app-icon.svg` exported as a PNG
      - Developer contact email
   3. **Authorised domains:** add `vercel.app` (or your own domain) and `supabase.co`.
   4. **Scopes:** keep the defaults (`openid`, `email`, `profile`). These basic scopes need no
      Google review.
   5. **Publishing status → Publish app (In production).** Important: in *Testing* mode, only the
      test users you list (max 100) can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   1. Application type: **Web application**.
   2. **Authorised JavaScript origins:**
      - `https://YOUR-APP.vercel.app`
      - `http://localhost:3000`
   3. **Authorised redirect URIs:** exactly `https://PROJECT-REF.supabase.co/auth/v1/callback`
      (in the Supabase dashboard, *Authentication → Providers → Google* shows this URL with a copy button).
   4. Create, then note the **Client ID** and **Client secret** **(copy)**.

## 4. Turn on Google in Supabase

1. **Authentication → Sign In / Providers → Google**:
   1. Enable it.
   2. Paste the Client ID and Client secret.
   3. Save.
2. **Authentication → Sign In / Providers → Email:** turn it **off**. The app only uses Google, and
   this stops anyone creating email/password accounts through the API.
3. **Authentication → URL Configuration:**
   - **Site URL:** `https://YOUR-APP.vercel.app`
   - **Redirect URLs:** add these three:
     - `https://YOUR-APP.vercel.app/**`
     - `http://localhost:3000/**`
     - `https://*-YOUR-VERCEL-TEAM.vercel.app/**` (preview deployments; optional)

After sign-in, the app sends people back to `/login?next=…` on your site. That address must match
one of these patterns, or Supabase falls back to the Site URL.

## 5. Connect the app

### Local development

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

Restart `npm run dev`. The sign-in screen now shows **Continue with Google**.

### Vercel

1. <https://vercel.com/new> → import the GitHub repo **Anusara14/urban-walk**. The framework is
   detected as Next.js, so keep the defaults.
2. Before deploying, open **Environment Variables** and add the same two `NEXT_PUBLIC_SUPABASE_*`
   variables for Production, Preview and Development.
3. Deploy. If you add or change the variables later, **redeploy**, because `NEXT_PUBLIC_*` values are
   baked in at build time.
4. If Vercel gives you a different address than you used in steps 3–4, update the Google origins and
   the Supabase Site URL and Redirect URLs to match.

## 6. Make yourself an organiser

1. Open the deployed app and sign in with Google once. This creates your user.
2. In **SQL Editor**, run:
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role":"organiser"}'
   where email = 'you@gmail.com';
   ```
3. **Sign out and back in.** The role is read when you sign in. `/admin` now opens the dashboard.

Repeat for each organiser. To remove the role:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where email = '…';
```

## 7. Trial run (do this before the event)

Test with 3–4 phones: a mix of Android and iPhone, on mobile data rather than Wi-Fi.

- [ ] Each phone signs in with Google and lands back in the app.
- [ ] A photo posted on one phone appears in **Discoveries** on the others, as a small image.
- [ ] Tapping a photo opens the full-size version.
- [ ] A comment and an appreciation from another phone show up after reopening Discoveries.
- [ ] Marking stops visited shows up on **/admin → Overview** (*Walking*, *Visits by stop*) within a minute.
- [ ] An organiser can delete someone else's post in **/admin → Moderation**.
- [ ] A non-organiser sees "Organisers only" at `/admin`.
- [ ] Installed to the home screen, the app shows the yellow square icon.

## Free plan limits to know

| Limit (free plan) | What it means for ~300 participants |
|---|---|
| **Projects pause after 7 days without activity** | Open the dashboard or app the day before the event. A paused project needs a manual *Restore*. |
| Database 500 MB | Posts, comments and progress are tiny. No issue. |
| File storage 1 GB | Each photo is stored twice, roughly 300 KB full plus 40 KB thumbnail, so 1 GB holds about 3,000 photos. |
| Bandwidth ≈ 5 GB / month | The feed and map load only thumbnails, so 300 people browsing 1,000 photos uses about 12 GB. Full-size photos load only when tapped. If you expect more than ~500 photos, use **Pro** for the event month ($25). |
| Auth | Google sign-in sends no emails, so Supabase's email limits don't apply. |

Check current limits at <https://supabase.com/pricing>. They change from time to time.

## Troubleshooting

- **"redirect_uri_mismatch" from Google:** the redirect URI in Google Cloud must be exactly
  `https://PROJECT-REF.supabase.co/auth/v1/callback`.
- **Signed in but sent to the wrong site:** add your domain to Supabase **Redirect URLs** (step 4).
- **Only some people can sign in:** the Google consent screen is still in *Testing*. Publish it.
- **`/admin` says "Organisers only" after granting the role:** sign out and in again.
- **Photos fail to upload:** check the `photos` bucket exists and that the file is a photo.
  The app always uploads WebP or JPEG.
