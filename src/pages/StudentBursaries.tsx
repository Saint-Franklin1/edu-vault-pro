import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin } from "lucide-react";

interface Bursary {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  county_id: string | null;
  constituency_id: string | null;
  ward_id: string | null;
  counties?: { name: string } | null;
  constituencies?: { name: string } | null;
  wards?: { name: string } | null;
}

const StudentBursaries = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Bursary[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("bursaries")
      .select(
        "id,title,description,deadline,county_id,constituency_id,ward_id, counties(name), constituencies(name), wards(name)"
      )
      .is("deleted_at", null)
      .order("deadline", { ascending: true, nullsFirst: false });
    setItems((data as unknown as Bursary[]) ?? []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("bursaries-students")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bursaries" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <AppShell>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bursaries & scholarship programs</h1>
          <p className="text-muted-foreground">
            All currently open programs. Each card shows the geographic scope it applies to.
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
            {items.map((b) => (
              <Card key={b.id} className="shadow-card">
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
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{b.description}</p>
                  <div className="mt-3">
                    <Badge variant="secondary">
                      {b.ward_id
                        ? "Ward"
                        : b.constituency_id
                        ? "Constituency"
                        : b.county_id
                        ? "County"
                        : "Open to all"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default StudentBursaries;
