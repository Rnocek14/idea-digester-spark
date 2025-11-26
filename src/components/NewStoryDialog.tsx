import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type NewStoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewStoryDialog({ open, onOpenChange }: NewStoryDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const createStoryMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("content_queue").insert({
        title,
        category,
        content,
        summary: summary || null,
        image_url: imageUrl || null,
        status: "approved", // Manual stories start as approved
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
      toast.success("Story created successfully");
      onOpenChange(false);
      // Reset form
      setTitle("");
      setCategory("");
      setContent("");
      setSummary("");
      setImageUrl("");
    },
    onError: () => {
      toast.error("Failed to create story");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    createStoryMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Story</DialogTitle>
          <DialogDescription>
            Manually add a new story to the content queue
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="new-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter story title"
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="new-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="dining">Dining</SelectItem>
                <SelectItem value="real-estate">Real Estate</SelectItem>
                <SelectItem value="community">Community</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="new-summary">Summary</Label>
            <Textarea
              id="new-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of the story"
              rows={2}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="new-content">
              Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="new-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Full story content"
              rows={8}
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="new-image">Image URL</Label>
            <Input
              id="new-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              type="url"
              className="mt-1.5"
            />
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
              disabled={createStoryMutation.isPending}
            >
              {createStoryMutation.isPending ? "Creating..." : "Create Story"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
