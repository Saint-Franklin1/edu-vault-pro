import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, UserCog } from "lucide-react";

interface Handover {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  national_id_number: string;
  status: string;
  ai_match_score: number | null;
  ai_reasoning: string | null;
  rejection_reason: string | null;
  created_at: string;
  new_user_id: string | null;
}

const SuperAdminHandover = () => {
  const { roles, loading, user } = useAuth();
  const isSuper = roles.includes("super_admin");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [handovers, setHandovers] = useState<Handover[]>([]);

  const load = async () => {
    const { data, error } = await supabase
      .from("super_admin_handovers")
      .select("id,full_name,email,phone,national_id_number,status,ai_match_score,ai_reasoning,rejection_reason,created_at,new_user_id")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load handovers", description: error.message, variant: "destructive" });
    }
    setHandovers((data as Handover[]) ?? []);
  };

  useEffect(() => { if (!loading && isSuper) load(); }, [loading, isSuper]);

  if (!loading && !isSuper) return <Navigate to="/admin" replace />;

  const reset = () => {
    setFullName(""); setEmail(""); setPhone(""); setNationalId("");
    setPassword(""); setIdPhoto(null); setSelfie(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!idPhoto || !selfie) {
      toast({ title: "Both photos required", description: "Upload the national-ID photo and a selfie.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Weak password", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the new auth user (sends verification email automatically)
      const { data: signupRes, error: signupErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName },
        },
      });
      if (signupErr) throw signupErr;
      const newUserId = signupRes.user?.id;
      if (!newUserId) throw new Error("Signup did not return a user id");

      // 2. Insert handover row
      const { data: handoverRow, error: insErr } = await supabase
        .from("super_admin_handovers")
        .insert({
          initiated_by: user.id,
          new_user_id: newUserId,
          full_name: fullName,
          email,
          phone,
          national_id_number: nationalId,
          status: "pending_ai_review",
        })
        .select("id").single();
      if (insErr) throw insErr;
      const handoverId = handoverRow.id;

      // 3. Upload both photos to private handover-ids bucket
      const idPath = `${handoverId}/national-id-${Date.now()}.${idPhoto.name.split(".").pop()}`;
      const selfiePath = `${handoverId}/selfie-${Date.now()}.${selfie.name.split(".").pop()}`;
      const [u1, u2] = await Promise.all([
        supabase.storage.from("handover-ids").upload(idPath, idPhoto, { contentType: idPhoto.type }),
        supabase.storage.from("handover-ids").upload(selfiePath, selfie, { contentType: selfie.type }),
      ]);
      if (u1.error) throw u1.error;
      if (u2.error) throw u2.error;

      await supabase.from("super_admin_handovers").update({
        national_id_photo_path: idPath,
        selfie_photo_path: selfiePath,
      }).eq("id", handoverId);

      // 4. Trigger AI face-match verification
      const { data: aiRes, error: aiErr } = await supabase.functions.invoke("verify-handover-identity", {
        body: { handover_id: handoverId },
      });
      if (aiErr) throw aiErr;

      if (aiRes?.status === "approved") {
        toast({
          title: "Identity verified ✓",
          description: `Match confidence ${(aiRes.confidence * 100).toFixed(0)}%. The new admin must verify their email, then click "Finalize" below.`,
        });
      } else {
        toast({
          title: "Identity check failed",
          description: aiRes?.reasoning ?? "Photos did not match. Handover rejected.",
          variant: "destructive",
        });
      }

      reset();
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Handover failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = async (h: Handover) => {
    if (!h.new_user_id) {
      toast({ title: "No linked user", variant: "destructive" });
      return;
    }
    const { error } = await supabase.rpc("finalize_super_admin_handover", {
      _handover_id: h.id,
      _new_user: h.new_user_id,
    });
    if (error) {
      toast({ title: "Finalize failed", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Handover finalized",
        description: `${h.full_name} is now a super admin. You can sign out.`,
      });
      load();
    }
  };

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge>Identity verified</Badge>;
    if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
    if (s === "expired") return <Badge variant="secondary">Expired</Badge>;
    return <Badge variant="secondary">{s.replace(/_/g, " ")}</Badge>;
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Super admin handover</h1>
            <p className="text-muted-foreground">
              Onboard a new super admin with verified identity. The system uses AI to compare the
              national ID photo against a selfie. The new admin must verify their email before
              you finalize the handover.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-5 h-5 text-accent" /> Super admin only
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" /> Onboard new super admin
            </CardTitle>
            <CardDescription>
              All fields are required. The new admin will receive a verification email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ho-name">Full name</Label>
                <Input id="ho-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ho-email">New email</Label>
                <Input id="ho-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ho-phone">Phone</Label>
                <Input id="ho-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={32} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ho-nid">National ID number</Label>
                <Input id="ho-nid" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required maxLength={32} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ho-pwd">Temporary password (min 8 chars)</Label>
                <Input id="ho-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ho-id-photo">Photo of national ID</Label>
                <Input
                  id="ho-id-photo"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ho-selfie">Selfie of new admin</Label>
                <Input
                  id="ho-selfie"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Verifying identity…" : "Submit handover"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Handover history</CardTitle>
            <CardDescription>
              Approved handovers can be finalized once the new admin verifies their email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {handovers.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No handovers yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI score</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {handovers.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        <div className="font-medium">{h.full_name}</div>
                        <div className="text-xs text-muted-foreground">ID: {h.national_id_number}</div>
                      </TableCell>
                      <TableCell className="text-xs">{h.email}</TableCell>
                      <TableCell>
                        {statusBadge(h.status)}
                        {h.rejection_reason && (
                          <div className="text-xs text-destructive mt-1 max-w-xs truncate" title={h.rejection_reason}>
                            {h.rejection_reason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {h.ai_match_score !== null ? `${(h.ai_match_score * 100).toFixed(0)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {h.status === "approved" && !h.new_user_id ? (
                          <span className="text-xs text-muted-foreground">Awaiting email verification</span>
                        ) : h.status === "approved" ? (
                          <Button size="sm" onClick={() => finalize(h)}>Finalize</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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

export default SuperAdminHandover;
