create table public.rdo_erp_sync_events (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdos(id) on delete restrict,
  integration text not null default 'totvs_protheus' check (integration = 'totvs_protheus'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  response_status integer,
  erp_reference text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz
);

create index rdo_erp_sync_events_recent_idx
  on public.rdo_erp_sync_events (created_at desc);
create index rdo_erp_sync_events_pending_idx
  on public.rdo_erp_sync_events (status, created_at)
  where status in ('pending', 'failed');

alter table public.rdo_erp_sync_events enable row level security;
revoke all privileges on public.rdo_erp_sync_events from public, anon, authenticated;
grant select on public.rdo_erp_sync_events to authenticated;

create policy rdo_erp_sync_events_admin_select on public.rdo_erp_sync_events
  for select to authenticated
  using ((select private.is_admin()));

create or replace function private.queue_approved_rdo_for_erp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    insert into public.rdo_erp_sync_events (rdo_id)
    values (new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.queue_approved_rdo_for_erp() from public, anon, authenticated;

drop trigger if exists rdos_queue_erp_sync on public.rdos;
create trigger rdos_queue_erp_sync
  after update of status on public.rdos
  for each row
  when (new.status = 'approved' and old.status is distinct from new.status)
  execute function private.queue_approved_rdo_for_erp();

drop function public.transition_rdo_status(uuid, text, text);

create function public.transition_rdo_status(
  p_rdo_id uuid,
  p_status text,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sync_event_id uuid;
begin
  perform private.transition_rdo_status_impl(p_rdo_id, p_status, p_comment);

  if p_status = 'approved' then
    select e.id
    into sync_event_id
    from public.rdo_erp_sync_events e
    where e.rdo_id = p_rdo_id
      and e.status = 'pending'
    order by e.created_at desc, e.id desc
    limit 1;
  end if;

  return sync_event_id;
end;
$$;

revoke all on function public.transition_rdo_status(uuid, text, text) from public, anon;
grant execute on function public.transition_rdo_status(uuid, text, text) to authenticated;
