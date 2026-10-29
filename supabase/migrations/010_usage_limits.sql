alter table public.provider_usage_snapshots
  add column if not exists limit_value numeric(24,6),
  add column if not exists limit_unit text,
  add column if not exists overage_rate numeric(18,6),
  add column if not exists overage_currency text;

drop policy if exists "Provider usage limits editable by project owner" on public.provider_usage_snapshots;
create policy "Provider usage limits editable by project owner" on public.provider_usage_snapshots
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = public.provider_usage_snapshots.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = public.provider_usage_snapshots.project_id and p.owner_id = auth.uid()
    )
  );
