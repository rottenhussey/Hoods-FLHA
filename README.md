# HCR Field Hazard Assessment (FLHA)

A mobile-friendly, installable PWA version of the HCR "Work Site / Lift Hazard
Assessment & Tool Box Meeting Report." Matches your paper form's 54 items,
crane set-up changes, hazard controls, and toolbox attendee list.

On submit it:
1. Builds a PDF that mirrors the paper form
2. Emails the PDF to the office + whatever supervisor email was entered, from
   your own Gmail/Outlook account
3. Saves the PDF + a database record for recordkeeping
4. Auto-deletes records older than your chosen retention window (set to 12
   months by default — change it in `supabase/schema.sql`)

Works offline: if you're at a site with no signal, it saves the form on your
phone and sends everything automatically the next time you're connected.

## 1. Add your logo

Drop your HCR logo file in as `/public/hcr-logo.png` (the one you sent).

## 2. Create a Supabase project

Same as CrewFind — go to supabase.com, create a project, then in the SQL
Editor paste and run everything in `supabase/schema.sql`.

Then create a **Storage bucket** if it wasn't created by the SQL already:
Storage > New bucket > name it `flha-reports`, keep it private.

Copy your project's URL and anon key from **Settings > API**, then:
```
cp .env.example .env
```
and paste them in.

## 3. Set up email sending (Gmail example)

Since you're using Gmail, you'll need an **App Password** (Google blocks
regular passwords for this):
1. Go to myaccount.google.com/security
2. Turn on 2-Step Verification if it isn't already on
3. Search "App Passwords," create one for "Mail"
4. Copy the 16-character password it gives you

Then set the Edge Function secrets (from your project folder, with the
Supabase CLI installed and linked — same as you did for CrewFind's Discord bot):
```
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=465
supabase secrets set SMTP_USER=youraddress@gmail.com
supabase secrets set SMTP_PASS=your16charapppassword
supabase secrets set OFFICE_EMAIL=office@hoodscranerental.com
```
(For Outlook: `SMTP_HOST=smtp.office365.com`, `SMTP_PORT=587`.)

Deploy the function:
```
supabase functions deploy send-flha
```

## 4. Install dependencies and run locally

```
npm install
npm run dev
```

## 5. Deploy to Netlify

Same flow as your other two apps: push this to a GitHub repo, connect it in
Netlify, set the build command to `npm run build` and publish directory to
`dist`. Add the two `VITE_SUPABASE_*` env vars in Netlify's site settings too.

## Changing the retention window

Open `supabase/schema.sql`, find `cleanup_old_flha_submissions()`, and change
`interval '12 months'` to `interval '6 months'` (or whatever you want),
then re-run that part in the SQL Editor. The commented-out `cron.schedule`
line at the bottom turns on nightly auto-cleanup — enable the `pg_cron`
extension first (Database > Extensions) then uncomment and run those two lines.

## Notes

- No login screen — anyone on site can fill it out, matching how the paper
  pad works today. If you'd rather require a name/PIN first, that's a small
  add-on, just ask.
- The generated PDF is a clean re-layout of the form, not a pixel copy of the
  carbon pad, but has all the same fields, items, and sections.
- Toolbox attendee "signatures" are a signed checkbox for now — a proper
  finger-signature pad can be added if you want that visual on the PDF.
