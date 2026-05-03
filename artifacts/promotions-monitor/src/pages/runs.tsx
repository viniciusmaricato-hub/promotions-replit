import {
  useListRuns,
  useTriggerRun,
  useGetRunProgress,
  getListRunsQueryKey,
  getGetRunProgressQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, AlertCircle, Play, Loader2 } from "lucide-react";

export default function Runs() {
  const queryClient = useQueryClient();
  const listRunsParams = { limit: 50 };
  const { data: runs, isLoading } = useListRuns(listRunsParams, {
    query: {
      queryKey: getListRunsQueryKey(listRunsParams),
      refetchInterval: 5000,
    },
  });

  const { data: progress } = useGetRunProgress({
    query: {
      queryKey: getGetRunProgressQueryKey(),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "running" || status === "finished" ? 2000 : false;
      },
      refetchIntervalInBackground: false,
    },
  });

  const triggerRun = useTriggerRun({
    mutation: {
      onSuccess: () => {
        toast.success("Pipeline run started", {
          description: "New entries will appear below as the pipeline processes each source.",
        });
        queryClient.invalidateQueries({ queryKey: getListRunsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRunProgressQueryKey() });
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "error" in err
              ? String((err as { error: unknown }).error)
              : "Failed to start the pipeline.";
        toast.error("Could not start pipeline", { description: message });
      },
    },
  });

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

  const showProgress =
    progress && (progress.status === "running" || progress.status === "finished");
  const progressTotal = progress?.total ?? 0;
  const progressCompleted = progress?.completed ?? 0;
  const progressPct =
    progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;
  const isRunning = progress?.status === "running";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-muted-foreground">Recent ingestion and processing runs.</p>
        </div>
        <Button
          onClick={() => triggerRun.mutate()}
          disabled={triggerRun.isPending}
          className="gap-2"
        >
          {triggerRun.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Starting...
            </>
          ) : isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Run Now
            </>
          )}
        </Button>
      </div>

      {showProgress && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {isRunning ? "Running pipeline" : "Run complete"}
                  <span className="text-muted-foreground font-normal ml-2">
                    {progressCompleted} / {progressTotal} jobs
                  </span>
                </div>
                {isRunning && progress?.currentSource && (
                  <div className="text-xs text-muted-foreground truncate">
                    Currently processing:{" "}
                    <span className="font-medium text-foreground">{progress.currentSource}</span>
                    {progress.currentPlatform && (
                      <>
                        {" · "}
                        <span>{progress.currentPlatform}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="text-sm font-mono text-muted-foreground tabular-nums shrink-0">
              {progressPct}%
            </div>
          </div>
          <Progress value={progressPct} className="mt-3 h-2" />
        </Card>
      )}

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
