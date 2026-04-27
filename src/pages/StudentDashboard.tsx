import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GeoSelector, GeoValue } from "@/components/GeoSelector";
import { StatusBadge, DocStatus, ApprovalStage } from "@/components/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { Trash2, Upload as UploadIcon, FileText } from "lucide-react";

const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];
const MAX_SIZE = 5 * 1024 * 1024;

interface Doc {
  id: string;
  title: string;
  file_name: string | null;
  mime_type: string | null;
  status: DocStatus;
  rejection_reason: string | null;
  created_at: string;
  storage_path: string;
  chief_approved: boolean;
  chief_category: string | null;
  ward_approved: boolean;
  constituency_approved: boolean;
  county_approved: boolean;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    phone: string | null;
    county_id: string | null;
    constituency_id: string | null;
    ward_id: string | null;
  } | null>(null);
  // Tracks the LAST PERSISTED geo state from the server so we don't hide the
  // profile card based on unsaved local dropdown selections.
  const [persistedGeo, setPersistedGeo] = useState<{
    county_id: string | null;
    constituency_id: string | null;
    ward_id: string | null;
  }>({ county_id: null, constituency_id: null, ward_id: null });
  const [savingProfile, setSavingProfile] = useState(false);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name,phone,county_id,constituency_id,ward_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(
          data ?? { full_name: "", phone: "", county_id: null, constituency_id: null, ward_id: null }
        );
        setPersistedGeo({
          county_id: data?.county_id ?? null,
          constituency_id: data?.constituency_id ?? null,
          ward_id: data?.ward_id ?? null,
        });
      });
  }, [user]);

  const loadDocs = () => {
    if (!user) return;
    supabase
      .from("documents")
      .select(
        "id,title,file_name,mime_type,status,rejection_reason,created_at,storage_path,chief_approved,chief_category,ward_approved,constituency_approved,county_approved"
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs((data as Doc[]) ?? []));
  };

  useEffect(() => {
    loadDocs();
    if (!user) return;
    const channel = supabase
      .channel("docs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `user_id=eq.${user.id}` },
        () => loadDocs()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const profileComplete =
    !!persistedGeo.county_id && !!persistedGeo.constituency_id && !!persistedGeo.ward_id;

  const hasUnsavedGeoChanges =
    profile !== null &&
    (profile.county_id !== persistedGeo.county_id ||
      profile.constituency_id !== persistedGeo.constituency_id ||
      profile.ward_id !== persistedGeo.ward_id);

  const saveProfile = async () => {
    if (!user || !profile) return;
    if (!profile.county_id || !profile.constituency_id || !profile.ward_id) {
      toast({
        title: "Select your full location",
        description: "County, constituency and ward are all required.",
        variant: "destructive",
      });
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        full_name: profile.full_name,
        phone: profile.phone,
        county_id: profile.county_id,
        constituency_id: profile.constituency_id,
        ward_id: profile.ward_id,
      });
    setSavingProfile(false);
    if (error) {
      toast({ title: "Couldn't save profile", description: error.message, variant: "destructive" });
    } else {
      setPersistedGeo({
        county_id: profile.county_id,
        constituency_id: profile.constituency_id,
        ward_id: profile.ward_id,
      });
      toast({ title: "Profile saved" });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Allowed: PDF, PNG, JPEG", variant: "destructive" });
      return;
    }
    if (file.size === 0) {
      toast({ title: "Empty file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("student-documents")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }
    const { error: insErr } = await supabase.from("documents").insert({
      user_id: user.id,
      title: title || file.name,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });
    setUploading(false);
    if (insErr) {
      toast({ title: "Couldn't save document", description: insErr.message, variant: "destructive" });
    } else {
      toast({ title: "Uploaded — pending verification" });
      setFile(null);
      setTitle("");
      (document.getElementById("file-input") as HTMLInputElement | null)?.value && ((document.getElementById("file-input") as HTMLInputElement).value = "");
    }
  };

  const softDelete = async (id: string) => {
    const { error } = await supabase
      .from("documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Document removed" });
    }
  };

  const view = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("student-documents")
      .createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Couldn't open file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <AppShell>
      <div className="container py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Your documents</h1>
          <p className="text-muted-foreground">Upload, track and share verified documents.</p>
        </div>

        {!profileComplete && (
          <Card className="border-warning shadow-card">
            <CardHeader>
              <CardTitle>Complete your profile</CardTitle>
              <CardDescription>
                Select your county, constituency and ward so the right administrator can verify your documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    value={profile?.full_name ?? ""}
                    onChange={(e) => setProfile((p) => ({ ...(p ?? { phone: "", county_id: null, constituency_id: null, ward_id: null, full_name: "" }), full_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={profile?.phone ?? ""}
                    onChange={(e) => setProfile((p) => ({ ...(p ?? { full_name: "", county_id: null, constituency_id: null, ward_id: null, phone: "" }), phone: e.target.value }))}
                  />
                </div>
              </div>
              <GeoSelector
                required
                value={{
                  county_id: profile?.county_id ?? null,
                  constituency_id: profile?.constituency_id ?? null,
                  ward_id: profile?.ward_id ?? null,
                }}
                onChange={(v: GeoValue) =>
                  setProfile((p) => ({ ...(p ?? { full_name: "", phone: "" }), ...v }))
                }
              />
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </CardContent>
          </Card>
        )}

        {profileComplete && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Upload a document</CardTitle>
              <CardDescription>PDF, PNG or JPEG. Max 5MB.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="grid gap-4 md:grid-cols-3 items-end">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="doc-title">Title</Label>
                  <Input
                    id="doc-title"
                    placeholder="e.g. KCSE Certificate"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="file-input">File</Label>
                  <Input
                    id="file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button type="submit" disabled={!file || uploading}>
                  <UploadIcon className="w-4 h-4" /> {uploading ? "Uploading…" : "Upload"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Updated in real time.</CardDescription>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                No documents yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approval stage</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        {d.title}
                        {d.status === "rejected" && d.rejection_reason && (
                          <p className="text-xs text-destructive mt-1">Reason: {d.rejection_reason}</p>
                        )}
                        {d.chief_category && (
                          <p className="text-xs text-muted-foreground mt-1 capitalize">
                            Category: {d.chief_category}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.file_name}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell><ApprovalStage d={d} /></TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => view(d.storage_path)}>
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => softDelete(d.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
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

export default StudentDashboard;
