-- Administrators may change another member's role, but never which user,
-- organization, or tenant a membership row points to. Rewriting user_id
-- would attach an arbitrary account to the tenant (and expose its name and
-- phone to tenant admins) without going through add_organization_member.

revoke update on public.organization_members from authenticated;
grant update (role) on public.organization_members to authenticated;
