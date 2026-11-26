-- Farmers see only the names they need (security review of ADR 0018).
--
-- profiles_share_organization let every member read the name of every other
-- member of a shared organization. With public farmer self-registration
-- (ADR 0018) anyone could join as a farmer and list the names of all members,
-- including every other farmer with a login. Phone numbers were already
-- protected (get_profile_phone).
--
-- Now a viewer whose role is 'farmer' sees a member's name only when that
-- member appears on one of the farmer's own bookings: as the actor of a status
-- change (mitra, regional admin, pilot) or as an assigned pilot. Staff
-- visibility is unchanged.

create or replace function public.profiles_share_organization(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as viewer
    join public.organization_members as subject
      on subject.organization_id = viewer.organization_id
    where viewer.user_id = auth.uid()
      and subject.user_id = p_profile_id
      and (
        viewer.role <> 'farmer'
        or subject.user_id = viewer.user_id
        or exists (
          select 1
          from public.booking_status_history as history
          where history.tenant_id = viewer.organization_id
            and history.actor_id = p_profile_id
            and public.can_view_booking(history.booking_id)
        )
        or exists (
          select 1
          from public.booking_assignments as assignment
          where assignment.tenant_id = viewer.organization_id
            and assignment.pilot_user_id = p_profile_id
            and public.can_view_booking(assignment.booking_id)
        )
      )
  );
$$;

revoke execute on function public.profiles_share_organization(uuid) from public, anon;
grant execute on function public.profiles_share_organization(uuid) to authenticated;

-- Supports the actor lookup above.
create index booking_status_history_actor_idx on public.booking_status_history (tenant_id, actor_id);
