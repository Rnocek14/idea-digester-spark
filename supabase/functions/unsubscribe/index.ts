import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(renderPage("Missing Token", "No unsubscribe token provided."), {
      status: 400,
      headers: { "Content-Type": "text/html" }
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find subscriber by token
  const { data: subscriber, error: findError } = await supabase
    .from("subscribers")
    .select("id, email, status")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (findError || !subscriber) {
    return new Response(renderPage("Invalid Link", "This unsubscribe link is invalid or expired."), {
      status: 404,
      headers: { "Content-Type": "text/html" }
    });
  }

  if (subscriber.status === "unsubscribed") {
    return new Response(renderPage("Already Unsubscribed", "You have already been unsubscribed."), {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
  }

  // Update status
  const { error: updateError } = await supabase
    .from("subscribers")
    .update({ 
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
      unsubscribe_reason: "user_requested"
    })
    .eq("id", subscriber.id);

  if (updateError) {
    console.error("Unsubscribe error:", updateError);
    return new Response(renderPage("Error", "Something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" }
    });
  }

  console.log(`✅ Unsubscribed: ${subscriber.email}`);

  return new Response(
    renderPage("Unsubscribed", "You have been successfully unsubscribed from Lake Geneva Local. We're sorry to see you go!"),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
});

function renderPage(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Lake Geneva Local</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .card {
      background: white;
      padding: 48px;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 400px;
    }
    h1 {
      color: #2d3748;
      margin: 0 0 16px 0;
      font-size: 24px;
    }
    p {
      color: #4a5568;
      line-height: 1.6;
      margin: 0;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>
  `.trim();
}
