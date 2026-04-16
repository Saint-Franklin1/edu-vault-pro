import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Row {
  id: string;
  name: string;
}

export interface GeoValue {
  county_id: string | null;
  constituency_id: string | null;
  ward_id: string | null;
}

export function GeoSelector({
  value,
  onChange,
  required,
}: {
  value: GeoValue;
  onChange: (v: GeoValue) => void;
  required?: boolean;
}) {
  const [counties, setCounties] = useState<Row[]>([]);
  const [constituencies, setConstituencies] = useState<Row[]>([]);
  const [wards, setWards] = useState<Row[]>([]);

  useEffect(() => {
    supabase
      .from("counties")
      .select("id,name")
      .order("name")
      .then(({ data }) => setCounties(data ?? []));
  }, []);

  useEffect(() => {
    if (!value.county_id) {
      setConstituencies([]);
      return;
    }
    supabase
      .from("constituencies")
      .select("id,name")
      .eq("county_id", value.county_id)
      .order("name")
      .then(({ data }) => setConstituencies(data ?? []));
  }, [value.county_id]);

  useEffect(() => {
    if (!value.constituency_id) {
      setWards([]);
      return;
    }
    supabase
      .from("wards")
      .select("id,name")
      .eq("constituency_id", value.constituency_id)
      .order("name")
      .then(({ data }) => setWards(data ?? []));
  }, [value.constituency_id]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label>County{required && " *"}</Label>
        <Select
          value={value.county_id ?? undefined}
          onValueChange={(v) =>
            onChange({ county_id: v, constituency_id: null, ward_id: null })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select county" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {counties.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Constituency{required && " *"}</Label>
        <Select
          value={value.constituency_id ?? undefined}
          onValueChange={(v) =>
            onChange({ ...value, constituency_id: v, ward_id: null })
          }
          disabled={!value.county_id}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select constituency" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {constituencies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Ward{required && " *"}</Label>
        <Select
          value={value.ward_id ?? undefined}
          onValueChange={(v) => onChange({ ...value, ward_id: v })}
          disabled={!value.constituency_id}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select ward" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {wards.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
