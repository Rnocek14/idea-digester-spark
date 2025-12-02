import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/queryWithTimeout";
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
import { Plus, Edit, Power, AlertCircle, RefreshCw, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { BusinessDialog } from "@/components/BusinessDialog";
import { PlacementDialog } from "@/components/PlacementDialog";

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

const Directory = () => {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [isBusinessDialogOpen, setIsBusinessDialogOpen] = useState(false);
  const [isPlacementDialogOpen, setIsPlacementDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: businesses, isLoading, error, refetch } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const result = await withTimeout(
        supabase
          .from("business_profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .then(res => res),
        15000
      );

      if (result.error) throw result.error;
      return result.data;
    },
    retry: 2,
    staleTime: 30000,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("business_profiles")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success(`Business ${newStatus === "active" ? "activated" : "deactivated"}`);
    },
    onError: () => toast.error("Failed to update business status"),
  });

  const handleEdit = (businessId: string) => {
    setSelectedBusinessId(businessId);
    setIsBusinessDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedBusinessId(null);
    setIsBusinessDialogOpen(true);
  };

  const handleManagePlacements = (businessId: string) => {
    setSelectedBusinessId(businessId);
    setIsPlacementDialogOpen(true);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Business Directory</h1>
            <p className="text-muted-foreground mt-2">
              Manage local businesses and advertising placements
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 py-12 text-center border rounded-lg bg-card">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h3 className="text-lg font-semibold">Failed to load businesses</h3>
          <p className="text-muted-foreground max-w-md">
            {error.message || "An error occurred while loading businesses"}
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Directory</h1>
          <p className="text-muted-foreground mt-2">
            Manage local businesses and advertising placements
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Business
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-muted-foreground">Loading businesses...</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            className="mt-2"
          >
            Taking too long? Click to retry
          </Button>
        </div>
      ) : businesses && businesses.length > 0 ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((business) => (
                <TableRow key={business.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {business.logo_url && (
                        <img 
                          src={business.logo_url} 
                          alt={business.name}
                          className="w-8 h-8 rounded object-cover"
                        />
                      )}
                      {business.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {business.category && (
                      <Badge variant="outline" className="capitalize">
                        {business.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {business.email && <div>{business.email}</div>}
                      {business.phone && <div className="text-muted-foreground">{business.phone}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(business.status)}>
                      {business.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleManagePlacements(business.id)}
                        title="Manage Ad Placements"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(business.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          toggleStatusMutation.mutate({
                            id: business.id,
                            currentStatus: business.status,
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
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-card">
          No businesses yet. Add your first business to get started.
        </div>
      )}

      <BusinessDialog
        businessId={selectedBusinessId}
        open={isBusinessDialogOpen}
        onOpenChange={setIsBusinessDialogOpen}
      />

      <PlacementDialog
        businessId={selectedBusinessId}
        open={isPlacementDialogOpen}
        onOpenChange={setIsPlacementDialogOpen}
      />
    </div>
  );
};

export default Directory;
