-- Field boundaries as GeoJSON for the web maps (ADR 0016).
--
-- PostgREST returns geography columns as hex EWKB, which a browser map can't
-- draw. This computed column (select=boundary_geojson) returns the boundary
-- as a GeoJSON Polygon instead. It is SECURITY INVOKER and receives the row
-- itself, so it only ever sees fields the caller can already read through
-- RLS; it adds no new access.

create or replace function public.boundary_geojson(p_field public.fields)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select extensions.st_asgeojson(p_field.boundary::extensions.geometry, 6)::jsonb;
$$;

revoke execute on function public.boundary_geojson(public.fields) from public, anon;
grant execute on function public.boundary_geojson(public.fields) to authenticated;
