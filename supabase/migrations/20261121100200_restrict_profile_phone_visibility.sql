-- Phone numbers are personal data (ADR 0004). Members of the same tenant may
-- see each other's names, but only the member themselves and organization or
-- regional administrators of a shared tenant may read a phone number.
-- RLS is row-level, so the phone column is removed from the direct grant and
-- exposed through a narrowly checked function instead.

revoke select, insert, update, delete on public.profiles from anon;
revoke select, update on public.profiles from authenticated;
grant select (id, full_name, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create or replace function public.get_profile_phone(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.phone
  from public.profiles as profile
  where profile.id = p_profile_id
    and (
      profile.id = auth.uid()
      or exists (
        select 1
        from public.organization_members as viewer
        join public.organization_members as subject
          on subject.organization_id = viewer.organization_id
        where viewer.user_id = auth.uid()
          and viewer.role in ('organization_admin', 'regional_admin')
          and subject.user_id = p_profile_id
      )
    );
$$;

revoke execute on function public.get_profile_phone(uuid) from public, anon;
grant execute on function public.get_profile_phone(uuid) to authenticated;
