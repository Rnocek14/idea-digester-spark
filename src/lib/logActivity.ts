import { supabase } from "@/integrations/supabase/client";

type ActivityEntityType = "content" | "source" | "sponsor" | "system";

interface LogActivityOptions {
  entityType: ActivityEntityType;
  entityId?: string | null;
  action: string;
  message: string;
  details?: Record<string, any>;
}

export async function logActivity(opts: LogActivityOptions) {
  const {
    entityType,
    entityId = null,
    action,
    message,
    details = {},
  } = opts;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("activity_log").insert({
    user_id: user?.id ?? null,
    actor_type: user ? "user" : "system",
    entity_type: entityType,
    entity_id: entityId,
    action,
    message,
    details,
  });

  if (error) {
    console.error("Failed to log activity", error);
  }
}
