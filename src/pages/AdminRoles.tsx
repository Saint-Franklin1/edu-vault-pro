import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole, highestRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Trash2 } from "lucide-react";
import { AdminPromotionPanel } from "@/components/AdminPromotionPanel";

type AdminStatus = "active" | "suspended" | "banned" | "deleted";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  admin_status: AdminStatus;
  status_reason: string | null;
}
interface RoleRow {
  id: string;
  user_id: string;
  role: AppRole;
}

const ALL_ROLES: AppRole[] = ["student", "ward_admin", "constituency_admin", "county_admin", "super_admin"];
const STATUS_OPTIONS: AdminStatus[] = ["active", "suspended", "banned", "deleted"];

const statusVariant = (s: AdminStatus): "default" | "secondary" | "destructive" =>
  s === "active" ? "default" : s === "suspended" ? "secondary" : "destructive";

const AdminRoles = () => {
  const { roles: myRoles, loading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState("");

  const isSuper = myRoles.includes("super_admin");

  const load = async () => {
    const [{ data: profs, error: pErr }, { data: rs, error: rErr }] = await Promise.all([
      supabase.from("profiles")
        .select("id,email,full_name,admin_status,status_reason")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("id,user_id,role"),
    ]);
    if (pErr) toast({ title: "Failed to load users", description: pErr.message, variant: "destructive" });
    if (rErr) toast({ title: "Failed to load roles", description: rErr.message, variant: "destructive" });
    setProfiles((profs as ProfileRow[]) ?? []);
    setRoleRows((rs as RoleRow[]) ?? []);
  };

  useEffect(() => {
    if (!loading && isSuper) load();
  }, [loading, isSuper]);

  if (!loading && !isSuper) return <Navigate to="/admin" replace />;

  const filtered = profiles.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.email ?? "").toLowerCase().includes(q) || (p.full_name ?? "").toLowerCase().includes(q);
  });

  const revoke = async (rowId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", rowId);
    if (error) {
      toast({ title: "Couldn't revoke", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role revoked" });
      load();
    }
  };

  const changeStatus = async (uid: string, status: AdminStatus) => {
    const reason = status === "active" ? null : window.prompt(`Reason for marking user as ${status}?`, "");
    if (status !== "active" && reason === null) return;
    const { error } = await supabase.rpc("set_admin_status", {
      _target: uid,
      _status: status,
      _reason: reason,
    });
    if (error) {
      toast({ title: "Couldn't update status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `User marked ${status}` });
      load();
    }
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Role management</h1>
            <p className="text-muted-foreground">
              Promote users to admin roles with geographic scope. Super-admin only.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-5 h-5 text-accent" />
            Super admin
          </div>
        </div>

        <AdminPromotionPanel onPromoted={load} />


        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>{profiles.length} total</CardDescription>
            </div>
            <Input
              placeholder="Search by name or email…"
              className="max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No users found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const rs = roleRows.filter((r) => r.user_id === p.id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{p.email}</div>
                        </TableCell>
                        <TableCell>
                          {rs.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {rs.map((r) => (
                                <Badge key={r.id} variant="secondary" className="capitalize gap-1">
                                  {r.role.replace("_", " ")}
                                  <button
                                    onClick={() => revoke(r.id)}
                                    className="ml-1 hover:text-destructive"
                                    aria-label={`Revoke ${r.role}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(p.admin_status)} className="capitalize">
                            {p.admin_status}
                          </Badge>
                          {p.status_reason && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={p.status_reason}>
                              {p.status_reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <Select value={p.admin_status} onValueChange={(v) => changeStatus(p.id, v as AdminStatus)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default AdminRoles;
