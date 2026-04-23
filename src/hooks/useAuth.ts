import { useEffect, useState } from "react";
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
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("admin_status")
      .eq("id", userId)
      .maybeSingle(),
  ]);

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

export function useAuth(): AuthState & { signOut: () => Promise<void> } {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // defer to avoid deadlock with the auth callback
        setTimeout(() => {
          loadRolesAndEnforceStatus(newSession.user.id).then(setRoles);
        }, 0);
      } else {
        setRoles([]);
      }
    });

    // THEN load existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadRolesAndEnforceStatus(existing.user.id).then((r) => {
          setRoles(r);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, roles, loading, signOut };
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
