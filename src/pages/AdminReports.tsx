import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, Download } from "lucide-react";

interface Summary {
  total_applications: number;
  pending: number;
  approved: number;
  rejected: number;
  disbursed: number;
  funds_requested: number;
  funds_approved: number;
  funds_disbursed: number;
  avg_disbursement: number;
}

interface ProgramRow {
  bursary_id: string;
  title: string;
  applicants: number;
  approved: number;
  rejected: number;
  disbursed_amount: number;
}

interface ReasonRow { reason: string; count: number; }

interface DisbRow {
  disbursement_id: string;
  application_id: string;
  student_name: string;
  bursary_title: string;
  amount: number;
  channel: string;
  reference_number: string;
  paid_at: string;
}

const fmt = (n: number) => `KES ${Number(n ?? 0).toLocaleString()}`;

const toCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
};

const download = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

const AdminReports = () => {
  const [from, setFrom] = useState(monthsAgo(6));
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [reasons, setReasons] = useState<ReasonRow[]>([]);
  const [disbursements, setDisbursements] = useState<DisbRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, p, r, d] = await Promise.all([
      supabase.rpc("report_application_summary", { _from: from, _to: to }),
      supabase.rpc("report_by_program", { _from: from, _to: to }),
      supabase.rpc("report_rejections_by_reason", { _from: from, _to: to }),
      supabase.rpc("report_disbursements", { _from: from, _to: to }),
    ]);
    setSummary((s.data?.[0] as unknown as Summary) ?? null);
    setPrograms((p.data as unknown as ProgramRow[]) ?? []);
    setReasons((r.data as unknown as ReasonRow[]) ?? []);
    setDisbursements((d.data as unknown as DisbRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const kpis = useMemo(() => [
    { label: "Total applications", value: summary?.total_applications ?? 0 },
    { label: "Pending review", value: summary?.pending ?? 0 },
    { label: "Approved", value: summary?.approved ?? 0 },
    { label: "Rejected", value: summary?.rejected ?? 0 },
    { label: "Disbursed (count)", value: summary?.disbursed ?? 0 },
    { label: "Funds requested", value: fmt(summary?.funds_requested ?? 0) },
    { label: "Funds approved", value: fmt(summary?.funds_approved ?? 0) },
    { label: "Funds disbursed", value: fmt(summary?.funds_disbursed ?? 0) },
    { label: "Avg disbursement", value: fmt(summary?.avg_disbursement ?? 0) },
  ], [summary]);

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="w-7 h-7" /> Reports
            </h1>
            <p className="text-muted-foreground">
              Disbursement & rejection analytics. Scoped to your geography.
            </p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="grid gap-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={load} disabled={loading}>{loading ? "Loading…" : "Apply"}</Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <Card key={k.label} className="shadow-card">
              <CardContent className="py-4">
                <div className="text-xs uppercase text-muted-foreground tracking-wide">{k.label}</div>
                <div className="text-xl font-bold">{k.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>By program</CardTitle>
                <CardDescription>Applicants, approvals, and amount disbursed</CardDescription>
              </div>
              <Button size="sm" variant="ghost"
                onClick={() => download("programs.csv", toCsv(programs as unknown as Record<string, unknown>[]))}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={programs.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="title" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="applicants" fill="hsl(var(--primary))" />
                    <Bar dataKey="approved" fill="hsl(var(--accent))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Applicants</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Rejected</TableHead>
                    <TableHead>Disbursed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs.map((p) => (
                    <TableRow key={p.bursary_id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{p.applicants}</TableCell>
                      <TableCell>{p.approved}</TableCell>
                      <TableCell>{p.rejected}</TableCell>
                      <TableCell>{fmt(p.disbursed_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Rejections by reason</CardTitle>
                <CardDescription>What stops applications from going through</CardDescription>
              </div>
              <Button size="sm" variant="ghost"
                onClick={() => download("rejections.csv", toCsv(reasons as unknown as Record<string, unknown>[]))}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reasons.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="reason" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reasons.map((r) => (
                    <TableRow key={r.reason}>
                      <TableCell>{r.reason}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Disbursements</CardTitle>
              <CardDescription>Students who received funds in this period</CardDescription>
            </div>
            <Button size="sm" variant="ghost"
              onClick={() => download("disbursements.csv", toCsv(disbursements as unknown as Record<string, unknown>[]))}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disbursements.map((d) => (
                  <TableRow key={d.disbursement_id}>
                    <TableCell className="font-medium">{d.student_name}</TableCell>
                    <TableCell>{d.bursary_title}</TableCell>
                    <TableCell>{fmt(d.amount)}</TableCell>
                    <TableCell>{d.channel}</TableCell>
                    <TableCell className="font-mono text-xs">{d.reference_number}</TableCell>
                    <TableCell>{new Date(d.paid_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default AdminReports;
