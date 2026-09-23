"use client";

import { useState } from "react";
import { UserImporter } from "@/components/admin/user-importer";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { cn } from "@/lib/cn";
import { unitLabel } from "@/lib/format";
import { fieldErrors, ROLE_OPTIONS, userSchema } from "@/lib/schemas";
import { ROLE_LABEL } from "@/lib/user-import";
import type { Role, User } from "@/types/domain";

type RoleFilter = Role | "TODOS";
type DialogKind = "create" | "edit" | "import" | "deactivate" | null;
const FILTERS: RoleFilter[] = ["TODOS", ...ROLE_OPTIONS];

export default function UsuariosPage() {
  const api = useDataApi();
  const { user: currentUser } = useSession();
  const { data: users } = useQuery(api.getUsers);
  const { data: zones } = useQuery(api.getZones);
  const { data: units } = useQuery(api.getUnits);
  const [filter, setFilter] = useState<RoleFilter>("TODOS");
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const term = search.trim().toLocaleLowerCase("es");
  const listedUsers = (users ?? []).filter((user) => includeInactive || user.active);
  const visible = listedUsers.filter((user) => filter === "TODOS" || user.role === filter).filter((user) => !term || `${user.name} ${user.email}`.toLocaleLowerCase("es").includes(term)).toSorted((a, b) => a.name.localeCompare(b.name, "es"));

  function detail(user: User): string {
    if (user.role === "ADMIN") return "Todas las zonas";
    if (user.role === "ENCARGADO") return zones?.filter((zone) => user.zoneIds.includes(zone.id)).map((zone) => zone.name).join(", ") || "Sin zonas";
    const owned = units?.filter((unit) => unit.ownerId === user.id) ?? [];
    return owned.length === 0 ? "Sin vivienda asignada" : owned.map(unitLabel).join(", ");
  }
  function openDialog(kind: DialogKind, user: User | null = null) {
    setActionError(null);
    setSelectedUser(user);
    setDialog(kind);
  }
  async function changeActive(user: User, active: boolean) {
    setUpdatingUserId(user.id);
    setActionError(null);
    try {
      await api.updateUser(user.id, { active });
      setDialog(null);
      setSelectedUser(null);
      setNotice(`${user.name} fue ${active ? "reactivado" : "desactivado"}.`);
    } catch {
      setActionError("No se pudo actualizar el estado del usuario. Inténtalo nuevamente.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  return <div className="pb-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl">Usuarios</h1><p className="mt-1 text-sm text-ink-secondary">Propietarios, encargados zonales y administradores.</p></div>
      <div className="flex gap-3"><Button variant="secondary" onClick={() => openDialog("import")}>Importar desde Excel</Button><Button onClick={() => openDialog("create")}>Nuevo usuario</Button></div>
    </header>
    {notice && <div className="mt-5 flex items-start justify-between gap-3 rounded-md bg-success/10 p-4 text-sm text-success" role="status"><p>{notice}</p><button type="button" aria-label="Cerrar aviso" className="shrink-0 font-bold" onClick={() => setNotice(null)}>×</button></div>}
    {actionError && <p className="mt-5 text-sm text-danger" role="alert">{actionError}</p>}
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
      <div role="tablist" aria-label="Filtrar por rol" className="flex flex-wrap gap-1 rounded-md bg-surface-secondary p-1">
        {FILTERS.map((item) => {
          const count = item === "TODOS" ? listedUsers.length : listedUsers.filter((user) => user.role === item).length;
          return <button key={item} type="button" role="tab" aria-selected={filter === item} className={cn("rounded-sm px-3 py-1.5 text-sm transition-colors", filter === item ? "bg-surface font-bold text-accent" : "text-ink-secondary hover:text-accent")} onClick={() => setFilter(item)}>
            {item === "TODOS" ? "Todos" : `${ROLE_LABEL[item]}${item === "ADMIN" ? "es" : "s"}`} <span className="text-ink-meta">({count})</span>
          </button>;
        })}
      </div>
      <div className="flex w-full flex-wrap items-end gap-4 sm:w-auto">
        <label className="flex h-10 items-center gap-2 text-sm text-ink-secondary"><input type="checkbox" className="accent-[#003399]" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />Incluir inactivos</label>
        <div className="w-full sm:w-72"><Input label="Buscar" name="user-search" type="search" placeholder="Nombre o correo" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      </div>
    </div>
    {users === undefined ? <p className="mt-6 text-sm text-ink-secondary" role="status">Cargando usuarios…</p> : visible.length === 0 ? <div className="mt-6 rounded-lg border border-line-soft bg-surface p-8 text-center"><p className="font-bold text-ink">No hay usuarios con estos filtros</p>{!includeInactive && <p className="mt-1 text-sm text-ink-secondary">Activa “Incluir inactivos” para ver usuarios desactivados.</p>}</div> : (
      <div className="mt-4 overflow-x-auto rounded-lg border border-line-soft bg-surface px-6 py-2"><table className="w-full min-w-[52rem] text-left text-sm">
        <thead><tr className="border-b border-line-soft"><th scope="col" className="py-4 pr-4 font-bold text-ink">Nombre</th><th scope="col" className="py-4 pr-4 font-bold text-ink">Contacto</th><th scope="col" className="py-4 pr-4 font-bold text-ink">Rol</th><th scope="col" className="py-4 pr-4 font-bold text-ink">Zonas o vivienda</th><th scope="col" className="py-4 text-right font-bold text-ink">Acciones</th></tr></thead>
        <tbody>{visible.map((user) => {
          const isSelf = user.id === currentUser?.id;
          return <tr key={user.id} className="border-b border-line-soft last:border-b-0">
            <td className="py-4 pr-4 font-bold text-ink">{user.name}{!user.active && <span className="ml-2 inline-flex rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-normal text-ink-meta">Inactivo</span>}</td>
            <td className="py-4 pr-4 text-ink">{user.email}<span className="block text-xs text-ink-meta">{user.phone}</span></td><td className="py-4 pr-4 text-ink">{ROLE_LABEL[user.role]}</td><td className="py-4 pr-4 text-ink-secondary">{detail(user)}</td>
            <td className="py-4 text-right"><div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => openDialog("edit", user)}>Editar</Button>{user.active ? <Button variant="danger" disabled={isSelf || updatingUserId === user.id} title={isSelf ? "No puedes desactivarte a ti mismo." : undefined} onClick={() => openDialog("deactivate", user)}>Desactivar</Button> : <Button variant="secondary" disabled={updatingUserId === user.id} onClick={() => changeActive(user, true)}>Reactivar</Button>}</div></td>
          </tr>;
        })}</tbody>
      </table></div>
    )}
    <Dialog open={dialog === "create"} title="Nuevo usuario" onClose={() => setDialog(null)}>{dialog === "create" && <UserForm onCancel={() => setDialog(null)} onSaved={(user) => { setDialog(null); setNotice(user.role === "PROPIETARIO" ? `${user.name} creado. Asígnale su vivienda desde Obras y unidades.` : `${user.name} creado como ${ROLE_LABEL[user.role].toLowerCase()}.`); }} />}</Dialog>
    <Dialog open={dialog === "edit"} title="Editar usuario" onClose={() => setDialog(null)}>{dialog === "edit" && selectedUser && <UserForm user={selectedUser} currentUserId={currentUser?.id} ownerUnitCount={units?.filter((unit) => unit.ownerId === selectedUser.id).length ?? 0} onCancel={() => setDialog(null)} onSaved={(user) => { setDialog(null); setNotice(`${user.name} fue actualizado.`); }} />}</Dialog>
    <Dialog open={dialog === "import"} title="Importar usuarios desde Excel" onClose={() => setDialog(null)}>{dialog === "import" && <UserImporter onCancel={() => setDialog(null)} onDone={(imported, skipped) => { setDialog(null); setNotice(`${imported} ${imported === 1 ? "usuario importado" : "usuarios importados"}${skipped > 0 ? `. ${skipped} ${skipped === 1 ? "fila con errores no se importó" : "filas con errores no se importaron"}.` : "."}`); }} />}</Dialog>
    <Dialog open={dialog === "deactivate"} title="Desactivar usuario" onClose={() => setDialog(null)}>{dialog === "deactivate" && selectedUser && <div><p className="text-sm text-ink-secondary">{selectedUser.name} ya no podrá iniciar sesión hasta que reactives su cuenta.</p><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" disabled={updatingUserId === selectedUser.id} onClick={() => setDialog(null)}>Cancelar</Button><Button variant="danger" disabled={updatingUserId === selectedUser.id} onClick={() => changeActive(selectedUser, false)}>{updatingUserId === selectedUser.id ? "Desactivando…" : "Desactivar"}</Button></div></div>}</Dialog>
  </div>;
}

type UserFormProps = { user?: User; currentUserId?: string; ownerUnitCount?: number; onSaved: (user: User) => void; onCancel: () => void };
function UserForm({ user, currentUserId, ownerUnitCount = 0, onSaved, onCancel }: UserFormProps) {
  const api = useDataApi();
  const { data: zones } = useQuery(api.getZones);
  const { data: users } = useQuery(api.getUsers);
  const [values, setValues] = useState(() => user ? { name: user.name, email: user.email, phone: user.phone, role: user.role, zoneIds: user.zoneIds } : { name: "", email: "", phone: "", role: "PROPIETARIO" as Role, zoneIds: [] as string[] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isOwnRole = user?.id === currentUserId;
  const isOwnerWithUnits = user?.role === "PROPIETARIO" && ownerUnitCount > 0;
  const roleLocked = isOwnRole || isOwnerWithUnits;
  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); }
  async function handleSubmit() {
    const candidate = { ...values, role: roleLocked && user ? user.role : values.role, zoneIds: values.role === "ENCARGADO" ? values.zoneIds : [] };
    const result = userSchema.safeParse(candidate);
    if (!result.success) { setErrors(fieldErrors(result.error)); return; }
    if (users?.some((item) => item.id !== user?.id && item.email.toLowerCase() === result.data.email)) { setErrors({ email: "Ese correo ya está registrado." }); return; }
    setSaving(true); setSubmitError(null);
    try { onSaved(user ? await api.updateUser(user.id, result.data) : await api.createUser({ ...result.data, active: true })); } catch { setSubmitError("No se pudo guardar el usuario. Inténtalo nuevamente."); } finally { setSaving(false); }
  }
  return <div className="flex flex-col gap-4">
    <Input label="Nombre completo" name="user-name" value={values.name} error={errors.name} onChange={(event) => set("name", event.target.value)} />
    <div className="grid gap-4 sm:grid-cols-2"><Input label="Correo" name="user-email" type="email" value={values.email} error={errors.email} onChange={(event) => set("email", event.target.value)} /><Input label="Teléfono" name="user-phone" type="tel" placeholder="+56 9 1234 5678" value={values.phone} error={errors.phone} onChange={(event) => set("phone", event.target.value)} /></div>
    <div><Select label="Rol" name="user-role" value={values.role} disabled={roleLocked} onChange={(event) => set("role", event.target.value as Role)}>{ROLE_OPTIONS.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}</Select>{isOwnRole && <p className="mt-1 text-xs text-ink-meta">No puedes cambiar tu propio rol.</p>}{isOwnerWithUnits && <p className="mt-1 text-xs text-ink-meta">No se puede cambiar el rol porque esta persona tiene viviendas asignadas.</p>}</div>
    {values.role === "ENCARGADO" && <fieldset><legend className="mb-2 text-sm font-bold text-ink">Zonas a cargo</legend>{zones === undefined ? <p className="text-sm text-ink-secondary" role="status">Cargando zonas…</p> : zones.length === 0 ? <p className="text-sm text-ink-secondary">No hay zonas disponibles.</p> : <div className="flex flex-wrap gap-2">{zones.map((zone) => { const checked = values.zoneIds.includes(zone.id); return <label key={zone.id} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-accent", checked ? "border-accent bg-accent-soft font-bold text-accent" : "border-line-soft text-ink hover:border-accent/40")}><input type="checkbox" className="accent-[#003399]" checked={checked} onChange={() => set("zoneIds", checked ? values.zoneIds.filter((id) => id !== zone.id) : [...values.zoneIds, zone.id])} />{zone.name}</label>; })}</div>}{errors.zoneIds && <p className="mt-2 text-sm text-danger" role="alert">{errors.zoneIds}</p>}</fieldset>}
    {submitError && <p className="text-sm text-danger" role="alert">{submitError}</p>}
    <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={saving} onClick={onCancel}>Cancelar</Button><Button disabled={saving} onClick={handleSubmit}>{saving ? "Guardando…" : user ? "Guardar cambios" : "Crear usuario"}</Button></div>
  </div>;
}
