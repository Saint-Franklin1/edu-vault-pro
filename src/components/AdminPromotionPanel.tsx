import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ShieldPlus, Search, CheckCircle2 } from "lucide-react";

interface FoundUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface GeoRow {
  id: string;
  name: string;
}

const PROMOTABLE_ROLES: AppRole[] = [
  "chief",
  "ward_admin",
  "constituency_admin",
  "county_admin",
  "super_admin",
];

export function AdminPromotionPanel({ onPromoted }: { onPromoted?: () => void }) {
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FoundUser | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [role, setRole] = useState<AppRole | "">("");
  const [countyId, setCountyId] = useState<string>("");
  const [constituencyId, setConstituencyId] = useState<string>("");
  const [wardId, setWardId] = useState<string>("");

  const [counties, setCounties] = useState<GeoRow[]>([]);
  const [constituencies, setConstituencies] = useState<GeoRow[]>([]);
  const [wards, setWards] = useState<GeoRow[]>([]);

  const [submitting, setSubmitting] = useState(false);

  // Load counties on mount
  useEffect(() => {
    supabase.from("counties").select("id,name").order("name").then(({ data }) => {
      setCounties(data ?? []);
    });
  }, []);

  // Cascade constituencies
  useEffect(() => {
    setConstituencyId("");
    setWardId("");
    setConstituencies([]);
    setWards([]);
    if (!countyId) return;
    supabase
      .from("constituencies")
      .select("id,name")
      .eq("county_id", countyId)
      .order("name")
      .then(({ data }) => setConstituencies(data ?? []));
  }, [countyId]);

  // Cascade wards
  useEffect(() => {
    setWardId("");
    setWards([]);
    if (!constituencyId) return;
    supabase
      .from("wards")
      .select("id,name")
      .eq("constituency_id", constituencyId)
      .order("name")
      .then(({ data }) => setWards(data ?? []));
  }, [constituencyId]);

  // Reset geo when role changes (different fields are required)
  useEffect(() => {
    if (role === "super_admin") {
      setCountyId("");
      setConstituencyId("");
      setWardId("");
    } else if (role === "county_admin") {
      setConstituencyId("");
      setWardId("");
    } else if (role === "constituency_admin") {
      setWardId("");
    }
  }, [role]);

  const showCounty = role === "ward_admin" || role === "chief" || role === "constituency_admin" || role === "county_admin";
  const showConstituency = role === "ward_admin" || role === "chief" || role === "constituency_admin";
  const showWard = role === "ward_admin" || role === "chief";

  const isValid = useMemo(() => {
    if (!found || !role) return false;
    if (role === "super_admin") return true;
    if (role === "county_admin") return !!countyId;
    if (role === "constituency_admin") return !!countyId && !!constituencyId;
    if (role === "ward_admin" || role === "chief") return !!countyId && !!constituencyId && !!wardId;
    return false;
  }, [found, role, countyId, constituencyId, wardId]);

  const reset = () => {
    setEmail("");
    setFound(null);
    setNotFound(false);
    setRole("");
    setCountyId("");
    setConstituencyId("");
    setWardId("");
  };

  const search = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast({ title: "Enter an email", variant: "destructive" });
      return;
    }
    setSearching(true);
    setFound(null);
    setNotFound(false);
    const { data, error } = await supabase.rpc("find_user_by_email", { _email: trimmed });
    setSearching(false);
    if (error) {
      toast({ title: "Search failed", description: error.message, variant: "destructive" });
      return;
    }
    const row = (data as FoundUser[] | null)?.[0];
    if (!row) {
      setNotFound(true);
      return;
    }
    setFound(row);
  };

  const promote = async () => {
    if (!found || !role) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("promote_user_to_admin", {
      _target: found.id,
      _role: role as AppRole,
      _county: countyId || null,
      _constituency: constituencyId || null,
      _ward: wardId || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Promotion failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "User promoted",
      description: `${found.email} is now ${role.replace("_", " ")}.`,
    });
    reset();
    onPromoted?.();
  };

  return (
    <Card className="shadow-card border-accent/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldPlus className="w-5 h-5 text-accent" /> Promote user to admin
        </CardTitle>
        <CardDescription>
          Search a user by email, assign an admin role, and set their geographic scope. Logged in audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email search */}
        <div className="space-y-2">
          <Label htmlFor="promote-email">User email</Label>
          <div className="flex gap-2">
            <Input
              id="promote-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(null);
                setNotFound(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button onClick={search} disabled={searching} variant="secondary">
              <Search className="w-4 h-4" />
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          {notFound && (
            <p className="text-sm text-destructive">No user found with that email.</p>
          )}
          {found && (
            <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-accent" />
              <span className="font-medium">{found.full_name || "—"}</span>
              <span className="text-muted-foreground">· {found.email}</span>
            </div>
          )}
        </div>

        {/* Promotion fields (shown after user found) */}
        {found && (
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
                <SelectContent>
                  {PROMOTABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(showCounty || showConstituency || showWard) && (
              <div className="grid gap-4 md:grid-cols-3">
                {showCounty && (
                  <div className="space-y-2">
                    <Label>County *</Label>
                    <Select value={countyId} onValueChange={setCountyId}>
                      <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {counties.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showConstituency && (
                  <div className="space-y-2">
                    <Label>Constituency *</Label>
                    <Select value={constituencyId} onValueChange={setConstituencyId} disabled={!countyId}>
                      <SelectTrigger><SelectValue placeholder="Select constituency" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {constituencies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {showWard && (
                  <div className="space-y-2">
                    <Label>Ward *</Label>
                    <Select value={wardId} onValueChange={setWardId} disabled={!constituencyId}>
                      <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {wards.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button onClick={promote} disabled={!isValid || submitting}>
                {submitting ? "Promoting…" : "Promote user"}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
