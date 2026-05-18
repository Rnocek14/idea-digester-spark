import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Building2, 
  Mail, 
  Loader2, 
  FileText, 
  LayoutDashboard, 
  ShoppingCart,
  CheckCircle,
  Clock,
  AlertCircle,
  Printer,
  ExternalLink,
  TrendingUp,
  Eye,
  MousePointer
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const AD_PACKAGES = [
  { id: "newsletter_1mo", name: "Newsletter Banner - 1 Month", price: 29900, priceDisplay: "$299", category: "Newsletter" },
  { id: "newsletter_3mo", name: "Newsletter Banner - 3 Months", price: 79900, priceDisplay: "$799", category: "Newsletter" },
  { id: "sidebar_1mo", name: "Website Sidebar Ad - 1 Month", price: 29900, priceDisplay: "$299", category: "Website" },
  { id: "sidebar_3mo", name: "Website Sidebar Ad - 3 Months", price: 69900, priceDisplay: "$699", category: "Website" },
  { id: "social_post", name: "Social Media Sponsored Post", price: 19900, priceDisplay: "$199", category: "Social" },
  { id: "premium_1mo", name: "Premium Bundle - 1 Month", price: 149900, priceDisplay: "$1,499", category: "Premium" },
  { id: "premium_3mo", name: "Premium Bundle - 3 Months", price: 399900, priceDisplay: "$3,999", category: "Premium" },
];

interface TokenData {
  email: string;
  business_id: string;
  business?: {
    id: string;
    name: string;
    email: string | null;
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  description: string | null;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

interface Placement {
  id: string;
  label: string | null;
  package_type: string | null;
  start_date: string;
  end_date: string;
  status: string | null;
  slot?: {
    name: string;
    channel: string;
  };
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paid
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case "overdue":
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Overdue
        </Badge>
      );
    case "active":
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    case "scheduled":
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>
      );
    case "ended":
      return (
        <Badge variant="outline">
          Ended
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function SponsorPortal() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = searchParams.get("token");
  
  const [email, setEmail] = useState("");
  const [isRequestingLink, setIsRequestingLink] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Validate token
  const { data: tokenData, isLoading: isValidating } = useQuery({
    queryKey: ["sponsor-token", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .rpc("validate_sponsor_token", { _token: token });

      if (error || !data || data.length === 0) return null;
      const row = data[0];

      if (!row.used_at) {
        await supabase.rpc("mark_sponsor_token_used", { _token: token });
      }

      return {
        email: row.email,
        business_id: row.business_id,
        expires_at: row.expires_at,
        used_at: row.used_at,
        business: { id: row.business_id, name: row.business_name, email: row.email },
      } as TokenData;
    },
    enabled: !!token,
  });

  const businessId = tokenData?.business_id;
  const businessName = (tokenData?.business as any)?.name;

  // Fetch invoices for this business
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["sponsor-portal-invoices", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsor_invoices")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!businessId,
  });

  // Fetch placements for this business
  const { data: placements, isLoading: placementsLoading } = useQuery({
    queryKey: ["sponsor-portal-placements", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_placements")
        .select(`
          *,
          slot:ad_slots(name, channel)
        `)
        .eq("business_id", businessId!)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as Placement[];
    },
    enabled: !!businessId,
  });

  // Fetch analytics for this business
  const { data: analytics } = useQuery({
    queryKey: ["sponsor-portal-analytics", businessId],
    queryFn: async () => {
      const { data: clicks, error: clicksError } = await supabase
        .from("newsletter_clicks")
        .select("id, clicked_at")
        .eq("business_id", businessId!);

      if (clicksError) throw clicksError;

      // Get impressions from newsletter opens where business had active placement
      const { count: impressions } = await supabase
        .from("newsletter_opens")
        .select("*", { count: "exact", head: true });

      return {
        totalClicks: clicks?.length || 0,
        impressions: impressions || 0,
        ctr: impressions ? ((clicks?.length || 0) / impressions * 100).toFixed(2) : "0.00"
      };
    },
    enabled: !!businessId,
  });

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsRequestingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sponsor-magic-link", {
        body: { email: email.trim() },
      });

      if (error) throw error;

      toast.success("Check your email for an access link!");
      setEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send access link");
    } finally {
      setIsRequestingLink(false);
    }
  };

  const handlePurchasePackage = async () => {
    if (!selectedPackage || !businessId) return;
    
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-sponsor-checkout", {
        body: {
          business_id: businessId,
          package_id: selectedPackage,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to checkout...");
        queryClient.invalidateQueries({ queryKey: ["sponsor-portal-invoices"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkout");
    } finally {
      setIsProcessing(false);
      setSelectedPackage("");
    }
  };

  const openPrintableInvoice = (invoice: Invoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to view the invoice");
      return;
    }

    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #1e40af; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { margin: 0; font-size: 28px; color: #1e40af; }
          .invoice-title p { margin: 4px 0 0; color: #6b7280; }
          .details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
          .details-section h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
          .details-section p { margin: 4px 0; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          .table th { text-align: left; padding: 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #6b7280; }
          .table td { padding: 16px 12px; border-bottom: 1px solid #e5e7eb; }
          .table .amount { text-align: right; }
          .total-section { display: flex; justify-content: flex-end; }
          .total-box { width: 250px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .total-row.final { font-size: 18px; font-weight: bold; border-top: 2px solid #1e40af; padding-top: 12px; margin-top: 8px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .status.paid { background: #dcfce7; color: #166534; }
          .status.pending { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Lake Geneva Locals</div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <p>${esc(invoice.invoice_number)}</p>
          </div>
        </div>
        
        <div class="details">
          <div class="details-section">
            <h3>Bill To</h3>
            <p><strong>${esc(businessName || "Sponsor")}</strong></p>
          </div>
          <div class="details-section">
            <h3>Invoice Details</h3>
            <p><strong>Date:</strong> ${format(new Date(invoice.created_at), "MMM d, yyyy")}</p>
            ${invoice.due_date ? `<p><strong>Due Date:</strong> ${format(new Date(invoice.due_date), "MMM d, yyyy")}</p>` : ""}
            <p><strong>Status:</strong> <span class="status ${esc(invoice.status)}">${esc(invoice.status.toUpperCase())}</span></p>
            ${invoice.paid_at ? `<p><strong>Paid:</strong> ${format(new Date(invoice.paid_at), "MMM d, yyyy")}</p>` : ""}
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Period</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${esc(invoice.description || "Advertising Services")}</td>
              <td>${invoice.period_start && invoice.period_end ? `${format(new Date(invoice.period_start), "MMM d")} - ${format(new Date(invoice.period_end), "MMM d, yyyy")}` : "—"}</td>
              <td class="amount">$${(invoice.amount_cents / 100).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <div class="total-row">
              <span>Subtotal</span>
              <span>$${(invoice.amount_cents / 100).toFixed(2)}</span>
            </div>
            <div class="total-row final">
              <span>Total</span>
              <span>$${(invoice.amount_cents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for advertising with Lake Geneva Locals!</p>
          <p>Questions? Contact us at ads@lakegeneva.com</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Loading state while validating token
  if (token && isValidating) {
    return (
      <PageShell>
        <div className="container max-w-4xl mx-auto py-16 px-4 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validating access...</p>
        </div>
      </PageShell>
    );
  }

  // Login form if no valid token
  if (!token || (token && !isValidating && !tokenData)) {
    return (
      <PageShell>
        <div className="container max-w-md mx-auto py-16 px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Sponsor Portal</CardTitle>
              <CardDescription>
                Enter your email to access your sponsor dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRequestLink} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Business Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@business.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isRequestingLink || !email.trim()}
                >
                  {isRequestingLink ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    "Send Access Link"
                  )}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-4">
                A secure link will be sent to your email if you have a sponsor account with us.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Calculate stats
  const activePlacements = placements?.filter(p => p.status === "active").length || 0;
  const totalSpent = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount_cents, 0) || 0;
  const pendingInvoices = invoices?.filter(i => i.status === "pending").length || 0;

  return (
    <PageShell>
      <div className="container max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, {businessName || "Sponsor"}</h1>
          <p className="text-muted-foreground mt-1">
            Manage your advertising placements and invoices
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <LayoutDashboard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Placements</p>
                <p className="text-2xl font-bold">{activePlacements}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">${(totalSpent / 100).toLocaleString()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Impressions</p>
                <p className="text-2xl font-bold">{analytics?.impressions.toLocaleString() || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <MousePointer className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clicks</p>
                <p className="text-2xl font-bold">{analytics?.totalClicks || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="placements" className="space-y-6">
          <TabsList>
            <TabsTrigger value="placements">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Placements
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <FileText className="h-4 w-4 mr-2" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="purchase">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Purchase
            </TabsTrigger>
          </TabsList>

          {/* Placements Tab */}
          <TabsContent value="placements">
            <Card>
              <CardHeader>
                <CardTitle>Your Ad Placements</CardTitle>
                <CardDescription>View all your active and past advertising placements</CardDescription>
              </CardHeader>
              <CardContent>
                {placementsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : placements && placements.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Placement</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {placements.map((placement) => (
                        <TableRow key={placement.id}>
                          <TableCell className="font-medium">
                            {placement.label || placement.slot?.name || "Ad Placement"}
                          </TableCell>
                          <TableCell className="capitalize">
                            {placement.slot?.channel || "—"}
                          </TableCell>
                          <TableCell>
                            {placement.package_type 
                              ? AD_PACKAGES.find(p => p.id === placement.package_type)?.name || placement.package_type
                              : "—"
                            }
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(placement.start_date), "MMM d")} - {format(new Date(placement.end_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(placement.status || "active")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <LayoutDashboard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No placements yet. Purchase an ad package to get started!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Your Invoices</CardTitle>
                <CardDescription>View and download all your invoices</CardDescription>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : invoices && invoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {invoice.description || "Advertising Services"}
                          </TableCell>
                          <TableCell className="font-medium">
                            ${(invoice.amount_cents / 100).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(invoice.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPrintableInvoice(invoice)}
                                title="View/Print Invoice"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {invoice.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    setIsProcessing(true);
                                    try {
                                      const { data, error } = await supabase.functions.invoke("create-sponsor-checkout", {
                                        body: {
                                          business_id: businessId,
                                          package_id: "newsletter_1mo",
                                        },
                                      });
                                      if (error) throw error;
                                      if (data.url) window.open(data.url, "_blank");
                                    } catch (err: any) {
                                      toast.error(err.message);
                                    } finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  disabled={isProcessing}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No invoices yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Tab */}
          <TabsContent value="purchase">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Ad Packages</CardTitle>
                <CardDescription>Choose an advertising package to promote your business</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {AD_PACKAGES.map((pkg) => (
                    <Card 
                      key={pkg.id}
                      className={`cursor-pointer transition-all hover:border-primary ${
                        selectedPackage === pkg.id ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
                      onClick={() => setSelectedPackage(pkg.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <Badge variant="outline" className="text-xs">
                            {pkg.category}
                          </Badge>
                          {selectedPackage === pkg.id && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-primary">{pkg.priceDisplay}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button 
                    size="lg"
                    onClick={handlePurchasePackage}
                    disabled={!selectedPackage || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Purchase Selected Package
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
