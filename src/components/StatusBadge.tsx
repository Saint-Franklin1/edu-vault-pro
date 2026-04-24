import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ListChecks, ShieldCheck, XCircle } from "lucide-react";

export type DocStatus = "pending" | "in_queue" | "verified" | "rejected";

export function StatusBadge({ status }: { status: DocStatus }) {
  switch (status) {
    case "verified":
      return (
        <Badge className="bg-accent text-accent-foreground hover:bg-accent/90">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>
      );
    case "in_queue":
      return (
        <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">
          <ListChecks className="w-3 h-3 mr-1" /> In queue
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
  }
}

export interface StageFlags {
  status: DocStatus;
  chief_approved?: boolean;
  ward_approved?: boolean;
  constituency_approved?: boolean;
  county_approved?: boolean;
}

/**
 * Compact label describing where the document sits in the
 * Chief → Ward → Constituency → County → Verified chain.
 */
export function stageLabel(d: StageFlags): string {
  if (d.status === "rejected") return "Rejected";
  if (d.county_approved && d.constituency_approved && d.ward_approved && d.chief_approved)
    return "Fully Verified";
  if (d.county_approved) return "County Approved";
  if (d.constituency_approved) return "Constituency Approved";
  if (d.ward_approved) return "Ward Approved";
  if (d.chief_approved) return "Chief Approved";
  return "Pending Chief";
}

export function ApprovalStage({ d }: { d: StageFlags }) {
  const label = stageLabel(d);
  const fully = label === "Fully Verified";
  const rejected = label === "Rejected";
  return (
    <div className="space-y-1">
      <Badge
        variant={rejected ? "destructive" : fully ? "default" : "secondary"}
        className="gap-1"
      >
        <ShieldCheck className="w-3 h-3" /> {label}
      </Badge>
      <div className="flex gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className={d.chief_approved ? "text-accent font-semibold" : ""}>Ch</span>
        <span>›</span>
        <span className={d.ward_approved ? "text-accent font-semibold" : ""}>W</span>
        <span>›</span>
        <span className={d.constituency_approved ? "text-accent font-semibold" : ""}>C</span>
        <span>›</span>
        <span className={d.county_approved ? "text-accent font-semibold" : ""}>Co</span>
      </div>
    </div>
  );
}
