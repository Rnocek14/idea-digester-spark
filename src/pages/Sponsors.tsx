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
import { Plus, Edit, Power } from "lucide-react";
import { toast } from "sonner";
import { SponsorDialog } from "@/components/SponsorDialog";
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

const Sponsors = () => {
  const [selectedSponsorId, setSelectedSponsorId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sponsors, isLoading, refetch } = useQuery({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sponsors</h1>
          <p className="text-muted-foreground mt-2">
            Manage local business sponsors and advertising campaigns
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Sponsor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-muted-foreground">Loading sponsors...</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()}
            className="mt-2"
          >
            Taking too long? Click to retry
          </Button>
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
        <div className="text-center py-12 text-muted-foreground">
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

export default Sponsors;
