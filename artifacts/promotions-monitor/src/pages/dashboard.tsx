import { SVGProps, useState } from "react";
import {
  useGetPromotionsStats,
  useListPromotions,
  useGetPromotion,
  getGetPromotionQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tag, TrendingUp, AlertTriangle, Building2 } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { format } from "date-fns";

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
  if (score === "High") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20">High</Badge>;
  if (score === "Medium") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 hover:bg-amber-500/20">Medium</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 border-red-200 hover:bg-red-500/20">Low</Badge>;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPromotionsStats();
  const { data: promotionsData, isLoading: promotionsLoading } = useListPromotions({ page: 1, pageSize: 50 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: detailData, isLoading: detailLoading } = useGetPromotion(selectedId ?? "", {
    query: {
      enabled: !!selectedId,
      queryKey: getGetPromotionQueryKey(selectedId ?? ""),
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of competitor promotional activity.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent><Skeleton className="h-8 w-16 mb-1" /></CardContent>
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

      {/* Summary breakdown */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Operators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.byOperator.slice(0, 5).map((op) => (
                  <div key={op.operator} className="flex items-center justify-between">
                    <div className="font-medium text-sm">{op.operator}</div>
                    <Badge variant="secondary">{op.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.byPlatform.map((plat) => (
                  <div key={plat.platform} className="flex items-center justify-between">
                    <div className="font-medium text-sm">{plat.platform}</div>
                    <Badge variant="outline">{plat.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full promotions table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Promotions</h2>
        <Card>
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
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : promotionsData?.promotions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      No promotions yet. The data ingestion pipeline will populate this table.
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
                      <TableCell className="max-w-[200px] truncate" title={promo.offerDetails ?? ""}>
                        {promo.offerDetails ?? <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{promo.rewardValue ?? <span className="text-muted-foreground">-</span>}</TableCell>
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
          {promotionsData && promotionsData.total > promotionsData.pageSize && (
            <div className="p-4 border-t border-border text-sm text-muted-foreground text-center">
              Showing first {promotionsData.pageSize} of {promotionsData.total} promotions.{" "}
              <a href="/promotions" className="text-primary hover:underline">View all with filters</a>
            </div>
          )}
        </Card>
      </div>

      {/* Detail drawer */}
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
                  <div className="font-medium text-emerald-600">{detailData.rewardValue ?? "-"}</div>
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
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Failed to load promotion details.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
