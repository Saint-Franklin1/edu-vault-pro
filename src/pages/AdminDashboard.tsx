import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, highestRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge, DocStatus } from "@/components/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, FileText, ShieldCheck, XCircle } from "lucide-react";

interface DocRow {
  id: string;
  title: string;
  file_name: string | null;
  mime_type: string | null;
  status: DocStatus;
  storage_path: string;
  user_id: string;
  rejection_reason: string | null;
  created_at: string;
  chief_approved: boolean;
  chief_category: string | null;
  recommendation_letter_url: string | null;
  ward_approved: boolean;
  constituency_approved: boolean;
  county_approved: boolean;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const stageBadge = (d: DocRow) => {
  if (d.status === "rejected") return { label: "Rejected", variant: "destructive" as const };
  if (d.county_approved && d.constituency_approved && d.ward_approved && d.chief_approved)
    return { label: "Fully Verified", variant: "default" as const };
  if (d.county_approved) return { label: "County Approved", variant: "secondary" as const };
  if (d.constituency_approved) return { label: "Constituency Approved", variant: "secondary" as const };
  if (d.ward_approved) return { label: "Ward Approved", variant: "secondary" as const };
  if (d.chief_approved) return { label: "Chief Approved", variant: "secondary" as const };
  return { label: "Pending Chief", variant: "outline" as const };
};

const AdminDashboard = () => {
  const { user, roles } = useAuth();
  const role = highestRole(roles);

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<DocStatus | "all">("all");
  const [rejectionId, setRejectionId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = () => {
    let q = supabase
      .from("documents")
      .select(
        "id,title,file_name,mime_type,status,storage_path,user_id,rejection_reason,created_at,chief_approved,chief_category,ward_approved,constituency_approved,county_approved, profiles!inner(full_name,email)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    q.then(({ data, error }) => {
      if (error) {
        toast({ title: "Couldn't load", description: error.message, variant: "destructive" });
        return;
      }
      setDocs((data as unknown as DocRow[]) ?? []);
    });
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-docs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = {
    pending: docs.filter((d) => d.status === "pending").length,
    in_queue: docs.filter((d) => d.status === "in_queue").length,
    verified: docs.filter((d) => d.status === "verified").length,
    rejected: docs.filter((d) => d.status === "rejected").length,
  };

  const approve = async (d: DocRow, level: "ward" | "constituency" | "county") => {
    const patch: {
      ward_approved?: boolean;
      constituency_approved?: boolean;
      county_approved?: boolean;
      status?: DocStatus;
    } = {};
    if (level === "ward") patch.ward_approved = true;
    if (level === "constituency") patch.constituency_approved = true;
    if (level === "county") patch.county_approved = true;
    if (d.status === "pending") patch.status = "in_queue";
    const { error } = await supabase.from("documents").update(patch).eq("id", d.id);
    if (error) {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${level[0].toUpperCase() + level.slice(1)} approval recorded` });
    }
  };

  const reject = async (id: string, reasonText: string) => {
    const { error } = await supabase
      .from("documents")
      .update({
        status: "rejected",
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
        rejection_reason: reasonText,
      })
      .eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Document rejected" });
      setRejectionId(null);
      setReason("");
    }
  };

  const view = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("student-documents")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Couldn't open file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  // Super admin is intentionally excluded from approvals (oversight only).
  const nextAction = (d: DocRow): null | "ward" | "constituency" | "county" => {
    if (d.status === "rejected") return null;
    if (!d.chief_approved) return null; // Chief must approve first (handled in ChiefDashboard)
    if (d.ward_approved && d.constituency_approved && d.county_approved) return null;
    if (!d.ward_approved) return role === "ward_admin" ? "ward" : null;
    if (!d.constituency_approved) return role === "constituency_admin" ? "constituency" : null;
    if (!d.county_approved) return role === "county_admin" ? "county" : null;
    return null;
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Admin dashboard</h1>
            <p className="text-muted-foreground capitalize">
              Acting as {role?.replace("_", " ")}. You see documents within your geographic scope.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <span className="text-sm text-muted-foreground">RLS-enforced scope · Live updates</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pending", value: counts.pending },
            { label: "In queue", value: counts.in_queue },
            { label: "Verified", value: counts.verified },
            { label: "Rejected", value: counts.rejected },
          ].map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-5">
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Hierarchical approval: Ward → Constituency → County. The system auto-marks Verified when all three approve.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Filter</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DocStatus | "all")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_queue">In queue</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                No documents in your scope.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval stage</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => {
                    const stage = stageBadge(d);
                    const action = nextAction(d);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">{d.profiles?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{d.profiles?.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{d.title}</div>
                          <div className="text-xs text-muted-foreground">{d.file_name}</div>
                          {d.status === "rejected" && d.rejection_reason && (
                            <div className="text-xs text-destructive mt-1">Reason: {d.rejection_reason}</div>
                          )}
                        </TableCell>
                        <TableCell><StatusBadge status={d.status} /></TableCell>
                        <TableCell>
                          <Badge variant={stage.variant}>{stage.label}</Badge>
                          <div className="mt-1 flex gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <span className={d.ward_approved ? "text-accent font-semibold" : ""}>W</span>
                            <span>›</span>
                            <span className={d.constituency_approved ? "text-accent font-semibold" : ""}>C</span>
                            <span>›</span>
                            <span className={d.county_approved ? "text-accent font-semibold" : ""}>Co</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button size="sm" variant="ghost" onClick={() => view(d.storage_path)}>
                            View
                          </Button>
                          {action && (
                            <Button size="sm" onClick={() => approve(d, action)}>
                              <CheckCircle2 className="w-4 h-4" />{" "}
                              {action === "ward"
                                ? "Approve (Ward)"
                                : action === "constituency"
                                ? "Approve (Constituency)"
                                : "Approve (County)"}
                            </Button>
                          )}
                          {d.status !== "rejected" && d.status !== "verified" && (
                            rejectionId === d.id ? (
                              <span className="inline-flex items-center gap-1">
                                <Input
                                  value={reason}
                                  onChange={(e) => setReason(e.target.value)}
                                  placeholder="Reason"
                                  className="w-40 inline-flex"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => reject(d.id, reason)}
                                  disabled={!reason}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { setRejectionId(null); setReason(""); }}
                                >
                                  Cancel
                                </Button>
                              </span>
                            ) : (
                              <Button size="sm" variant="destructive" onClick={() => setRejectionId(d.id)}>
                                <XCircle className="w-4 h-4" /> Reject
                              </Button>
                            )
                          )}
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

export default AdminDashboard;
