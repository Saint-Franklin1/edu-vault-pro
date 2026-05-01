import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, Ban, FileCheck2, FileText, ShieldCheck,
  UserMinus, UserPlus, Users,
} from "lucide-react";

interface Stats {
  studentsWithUploads: number;
  totalStudents: number;
  adminsActive: number;
  adminsSuspended: number;
  adminsBanned: number;
  adminsDeleted: number;
  docsTotal: number;
  docsVerified: number;
  docsPending: number;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const SuperAdminDashboard = () => {
  const { roles, loading } = useAuth();
  const isSuper = roles.includes("super_admin");

  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [
      studentRoles,
      adminRoles,
      profilesRes,
      docsRes,
      docUsers,
      logsRes,
    ] = await Promise.all([
      supabase.from("user_roles").select("user_id", { count: "exact" }).eq("role", "student"),
      supabase.from("user_roles").select("user_id, role").neq("role", "student"),
      supabase.from("profiles").select("id, admin_status"),
      supabase.from("documents").select("id, status").is("deleted_at", null),
      supabase.from("documents").select("user_id").is("deleted_at", null),
      supabase.from("audit_logs").select("id,action,entity,user_id,metadata,created_at")
        .order("created_at", { ascending: false }).limit(15),
    ]);

    const errors = [studentRoles.error, adminRoles.error, profilesRes.error, docsRes.error, docUsers.error, logsRes.error]
      .filter(Boolean).map((e) => e!.message);
    if (errors.length) setErr(errors.join(" · "));

    const adminUserIds = new Set((adminRoles.data ?? []).map((r) => r.user_id));
    const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id as string, p.admin_status as string]));

    let active = 0, suspended = 0, banned = 0, deleted = 0;
    for (const uid of adminUserIds) {
      const s = profilesById.get(uid) ?? "active";
      if (s === "suspended") suspended++;
      else if (s === "banned") banned++;
      else if (s === "deleted") deleted++;
      else active++;
    }

    const docs = docsRes.data ?? [];
    const uniqueUploaders = new Set((docUsers.data ?? []).map((d) => d.user_id as string)).size;

    setStats({
      studentsWithUploads: uniqueUploaders,
      totalStudents: studentRoles.count ?? 0,
      adminsActive: active,
      adminsSuspended: suspended,
      adminsBanned: banned,
      adminsDeleted: deleted,
      docsTotal: docs.length,
      docsVerified: docs.filter((d) => d.status === "verified").length,
      docsPending: docs.filter((d) => d.status === "pending" || d.status === "in_queue").length,
    });
    setLogs((logsRes.data as AuditLog[]) ?? []);
  };

  useEffect(() => {
    if (!loading && isSuper) {
      load();
      const channel = supabase
        .channel("super-admin-overview")
        .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [loading, isSuper]);

  if (!loading && !isSuper) return <Navigate to="/admin" replace />;

  const tiles = stats ? [
    { label: "Students with uploads", value: stats.studentsWithUploads, sub: `of ${stats.totalStudents} students`, icon: Users, accent: "text-primary" },
    { label: "Admins onboarded", value: stats.adminsActive, sub: "active", icon: UserPlus, accent: "text-accent" },
    { label: "Admins suspended", value: stats.adminsSuspended, sub: "temporarily disabled", icon: UserMinus, accent: "text-amber-600" },
    { label: "Admins banned/deleted", value: stats.adminsBanned + stats.adminsDeleted, sub: `${stats.adminsBanned} banned · ${stats.adminsDeleted} deleted`, icon: Ban, accent: "text-destructive" },
    { label: "Documents", value: stats.docsTotal, sub: `${stats.docsVerified} verified · ${stats.docsPending} pending`, icon: FileText, accent: "text-primary" },
    { label: "Verified docs", value: stats.docsVerified, sub: "approved by admins", icon: FileCheck2, accent: "text-accent" },
  ] : [];

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Super admin overview</h1>
            <p className="text-muted-foreground">Live system metrics, admin lifecycle, and recent audit events.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-5 h-5 text-accent" />
            Super admin
          </div>
        </div>

        {err && (
          <Card className="border-destructive">
            <CardContent className="p-4 text-destructive text-sm">{err}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.label} className="shadow-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">{t.label}</div>
                      <div className="text-3xl font-bold mt-1">{t.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t.sub}</div>
                    </div>
                    <Icon className={`w-6 h-6 ${t.accent}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button asChild><Link to="/admin/roles">Manage roles & admins</Link></Button>
          <Button asChild variant="secondary"><Link to="/admin">Verify documents</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/handover">Hand over super admin</Link></Button>
          <Button asChild variant="outline"><Link to="/admin/bursaries">Post bursary</Link></Button>
          <Button asChild variant="ghost"><Link to="/admin/audit">Full audit log</Link></Button>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" /> Recent activity
            </CardTitle>
            <CardDescription>Last 15 audit events. Updates live.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No activity yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                      <TableCell className="text-xs">{l.entity ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono max-w-xs truncate">
                        {l.metadata ? JSON.stringify(l.metadata) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default SuperAdminDashboard;
