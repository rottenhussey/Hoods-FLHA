// Supabase Edge Function: send-flha
// Emails the generated FLHA PDF to the HCR office and the consultant address entered
// on the form, using Resend's HTTP API. (We originally tried connecting directly to
// Gmail over SMTP, but raw SMTP/TLS connections are too CPU-heavy for the Edge Function
// sandbox and reliably hit "CPU Time exceeded" errors — Resend sends over a normal
// HTTPS request instead, which works fine here.)
//
// Required secrets (set with `supabase secrets set`):
//   RESEND_API_KEY   your API key from resend.com
//   FROM_EMAIL       the verified sending address, e.g. flha@hcr-flha.ca
//   OFFICE_EMAIL     the fixed office/admin address that should get every report

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL')!;
const OFFICE_EMAIL = Deno.env.get('OFFICE_EMAIL')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { pdfBase64, filename, supervisorEmail, site, date } = await req.json();
    const recipients = [OFFICE_EMAIL, supervisorEmail].filter(Boolean);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `HCR FLHA Reports <${FROM_EMAIL}>`,
        to: recipients,
        subject: `FLHA — ${site} — ${date}`,
        text: `A Field Level Hazard Assessment was submitted for ${site} on ${date}. See the attached PDF for full details.`,
        attachments: [
          {
            filename,
            content: pdfBase64
          }
        ]
      })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, result }), {
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
