import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, highestRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

type Stage =
  | "submitted" | "ward_reviewed" | "constituency_reviewed"
  | "county_approved" | "disbursed" | "rejected" | "withdrawn";

interface ApplicationRow {
  id: string;
  bursary_id: string;
  student_id: string;
  message: string | null;
  current_stage: Stage;
  recommended_amount: number | null;
  approved_amount: number | null;
  amount_requested: number | null;
  rejection_reason: string | null;
  review_notes: string | null;
  created_at: string;
  institution_name: string | null;
  course: string | null;
  study_level: string | null;
  year_of_study: number | null;
  admission_number: string | null;
  tuition_required: number | null;
  upkeep_required: number | null;
  other_fees: number | null;
  parents_status: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  household_income_bracket: string | null;
  siblings_in_school: number | null;
  has_disability: boolean | null;
  bank_name: string | null;
  account_number: string | null;
  mpesa_number: string | null;
  bursaries?: { title: string } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const STAGE_LABEL: Record<Stage, string> = {
  submitted: "Submitted",
  ward_reviewed: "Ward reviewed",
  constituency_reviewed: "Constituency reviewed",
  county_approved: "County approved",
  disbursed: "Disbursed",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STAGE_VARIANT: Record<Stage, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "secondary",
  ward_reviewed: "outline",
  constituency_reviewed: "outline",
  county_approved: "default",
  disbursed: "default",
  rejected: "destructive",
  withdrawn: "outline",
};

const AdminApplications = () => {
  const { roles } = useAuth();
  const role = highestRole(roles);
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [reviewing, setReviewing] = useState<ApplicationRow | null>(null);
  const [notes, setNotes] = useState("");
  const [recommended, setRecommended] = useState("");
  const [approved, setApproved] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let query = supabase
      .from("bursary_applications")
      .select(
        "id,bursary_id,student_id,message,current_stage,recommended_amount,approved_amount,amount_requested,rejection_reason,review_notes,created_at," +
        "institution_name,course,study_level,year_of_study,admission_number,tuition_required,upkeep_required,other_fees," +
        "parents_status,guardian_name,guardian_relationship,household_income_bracket,siblings_in_school,has_disability," +
        "bank_name,account_number,mpesa_number, bursaries(title)"
      )
      .order("created_at", { ascending: false });
    if (stageFilter !== "all") query = query.eq("current_stage", stageFilter);
    const { data } = await query;
    const rows = (data as unknown as ApplicationRow[]) ?? [];
    if (rows.length === 0) { setItems([]); return; }
    const ids = Array.from(new Set(rows.map((r) => r.student_id)));
    const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    setItems(rows.map((r) => ({ ...r, profiles: profMap.get(r.student_id) ?? null })));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("applications-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "bursary_applications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) c[i.current_stage] = (c[i.current_stage] ?? 0) + 1;
    return c;
  }, [items]);

  const openReview = (row: ApplicationRow) => {
    setReviewing(row);
    setNotes(row.review_notes ?? "");
    setRecommended(row.recommended_amount?.toString() ?? "");
    setApproved(row.approved_amount?.toString() ?? row.amount_requested?.toString() ?? "");
    setRejectReason("");
  };

  // Determine which stage actions the current admin role can perform on this row
  const availableActions = (row: ApplicationRow): { stage: Stage; label: string }[] => {
    if (!row) return [];
    const r = role;
    const actions: { stage: Stage; label: string }[] = [];
    if (row.current_stage === "submitted" && (r === "ward_admin" || r === "super_admin")) {
      actions.push({ stage: "ward_reviewed", label: "Recommend at ward" });
    }
    if (row.current_stage === "ward_reviewed" && (r === "constituency_admin" || r === "super_admin")) {
      actions.push({ stage: "constituency_reviewed", label: "Endorse at constituency" });
    }
    if (row.current_stage === "constituency_reviewed" && (r === "county_admin" || r === "super_admin")) {
      actions.push({ stage: "county_approved", label: "Approve at county" });
    }
    if (["submitted", "ward_reviewed", "constituency_reviewed"].includes(row.current_stage)
        && (r === "ward_admin" || r === "constituency_admin" || r === "county_admin" || r === "super_admin")) {
      actions.push({ stage: "rejected", label: "Reject" });
    }
    return actions;
  };

  const transitionTo = async (stage: Stage) => {
    if (!reviewing) return;
    setBusy(true);
    const update: Record<string, unknown> = {
      current_stage: stage,
      review_notes: notes || null,
    };
    if (stage === "ward_reviewed" || stage === "constituency_reviewed") {
      if (recommended) update.recommended_amount = Number(recommended);
    }
    if (stage === "county_approved") {
      if (!approved || Number(approved) <= 0) {
        toast({ title: "Approved amount required", variant: "destructive" });
        setBusy(false); return;
      }
      update.approved_amount = Number(approved);
    }
    if (stage === "rejected") {
      if (!rejectReason.trim()) {
        toast({ title: "Rejection reason required", variant: "destructive" });
        setBusy(false); return;
      }
      update.rejection_reason = rejectReason;
    }
    const { error } = await supabase
      .from("bursary_applications")
      .update(update)
      .eq("id", reviewing.id);
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Application updated" });
    setReviewing(null);
    load();
  };

  const STAGES: Stage[] = ["submitted", "ward_reviewed", "constituency_reviewed", "county_approved", "disbursed", "rejected", "withdrawn"];

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
              Review applications stage-by-stage. Ward → Constituency → County → Disbursed.
            </p>
          </div>
          <div className="w-56">
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as Stage | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          {STAGES.map((s) => (
            <Card key={s} className="shadow-card">
              <CardContent className="py-3">
                <div className="text-xs uppercase text-muted-foreground tracking-wide truncate">{STAGE_LABEL[s]}</div>
                <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Click an application to take action.</CardDescription>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center">No applications.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.profiles?.full_name ?? "Student"}</div>
                        <div className="text-xs text-muted-foreground">{row.institution_name}</div>
                      </TableCell>
                      <TableCell>{row.bursaries?.title ?? "—"}</TableCell>
                      <TableCell>KES {Number(row.amount_requested ?? 0).toLocaleString()}</TableCell>
                      <TableCell>{row.approved_amount != null ? `KES ${Number(row.approved_amount).toLocaleString()}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STAGE_VARIANT[row.current_stage]}>{STAGE_LABEL[row.current_stage]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openReview(row)}>Open</Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{reviewing?.bursaries?.title}</DialogTitle>
            <DialogDescription>
              {reviewing?.profiles?.full_name} · {reviewing?.profiles?.email}
            </DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                <div><span className="text-muted-foreground">Institution:</span> {reviewing.institution_name}</div>
                <div><span className="text-muted-foreground">Course:</span> {reviewing.course}</div>
                <div><span className="text-muted-foreground">Level / Year:</span> {reviewing.study_level} · Y{reviewing.year_of_study}</div>
                <div><span className="text-muted-foreground">Reg No:</span> {reviewing.admission_number}</div>
                <div><span className="text-muted-foreground">Guardian:</span> {reviewing.guardian_name} ({reviewing.guardian_relationship})</div>
                <div><span className="text-muted-foreground">Parents:</span> {reviewing.parents_status}</div>
                <div><span className="text-muted-foreground">Household income:</span> {reviewing.household_income_bracket}</div>
                <div><span className="text-muted-foreground">Siblings in school:</span> {reviewing.siblings_in_school}</div>
                <div><span className="text-muted-foreground">Disability:</span> {reviewing.has_disability ? "Yes" : "No"}</div>
                <div><span className="text-muted-foreground">Payout:</span> {reviewing.bank_name ? `${reviewing.bank_name} ${reviewing.account_number}` : `M-Pesa ${reviewing.mpesa_number}`}</div>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
                <div><div className="text-xs text-muted-foreground">Tuition</div>KES {Number(reviewing.tuition_required ?? 0).toLocaleString()}</div>
                <div><div className="text-xs text-muted-foreground">Upkeep</div>KES {Number(reviewing.upkeep_required ?? 0).toLocaleString()}</div>
                <div><div className="text-xs text-muted-foreground">Other</div>KES {Number(reviewing.other_fees ?? 0).toLocaleString()}</div>
                <div className="col-span-3 font-semibold">Total requested: KES {Number(reviewing.amount_requested ?? 0).toLocaleString()}</div>
              </div>
              {reviewing.message && (
                <div>
                  <Label>Student message</Label>
                  <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-line">{reviewing.message}</div>
                </div>
              )}

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Recommended amount (KES)</Label>
                    <Input type="number" value={recommended} onChange={(e) => setRecommended(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Approved amount (county only)</Label>
                    <Input type="number" value={approved} onChange={(e) => setApproved(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Review notes</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Rejection reason (only if rejecting)</Label>
                  <Textarea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setReviewing(null)} disabled={busy}>Cancel</Button>
            {reviewing && availableActions(reviewing).map((a) => (
              <Button key={a.stage} variant={a.stage === "rejected" ? "destructive" : "default"}
                disabled={busy} onClick={() => transitionTo(a.stage)}>
                {a.label}
              </Button>
            ))}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminApplications;
