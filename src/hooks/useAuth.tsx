import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type AppRole =
  | "student"
  | "chief"
  | "ward_admin"
  | "constituency_admin"
  | "county_admin"
  | "super_admin";

export type AdminStatus = "active" | "suspended" | "banned" | "deleted";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
}

const STATUS_MESSAGES: Record<Exclude<AdminStatus, "active">, string> = {
  suspended: "Your admin account has been suspended. Contact a super admin for assistance.",
  banned: "Your admin account has been banned. Access is permanently revoked.",
  deleted: "This admin account has been deleted.",
};

async function loadRolesAndEnforceStatus(userId: string): Promise<AppRole[]> {
  const [{ data: roleRows, error: roleError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("admin_status")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (roleError) throw roleError;
  if (profileError) throw profileError;

  const roles = (roleRows ?? []).map((r: { role: AppRole }) => r.role);
  const status = (profile?.admin_status ?? "active") as AdminStatus;
  const userIsAdmin = roles.some((r) => r !== "student");

  if (userIsAdmin && status !== "active") {
    await supabase.auth.signOut();
    toast({
      title: "Sign-in blocked",
      description: STATUS_MESSAGES[status],
      variant: "destructive",
    });
    return [];
  }

  return roles;
}

type AuthContextValue = AuthState & { signOut: () => Promise<void> };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const requestSeq = useRef(0);

  const syncAuthState = useCallback(async (newSession: Session | null) => {
    const requestId = ++requestSeq.current;
    setLoading(true);
    setSession(newSession);
    setUser(newSession?.user ?? null);

    if (!newSession?.user) {
      if (requestId === requestSeq.current) {
        setRoles([]);
        setLoading(false);
      }
      return;
    }

    try {
      const resolvedRoles = await loadRolesAndEnforceStatus(newSession.user.id);
      if (requestId !== requestSeq.current) return;
      setRoles(resolvedRoles);
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      setRoles([]);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Auth session refresh failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (requestId === requestSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let bootstrapped = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      bootstrapped = true;
      // defer to avoid deadlock with the auth callback
      setTimeout(() => {
        void syncAuthState(newSession);
      }, 0);
    });

    void supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!bootstrapped) {
        void syncAuthState(existing);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncAuthState]);

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({ session, user, roles, loading, signOut }),
    [session, user, roles, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function highestRole(roles: AppRole[]): AppRole | null {
  const order: AppRole[] = [
    "super_admin",
    "county_admin",
    "constituency_admin",
    "ward_admin",
    "chief",
    "student",
  ];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}

export function isAdmin(roles: AppRole[]): boolean {
  return roles.some((r) => r !== "student");
}
