create or replace function private.can_add_rdo_photo(target_rdo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rdos r
    where r.id = target_rdo_id
      and r.deleted_at is null
      and r.status in ('draft', 'rejected', 'submitted')
      and (
        r.user_id = (select auth.uid())
        or private.can_review_rdo()
      )
  )
$$;

revoke all on function private.can_add_rdo_photo(uuid) from public, anon, authenticated;
grant execute on function private.can_add_rdo_photo(uuid) to authenticated;

create policy evidencias_insert_photo_addable on public.evidencias_rdo
  for insert to authenticated
  with check (
    tipo = 'foto'
    and (select private.can_add_rdo_photo(rdo_id))
  );

drop policy evidencias_upload_rdo_access on storage.objects;
create policy evidencias_upload_rdo_access on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (select private.can_add_rdo_photo(((storage.foldername(name))[1])::uuid))
      else false
    end
  );

create policy evidencias_delete_unregistered_photo on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidencias'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (select private.can_add_rdo_photo(((storage.foldername(name))[1])::uuid))
      else false
    end
    and not exists (
      select 1
      from public.evidencias_rdo e
      where e.url = storage.objects.name
    )
  );
