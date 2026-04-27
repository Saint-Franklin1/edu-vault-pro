import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { CheckCircle2, GraduationCap, ShieldCheck } from "lucide-react";

interface Doc {
  id: string;
  title: string;
  verified_at: string | null;
  created_at: string;
  mime_type: string | null;
}

const Verify = () => {
  const { user_id } = useParams<{ user_id: string }>();
  const [name, setName] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user_id) return;
    (async () => {
      const [{ data: profileRows }, { data: documents }] = await Promise.all([
        supabase.rpc("get_public_profile", { _user_id: user_id }),
        supabase.rpc("get_public_verified_documents", { _user_id: user_id }),
      ]);
      const profile = Array.isArray(profileRows) ? profileRows[0] : profileRows;
      setName(profile?.full_name ?? null);
      setDocs((documents as Doc[]) ?? []);
      setLoading(false);
    })();
  }, [user_id]);

  return (
    <AppShell>
      <div className="container max-w-2xl py-12 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold">Verified documents</h1>
          {name && (
            <p className="flex items-center gap-2 justify-center text-muted-foreground">
              <GraduationCap className="w-4 h-4" /> {name}
            </p>
          )}
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Verification record</CardTitle>
            <CardDescription>
              These documents have been verified by a Kenyan local administrator. File contents are not exposed publicly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground py-6 text-center">Loading…</p>
            ) : docs.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No verified documents found for this student.
              </p>
            ) : (
              <ul className="divide-y">
                {docs.map((d) => (
                  <li key={d.id} className="py-3 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">{d.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Verified {d.verified_at ? new Date(d.verified_at).toLocaleDateString() : "—"}
                      </div>
                    </div>
                    <StatusBadge status="verified" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Verify;
