-- Run this in the Supabase SQL Editor for your project.

-- 1. Table to store every submitted FLHA
create table if not exists flha_submissions (
  id uuid primary key default gen_random_uuid(),
  site_location text not null,
  customer text,
  operator text not null,
  submission_date date not null,
  supervisor_email text not null,
  pdf_path text not null,          -- path inside the flha-reports storage bucket
  form_data jsonb not null,        -- the full form payload, for reference/reprinting
  created_at timestamptz not null default now()
);

-- Helpful index for the history list / date-range queries
create index if not exists flha_submissions_created_at_idx on flha_submissions (created_at desc);

-- 2. Storage bucket for the generated PDFs
insert into storage.buckets (id, name, public)
values ('flha-reports', 'flha-reports', false)
on conflict (id) do nothing;

-- 3. Row Level Security
-- This app has no login screen (matches how the paper form works — anyone on site fills
-- it out). If you'd rather require a name/PIN before submitting, say the word and this
-- can be locked down to authenticated users only.
alter table flha_submissions enable row level security;

create policy "Anyone can insert a submission"
  on flha_submissions for insert
  with check (true);

create policy "Anyone can read submissions"
  on flha_submissions for select
  using (true);

create policy "Anyone can read flha PDFs"
  on storage.objects for select
  using (bucket_id = 'flha-reports');

create policy "Anyone can upload flha PDFs"
  on storage.objects for insert
  with check (bucket_id = 'flha-reports');

-- 4. Retention cleanup — deletes submissions (and their PDFs) older than the retention
-- window. Change the interval below to '6 months' if you want a shorter retention period.
create or replace function cleanup_old_flha_submissions()
returns void
language plpgsql
security definer
as $$
declare
  rec record;
begin
  for rec in
    select id, pdf_path from flha_submissions
    where created_at < now() - interval '12 months'
  loop
    delete from storage.objects where bucket_id = 'flha-reports' and name = rec.pdf_path;
    delete from flha_submissions where id = rec.id;
  end loop;
end;
$$;

-- 5. Schedule the cleanup to run automatically every night.
-- Requires the pg_cron extension, which you can enable from
-- Database > Extensions in the Supabase dashboard.
-- create extension if not exists pg_cron;
-- select cron.schedule('cleanup-old-flha', '0 3 * * *', 'select cleanup_old_flha_submissions();');
