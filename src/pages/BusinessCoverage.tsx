import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  RefreshCw,
  MapPin,
  Phone,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Play,
  Eye,
  GitMerge,
  TrendingUp,
  Store,
  Utensils,
  Bed,
  ShoppingBag,
  Wrench,
  Heart,
  Anchor,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AuditData {
  total_active: number;
  total_hidden: number;
  total_closed: number;
  by_geo_tier: Record<string, number>;
  by_business_type: Record<string, number>;
  missing_website: number;
  missing_phone: number;
  missing_address: number;
  missing_city: number;
  missing_place_id: number;
  by_source_confidence: Record<string, number>;
  by_import_source: Record<string, number>;
  restaurants_total: number;
  restaurants_linked: number;
  potential_duplicates: Array<{
    normalized_name: string;
    count: number;
    names: string[];
  }>;
  website_coverage_pct: number;
  phone_coverage_pct: number;
}

interface ReviewItem {
  id: string;
  name: string;
  business_type: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  google_place_id: string | null;
  import_source: string | null;
  issues: string[];
}

const BUSINESS_TYPE_ICONS: Record<string, React.ElementType> = {
  restaurant: Utensils,
  lodging: Bed,
  retail: ShoppingBag,
  service: Wrench,
  health: Heart,
  marina: Anchor,
  entertainment: Music,
};

const BusinessCoverage = () => {
  const [activeTab, setActiveTab] = useState("stats");
  const [importDryRun, setImportDryRun] = useState(true);
  const [mergeDryRun, setMergeDryRun] = useState(true);

  // Fetch audit data
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["business-coverage-audit"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("audit-business-coverage");
      if (error) throw error;
      return data as AuditData;
    },
    staleTime: 60000,
  });

  // Fetch review queue (businesses with issues)
  const { data: reviewQueue = [], isLoading: reviewLoading, refetch: refetchReview } = useQuery({
    queryKey: ["business-review-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_profiles")
        .select("id, name, business_type, city, website, phone, address, google_place_id, import_source")
        .eq("is_hidden", false)
        .or("website.is.null,phone.is.null,address.is.null,city.is.null")
        .order("name");

      if (error) throw error;

      // Add issue flags
      return (data || []).map((item) => ({
        ...item,
        issues: [
          !item.website && "No website",
          !item.phone && "No phone",
          !item.address && "No address",
          !item.city && "No city",
          !item.google_place_id && "No Place ID",
        ].filter(Boolean) as string[],
      })) as ReviewItem[];
    },
    staleTime: 30000,
  });

  // Fetch merge history
  const { data: mergeHistory = [], isLoading: mergeLoading } = useQuery({
    queryKey: ["business-merge-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_profiles")
        .select("id, name, merged_into_id, updated_at")
        .not("merged_into_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    staleTime: 60000,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke("import-google-places-businesses", {
        body: {
          centers: [
            { lat: 42.5917, lng: -88.4334, radius: 3, label: "Downtown Lake Geneva" },
            { lat: 42.5750, lng: -88.5417, label: "Williams Bay" },
            { lat: 42.5486, lng: -88.5750, label: "Fontana" },
            { lat: 42.6000, lng: -88.4000, label: "Geneva National" },
          ],
          dry_run: dryRun,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.success(`Dry run: Would insert ${data.would_insert}, update ${data.would_update}`);
      } else {
        toast.success(`Import complete: ${data.inserted} inserted, ${data.updated} updated`);
        refetchAudit();
        refetchReview();
      }
    },
    onError: (error: Error) => toast.error(`Import failed: ${error.message}`),
  });

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const names = auditData?.potential_duplicates?.map((d) => d.normalized_name) || [];
      if (names.length === 0) {
        throw new Error("No duplicates to merge");
      }
      const { data, error } = await supabase.functions.invoke("merge-business-profile-duplicates", {
        body: { normalized_names: names, dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.success(`Dry run: Would merge ${data.merges?.length || 0} duplicate groups`);
      } else {
        toast.success(`Merged ${data.merges?.length || 0} duplicate groups`);
        refetchAudit();
        refetchReview();
      }
    },
    onError: (error: Error) => toast.error(`Merge failed: ${error.message}`),
  });

  const totalBusinesses = (auditData?.total_active || 0) + (auditData?.total_hidden || 0) + (auditData?.total_closed || 0);
  const duplicateCount = auditData?.potential_duplicates?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Coverage</h1>
          <p className="text-muted-foreground mt-2">
            Monitor data quality, run imports, and manage duplicates
          </p>
        </div>
        <Button onClick={() => refetchAudit()} variant="outline" disabled={auditLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${auditLoading ? "animate-spin" : ""}`} />
          Refresh Audit
        </Button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Businesses</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditData?.total_active || 0}</div>
            <p className="text-xs text-muted-foreground">
              {auditData?.total_hidden || 0} hidden, {auditData?.total_closed || 0} closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Completeness</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Website</span>
                <span>{auditData?.website_coverage_pct?.toFixed(0) || 0}%</span>
              </div>
              <Progress value={auditData?.website_coverage_pct || 0} className="h-1" />
              <div className="flex items-center justify-between text-xs">
                <span>Phone</span>
                <span>{auditData?.phone_coverage_pct?.toFixed(0) || 0}%</span>
              </div>
              <Progress value={auditData?.phone_coverage_pct || 0} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Restaurant Linkage</CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {auditData?.restaurants_linked || 0}/{auditData?.restaurants_total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {auditData?.restaurants_total && auditData?.restaurants_linked
                ? ((auditData.restaurants_linked / auditData.restaurants_total) * 100).toFixed(0)
                : 0}% linked to profiles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duplicate Suspects</CardTitle>
            {duplicateCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duplicateCount}</div>
            <p className="text-xs text-muted-foreground">
              {duplicateCount === 0 ? "All clean!" : "Needs attention"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stats">
            <TrendingUp className="h-4 w-4 mr-2" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="review">
            <Eye className="h-4 w-4 mr-2" />
            Review Queue ({reviewQueue.length})
          </TabsTrigger>
          <TabsTrigger value="operations">
            <Play className="h-4 w-4 mr-2" />
            Operations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* By Business Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Business Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditData?.by_business_type &&
                    Object.entries(auditData.by_business_type)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => {
                        const Icon = BUSINESS_TYPE_ICONS[type] || Store;
                        const pct = totalBusinesses > 0 ? (count / totalBusinesses) * 100 : 0;
                        return (
                          <div key={type} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 capitalize">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {type || "Unknown"}
                              </span>
                              <span className="font-medium">{count}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                </div>
              </CardContent>
            </Card>

            {/* By Geo Tier */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Geographic Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditData?.by_geo_tier &&
                    Object.entries(auditData.by_geo_tier)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([tier, count]) => {
                        const pct = totalBusinesses > 0 ? (count / totalBusinesses) * 100 : 0;
                        const tierLabel =
                          tier === "1" ? "Core (T1)" : tier === "2" ? "Adjacent (T2)" : `Tier ${tier}`;
                        return (
                          <div key={tier} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {tierLabel}
                              </span>
                              <span className="font-medium">{count}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                </div>
              </CardContent>
            </Card>

            {/* Missing Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Missing Data</CardTitle>
                <CardDescription>Fields that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Missing Website
                    </span>
                    <Badge variant={auditData?.missing_website ? "destructive" : "secondary"}>
                      {auditData?.missing_website || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Missing Phone
                    </span>
                    <Badge variant={auditData?.missing_phone ? "destructive" : "secondary"}>
                      {auditData?.missing_phone || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Missing Address
                    </span>
                    <Badge variant={auditData?.missing_address ? "destructive" : "secondary"}>
                      {auditData?.missing_address || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Missing City
                    </span>
                    <Badge variant={auditData?.missing_city ? "destructive" : "secondary"}>
                      {auditData?.missing_city || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Missing Place ID
                    </span>
                    <Badge variant={auditData?.missing_place_id ? "secondary" : "secondary"}>
                      {auditData?.missing_place_id || 0}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By Import Source */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Import Source</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditData?.by_import_source &&
                    Object.entries(auditData.by_import_source)
                      .sort(([, a], [, b]) => b - a)
                      .map(([source, count]) => (
                        <div key={source} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{source || "Manual"}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Potential Duplicates */}
          {duplicateCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Potential Duplicates
                </CardTitle>
                <CardDescription>
                  These names appear multiple times and may need merging
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditData?.potential_duplicates?.map((dup) => (
                    <div
                      key={dup.normalized_name}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div>
                        <span className="font-medium">{dup.names[0]}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({dup.count} records)
                        </span>
                      </div>
                      <Badge variant="outline">{dup.normalized_name}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Merge History */}
          {mergeHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitMerge className="h-5 w-5" />
                  Recent Merges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mergeHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                    >
                      <span className="text-muted-foreground line-through">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.updated_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>
                Businesses missing critical data fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reviewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : reviewQueue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  All businesses have complete data!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueue.slice(0, 50).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.business_type || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.city || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">
                          {item.import_source || "Manual"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {item.issues.map((issue) => (
                              <Badge key={issue} variant="destructive" className="text-xs">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Import Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Google Places Import</CardTitle>
                <CardDescription>
                  Pull businesses from Google Places API for the Lake Geneva area
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="import-dry-run"
                    checked={importDryRun}
                    onChange={(e) => setImportDryRun(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="import-dry-run" className="text-sm">
                    Dry run (preview only)
                  </label>
                </div>
                <Button
                  onClick={() => importMutation.mutate(importDryRun)}
                  disabled={importMutation.isPending}
                  className="w-full"
                >
                  {importMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {importDryRun ? "Preview Import" : "Run Import"}
                </Button>
              </CardContent>
            </Card>

            {/* Merge Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Merge Duplicates</CardTitle>
                <CardDescription>
                  Automatically merge detected duplicate business profiles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="merge-dry-run"
                    checked={mergeDryRun}
                    onChange={(e) => setMergeDryRun(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="merge-dry-run" className="text-sm">
                    Dry run (preview only)
                  </label>
                </div>
                <Button
                  onClick={() => mergeMutation.mutate(mergeDryRun)}
                  disabled={mergeMutation.isPending || duplicateCount === 0}
                  variant={duplicateCount > 0 ? "default" : "secondary"}
                  className="w-full"
                >
                  {mergeMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <GitMerge className="h-4 w-4 mr-2" />
                  )}
                  {duplicateCount === 0
                    ? "No Duplicates"
                    : mergeDryRun
                    ? `Preview Merge (${duplicateCount})`
                    : `Merge ${duplicateCount} Groups`}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Import centers info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import Coverage Areas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2">
                {[
                  { label: "Downtown Lake Geneva", coords: "42.5917, -88.4334" },
                  { label: "Williams Bay", coords: "42.5750, -88.5417" },
                  { label: "Fontana", coords: "42.5486, -88.5750" },
                  { label: "Geneva National", coords: "42.6000, -88.4000" },
                ].map((center) => (
                  <div
                    key={center.label}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{center.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {center.coords}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessCoverage;
