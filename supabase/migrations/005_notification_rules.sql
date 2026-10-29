create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  rule_type text not null check (rule_type in ('domain_expiry', 'service_quota', 'critical_incident', 'weekly_spend')),
  threshold numeric(12,2),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_rules_recipient
  on public.notification_rules(recipient_id, created_at desc);

alter table public.notification_rules enable row level security;

drop policy if exists "Notification rules manageable by recipient" on public.notification_rules;
create policy "Notification rules manageable by recipient" on public.notification_rules
  for all using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
