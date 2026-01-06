import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Power, AlertCircle, RefreshCw, Megaphone, LayoutGrid, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { SponsorDialog } from "@/components/SponsorDialog";
import { PlacementManagement } from "@/components/PlacementManagement";
import { SponsorBilling } from "@/components/SponsorBilling";
import { format } from "date-fns";

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "inactive":
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    case "pending":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getTierColor = (tier: string) => {
  switch (tier) {
    case "featured":
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case "premium":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "basic":
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const SponsorsTable = () => {
  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sponsors, isLoading, error, refetch } = useQuery({
    queryKey: ["sponsors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("sponsors")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["sponsors"] });
      toast.success(`Sponsor ${newStatus === "active" ? "activated" : "deactivated"}`);
    },
    onError: () => toast.error("Failed to update sponsor status"),
  });

  const handleEdit = (sponsorId: string) => {
    setSelectedSponsorId(sponsorId);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedSponsorId(null);
    setIsDialogOpen(true);
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h3 className="text-lg font-semibold">Failed to load sponsors</h3>
          <p className="text-muted-foreground max-w-md">
            {error.message || "An error occurred while loading sponsors"}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sponsor Accounts</h2>
          <p className="text-sm text-muted-foreground">
            {sponsors?.length || 0} sponsors registered
          </p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Sponsor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-muted-foreground">Loading sponsors...</span>
        </div>
      ) : sponsors && sponsors.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sponsors.map((sponsor) => (
                <TableRow key={sponsor.id}>
                  <TableCell className="font-medium">{sponsor.business_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getTierColor(sponsor.tier)}>
                      {sponsor.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(sponsor.status)}>
                      {sponsor.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {sponsor.start_date
                      ? format(new Date(sponsor.start_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {sponsor.end_date
                      ? format(new Date(sponsor.end_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(sponsor.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: sponsor.id,
                            currentStatus: sponsor.status,
                          })
                        }
                        disabled={toggleStatusMutation.isPending}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No sponsors yet. Add your first sponsor to get started.
        </div>
      )}

      <SponsorDialog
        sponsorId={selectedSponsorId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
};

const Sponsors = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sponsors</h1>
        <p className="text-muted-foreground mt-2">
          Manage sponsors and their ad placements across the platform
        </p>
      </div>

      <Tabs defaultValue="billing" className="w-full">
        <TabsList>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="placements" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Ad Placements
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Sponsor Accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="billing" className="mt-6">
          <SponsorBilling />
        </TabsContent>
        <TabsContent value="placements" className="mt-6">
          <PlacementManagement />
        </TabsContent>
        <TabsContent value="sponsors" className="mt-6">
          <SponsorsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Sponsors;
