import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Gift, Building2, Calendar } from "lucide-react";
import { DealDialog } from "@/components/DealDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"ambassador_deals"> & {
  business_profiles?: { name: string } | null;
};

const AdminDeals = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const { data: deals, isLoading } = useQuery({
    queryKey: ["ambassador-deals-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ambassador_deals")
        .select("*, business_profiles(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });

  const handleToggleActive = async (deal: Deal) => {
    const { error } = await supabase
      .from("ambassador_deals")
      .update({ is_active: !deal.is_active })
      .eq("id", deal.id);

    if (error) {
      toast.error("Failed to update deal status");
    } else {
      toast.success(deal.is_active ? "Deal deactivated" : "Deal activated");
      queryClient.invalidateQueries({ queryKey: ["ambassador-deals-admin"] });
    }
  };

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal);
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingDeal(null);
    setDialogOpen(true);
  };

  const handleDialogSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["ambassador-deals-admin"] });
  };

  const activeCount = deals?.filter((d) => d.is_active).length ?? 0;
  const expiredCount = deals?.filter((d) => d.valid_until && new Date(d.valid_until) < new Date()).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage Ambassador Deals</h1>
          <p className="text-muted-foreground">
            Create and manage exclusive deals for Ambassador-tier subscribers (5+ referrals)
          </p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          Add Deal
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deals?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Deals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{expiredCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Deals</CardTitle>
          <CardDescription>
            Deals are shown to subscribers with 5+ referrals on the /deals page
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading deals...</div>
          ) : !deals?.length ? (
            <div className="text-center py-12">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No deals yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first Ambassador deal to reward loyal referrers
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Deal
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => {
                  const isExpired = deal.valid_until && new Date(deal.valid_until) < new Date();
                  return (
                    <TableRow key={deal.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{deal.title}</div>
                          {deal.description && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {deal.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {deal.business_profiles?.name ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{deal.business_profiles.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.discount_code ? (
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {deal.discount_code}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {deal.valid_until ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className={isExpired ? "text-destructive" : ""}>
                              {format(new Date(deal.valid_until), "MMM d, yyyy")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No expiry</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="secondary">Expired</Badge>
                        ) : deal.is_active ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={deal.is_active ?? false}
                            onCheckedChange={() => handleToggleActive(deal)}
                            disabled={isExpired}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(deal)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={editingDeal}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
};

export default AdminDeals;
