import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, FileText, ShieldCheck, Upload } from "lucide-react";

type Category = "orphan" | "vulnerable" | "pwd" | "other";

interface Doc {
  id: string;
  title: string;
  file_name: string | null;
  status: string;
  storage_path: string;
  user_id: string;
  created_at: string;
  chief_approved: boolean;
  chief_category: Category | null;
  chief_notes: string | null;
  recommendation_letter_url: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

const ChiefDashboard = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [active, setActive] = useState<Doc | null>(null);
  const [category, setCategory] = useState<Category>("other");
  const [notes, setNotes] = useState("");
  const [letter, setLetter] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    supabase
      .from("documents")
      .select(
        "id,title,file_name,status,storage_path,user_id,created_at,chief_approved,chief_category,chief_notes,recommendation_letter_url, profiles!inner(full_name,email)"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Couldn't load", description: error.message, variant: "destructive" });
          return;
        }
        setDocs((data as unknown as Doc[]) ?? []);
      });
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("chief-docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const view = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("student-documents")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Couldn't open", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const openReview = (d: Doc) => {
    setActive(d);
    setCategory((d.chief_category as Category) ?? "other");
    setNotes(d.chief_notes ?? "");
    setLetter(null);
  };

  const submit = async () => {
    if (!active || !user) return;
    setSubmitting(true);
    let letterUrl = active.recommendation_letter_url;
    if (letter) {
      const path = `${user.id}/${active.id}-${Date.now()}-${letter.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("chief-letters")
        .upload(path, letter, { contentType: letter.type });
      if (upErr) {
        setSubmitting(false);
        toast({ title: "Letter upload failed", description: upErr.message, variant: "destructive" });
        return;
      }
      letterUrl = path;
    }
    const { error } = await supabase
      .from("documents")
      .update({
        chief_approved: true,
        chief_category: category,
        chief_notes: notes || null,
        recommendation_letter_url: letterUrl,
        status: "in_queue",
      })
      .eq("id", active.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Chief approval recorded", description: "Document moved to ward admin queue." });
    setActive(null);
    setLetter(null);
    setNotes("");
  };

  const pending = docs.filter((d) => !d.chief_approved && d.status !== "rejected");
  const done = docs.filter((d) => d.chief_approved);

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Chief queue</h1>
            <p className="text-muted-foreground">
              Verify residency, assign category, and upload a recommendation letter. Approved
              documents move to the ward admin automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-5 h-5 text-accent" /> Ward-scoped
          </div>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Pending residency verification ({pending.length})</CardTitle>
            <CardDescription>Students in your ward awaiting your approval.</CardDescription>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                Nothing pending.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-medium">{d.profiles?.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{d.profiles?.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{d.title}</div>
                        <div className="text-xs text-muted-foreground">{d.file_name}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => view(d.storage_path)}>
                          View
                        </Button>
                        <Button size="sm" onClick={() => openReview(d)}>
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

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Already approved ({done.length})</CardTitle>
            <CardDescription>Forwarded to ward admin queue.</CardDescription>
          </CardHeader>
          <CardContent>
            {done.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">None yet.</p>
            ) : (
              <div className="space-y-2">
                {done.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="font-medium">{d.profiles?.full_name} · {d.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Category: <Badge variant="secondary" className="capitalize">{d.chief_category}</Badge>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve residency</DialogTitle>
            <DialogDescription>
              Confirm the student lives in your ward, classify the case, and upload a recommendation letter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="orphan">Orphan</SelectItem>
                  <SelectItem value="vulnerable">Vulnerable</SelectItem>
                  <SelectItem value="pwd">Person with disability</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chief notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Brief context…" />
            </div>
            <div className="space-y-2">
              <Label>Recommendation letter (PDF or image)</Label>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => setLetter(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>
              <Upload className="w-4 h-4" /> {submitting ? "Submitting…" : "Approve & forward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default ChiefDashboard;
