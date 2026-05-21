import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  CalendarDays, MapPin, CheckCircle2, Clock, XCircle, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react";

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

type Stage =
  | "submitted" | "ward_reviewed" | "constituency_reviewed"
  | "county_approved" | "disbursed" | "rejected" | "withdrawn";

interface MyApplication {
  id: string;
  bursary_id: string;
  current_stage: Stage;
  approved_amount: number | null;
  amount_requested: number | null;
  rejection_reason: string | null;
}

const STAGE_LABEL: Record<Stage, string> = {
  submitted: "Submitted",
  ward_reviewed: "Ward reviewed",
  constituency_reviewed: "Constituency reviewed",
  county_approved: "Approved",
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

const num = (s: string) => (s === "" ? 0 : Number(s));

const applicationSchema = z.object({
  institution_name: z.string().trim().min(2).max(200),
  course: z.string().trim().min(2).max(200),
  study_level: z.enum(["secondary", "tvet", "undergraduate", "postgraduate"]),
  year_of_study: z.number().int().min(1).max(10),
  admission_number: z.string().trim().min(1).max(50),
  expected_completion_year: z.number().int().min(new Date().getFullYear()).max(new Date().getFullYear() + 10),
  tuition_required: z.number().min(0),
  upkeep_required: z.number().min(0),
  other_fees: z.number().min(0),
  parents_status: z.enum(["both_alive", "father_only", "mother_only", "none"]),
  guardian_name: z.string().trim().min(2).max(200),
  guardian_relationship: z.string().trim().min(2).max(50),
  guardian_occupation: z.string().trim().max(100).optional().or(z.literal("")),
  household_income_bracket: z.enum(["below_10k", "10k_30k", "30k_60k", "60k_100k", "above_100k"]),
  siblings_in_school: z.number().int().min(0).max(30),
  has_disability: z.boolean(),
  bank_name: z.string().trim().max(100).optional().or(z.literal("")),
  bank_branch: z.string().trim().max(100).optional().or(z.literal("")),
  account_name: z.string().trim().max(200).optional().or(z.literal("")),
  account_number: z.string().trim().max(50).optional().or(z.literal("")),
  mpesa_number: z.string().trim().max(20).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  declaration: z.literal(true, { errorMap: () => ({ message: "You must accept the declaration" }) }),
}).refine((d) => !!d.account_number || !!d.mpesa_number, {
  message: "Provide a bank account or M-Pesa number for disbursement",
  path: ["mpesa_number"],
});

type FormState = {
  institution_name: string; course: string; study_level: string; year_of_study: string;
  admission_number: string; expected_completion_year: string;
  tuition_required: string; upkeep_required: string; other_fees: string;
  parents_status: string; guardian_name: string; guardian_relationship: string;
  guardian_occupation: string; household_income_bracket: string; siblings_in_school: string;
  has_disability: boolean;
  bank_name: string; bank_branch: string; account_name: string; account_number: string; mpesa_number: string;
  message: string; declaration: boolean;
};

const emptyForm: FormState = {
  institution_name: "", course: "", study_level: "secondary", year_of_study: "1",
  admission_number: "", expected_completion_year: String(new Date().getFullYear() + 1),
  tuition_required: "", upkeep_required: "", other_fees: "",
  parents_status: "both_alive", guardian_name: "", guardian_relationship: "",
  guardian_occupation: "", household_income_bracket: "below_10k", siblings_in_school: "0",
  has_disability: false,
  bank_name: "", bank_branch: "", account_name: "", account_number: "", mpesa_number: "",
  message: "", declaration: false,
};

const StudentBursaries = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Bursary[]>([]);
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [applyTo, setApplyTo] = useState<Bursary | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("bursaries")
      .select("id,title,description,application_link,deadline,county_id,constituency_id,ward_id, counties(name), constituencies(name), wards(name)")
      .is("deleted_at", null)
      .order("deadline", { ascending: true, nullsFirst: false });
    setItems((data as unknown as Bursary[]) ?? []);
  };

  const loadApplications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bursary_applications")
      .select("id,bursary_id,current_stage,approved_amount,amount_requested,rejection_reason")
      .eq("student_id", user.id);
    setApplications((data as unknown as MyApplication[]) ?? []);
  };

  useEffect(() => {
    load();
    loadApplications();
    const channel = supabase
      .channel("bursaries-students")
      .on("postgres_changes", { event: "*", schema: "public", table: "bursaries" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bursary_applications" }, () => loadApplications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const appByBursary = useMemo(() => {
    const map = new Map<string, MyApplication>();
    for (const a of applications) map.set(a.bursary_id, a);
    return map;
  }, [applications]);

  const openApply = (b: Bursary) => {
    setApplyTo(b);
    setForm(emptyForm);
    setStep(0);
  };

  const total = useMemo(
    () => num(form.tuition_required) + num(form.upkeep_required) + num(form.other_fees),
    [form.tuition_required, form.upkeep_required, form.other_fees],
  );

  const submitApplication = async () => {
    if (!applyTo || !user) return;
    const parsed = applicationSchema.safeParse({
      institution_name: form.institution_name,
      course: form.course,
      study_level: form.study_level,
      year_of_study: num(form.year_of_study),
      admission_number: form.admission_number,
      expected_completion_year: num(form.expected_completion_year),
      tuition_required: num(form.tuition_required),
      upkeep_required: num(form.upkeep_required),
      other_fees: num(form.other_fees),
      parents_status: form.parents_status,
      guardian_name: form.guardian_name,
      guardian_relationship: form.guardian_relationship,
      guardian_occupation: form.guardian_occupation,
      household_income_bracket: form.household_income_bracket,
      siblings_in_school: num(form.siblings_in_school),
      has_disability: form.has_disability,
      bank_name: form.bank_name, bank_branch: form.bank_branch,
      account_name: form.account_name, account_number: form.account_number,
      mpesa_number: form.mpesa_number,
      message: form.message, declaration: form.declaration,
    });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast({ title: "Form incomplete", description: first.message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const p = parsed.data;
    const { error } = await supabase.from("bursary_applications").insert({
      bursary_id: applyTo.id,
      student_id: user.id,
      message: p.message || null,
      institution_name: p.institution_name,
      course: p.course,
      study_level: p.study_level,
      year_of_study: p.year_of_study,
      admission_number: p.admission_number,
      expected_completion_year: p.expected_completion_year,
      tuition_required: p.tuition_required,
      upkeep_required: p.upkeep_required,
      other_fees: p.other_fees,
      amount_requested: p.tuition_required + p.upkeep_required + p.other_fees,
      parents_status: p.parents_status,
      guardian_name: p.guardian_name,
      guardian_relationship: p.guardian_relationship,
      guardian_occupation: p.guardian_occupation || null,
      household_income_bracket: p.household_income_bracket,
      siblings_in_school: p.siblings_in_school,
      has_disability: p.has_disability,
      bank_name: p.bank_name || null,
      bank_branch: p.bank_branch || null,
      account_name: p.account_name || null,
      account_number: p.account_number || null,
      mpesa_number: p.mpesa_number || null,
      declaration_signed_at: new Date().toISOString(),
      current_stage: "submitted",
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
    toast({ title: "Application submitted", description: "Your ward admin will begin the review." });
    setApplyTo(null);
    loadApplications();
  };

  const withdraw = async (appId: string) => {
    const { error } = await supabase
      .from("bursary_applications")
      .update({ current_stage: "withdrawn" })
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

  // Step navigation
  const STEPS = ["Academic", "Funding need", "Household", "Payout & declaration"];
  const canNext = () => {
    if (step === 0) return form.institution_name && form.course && form.admission_number;
    if (step === 1) return total > 0;
    if (step === 2) return form.guardian_name && form.guardian_relationship;
    return false;
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bursaries & scholarship programs</h1>
          <p className="text-muted-foreground">
            Apply for funding using the full HELB-style application form below.
          </p>
        </div>

        {items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            No bursaries available right now.
          </CardContent></Card>
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
                          <CalendarDays className="w-3 h-3" /> Deadline: {new Date(b.deadline).toLocaleDateString()}
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
                        {b.ward_id ? "Ward" : b.constituency_id ? "Constituency" : b.county_id ? "County" : "Open to all"}
                      </Badge>
                      {expired && <Badge variant="destructive">Closed</Badge>}
                      {app && (
                        <Badge variant={STAGE_VARIANT[app.current_stage]}>
                          {app.current_stage === "county_approved" || app.current_stage === "disbursed" ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : app.current_stage === "rejected" ? (
                            <XCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {STAGE_LABEL[app.current_stage]}
                        </Badge>
                      )}
                      {app?.approved_amount != null && (
                        <Badge variant="default">KES {Number(app.approved_amount).toLocaleString()}</Badge>
                      )}
                    </div>
                    {app?.rejection_reason && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        Reason: {app.rejection_reason}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {b.application_link && (
                        <Button size="sm" variant="outline"
                          onClick={() => window.open(b.application_link!, "_blank", "noopener,noreferrer")}>
                          <ExternalLink className="w-3 h-3 mr-1" /> External link
                        </Button>
                      )}
                      {!app && (
                        <Button size="sm" onClick={() => openApply(b)} disabled={expired}>
                          {expired ? "Closed" : "Apply"}
                        </Button>
                      )}
                      {app && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/student/applications/${app.id}`}>View application</Link>
                        </Button>
                      )}
                      {app && (app.current_stage === "submitted") && (
                        <Button size="sm" variant="ghost" onClick={() => withdraw(app.id)}>
                          Withdraw
                        </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply to {applyTo?.title}</DialogTitle>
            <DialogDescription>
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </DialogDescription>
          </DialogHeader>

          {step === 0 && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Institution name</Label>
                <Input value={form.institution_name}
                  onChange={(e) => setForm({ ...form, institution_name: e.target.value })}
                  placeholder="e.g. University of Nairobi" />
              </div>
              <div className="grid gap-2">
                <Label>Course / programme</Label>
                <Input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Study level</Label>
                  <Select value={form.study_level} onValueChange={(v) => setForm({ ...form, study_level: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="tvet">TVET</SelectItem>
                      <SelectItem value="undergraduate">Undergraduate</SelectItem>
                      <SelectItem value="postgraduate">Postgraduate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Year of study</Label>
                  <Input type="number" min={1} max={10} value={form.year_of_study}
                    onChange={(e) => setForm({ ...form, year_of_study: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Admission / reg number</Label>
                  <Input value={form.admission_number}
                    onChange={(e) => setForm({ ...form, admission_number: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Expected completion year</Label>
                  <Input type="number" value={form.expected_completion_year}
                    onChange={(e) => setForm({ ...form, expected_completion_year: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Tuition required (KES)</Label>
                <Input type="number" min={0} value={form.tuition_required}
                  onChange={(e) => setForm({ ...form, tuition_required: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Upkeep / accommodation (KES)</Label>
                <Input type="number" min={0} value={form.upkeep_required}
                  onChange={(e) => setForm({ ...form, upkeep_required: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Other fees (KES)</Label>
                <Input type="number" min={0} value={form.other_fees}
                  onChange={(e) => setForm({ ...form, other_fees: e.target.value })} />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                Total requested: <span className="font-semibold">KES {total.toLocaleString()}</span>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Parents status</Label>
                <Select value={form.parents_status} onValueChange={(v) => setForm({ ...form, parents_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both_alive">Both alive</SelectItem>
                    <SelectItem value="father_only">Father only</SelectItem>
                    <SelectItem value="mother_only">Mother only</SelectItem>
                    <SelectItem value="none">Both deceased</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Guardian name</Label>
                  <Input value={form.guardian_name}
                    onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Relationship</Label>
                  <Input value={form.guardian_relationship}
                    onChange={(e) => setForm({ ...form, guardian_relationship: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Guardian occupation</Label>
                <Input value={form.guardian_occupation}
                  onChange={(e) => setForm({ ...form, guardian_occupation: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Household income (KES / month)</Label>
                  <Select value={form.household_income_bracket}
                    onValueChange={(v) => setForm({ ...form, household_income_bracket: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="below_10k">Below 10,000</SelectItem>
                      <SelectItem value="10k_30k">10,000 – 30,000</SelectItem>
                      <SelectItem value="30k_60k">30,000 – 60,000</SelectItem>
                      <SelectItem value="60k_100k">60,000 – 100,000</SelectItem>
                      <SelectItem value="above_100k">Above 100,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Siblings in school</Label>
                  <Input type="number" min={0} value={form.siblings_in_school}
                    onChange={(e) => setForm({ ...form, siblings_in_school: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.has_disability}
                  onCheckedChange={(c) => setForm({ ...form, has_disability: !!c })} />
                Applicant has a disability
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Disbursement details — provide a bank account or M-Pesa number for payout.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Bank name</Label>
                  <Input value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Branch</Label>
                  <Input value={form.bank_branch}
                    onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Account name</Label>
                  <Input value={form.account_name}
                    onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Account number</Label>
                  <Input value={form.account_number}
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Or M-Pesa number</Label>
                <Input value={form.mpesa_number}
                  onChange={(e) => setForm({ ...form, mpesa_number: e.target.value })}
                  placeholder="07XXXXXXXX" />
              </div>
              <div className="grid gap-2">
                <Label>Additional message (optional)</Label>
                <Textarea rows={3} maxLength={2000} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <label className="flex items-start gap-2 text-sm rounded-md border bg-muted/30 p-3">
                <Checkbox checked={form.declaration}
                  onCheckedChange={(c) => setForm({ ...form, declaration: !!c })} />
                <span>
                  I declare that the information provided is true and accurate to the best of my knowledge.
                  I understand that any false information may result in disqualification.
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="ghost" disabled={step === 0 || submitting}
              onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submitApplication} disabled={submitting || !form.declaration}>
                {submitting ? "Submitting…" : "Submit application"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default StudentBursaries;
