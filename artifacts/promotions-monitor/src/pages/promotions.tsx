import { useState } from "react";
import { useListPromotions, useGetPromotion, getGetPromotionQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, RefreshCcw, ExternalLink } from "lucide-react";

export default function Promotions() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<any>(undefined);
  const [confidence, setConfidence] = useState<any>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useListPromotions({
    page,
    pageSize: 50,
    search: search || undefined,
    platform: platform && platform !== "all" ? platform : undefined,
    confidenceScore: confidence && confidence !== "all" ? confidence : undefined,
  });

  const { data: detailData, isLoading: detailLoading } = useGetPromotion(selectedId || "", {
    query: {
      enabled: !!selectedId,
      queryKey: getGetPromotionQueryKey(selectedId || ""),
    },
  });

  const handleExport = () => {
    if (!data?.promotions) return;
    const headers = ["ID", "Operator", "Platform", "Type", "Reward", "Requires Deposit", "Confidence", "Detected At"];
    const csvRows = data.promotions.map(p => [
      p.id,
      p.operator,
      p.platform,
      p.promoType || "",
      p.rewardValue || "",
      p.requiresDeposit ? "Yes" : "No",
      p.confidenceScore,
      p.detectedAt
    ]);
    
    const csvContent = [headers, ...csvRows]
      .map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(","))
      .join("\n");
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `promotions_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearch("");
    setPlatform("all");
    setConfidence("all");
    setPage(1);
  };

  const renderConfidenceBadge = (score: string) => {
    if (score === "High") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">High</Badge>;
    if (score === "Medium") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20">Medium</Badge>;
    return <Badge className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20">Low</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promotions Data</h1>
          <p className="text-muted-foreground">Filter and analyze scraped promotional content.</p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 border-b border-border bg-muted/40">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search operator, details..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={platform || "all"} onValueChange={setPlatform}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={confidence || "all"} onValueChange={setConfidence}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset filters">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operator</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Deposit</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Detected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : data?.promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    No promotions match your current filters.
                    <div className="mt-4">
                      <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data?.promotions.map((promo) => (
                  <TableRow 
                    key={promo.id} 
                    className={`cursor-pointer transition-colors ${promo.requiresDeposit === false ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
                    onClick={() => setSelectedId(promo.id)}
                  >
                    <TableCell className="font-medium">{promo.operator}</TableCell>
                    <TableCell>{promo.platform}</TableCell>
                    <TableCell>
                      {promo.promoType ? (
                        <Badge variant="outline" className="font-normal">{promo.promoType}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={promo.offerDetails || ""}>
                      {promo.offerDetails || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>{promo.rewardValue || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>
                      {promo.requiresDeposit === false ? (
                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                          No Deposit
                        </Badge>
                      ) : promo.requiresDeposit === true ? (
                        <span className="text-xs text-muted-foreground ml-2">Req.</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{renderConfidenceBadge(promo.confidenceScore)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(promo.detectedAt), "MMM d, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {data && data.total > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle>Promotion Details</SheetTitle>
              {detailData && (
                <a href={detailData.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm font-medium">
                  Source Post <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <SheetDescription>
              ID: <span className="font-mono">{selectedId}</span>
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detailData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Operator</div>
                  <div className="font-medium">{detailData.operator}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Platform</div>
                  <div className="font-medium">{detailData.platform}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Type</div>
                  <div>{detailData.promoType || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Confidence</div>
                  <div>{renderConfidenceBadge(detailData.confidenceScore)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Detected At</div>
                  <div className="text-sm">{format(new Date(detailData.detectedAt), "PPpp")}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Post Date</div>
                  <div className="text-sm">{detailData.postDate ? format(new Date(detailData.postDate), "PPpp") : "-"}</div>
                </div>
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Reward Value</div>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">{detailData.rewardValue || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Min Deposit</div>
                  <div>{detailData.minDeposit || "-"}</div>
                </div>
                <div className="space-y-1 col-span-2">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Requirements</div>
                  <div className="text-sm bg-muted p-2 rounded-md">
                    {detailData.requiresDeposit === false && (
                      <Badge className="mb-2 bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">No Deposit Required</Badge>
                    )}
                    <div><span className="font-medium">Wagering:</span> {detailData.wageringRequirement || "-"}</div>
                    <div><span className="font-medium">Expiry:</span> {detailData.expiryDate || "-"}</div>
                    <div><span className="font-medium">Audience:</span> {detailData.targetAudience || "-"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Extracted Offer Details</div>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{detailData.offerDetails || "-"}</p>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Raw Post Text</div>
                <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {detailData.rawPostText || "-"}
                </div>
              </div>
            </div>
          ) : (
            <div>Failed to load details</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}