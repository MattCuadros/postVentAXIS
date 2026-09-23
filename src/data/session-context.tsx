"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { users } from "@/mocks/data";
import type { Role, User } from "@/types/domain";

const COOKIE_NAME = "pv_user_id";
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

const listeners = new Set<() => void>();

function subscribeToCookie(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getCookieSnapshot(): string | null {
  return getCookie(COOKIE_NAME);
}

function getServerCookieSnapshot(): string | null {
  return null;
}

function notifyCookieChange(): void {
  for (const listener of listeners) listener();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const userId = useSyncExternalStore(subscribeToCookie, getCookieSnapshot, getServerCookieSnapshot);
  const user = useMemo(() => users.find((item) => item.id === userId) ?? null, [userId]);

  const setUser = useCallback((nextUserId: string | null) => {
    const nextUser = users.find((item) => item.id === nextUserId) ?? null;
    if (nextUser === null) {
      document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    } else {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(nextUser.id)}; path=/; max-age=${ONE_YEAR_IN_SECONDS}`;
    }
    notifyCookieChange();
  }, []);

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
