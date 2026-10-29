alter table public.provider_usage_snapshots
  add column if not exists limit_value numeric(24,6),
  add column if not exists limit_unit text,
  add column if not exists overage_rate numeric(18,6),
  add column if not exists overage_currency text;
