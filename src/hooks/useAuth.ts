import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "student"
  | "ward_admin"
  | "constituency_admin"
  | "county_admin"
  | "super_admin";

export interface AuthState {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
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
        // defer role fetch to avoid deadlock
        setTimeout(() => {
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", newSession.user.id)
            .then(({ data }) => {
              setRoles((data ?? []).map((r: { role: AppRole }) => r.role));
            });
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
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", existing.user.id)
          .then(({ data }) => {
            setRoles((data ?? []).map((r: { role: AppRole }) => r.role));
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
    "student",
  ];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}

export function isAdmin(roles: AppRole[]): boolean {
  return roles.some((r) => r !== "student");
}
