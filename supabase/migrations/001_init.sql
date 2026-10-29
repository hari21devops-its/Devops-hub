create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  default_currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  week_start_day text not null default 'Monday',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  website_url text,
  repository_url text,
  environment text not null default 'Development' check (environment in ('Development', 'Staging', 'Production')),
  category text,
  client_name text,
  status text not null default 'Active' check (status in ('Active', 'Archived', 'Paused')),
  project_notes text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  domain_name text not null,
  registrar text,
  registration_date date,
  expiration_date date,
  auto_renew boolean default false,
  renewal_price numeric(12,2),
  currency text default 'INR',
  dns_provider text,
  nameservers text[],
  ssl_status text,
  ssl_expires_at timestamptz,
  domain_status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  provider text,
  service_type text,
  plan_name text,
  is_paid boolean default false,
  monthly_cost numeric(12,2) default 0,
  currency text default 'INR',
  usage_limit numeric(18,2),
  current_usage numeric(18,2),
  usage_unit text,
  billing_cycle text,
  renewal_date date,
  dashboard_url text,
  status text default 'Active',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text,
  service text,
  amount numeric(12,2) not null,
  currency text default 'INR',
  billing_period text,
  payment_date date,
  next_payment_date date,
  recurring boolean default false,
  payment_status text default 'Pending',
  invoice_url text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null,
  connection_status text not null default 'Disconnected',
  connected_at timestamptz,
  last_sync_at timestamptz,
  sync_metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_id uuid references public.analytics_sources(id) on delete set null,
  date date not null,
  unique_visitors integer,
  page_views integer,
  sessions integer,
  provider_metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, source_id, date)
);

create table if not exists public.monitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  check_interval integer not null default 300,
  expected_status integer not null default 200,
  timeout_seconds integer default 10,
  enabled boolean default true,
  last_check_at timestamptz,
  current_status text default 'Unknown',
  response_time_ms integer,
  failure_count integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'Open',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  severity text default 'Medium',
  notes text
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_domains_project_id on public.domains(project_id);
create index if not exists idx_services_project_id on public.services(project_id);
create index if not exists idx_expenses_project_id on public.expenses(project_id);
create index if not exists idx_analytics_daily_project_date on public.analytics_daily(project_id, date);
create index if not exists idx_monitors_project_id on public.monitors(project_id);
create index if not exists idx_notifications_recipient_id on public.notifications(recipient_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.domains enable row level security;
alter table public.services enable row level security;
alter table public.expenses enable row level security;
alter table public.analytics_sources enable row level security;
alter table public.analytics_daily enable row level security;
alter table public.monitors enable row level security;
alter table public.incidents enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles are editable by owner" on public.profiles
  for update using (auth.uid() = id);

create policy "Projects are visible to owner" on public.projects
  for select using (auth.uid() = owner_id);

create policy "Projects are editable by owner" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Domains are visible to project owner" on public.domains
  for select using (
    exists (
      select 1 from public.projects p where p.id = public.domains.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Domains are editable by project owner" on public.domains
  for all using (
    exists (
      select 1 from public.projects p where p.id = public.domains.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p where p.id = public.domains.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Services are visible to project owner" on public.services
  for select using (
    exists (
      select 1 from public.projects p where p.id = public.services.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Services are editable by project owner" on public.services
  for all using (
    exists (
      select 1 from public.projects p where p.id = public.services.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p where p.id = public.services.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Expenses are visible to project owner" on public.expenses
  for select using (
    exists (
      select 1 from public.projects p where p.id = public.expenses.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Expenses are editable by project owner" on public.expenses
  for all using (
    exists (
      select 1 from public.projects p where p.id = public.expenses.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p where p.id = public.expenses.project_id and p.owner_id = auth.uid()
    )
  );

create policy "Notifications are visible to recipient" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "Notifications are editable by recipient" on public.notifications
  for update using (recipient_id = auth.uid());
