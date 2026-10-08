-- All writes are intentionally reserved for trusted server-side code using the service role.
create function current_app_user() returns users language sql stable security definer set search_path = public, pg_temp as $$ select u from public.users u where u.auth_user_id = (select auth.uid()) and u.active limit 1 $$;
create function is_staff() returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select coalesce((select (current_app_user()).role in ('ADMIN','ENCARGADO')),false) $$;
create function zones_of_user() returns setof text language sql stable security definer set search_path = public, pg_temp as $$ select uz.zone_id from public.user_zones uz join public.users u on u.id=uz.user_id where u.auth_user_id=(select auth.uid()) and u.active $$;
create function projects_of_user() returns setof text language sql stable security definer set search_path = public, pg_temp as $$ select up.project_id from public.user_projects up join public.users u on u.id=up.user_id where u.auth_user_id=(select auth.uid()) and u.active $$;
create function has_access_to_unit(target_unit_id text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.units u join public.users me on me.auth_user_id=(select auth.uid()) where u.id=target_unit_id and (u.owner_id=me.id or exists(select 1 from public.unit_responsibles r where r.unit_id=u.id and r.user_id=me.id))) $$;
create function unit_in_user_zone(target_unit_id text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.units u join public.projects p on p.id=u.project_id where u.id=target_unit_id and p.zone_id in (select zones_of_user())) $$;
create function project_in_user_zone(target_project_id text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.projects p where p.id=target_project_id and p.zone_id in (select zones_of_user())) $$;
create function unit_in_user_projects(target_unit_id text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.units u where u.id=target_unit_id and u.project_id in (select projects_of_user())) $$;
create function user_linked_to_zone(target_user_id text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.units u join public.projects p on p.id=u.project_id where p.zone_id in (select zones_of_user()) and (u.owner_id=target_user_id or exists(select 1 from public.unit_responsibles r where r.unit_id=u.id and r.user_id=target_user_id))) $$;
create function user_has_access_in_project(target_project_id text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select exists(select 1 from public.units u where u.project_id=target_project_id and has_access_to_unit(u.id)) $$;

do $$ declare t text; begin
 foreach t in array array['zones','users','user_zones','projects','user_projects','units','ticket_categories','work_crews','crew_projects','tickets','ticket_media','ticket_documents','ticket_external_refs','ticket_special_cases','ticket_status_history','unit_responsibles'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

create policy zones_read on zones for select to authenticated using ((select auth.uid()) is not null);
create policy categories_read on ticket_categories for select to authenticated using ((select auth.uid()) is not null);
create policy users_read on users for select to authenticated using (
 (select (current_app_user()).role)='ADMIN'
 or (select (current_app_user()).role)='ENCARGADO' and (id=(select (current_app_user()).id) or user_linked_to_zone(id))
 or (select (current_app_user()).role)='PROPIETARIO' and id=(select (current_app_user()).id)
 or (select (current_app_user()).role)='ADMIN_OBRA' and id=(select (current_app_user()).id)
);
create policy user_zones_read on user_zones for select to authenticated using (user_id=(select (current_app_user()).id) or (select (current_app_user()).role)='ADMIN' or (select (current_app_user()).role)='ENCARGADO' and zone_id in (select zones_of_user()));
create policy user_projects_read on user_projects for select to authenticated using (user_id=(select (current_app_user()).id) or (select (current_app_user()).role)='ADMIN');
create policy projects_read on projects for select to authenticated using ((select (current_app_user()).role)='ADMIN' or (select (current_app_user()).role)='ENCARGADO' and project_in_user_zone(id) or (select (current_app_user()).role)='ADMIN_OBRA' and id in (select projects_of_user()) or (select (current_app_user()).role)='PROPIETARIO' and user_has_access_in_project(id));
create policy units_read on units for select to authenticated using ((select (current_app_user()).role)='ADMIN' or (select (current_app_user()).role)='ENCARGADO' and project_in_user_zone(project_id) or (select (current_app_user()).role)='ADMIN_OBRA' and project_id in (select projects_of_user()) or (select (current_app_user()).role)='PROPIETARIO' and has_access_to_unit(id));
create policy crews_read on work_crews for select to authenticated using ((select (current_app_user()).role)='ADMIN' or (select (current_app_user()).role)='ENCARGADO' and zone_id in (select zones_of_user()));
create policy crew_projects_read on crew_projects for select to authenticated using ((select (current_app_user()).role)='ADMIN' or exists(select 1 from work_crews c where c.id=crew_id and c.zone_id in (select zones_of_user())));
create policy tickets_read on tickets for select to authenticated using ((select (current_app_user()).role)='ADMIN' or (select (current_app_user()).role)='ENCARGADO' and unit_in_user_zone(unit_id) or (select (current_app_user()).role)='PROPIETARIO' and has_access_to_unit(unit_id) or (select (current_app_user()).role)='ADMIN_OBRA' and unit_in_user_projects(unit_id));
create policy ticket_media_read on ticket_media for select to authenticated using (exists(select 1 from tickets t where t.id=ticket_id));
create policy ticket_documents_read on ticket_documents for select to authenticated using (exists(select 1 from tickets t where t.id=ticket_id));
create policy ticket_refs_read on ticket_external_refs for select to authenticated using (exists(select 1 from tickets t where t.id=ticket_id));
create policy ticket_history_read on ticket_status_history for select to authenticated using (exists(select 1 from tickets t where t.id=ticket_id));
create policy unit_responsibles_read on unit_responsibles for select to authenticated using ((select (current_app_user()).role)='ADMIN' or (select (current_app_user()).role)='ENCARGADO' and unit_in_user_zone(unit_id) or (select (current_app_user()).role)='PROPIETARIO' and has_access_to_unit(unit_id));
create policy special_cases_read on ticket_special_cases for select to authenticated using ((select (current_app_user()).role) in ('ADMIN','ENCARGADO') and exists(select 1 from tickets t where t.id=ticket_id));
