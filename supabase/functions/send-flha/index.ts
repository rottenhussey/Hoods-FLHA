// Supabase Edge Function: send-flha
// Emails the generated FLHA PDF to the HCR office and the supervisor address entered
// on the form, using your existing Gmail or Outlook account via SMTP.
//
// Required secrets (set with `supabase secrets set`):
//   SMTP_HOST       e.g. smtp.gmail.com or smtp.office365.com
//   SMTP_PORT       465 for Gmail SSL, 587 for Outlook TLS
//   SMTP_USER       your full email address
//   SMTP_PASS       a Gmail "App Password" (not your regular password) or Outlook app password
//   OFFICE_EMAIL    the fixed office/admin address that should get every report

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SMTP_HOST = Deno.env.get('SMTP_HOST')!;
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER')!;
const SMTP_PASS = Deno.env.get('SMTP_PASS')!;
const OFFICE_EMAIL = Deno.env.get('OFFICE_EMAIL')!;

// Needed so the browser is allowed to call this function directly.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  // The browser sends a quick "is this allowed?" check before the real request.
  // It has no body, so we answer it here instead of trying to read JSON from it.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfBase64, filename, supervisorEmail, site, date } = await req.json();

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: SMTP_PORT === 465,
        auth: { username: SMTP_USER, password: SMTP_PASS }
      }
    });

    const recipients = [OFFICE_EMAIL, supervisorEmail].filter(Boolean);

    await client.send({
      from: SMTP_USER,
      to: recipients,
      subject: `FLHA — ${site} — ${date}`,
      content: `A Field Level Hazard Assessment was submitted for ${site} on ${date}. See the attached PDF for full details.`,
      attachments: [
        {
          filename,
          content: pdfBase64,
          encoding: 'base64',
          contentType: 'application/pdf'
        }
      ]
    });

    await client.close();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
