create table if not exists public.monitor_checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  checked_at timestamptz not null default now(),
  is_up boolean not null,
  status_code integer,
  response_time_ms integer,
  error_code text
);

create index if not exists idx_monitor_checks_monitor_checked_at
  on public.monitor_checks(monitor_id, checked_at desc);

alter table public.monitor_checks enable row level security;

drop policy if exists "Monitor checks are visible to project owner" on public.monitor_checks;
create policy "Monitor checks are visible to project owner" on public.monitor_checks
  for select using (
    exists (
      select 1
      from public.monitors m
      join public.projects p on p.id = m.project_id
      where m.id = public.monitor_checks.monitor_id
        and p.owner_id = auth.uid()
    )
  );
