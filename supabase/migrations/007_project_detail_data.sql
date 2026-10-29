alter table public.analytics_sources
  add column if not exists is_primary boolean not null default false;

create unique index if not exists idx_analytics_sources_one_primary_per_project
  on public.analytics_sources(project_id)
  where is_primary;

create table if not exists public.project_integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  resource_type text not null,
  resource_id text not null,
  resource_name text not null,
  connection_status text not null default 'Selected',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider, resource_id)
);

create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  external_id text,
  status text not null,
  environment text,
  commit_sha text,
  deployment_url text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}',
  unique (project_id, provider, external_id)
);

create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  external_id text,
  fingerprint text,
  title text not null,
  severity text,
  environment text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1,
  metadata jsonb not null default '{}',
  unique (project_id, provider, external_id)
);

create index if not exists idx_project_integrations_project on public.project_integrations(project_id, provider);
create index if not exists idx_deployments_project_started on public.deployments(project_id, started_at desc);
create index if not exists idx_error_events_project_last_seen on public.error_events(project_id, last_seen_at desc);

alter table public.project_integrations enable row level security;
alter table public.deployments enable row level security;
alter table public.error_events enable row level security;

drop policy if exists "Project integrations manageable by project owner" on public.project_integrations;
create policy "Project integrations manageable by project owner" on public.project_integrations
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = public.project_integrations.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = public.project_integrations.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Deployments manageable by project owner" on public.deployments;
create policy "Deployments manageable by project owner" on public.deployments
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = public.deployments.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = public.deployments.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Error events visible to project owner" on public.error_events;
create policy "Error events visible to project owner" on public.error_events
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = public.error_events.project_id and p.owner_id = auth.uid()
    )
  );
