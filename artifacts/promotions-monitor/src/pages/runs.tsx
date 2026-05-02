import { useListRuns } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function Runs() {
  const { data: runs, isLoading } = useListRuns({ limit: 50 });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1 pr-2">
            <CheckCircle2 className="h-3 w-3" /> Success
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-200 gap-1 pr-2">
            <XCircle className="h-3 w-3" /> Error
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1 pr-2">
            <AlertCircle className="h-3 w-3" /> Partial
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground">Recent ingestion and processing runs.</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Run Time</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Fetched</TableHead>
                <TableHead className="text-right">Inserted</TableHead>
                <TableHead className="w-[300px]">Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  </TableRow>
                ))
              ) : runs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No run logs available.
                  </TableCell>
                </TableRow>
              ) : (
                runs?.map((run) => (
                  <TableRow key={run.id} className="font-mono text-sm">
                    <TableCell className="text-muted-foreground">
                      {format(new Date(run.runAt), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{run.source}</TableCell>
                    <TableCell>{run.platform}</TableCell>
                    <TableCell>{getStatusBadge(run.status)}</TableCell>
                    <TableCell className="text-right">{run.recordsFetched}</TableCell>
                    <TableCell className="text-right">{run.recordsInserted}</TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[300px]" title={run.errorMessage || ""}>
                      {run.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}