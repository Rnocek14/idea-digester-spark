import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface OperationProgressProps {
  current: number;
  total: number;
  message?: string;
  className?: string;
}

export function OperationProgress({ current, total, message, className }: OperationProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {message || `Processing ${current} of ${total}...`}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="text-xs text-muted-foreground text-right">
        {percentage}% complete
      </div>
    </div>
  );
}
