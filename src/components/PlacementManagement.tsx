import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Power, AlertTriangle, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addMonths } from "date-fns";

interface Placement {
  id: string;
  slot_id: string;
  business_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  label: string | null;
  business?: {
    name: string;
    logo_url: string | null;
  };
}

interface AdSlot {
  id: string;
  name: string;
  channel: string;
}

interface BusinessProfile {
  id: string;
  name: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "paused":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "expired":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getExpiryBadge = (endDate: string) => {
  const daysUntilExpiry = differenceInDays(new Date(endDate), new Date());
  
  if (daysUntilExpiry < 0) {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  } else if (daysUntilExpiry <= 7) {
    return (
      <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {daysUntilExpiry === 0 ? "Expires today" : `${daysUntilExpiry}d left`}
      </Badge>
    );
  } else if (daysUntilExpiry <= 30) {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">
        {daysUntilExpiry}d left
      </Badge>
    );
  }
  return null;
};

export const PlacementManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null);
  const [formData, setFormData] = useState({
    slot_id: "",
    business_id: "",
    start_date: "",
    end_date: "",
    status: "active",
    label: "",
  });
  const queryClient = useQueryClient();

  // Fetch placements with business info
  const { data: placements, isLoading, refetch } = useQuery({
    queryKey: ["ad-placements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_placements")
        .select(`
          *,
          business:business_profiles(name, logo_url)
        `)
        .order("end_date", { ascending: true });

      if (error) throw error;
      return data as Placement[];
    },
  });

  // Fetch ad slots for dropdown
  const { data: adSlots } = useQuery({
    queryKey: ["ad-slots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_slots")
        .select("id, name, channel")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as AdSlot[];
    },
  });

  // Fetch business profiles for dropdown
  const { data: businesses } = useQuery({
    queryKey: ["business-profiles-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_profiles")
        .select("id, name")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data as BusinessProfile[];
    },
  });

  // Create/update placement
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        slot_id: data.slot_id,
        business_id: data.business_id,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
        label: data.label || null,
      };

      if (editingPlacement) {
        const { error } = await supabase
          .from("ad_placements")
          .update(payload)
          .eq("id", editingPlacement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ad_placements")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-placements"] });
      toast.success(editingPlacement ? "Placement updated" : "Placement created");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Quick extend mutation
  const extendMutation = useMutation({
    mutationFn: async ({ id, months }: { id: string; months: number }) => {
      const placement = placements?.find(p => p.id === id);
      if (!placement) throw new Error("Placement not found");
      
      const currentEnd = new Date(placement.end_date);
      const newEnd = addMonths(currentEnd < new Date() ? new Date() : currentEnd, months);
      
      const { error } = await supabase
        .from("ad_placements")
        .update({ 
          end_date: format(newEnd, "yyyy-MM-dd"),
          status: "active" 
        })
        .eq("id", id);
      if (error) throw error;
      return newEnd;
    },
    onSuccess: (newEnd) => {
      queryClient.invalidateQueries({ queryKey: ["ad-placements"] });
      toast.success(`Extended until ${format(newEnd, "MMM d, yyyy")}`);
    },
    onError: () => toast.error("Failed to extend placement"),
  });

  // Toggle status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("ad_placements")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["ad-placements"] });
      toast.success(`Placement ${newStatus}`);
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleOpenDialog = (placement?: Placement) => {
    if (placement) {
      setEditingPlacement(placement);
      setFormData({
        slot_id: placement.slot_id || "",
        business_id: placement.business_id,
        start_date: placement.start_date,
        end_date: placement.end_date,
        status: placement.status,
        label: placement.label || "",
      });
    } else {
      setEditingPlacement(null);
      const today = format(new Date(), "yyyy-MM-dd");
      const threeMonthsLater = format(addMonths(new Date(), 3), "yyyy-MM-dd");
      setFormData({
        slot_id: "",
        business_id: "",
        start_date: today,
        end_date: threeMonthsLater,
        status: "active",
        label: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlacement(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.slot_id || !formData.business_id || !formData.start_date || !formData.end_date) {
      toast.error("Please fill in all required fields");
      return;
    }
    saveMutation.mutate(formData);
  };

  // Separate active, expiring soon, and expired
  const now = new Date();
  const expiringPlacements = placements?.filter(p => {
    const daysLeft = differenceInDays(new Date(p.end_date), now);
    return daysLeft >= 0 && daysLeft <= 14;
  }) || [];

  const expiredPlacements = placements?.filter(p => 
    differenceInDays(new Date(p.end_date), now) < 0
  ) || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-muted-foreground">Loading placements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Expiring Soon Alert */}
      {expiringPlacements.length > 0 && (
        <Card className="p-4 border-orange-200 bg-orange-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-orange-800">Placements Expiring Soon</h3>
              <p className="text-sm text-orange-700 mt-1">
                {expiringPlacements.length} placement{expiringPlacements.length > 1 ? "s" : ""} will expire in the next 14 days
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {expiringPlacements.map(p => (
                  <Badge key={p.id} variant="outline" className="bg-white">
                    {p.business?.name || "Unknown"} ({differenceInDays(new Date(p.end_date), now)}d)
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ad Placements</h2>
          <p className="text-sm text-muted-foreground">
            {placements?.length || 0} total • {expiredPlacements.length} expired
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            New Placement
          </Button>
        </div>
      </div>

      {/* Placements Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placements?.map((placement) => (
              <TableRow key={placement.id} className={differenceInDays(new Date(placement.end_date), now) < 0 ? "opacity-50" : ""}>
                <TableCell className="font-medium">
                  {placement.business?.name || "Unknown"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {adSlots?.find(s => s.id === placement.slot_id)?.name || placement.slot_id}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getStatusColor(placement.status)}>
                    {placement.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(placement.start_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(placement.end_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {getExpiryBadge(placement.end_date)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => extendMutation.mutate({ id: placement.id, months: 1 })}
                      disabled={extendMutation.isPending}
                      title="Extend 1 month"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      +1mo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => extendMutation.mutate({ id: placement.id, months: 3 })}
                      disabled={extendMutation.isPending}
                      title="Extend 3 months"
                    >
                      +3mo
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(placement)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleStatusMutation.mutate({ 
                        id: placement.id, 
                        currentStatus: placement.status 
                      })}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!placements || placements.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No placements yet. Create your first ad placement.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPlacement ? "Edit Placement" : "New Ad Placement"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business">Business *</Label>
              <Select
                value={formData.business_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, business_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot">Ad Slot *</Label>
              <Select
                value={formData.slot_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, slot_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an ad slot" />
                </SelectTrigger>
                <SelectContent>
                  {adSlots?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.channel})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Q1 2026 Campaign"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingPlacement ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlacementManagement;
