-- Ingreso con Google Workspace: la base de datos decide quién entra.
-- Todas las funciones son security definer con search_path fijo y solo las ejecuta `authenticated`.

-- Dominios de correo aceptados para el ingreso con Google (sin políticas: solo lo leen las funciones).
create table public.auth_allowed_domains (domain text primary key check (domain = lower(domain)));
alter table public.auth_allowed_domains enable row level security;
insert into public.auth_allowed_domains (domain) values ('axisdc.cl');

-- Vincula la sesión actual con su usuario del directorio. Exige una identidad de Google con correo
-- verificado (no sirve una cuenta creada con correo y contraseña), dominio permitido y usuario activo.
create function public.link_google_user() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_user public.users;
begin
  if v_uid is null then return jsonb_build_object('status', 'SIN_GOOGLE'); end if;

  select lower(i.identity_data->>'email') into v_email
  from auth.identities i
  where i.user_id = v_uid and i.provider = 'google'
    and coalesce((i.identity_data->>'email_verified')::boolean, false)
  limit 1;
  if v_email is null then return jsonb_build_object('status', 'SIN_GOOGLE'); end if;

  if not exists (select 1 from public.auth_allowed_domains d where d.domain = split_part(v_email, '@', 2)) then
    return jsonb_build_object('status', 'DOMINIO');
  end if;

  select u.* into v_user from public.users u where lower(u.email) = v_email;
  if not found then return jsonb_build_object('status', 'NO_REGISTRADO'); end if;
  if not v_user.active then return jsonb_build_object('status', 'INACTIVO'); end if;

  if v_user.auth_user_id is distinct from v_uid then
    update public.users set auth_user_id = null where auth_user_id = v_uid;
    update public.users set auth_user_id = v_uid where id = v_user.id;
  end if;
  return jsonb_build_object('status', 'OK', 'id', v_user.id, 'role', v_user.role);
end $$;

-- Perfil del usuario de la sesión actual (null si no está vinculado o está desactivado).
create function public.session_profile() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', u.id, 'name', u.name, 'email', u.email, 'phone', u.phone, 'role', u.role, 'active', u.active,
    'zone_ids', coalesce((select jsonb_agg(z.zone_id order by z.zone_id) from public.user_zones z where z.user_id = u.id), '[]'::jsonb),
    'project_ids', coalesce((select jsonb_agg(p.project_id order by p.project_id) from public.user_projects p where p.user_id = u.id), '[]'::jsonb))
  from public.users u
  where u.auth_user_id = (select auth.uid()) and u.active
$$;

-- Alta o cambio de un usuario del directorio; solo un superadministrador activo.
create function public.admin_upsert_user(p_user jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me public.users := public.current_app_user();
  v_id text := nullif(trim(p_user->>'id'), '');
  v_email text := lower(trim(p_user->>'email'));
begin
  if v_me.id is null or v_me.role <> 'ADMIN' then return jsonb_build_object('status', 'SIN_PERMISO'); end if;
  if v_id is null or v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or nullif(trim(p_user->>'name'), '') is null then
    return jsonb_build_object('status', 'DATOS_INVALIDOS');
  end if;
  if exists (select 1 from public.users u where lower(u.email) = v_email and u.id <> v_id) then
    return jsonb_build_object('status', 'CORREO_DUPLICADO');
  end if;
  -- Nadie se quita a sí mismo el rol ni se desactiva: siempre queda al menos quien administra.
  if v_id = v_me.id and ((p_user->>'role') <> 'ADMIN' or not coalesce((p_user->>'active')::boolean, true)) then
    return jsonb_build_object('status', 'SIN_PERMISO');
  end if;

  insert into public.users (id, name, email, phone, role, active)
  values (v_id, trim(p_user->>'name'), v_email, coalesce(p_user->>'phone', ''), (p_user->>'role')::public.app_role, coalesce((p_user->>'active')::boolean, true))
  on conflict (id) do update set name = excluded.name, email = excluded.email, phone = excluded.phone, role = excluded.role, active = excluded.active;

  -- Un correo distinto ya no corresponde a la cuenta de Google vinculada.
  update public.users u set auth_user_id = null
  where u.id = v_id and u.auth_user_id is not null
    and not exists (select 1 from auth.identities i where i.user_id = u.auth_user_id and i.provider = 'google' and lower(i.identity_data->>'email') = v_email);

  delete from public.user_zones where user_id = v_id;
  insert into public.user_zones (user_id, zone_id)
  select v_id, z.id from public.zones z where z.id in (select jsonb_array_elements_text(coalesce(p_user->'zone_ids', '[]'::jsonb)));

  delete from public.user_projects where user_id = v_id;
  insert into public.user_projects (user_id, project_id)
  select v_id, p.id from public.projects p where p.id in (select jsonb_array_elements_text(coalesce(p_user->'project_ids', '[]'::jsonb)));

  return jsonb_build_object('status', 'OK', 'id', v_id);
end $$;

revoke execute on function public.link_google_user(), public.session_profile(), public.admin_upsert_user(jsonb) from public, anon;
grant execute on function public.link_google_user(), public.session_profile(), public.admin_upsert_user(jsonb) to authenticated;
