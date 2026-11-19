drop policy organization_members_update_admin on public.organization_members;

create policy organization_members_update_admin on public.organization_members
for update to authenticated
using (
  user_id <> auth.uid()
  and public.has_organization_role(
    organization_id,
    array['super_admin', 'admin']::public.organization_role[]
  )
)
with check (
  user_id <> auth.uid()
  and (
    public.has_organization_role(
      organization_id,
      array['super_admin']::public.organization_role[]
    )
    or role <> 'super_admin'
  )
);
