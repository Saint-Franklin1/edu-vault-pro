import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, MapPin, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";

interface Bursary {
  id: string;
  title: string;
  description: string | null;
  application_link: string | null;
  deadline: string | null;
  county_id: string | null;
  constituency_id: string | null;
  ward_id: string | null;
  counties?: { name: string } | null;
  constituencies?: { name: string } | null;
  wards?: { name: string } | null;
}

type AppStatus = "pending" | "under_review" | "approved" | "rejected" | "withdrawn";

interface MyApplication {
  id: string;
  bursary_id: string;
  status: AppStatus;
  review_notes: string | null;
}

const STATUS_LABEL: Record<AppStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUS_VARIANT: Record<AppStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  under_review: "outline",
  approved: "default",
  rejected: "destructive",
  withdrawn: "outline",
};

const StudentBursaries = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Bursary[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [applyTo, setApplyTo] = useState<Bursary | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("bursaries")
      .select(
        "id,title,description,application_link,deadline,county_id,constituency_id,ward_id, counties(name), constituencies(name), wards(name)"
      )
      .is("deleted_at", null)
      .order("deadline", { ascending: true, nullsFirst: false });
    setItems((data as unknown as Bursary[]) ?? []);
  };

  const loadApplications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bursary_applications")
      .select("id,bursary_id,status,review_notes")
      .eq("student_id", user.id);
    setApplications((data as unknown as MyApplication[]) ?? []);
  };

  useEffect(() => {
    load();
    loadApplications();
    const channel = supabase
      .channel("bursaries-students")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bursaries" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bursary_applications" },
        () => loadApplications()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const appByBursary = useMemo(() => {
    const map = new Map<string, MyApplication>();
    for (const a of applications) map.set(a.bursary_id, a);
    return map;
  }, [applications]);

  const openApply = (b: Bursary) => {
    setApplyTo(b);
    setMessage("");
  };

  const submitApplication = async () => {
    if (!applyTo || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("bursary_applications").insert({
      bursary_id: applyTo.id,
      student_id: user.id,
      message: message || null,
    });
    setSubmitting(false);
    if (error) {
      toast({
        title: "Couldn't submit application",
        description: error.message.includes("duplicate")
          ? "You've already applied to this program."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Application submitted", description: "An admin will review it shortly." });
    setApplyTo(null);
    loadApplications();
  };

  const withdraw = async (appId: string) => {
    const { error } = await supabase
      .from("bursary_applications")
      .update({ status: "withdrawn" })
      .eq("id", appId);
    if (error) {
      toast({ title: "Couldn't withdraw", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Application withdrawn" });
    loadApplications();
  };

  const isExpired = (deadline: string | null) =>
    !!deadline && new Date(deadline) < new Date(new Date().toDateString());

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bursaries & scholarship programs</h1>
          <p className="text-muted-foreground">
            All currently open programs. Apply to any program you qualify for.
          </p>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No bursaries available right now.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((b) => {
              const app = appByBursary.get(b.id);
              const expired = isExpired(b.deadline);
              return (
                <Card key={b.id} className="shadow-card flex flex-col">
                  <CardHeader>
                    <CardTitle>{b.title}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-3 pt-1">
                      {b.deadline && (
                        <span className="flex items-center gap-1 text-xs">
                          <CalendarDays className="w-3 h-3" /> Deadline:{" "}
                          {new Date(b.deadline).toLocaleDateString()}
                        </span>
                      )}
                      {(b.wards?.name || b.constituencies?.name || b.counties?.name) && (
                        <span className="flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3" />
                          {b.wards?.name || b.constituencies?.name || b.counties?.name}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm whitespace-pre-line flex-1">{b.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {b.ward_id
                          ? "Ward"
                          : b.constituency_id
                          ? "Constituency"
                          : b.county_id
                          ? "County"
                          : "Open to all"}
                      </Badge>
                      {expired && <Badge variant="destructive">Closed</Badge>}
                      {app && (
                        <Badge variant={STATUS_VARIANT[app.status]}>
                          {app.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {app.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                          {(app.status === "pending" || app.status === "under_review") && (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {STATUS_LABEL[app.status]}
                        </Badge>
                      )}
                    </div>
                    {app?.review_notes && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Admin note: {app.review_notes}
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      {!app && (
                        <Button
                          size="sm"
                          onClick={() => openApply(b)}
                          disabled={expired}
                        >
                          {expired ? "Closed" : "Apply"}
                        </Button>
                      )}
                      {app && (app.status === "pending" || app.status === "under_review") && (
                        <Button size="sm" variant="outline" onClick={() => withdraw(app.id)}>
                          Withdraw
                        </Button>
                      )}
                      {app && app.status === "withdrawn" && !expired && (
                        <span className="text-xs text-muted-foreground">
                          You withdrew this application.
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!applyTo} onOpenChange={(o) => !o && setApplyTo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to {applyTo?.title}</DialogTitle>
            <DialogDescription>
              Add an optional message to support your application. Admins will review it within your geographic scope.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Briefly explain why you're applying…"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApplyTo(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitApplication} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default StudentBursaries;
