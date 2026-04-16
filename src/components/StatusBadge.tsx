import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, ListChecks, XCircle } from "lucide-react";

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
