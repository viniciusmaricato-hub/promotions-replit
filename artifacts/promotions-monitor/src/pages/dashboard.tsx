import { SVGProps, useState } from "react";
import {
  useGetPromotionsStats,
  useListPromotions,
  useGetPromotion,
  getGetPromotionQueryKey,
  useListPromotionTypes,
  useListOperators,
} from "@workspace/api-client-react";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tag, TrendingUp, AlertTriangle, Building2, Search, Download, RefreshCcw, ExternalLink } from "lucide-react";

type DepositFilter = "all" | "no-deposit" | "requires-deposit";

function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function renderConfidenceBadge(score: string) {
  if (score === "High")
    return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">High</Badge>;
  if (score === "Medium")
    return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20">Medium</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20">Low</Badge>;
}

const DEFAULT_DATE_FROM = format(subDays(new Date(), 7), "yyyy-MM-dd");

type Platform = "Instagram" | "Telegram" | "";
type Confidence = "High" | "Medium" | "Low" | "";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPromotionsStats();
  const { data: promoTypes } = useListPromotionTypes();
  const { data: operators } = useListOperators();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [operator, setOperator] = useState("");
  const [promoType, setPromoType] = useState("");
  const [platform, setPlatform] = useState<Platform>("");
  const [confidence, setConfidence] = useState<Confidence>("");
  const [depositFilter, setDepositFilter] = useState<DepositFilter>("all");
  const [dateFrom, setDateFrom] = useState(DEFAULT_DATE_FROM);
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: promotionsData, isLoading: promotionsLoading } = useListPromotions({
    page,
    pageSize: 50,
    search: search || undefined,
    operator: operator || undefined,
    promoType: promoType || undefined,
    platform: (platform || undefined) as "Instagram" | "Telegram" | undefined,
    confidenceScore: (confidence || undefined) as "High" | "Medium" | "Low" | undefined,
    requiresDeposit:
      depositFilter === "no-deposit" ? false
      : depositFilter === "requires-deposit" ? true
      : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const { data: detailData, isLoading: detailLoading } = useGetPromotion(selectedId ?? "", {
    query: {
      enabled: !!selectedId,
      queryKey: getGetPromotionQueryKey(selectedId ?? ""),
    },
  });

  const resetFilters = () => {
    setSearch("");
    setOperator("");
    setPromoType("");
    setPlatform("");
    setConfidence("");
    setDepositFilter("all");
    setDateFrom(DEFAULT_DATE_FROM);
    setDateTo("");
    setPage(1);
  };

  const handleExport = () => {
    if (!promotionsData?.promotions) return;
    const headers = ["ID", "Operator", "Platform", "Type", "Offer Details", "Reward", "Min Deposit", "Requires Deposit", "Confidence", "Post Date", "Detected At"];
    const csvRows = promotionsData.promotions.map((p) => [
      p.id,
      p.operator,
      p.platform,
      p.promoType ?? "",
      p.offerDetails ?? "",
      p.rewardValue ?? "",
      p.minDeposit ?? "",
      p.requiresDeposit === null ? "" : p.requiresDeposit ? "Yes" : "No",
      p.confidenceScore,
      p.postDate ? format(new Date(p.postDate), "yyyy-MM-dd HH:mm") : "",
      format(new Date(p.detectedAt), "yyyy-MM-dd HH:mm"),
    ]);
    const csvContent = [headers, ...csvRows]
      .map((e) => e.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `promotions_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Promotions Dashboard</h1>
          <p className="text-muted-foreground">
            Competitor promotional intelligence across Instagram and Telegram.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : stats ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Total Promotions</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalPromotions.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">No Deposit</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.noDepositCount.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.highConfidenceCount.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Operators</CardTitle>
                <Building2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.operatorCount.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
                <ActivityIcon className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.last24hCount.toLocaleString()}</div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Promotions filter table */}
      <Card>
        <CardContent className="p-4 border-b border-border bg-muted/40">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search offer details, operator..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={operator || "all"} onValueChange={(v) => { setOperator(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Operators</SelectItem>
                  {operators?.map((op) => (
                    <SelectItem key={op.id} value={op.name}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={promoType || "all"} onValueChange={(v) => { setPromoType(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="sm:w-48">
                  <SelectValue placeholder="Promo type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Promo Types</SelectItem>
                  {promoTypes?.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={platform || "all"} onValueChange={(v) => { setPlatform(v === "all" ? "" : v as Platform); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Telegram">Telegram</SelectItem>
                </SelectContent>
              </Select>

              <Select value={confidence || "all"} onValueChange={(v) => { setConfidence(v === "all" ? "" : v as Confidence); setPage(1); }}>
                <SelectTrigger className="w-[155px]">
                  <SelectValue placeholder="Confidence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Confidence</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={depositFilter} onValueChange={(v) => { setDepositFilter(v as DepositFilter); setPage(1); }}>
                <SelectTrigger className="w-[185px]">
                  <SelectValue placeholder="Deposit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Deposit Types</SelectItem>
                  <SelectItem value="no-deposit">No Deposit Only</SelectItem>
                  <SelectItem value="requires-deposit">Requires Deposit</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="w-[145px] text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="w-[145px] text-sm"
                />
              </div>

              <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset all filters">
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
                <TableHead>Post Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotionsLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : promotionsData?.promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    No promotions match your current filters.
                    <div className="mt-4">
                      <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                promotionsData?.promotions.map((promo) => (
                  <TableRow
                    key={promo.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${promo.requiresDeposit === false ? "bg-orange-50/50 dark:bg-orange-950/20" : ""}`}
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
                    <TableCell className="max-w-[220px] truncate" title={promo.offerDetails ?? ""}>
                      {promo.offerDetails ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {promo.rewardValue ?? <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {promo.requiresDeposit === false ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 whitespace-nowrap">No Deposit</Badge>
                      ) : promo.requiresDeposit === true ? (
                        <span className="text-xs text-muted-foreground">Required</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{renderConfidenceBadge(promo.confidenceScore)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {promo.postDate ? format(new Date(promo.postDate), "MMM d, HH:mm") : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {promotionsData && promotionsData.total > 0 && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {(page - 1) * promotionsData.pageSize + 1}–{Math.min(page * promotionsData.pageSize, promotionsData.total)} of {promotionsData.total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * promotionsData.pageSize >= promotionsData.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Promotion detail drawer */}
      <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-[420px] sm:w-[560px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle>Promotion Details</SheetTitle>
              {detailData && (
                <a
                  href={detailData.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm font-medium"
                >
                  Source Post <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <SheetDescription>
              ID: <span className="font-mono text-xs">{selectedId}</span>
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
                {[
                  { label: "Operator", value: detailData.operator },
                  { label: "Platform", value: detailData.platform },
                  { label: "Type", value: detailData.promoType ?? "-" },
                  { label: "Confidence", value: renderConfidenceBadge(detailData.confidenceScore) },
                  { label: "Post Date", value: detailData.postDate ? format(new Date(detailData.postDate), "PPpp") : "-" },
                  { label: "Detected At", value: format(new Date(detailData.detectedAt), "PPpp") },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">{label}</div>
                    <div className="font-medium text-sm">{value}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Reward Value</div>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">{detailData.rewardValue ?? "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Min Deposit</div>
                  <div className="text-sm">{detailData.minDeposit ?? "-"}</div>
                </div>
                <div className="space-y-1 col-span-2">
                  <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Terms</div>
                  <div className="text-sm bg-muted p-3 rounded-md space-y-1">
                    {detailData.requiresDeposit === false && (
                      <Badge className="mb-2 bg-orange-100 text-orange-700 border-orange-200">No Deposit Required</Badge>
                    )}
                    <div><span className="font-medium">Wagering:</span> {detailData.wageringRequirement ?? "-"}</div>
                    <div><span className="font-medium">Expiry:</span> {detailData.expiryDate ?? "-"}</div>
                    <div><span className="font-medium">Audience:</span> {detailData.targetAudience ?? "-"}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Offer Details</div>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{detailData.offerDetails ?? "-"}</p>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Raw Post Text</div>
                <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {detailData.rawPostText ?? "-"}
                </div>
              </div>

              {detailData.promptVersion && (
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Parsed with prompt version:{" "}
                  <span className="font-mono">{detailData.promptVersion}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Failed to load promotion details.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
