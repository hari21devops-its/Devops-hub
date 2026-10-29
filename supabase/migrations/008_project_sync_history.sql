create table if not exists public.provider_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  metric text not null,
  value numeric(24,6) not null,
  unit text not null,
  period_start date,
  period_end date,
  metadata jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  unique (project_id, provider, metric, period_start, period_end)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_imported integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'
);

create index if not exists idx_provider_usage_project_synced
  on public.provider_usage_snapshots(project_id, provider, synced_at desc);
create index if not exists idx_sync_runs_project_started
  on public.sync_runs(project_id, started_at desc);

alter table public.provider_usage_snapshots enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "Provider usage visible to project owner" on public.provider_usage_snapshots;
create policy "Provider usage visible to project owner" on public.provider_usage_snapshots
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = public.provider_usage_snapshots.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Sync runs visible to project owner" on public.sync_runs;
create policy "Sync runs visible to project owner" on public.sync_runs
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = public.sync_runs.project_id and p.owner_id = auth.uid()
    )
  );