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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Banknote } from "lucide-react";

interface ReadyRow {
  id: string;
  student_id: string;
  approved_amount: number | null;
  bursaries?: { title: string } | null;
  profiles?: { full_name: string | null } | null;
}

interface PaidRow {
  id: string;
  application_id: string;
  amount: number;
  channel: string;
  reference_number: string;
  paid_at: string;
  receipt_path: string | null;
}

const AdminDisbursements = () => {
  const { user, roles } = useAuth();
  const role = highestRole(roles);
  const canDisburse = role === "county_admin" || role === "super_admin";

  const [ready, setReady] = useState<ReadyRow[]>([]);
  const [paid, setPaid] = useState<PaidRow[]>([]);
  const [paying, setPaying] = useState<ReadyRow | null>(null);
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState("mpesa");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: r } = await supabase
      .from("bursary_applications")
      .select("id,student_id,approved_amount, bursaries(title)")
      .eq("current_stage", "county_approved")
      .order("updated_at", { ascending: false });
    const rows = (r as unknown as ReadyRow[]) ?? [];
    if (rows.length) {
      const ids = Array.from(new Set(rows.map((x) => x.student_id)));
      const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      setReady(rows.map((x) => ({ ...x, profiles: map.get(x.student_id) ?? null })));
    } else setReady([]);

    const { data: p } = await supabase
      .from("disbursements")
      .select("id,application_id,amount,channel,reference_number,paid_at,receipt_path")
      .order("paid_at", { ascending: false })
      .limit(50);
    setPaid((p as unknown as PaidRow[]) ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("disbursements")
      .on("postgres_changes", { event: "*", schema: "public", table: "disbursements" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "bursary_applications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openPay = (row: ReadyRow) => {
    setPaying(row);
    setAmount(row.approved_amount?.toString() ?? "");
    setChannel("mpesa");
    setReference("");
    setReceipt(null);
  };

  const recordPayment = async () => {
    if (!paying || !user) return;
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Amount required", variant: "destructive" }); return;
    }
    if (!reference.trim()) {
      toast({ title: "Reference number required", variant: "destructive" }); return;
    }
    setBusy(true);

    let receiptPath: string | null = null;
    if (receipt) {
      const path = `${user.id}/${paying.id}-${Date.now()}-${receipt.name}`;
      const { error: upErr } = await supabase.storage
        .from("disbursement-receipts").upload(path, receipt);
      if (upErr) {
        toast({ title: "Couldn't upload receipt", description: upErr.message, variant: "destructive" });
        setBusy(false); return;
      }
      receiptPath = path;
    }

    const { error } = await supabase.from("disbursements").insert({
      application_id: paying.id,
      amount: Number(amount),
      channel,
      reference_number: reference,
      paid_at: new Date().toISOString(),
      recorded_by: user.id,
      receipt_path: receiptPath,
    });
    if (error) {
      toast({ title: "Couldn't record payment", description: error.message, variant: "destructive" });
      setBusy(false); return;
    }
    // Move application to disbursed
    const { error: upErr } = await supabase
      .from("bursary_applications")
      .update({ current_stage: "disbursed" })
      .eq("id", paying.id);
    setBusy(false);
    if (upErr) {
      toast({ title: "Payment recorded but stage update failed", description: upErr.message, variant: "destructive" });
    } else {
      toast({ title: "Disbursement recorded" });
    }
    setPaying(null);
    load();
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Banknote className="w-7 h-7" /> Disbursements
          </h1>
          <p className="text-muted-foreground">
            Record payouts to approved students. Bank, M-Pesa, or cheque.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ready for disbursement</CardTitle>
            <CardDescription>County-approved applications awaiting payout</CardDescription>
          </CardHeader>
          <CardContent>
            {ready.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">Nothing waiting.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Approved amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ready.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.profiles?.full_name ?? "Student"}</TableCell>
                      <TableCell>{r.bursaries?.title}</TableCell>
                      <TableCell>KES {Number(r.approved_amount ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={!canDisburse} onClick={() => openPay(r)}>
                          Record payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!canDisburse && (
              <p className="text-xs text-muted-foreground pt-3">
                Only county admins and super admins can record payments.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent payouts</CardTitle>
          </CardHeader>
          <CardContent>
            {paid.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No disbursements yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paid.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>KES {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary">{p.channel}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.reference_number}</TableCell>
                      <TableCell>{new Date(p.paid_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record disbursement</DialogTitle>
            <DialogDescription>
              {paying?.profiles?.full_name} · {paying?.bursaries?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reference / transaction number</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Receipt (optional)</Label>
              <Input type="file" accept="image/*,.pdf"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)} disabled={busy}>Cancel</Button>
            <Button onClick={recordPayment} disabled={busy}>
              {busy ? "Saving…" : "Save disbursement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminDisbursements;
