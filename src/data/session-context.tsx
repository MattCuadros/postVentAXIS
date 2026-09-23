"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useDataContext } from "@/data/store-context";
import type { Role, User } from "@/types/domain";

/** Cookies de sesión simulada. El rol va aparte para que `src/proxy.ts` pueda rutear sin leer los datos locales. */
export const USER_COOKIE = "pv_user_id";
export const ROLE_COOKIE = "pv_role";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

interface SessionContextValue {
  user: User | null;
  role: Role | null;
  setUser: (userId: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function getCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length));
}

function writeCookie(name: string, value: string | null): void {
  document.cookie = value === null
    ? `${name}=; path=/; max-age=0`
    : `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
}

const listeners = new Set<() => void>();

function subscribeToCookie(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getCookieSnapshot(): string | null {
  return getCookie(USER_COOKIE);
}

function getServerCookieSnapshot(): string | null {
  return null;
}

function notifyCookieChange(): void {
  for (const listener of listeners) listener();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { state } = useDataContext();
  const userId = useSyncExternalStore(subscribeToCookie, getCookieSnapshot, getServerCookieSnapshot);
  // Un usuario desactivado (o eliminado de los datos locales) queda sin sesión.
  const user = useMemo(() => state.users.find((item) => item.id === userId && item.active) ?? null, [state.users, userId]);

  const setUser = useCallback((nextUserId: string | null) => {
    const nextUser = state.users.find((item) => item.id === nextUserId && item.active) ?? null;
    writeCookie(USER_COOKIE, nextUser?.id ?? null);
    writeCookie(ROLE_COOKIE, nextUser?.role ?? null);
    notifyCookieChange();
  }, [state.users]);

  const value = useMemo<SessionContextValue>(() => ({
    user,
    role: user?.role ?? null,
    setUser,
  }), [user, setUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
