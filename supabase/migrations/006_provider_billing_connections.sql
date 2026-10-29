alter table public.expenses
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists invoice_url text;

create unique index if not exists idx_expenses_external_record
  on public.expenses(project_id, external_source, external_id);

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  account_id text not null,
  encrypted_token text not null,
  token_iv text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  unique (owner_id, provider)
);

alter table public.provider_connections enable row level security;
revoke all on public.provider_connections from anon, authenticated;
grant all on public.provider_connections to service_role;
