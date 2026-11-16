-- Guarda convites administrativos e entrega o cargo apenas pelo fluxo confiavel do servidor.

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists invitation_pending boolean not null default false;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

create table if not exists public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  profile text not null check (profile in ('admin', 'supervisor', 'engenheiro', 'encarregado')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists employee_invitations_one_pending_per_email
  on public.employee_invitations (lower(email))
  where status = 'pending';

alter table public.employee_invitations enable row level security;
revoke all privileges on table public.employee_invitations from public, anon, authenticated;
grant select, insert, update, delete on public.employee_invitations to service_role;

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  invited_profile text;
begin
  select i.id, i.profile
  into invitation_id, invited_profile
  from public.employee_invitations i
  where lower(i.email) = lower(new.email)
    and i.status = 'pending'
    and i.auth_user_id is null
  order by i.created_at desc
  limit 1
  for update;

  if invitation_id is null then
    return new;
  end if;

  update public.employee_invitations
  set auth_user_id = new.id
  where id = invitation_id;

  insert into public.profiles (id, profile, email, invitation_pending)
  values (
    new.id,
    invited_profile,
    new.email,
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;
grant execute on function private.create_profile_for_auth_user() to supabase_auth_admin;

create or replace function private.sync_auth_user_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

revoke all on function private.sync_auth_user_profile_email() from public, anon, authenticated;
grant execute on function private.sync_auth_user_profile_email() to supabase_auth_admin;

drop trigger if exists sync_auth_user_profile_email on auth.users;
create trigger sync_auth_user_profile_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_auth_user_profile_email();

create or replace function public.complete_employee_invitation(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_name text := nullif(btrim(p_full_name), '');
begin
  if actor_id is null then
    raise exception 'Entre na sua conta para concluir o convite.' using errcode = '42501';
  end if;

  if clean_name is null or length(clean_name) > 150 then
    raise exception 'Informe um nome com até 150 caracteres.' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = clean_name,
      invitation_pending = false,
      updated_at = now()
  where id = actor_id and invitation_pending = true;

  if not found then
    raise exception 'Não há um convite pendente para esta conta.' using errcode = '42501';
  end if;

  update public.employee_invitations
  set status = 'accepted',
      accepted_at = now()
  where auth_user_id = actor_id and status = 'pending';
end;
$$;

revoke all on function public.complete_employee_invitation(text) from public, anon;
grant execute on function public.complete_employee_invitation(text) to authenticated;
