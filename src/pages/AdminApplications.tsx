import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ClipboardList } from "lucide-react";

type AppStatus = "pending" | "under_review" | "approved" | "rejected" | "withdrawn";

interface ApplicationRow {
  id: string;
  bursary_id: string;
  student_id: string;
  message: string | null;
  status: AppStatus;
  review_notes: string | null;
  created_at: string;
  bursaries?: { title: string } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const STATUS_VARIANT: Record<AppStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
  withdrawn: "outline",
};

const AdminApplications = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<AppStatus | "all">("all");
  const [reviewing, setReviewing] = useState<ApplicationRow | null>(null);
  const [nextStatus, setNextStatus] = useState<AppStatus>("under_review");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let query = supabase
      .from("bursary_applications")
      .select(
        "id,bursary_id,student_id,message,status,review_notes,created_at, bursaries(title), profiles!bursary_applications_student_id_fkey(full_name,email)"
      )
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data, error } = await query;
    if (error) {
      // Fallback: try without explicit FK alias if relationship not available
      const fallback = await supabase
        .from("bursary_applications")
        .select("id,bursary_id,student_id,message,status,review_notes,created_at, bursaries(title)")
        .order("created_at", { ascending: false });
      if (fallback.data) {
        // load student profiles in batch
        const ids = Array.from(new Set(fallback.data.map((r) => r.student_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids);
        const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
        setItems(
          (fallback.data as unknown as ApplicationRow[]).map((r) => ({
            ...r,
            profiles: profMap.get(r.student_id) ?? null,
          }))
        );
      }
      return;
    }
    setItems((data as unknown as ApplicationRow[]) ?? []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("applications-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bursary_applications" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, under_review: 0, approved: 0, rejected: 0, withdrawn: 0 };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  const openReview = (row: ApplicationRow) => {
    setReviewing(row);
    setNextStatus(row.status === "pending" ? "under_review" : row.status);
    setNotes(row.review_notes ?? "");
  };

  const submitReview = async () => {
    if (!reviewing || !user) return;
    setBusy(true);
    const { error } = await supabase
      .from("bursary_applications")
      .update({
        status: nextStatus,
        review_notes: notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reviewing.id);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't update application", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Application updated" });
    setReviewing(null);
    load();
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ClipboardList className="w-7 h-7" />
              Bursary applications
            </h1>
            <p className="text-muted-foreground">
              Applications from students within your scope. Updated in real time.
            </p>
          </div>
          <div className="w-48">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AppStatus | "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {(["pending", "under_review", "approved", "rejected", "withdrawn"] as AppStatus[]).map((s) => (
            <Card key={s} className="shadow-card">
              <CardContent className="py-4">
                <div className="text-xs uppercase text-muted-foreground tracking-wide">{s.replace("_", " ")}</div>
                <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Review and decide on each application.</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">No applications match this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.profiles?.full_name ?? "Student"}</div>
                        <div className="text-xs text-muted-foreground">{row.profiles?.email}</div>
                      </TableCell>
                      <TableCell>{row.bursaries?.title ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>{row.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openReview(row)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review application</DialogTitle>
            <DialogDescription>
              {reviewing?.profiles?.full_name} — {reviewing?.bursaries?.title}
            </DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              {reviewing.message && (
                <div className="space-y-1">
                  <Label>Student message</Label>
                  <div className="text-sm rounded-md border bg-muted/30 p-3 whitespace-pre-line">
                    {reviewing.message}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as AppStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_review">Under review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Review notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitReview} disabled={busy}>
              {busy ? "Saving…" : "Save decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminApplications;
