import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";

type Stage =
  | "submitted" | "ward_reviewed" | "constituency_reviewed"
  | "county_approved" | "disbursed" | "rejected" | "withdrawn";

interface AppRow {
  id: string;
  current_stage: Stage;
  institution_name: string | null;
  course: string | null;
  study_level: string | null;
  year_of_study: number | null;
  admission_number: string | null;
  amount_requested: number | null;
  approved_amount: number | null;
  recommended_amount: number | null;
  tuition_required: number | null;
  upkeep_required: number | null;
  other_fees: number | null;
  rejection_reason: string | null;
  review_notes: string | null;
  bank_name: string | null;
  account_number: string | null;
  mpesa_number: string | null;
  created_at: string;
  bursaries?: { title: string } | null;
}

interface EventRow {
  id: string;
  from_stage: Stage | null;
  to_stage: Stage;
  actor_role: string | null;
  notes: string | null;
  amount_recommended: number | null;
  created_at: string;
}

interface Disbursement {
  id: string;
  amount: number;
  channel: string;
  reference_number: string;
  paid_at: string;
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

const StudentApplicationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<AppRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [payouts, setPayouts] = useState<Disbursement[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: a } = await supabase
        .from("bursary_applications")
        .select("*, bursaries(title)")
        .eq("id", id).maybeSingle();
      setApp(a as unknown as AppRow);
      const { data: ev } = await supabase
        .from("application_review_events")
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: true });
      setEvents((ev as unknown as EventRow[]) ?? []);
      const { data: ds } = await supabase
        .from("disbursements")
        .select("id,amount,channel,reference_number,paid_at")
        .eq("application_id", id)
        .order("paid_at", { ascending: false });
      setPayouts((ds as unknown as Disbursement[]) ?? []);
    })();
  }, [id]);

  if (!app) return <AppShell><div className="container py-8 text-muted-foreground">Loading…</div></AppShell>;

  const stageIcon = (s: Stage) =>
    s === "rejected" ? <XCircle className="w-4 h-4 text-destructive" /> :
    s === "disbursed" || s === "county_approved" ? <CheckCircle2 className="w-4 h-4 text-primary" /> :
    <Clock className="w-4 h-4 text-muted-foreground" />;

  return (
    <AppShell>
      <div className="container py-8 space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/student/bursaries"><ArrowLeft className="w-4 h-4 mr-1" /> Back to bursaries</Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>{app.bursaries?.title}</CardTitle>
                <CardDescription>
                  Submitted {new Date(app.created_at).toLocaleString()}
                </CardDescription>
              </div>
              <Badge>{STAGE_LABEL[app.current_stage]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Institution:</span> {app.institution_name}</div>
              <div><span className="text-muted-foreground">Course:</span> {app.course}</div>
              <div><span className="text-muted-foreground">Level:</span> {app.study_level}</div>
              <div><span className="text-muted-foreground">Year:</span> {app.year_of_study}</div>
              <div><span className="text-muted-foreground">Reg No:</span> {app.admission_number}</div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
              <div><div className="text-xs text-muted-foreground">Requested</div>
                <div className="font-semibold">KES {Number(app.amount_requested ?? 0).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Recommended</div>
                <div className="font-semibold">{app.recommended_amount != null ? `KES ${Number(app.recommended_amount).toLocaleString()}` : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Approved</div>
                <div className="font-semibold">{app.approved_amount != null ? `KES ${Number(app.approved_amount).toLocaleString()}` : "—"}</div></div>
            </div>
            {app.rejection_reason && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                <div className="font-medium">Rejected</div>
                <div className="text-sm">{app.rejection_reason}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review timeline</CardTitle>
            <CardDescription>Every action taken on your application</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="mt-0.5">{stageIcon(e.to_stage)}</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {STAGE_LABEL[e.to_stage]}{" "}
                        <span className="text-xs text-muted-foreground font-normal">
                          by {e.actor_role?.replace("_", " ") ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                      {e.notes && <div className="text-sm mt-1 italic">"{e.notes}"</div>}
                      {e.amount_recommended != null && (
                        <div className="text-xs">Recommended amount: KES {Number(e.amount_recommended).toLocaleString()}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {payouts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Disbursements</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {payouts.map((p) => (
                  <li key={p.id} className="flex justify-between border rounded-md p-3">
                    <div>
                      <div className="font-medium">KES {Number(p.amount).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{p.channel.toUpperCase()} · Ref {p.reference_number}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
};

export default StudentApplicationDetail;
