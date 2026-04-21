import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, highestRole } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GeoSelector, GeoValue } from "@/components/GeoSelector";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

interface Bursary {
  id: string;
  title: string;
  description: string | null;
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
  const [deadline, setDeadline] = useState("");
  const [geo, setGeo] = useState<GeoValue>({ county_id: null, constituency_id: null, ward_id: null });
  const [busy, setBusy] = useState(false);

  // Edit state
  const [editing, setEditing] = useState<Bursary | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
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
      .select("id,title,description,deadline,county_id,constituency_id,ward_id,created_at,created_by")
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("bursaries").insert({
      title,
      description,
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
      setTitle(""); setDescription(""); setDeadline("");
      if (role !== "super_admin") setGeo(profileGeo);
      load();
    }
  };

  const canEdit = (b: Bursary) => role === "super_admin" || b.created_by === user?.id;

  const openEdit = (b: Bursary) => {
    setEditing(b);
    setEditDescription(b.description ?? "");
    setEditDeadline(b.deadline ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("bursaries")
      .update({
        description: editDescription,
        deadline: editDeadline || null,
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
              Title and scope are immutable once posted. You can adjust description and deadline only.
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
                    <TableHead>Deadline</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {b.description}
                      </TableCell>
                      <TableCell>
                        {b.deadline ? new Date(b.deadline).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit(b) ? (
                          <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                            <Pencil className="w-4 h-4 mr-1" /> Edit
                          </Button>
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
              Only the description and deadline can be adjusted. Title and scope are immutable.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title (locked)</Label>
                <Input value={editing.title} disabled />
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
