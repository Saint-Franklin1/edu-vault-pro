import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, highestRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  profiles?: { full_name: string | null; email: string | null } | null;
}

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
      .select("id,title,file_name,mime_type,status,storage_path,user_id,rejection_reason,created_at, profiles!inner(full_name,email)")
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

  const setStatus = async (id: string, status: DocStatus, reasonText?: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "verified") {
      patch.verified_by = user?.id;
      patch.verified_at = new Date().toISOString();
      patch.rejection_reason = null;
    }
    if (status === "rejected") {
      patch.rejection_reason = reasonText ?? null;
      patch.verified_by = user?.id;
      patch.verified_at = new Date().toISOString();
    }
    const { error } = await supabase.from("documents").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Marked ${status.replace("_", " ")}` });
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
            <span className="text-sm text-muted-foreground">RLS-enforced scope</span>
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
              <CardDescription>Verify or reject each submission.</CardDescription>
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
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
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
                      <TableCell className="text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => view(d.storage_path)}>
                          View
                        </Button>
                        {d.status !== "in_queue" && d.status !== "verified" && (
                          <Button size="sm" variant="secondary" onClick={() => setStatus(d.id, "in_queue")}>
                            Queue
                          </Button>
                        )}
                        {d.status !== "verified" && (
                          <Button size="sm" onClick={() => setStatus(d.id, "verified")}>
                            <CheckCircle2 className="w-4 h-4" /> Verify
                          </Button>
                        )}
                        {d.status !== "rejected" && (
                          rejectionId === d.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Input
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Reason"
                                className="w-40 inline-flex"
                              />
                              <Button size="sm" variant="destructive" onClick={() => setStatus(d.id, "rejected", reason)} disabled={!reason}>
                                Confirm
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setRejectionId(null); setReason(""); }}>
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

export default AdminDashboard;
