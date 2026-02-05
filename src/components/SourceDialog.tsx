import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { logActivity } from "@/lib/logActivity";

type SourceDialogProps = {
  sourceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SourceDialog({ sourceId, open, onOpenChange }: SourceDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [fetchFrequency, setFetchFrequency] = useState("60");
  const [defaultGeoTier, setDefaultGeoTier] = useState("1");

  const isEditing = !!sourceId;

  const { data: source } = useQuery({
    queryKey: ["source-detail", sourceId],
    queryFn: async () => {
      if (!sourceId) return null;
      const { data, error } = await supabase
        .from("sources")
        .select("*")
        .eq("id", sourceId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!sourceId,
  });

  useEffect(() => {
    if (source) {
      setName(source.name);
      setType(source.type);
      setUrl(source.url);
      setCategory(source.category || "");
      setFetchFrequency(source.fetch_frequency_minutes?.toString() || "60");
      setDefaultGeoTier(source.default_geo_tier?.toString() || "1");
    } else if (!sourceId) {
      // Reset form for new source
      setName("");
      setType("");
      setUrl("");
      setCategory("");
      setFetchFrequency("60");
      setDefaultGeoTier("1");
    }
  }, [source, sourceId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate and clamp geo tier to [0,1,2]
      const parsedGeoTier = parseInt(defaultGeoTier);
      const validGeoTier = Number.isNaN(parsedGeoTier) 
        ? 1 
        : Math.max(0, Math.min(2, parsedGeoTier));

      const sourceData = {
        name,
        type,
        url,
        category: category || null,
        fetch_frequency_minutes: Math.max(5, Math.min(1440, parseInt(fetchFrequency) || 60)),
        default_geo_tier: validGeoTier,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("sources")
          .update(sourceData)
          .eq("id", sourceId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("sources").insert(sourceData);

        if (error) throw error;
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.success(isEditing ? "Source updated" : "Source added");

      // Log activity
      await logActivity({
        entityType: "source",
        entityId: sourceId,
        action: isEditing ? "updated" : "created",
        message: `${isEditing ? "Updated" : "Created"} source "${name}"`,
        details: {
          type,
          url,
          category,
        },
      });

      onOpenChange(false);
    },
    onError: () => {
      toast.error(`Failed to ${isEditing ? "update" : "add"} source`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type || !url.trim()) {
      toast.error("Name, type, and URL are required");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Source" : "Add New Source"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the source configuration"
              : "Configure a new content source for ingestion"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="source-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Local News RSS"
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="source-type">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select source type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rss">RSS Feed</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="scrape">Web Scraper</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="source-url">
              URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="source-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              type="url"
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="source-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select category (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="nightlife">Nightlife</SelectItem>
                <SelectItem value="civic">Civic</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="schools">Schools</SelectItem>
                <SelectItem value="community">Community</SelectItem>
                <SelectItem value="real_estate">Real Estate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="geo-tier">Default Geo Tier</Label>
            <Select value={defaultGeoTier} onValueChange={setDefaultGeoTier}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select geo tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tier 1 — Lake Geneva (hyperlocal)</SelectItem>
                <SelectItem value="2">Tier 2 — Walworth County</SelectItem>
                <SelectItem value="0">Tier 0 — Regional / Wisconsin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1.5">
              Stories inherit this tier unless geo-detection overrides it
            </p>
          </div>

          <div>
            <Label htmlFor="fetch-frequency">Fetch Frequency (minutes)</Label>
            <Input
              id="fetch-frequency"
              value={fetchFrequency}
              onChange={(e) => setFetchFrequency(e.target.value)}
              type="number"
              min="5"
              max="1440"
              placeholder="60"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              How often the automation should check this source (5-1440 minutes)
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? isEditing
                  ? "Updating..."
                  : "Adding..."
                : isEditing
                ? "Update Source"
                : "Add Source"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
