drop policy if exists "Analytics sources are visible to project owner" on public.analytics_sources;
create policy "Analytics sources are visible to project owner" on public.analytics_sources
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = public.analytics_sources.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Analytics daily rows are visible to project owner" on public.analytics_daily;
create policy "Analytics daily rows are visible to project owner" on public.analytics_daily
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = public.analytics_daily.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Monitors are manageable by project owner" on public.monitors;
create policy "Monitors are manageable by project owner" on public.monitors
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = public.monitors.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = public.monitors.project_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "Incidents are manageable by project owner" on public.incidents;
create policy "Incidents are manageable by project owner" on public.incidents
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = public.incidents.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = public.incidents.project_id and p.owner_id = auth.uid()
    )
  );
