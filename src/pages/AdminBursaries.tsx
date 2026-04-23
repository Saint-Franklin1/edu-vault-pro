import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, highestRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GeoSelector, GeoValue } from "@/components/GeoSelector";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Pencil, Trash2, ExternalLink } from "lucide-react";

interface Bursary {
  id: string;
  title: string;
  description: string | null;
  application_link: string;
  deadline: string | null;
  county_id: string | null;
  constituency_id: string | null;
  ward_id: string | null;
  created_at: string;
  created_by: string | null;
}

const AdminBursaries = () => {
  const { user, roles } = useAuth();
  const role = highestRole(roles);

  const [profileGeo, setProfileGeo] = useState<GeoValue>({ county_id: null, constituency_id: null, ward_id: null });
  const [list, setList] = useState<Bursary[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [applicationLink, setApplicationLink] = useState("");
  const [deadline, setDeadline] = useState("");
  const [geo, setGeo] = useState<GeoValue>({ county_id: null, constituency_id: null, ward_id: null });
  const [busy, setBusy] = useState(false);

  // Edit state
  const [editing, setEditing] = useState<Bursary | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editLink, setEditLink] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("county_id,constituency_id,ward_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfileGeo(data);
          if (role !== "super_admin") setGeo(data);
        }
      });
  }, [user, role]);

  const load = () => {
    supabase
      .from("bursaries")
      .select("id,title,description,application_link,deadline,county_id,constituency_id,ward_id,created_at,created_by")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => setList((data as Bursary[]) ?? []));
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("bursaries-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bursaries" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isValidUrl = (v: string) => /^https?:\/\/\S+/i.test(v.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isValidUrl(applicationLink)) {
      toast({ title: "Invalid application link", description: "Use a full URL starting with http(s)://", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("bursaries").insert({
      title,
      description,
      application_link: applicationLink.trim(),
      deadline: deadline || null,
      county_id: geo.county_id,
      constituency_id: geo.constituency_id,
      ward_id: geo.ward_id,
      created_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Couldn't create bursary", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bursary posted" });
      setTitle(""); setDescription(""); setDeadline(""); setApplicationLink("");
      if (role !== "super_admin") setGeo(profileGeo);
      load();
    }
  };

  const canEdit = (b: Bursary) => role === "super_admin" || b.created_by === user?.id;

  const openEdit = (b: Bursary) => {
    setEditing(b);
    setEditDescription(b.description ?? "");
    setEditDeadline(b.deadline ?? "");
    setEditLink(b.application_link ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!isValidUrl(editLink)) {
      toast({ title: "Invalid application link", description: "Use a full URL starting with http(s)://", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("bursaries")
      .update({
        description: editDescription,
        deadline: editDeadline || null,
        application_link: editLink.trim(),
      })
      .eq("id", editing.id);
    setSavingEdit(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bursary updated" });
      setEditing(null);
      load();
    }
  };

  const softDelete = async (b: Bursary) => {
    if (!canEdit(b)) return;
    if (!confirm(`Remove "${b.title}"? Students will no longer see it.`)) return;
    const { error } = await supabase
      .from("bursaries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bursary removed" });
      load();
    }
  };

  const scopeLabel = (b: Bursary) =>
    b.ward_id ? "Ward" : b.constituency_id ? "Constituency" : b.county_id ? "County" : "Open to all";

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Bursaries</h1>
          <p className="text-muted-foreground">Post and manage bursaries within your scope.</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Create bursary</CardTitle>
            <CardDescription>
              {role === "super_admin"
                ? "As super admin you can target any county / constituency / ward."
                : "Locked to your geographic scope."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Application link</Label>
                <Input
                  type="url"
                  placeholder="https://example.org/apply"
                  value={applicationLink}
                  onChange={(e) => setApplicationLink(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Students will click "Apply Now" and be taken here in a new tab.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>
              {role === "super_admin" ? (
                <GeoSelector value={geo} onChange={setGeo} />
              ) : (
                <div className="text-sm text-muted-foreground">
                  Targeting your assigned scope automatically.
                </div>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? "Posting…" : "Post bursary"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>All bursaries</CardTitle>
            <CardDescription>
              Title and scope are immutable once posted. You can adjust description, deadline and link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">No bursaries yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium align-top">{b.title}</TableCell>
                      <TableCell className="text-sm align-top max-w-md">
                        <p className="whitespace-pre-line">{b.description || "—"}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="secondary">{scopeLabel(b)}</Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        {b.deadline ? new Date(b.deadline).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="align-top">
                        {b.application_link ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(b.application_link, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" /> Open
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top whitespace-nowrap">
                        {canEdit(b) ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                              <Pencil className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => softDelete(b)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read-only</span>
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bursary</DialogTitle>
            <DialogDescription>
              Title and scope are immutable. Description, deadline and application link can be updated.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title (locked)</Label>
                <Input value={editing.title} disabled />
              </div>
              <div className="space-y-2">
                <Label>Application link</Label>
                <Input
                  type="url"
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default AdminBursaries;
