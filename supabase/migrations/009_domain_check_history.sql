create table if not exists public.domain_checks (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  checked_at timestamptz not null default now(),
  dns_resolves boolean not null,
  ssl_reachable boolean not null,
  details jsonb not null default '{}'
);

create index if not exists idx_domain_checks_project_checked
  on public.domain_checks(project_id, checked_at desc);

alter table public.domain_checks enable row level security;

drop policy if exists "Domain checks visible to project owner" on public.domain_checks;
create policy "Domain checks visible to project owner" on public.domain_checks
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = public.domain_checks.project_id and p.owner_id = auth.uid()
    )
  );
