import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  FileText, 
  Plus, 
  ExternalLink, 
  CheckCircle,
  Clock,
  AlertCircle,
  Printer
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  business_id: string;
  placement_id: string | null;
  business?: {
    name: string;
  };
}

interface BusinessProfile {
  id: string;
  name: string;
}

const AD_PACKAGES = [
  { id: "newsletter_1mo", name: "Newsletter Banner - 1 Month", price: "$299" },
  { id: "newsletter_3mo", name: "Newsletter Banner - 3 Months", price: "$799" },
];

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
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
};

export const SponsorBilling = () => {
  const [searchParams] = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  // Check for payment success/cancel from URL params
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const invoiceId = searchParams.get("invoice_id");

    if (paymentStatus === "success" && invoiceId) {
      // Verify and update payment status
      verifyPayment(invoiceId);
    } else if (paymentStatus === "cancelled") {
      toast.info("Payment was cancelled");
    }
  }, [searchParams]);

  const verifyPayment = async (invoiceId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-sponsor-payment", {
        body: { invoice_id: invoiceId },
      });

      if (error) throw error;

      if (data.status === "paid") {
        toast.success("Payment confirmed! Invoice marked as paid.");
        queryClient.invalidateQueries({ queryKey: ["sponsor-invoices"] });
      }
    } catch (err) {
      console.error("Payment verification error:", err);
    }
  };

  // Fetch invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["sponsor-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsor_invoices")
        .select(`
          *,
          business:business_profiles(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
  });

  // Fetch businesses for dropdown
  const { data: businesses } = useQuery({
    queryKey: ["business-profiles-billing"],
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

  // Create checkout session
  const createCheckoutMutation = useMutation({
    mutationFn: async ({ businessId, packageId }: { businessId: string; packageId: string }) => {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke("create-sponsor-checkout", {
        body: {
          business_id: businessId,
          package_id: packageId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      setIsCreateDialogOpen(false);
      
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success(`Invoice ${data.invoice_number} created. Redirecting to payment...`);
        queryClient.invalidateQueries({ queryKey: ["sponsor-invoices"] });
      }
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error(`Failed to create checkout: ${error.message}`);
    },
  });

  const handleCreateInvoice = () => {
    if (!selectedBusiness || !selectedPackage) {
      toast.error("Please select a business and package");
      return;
    }
    createCheckoutMutation.mutate({
      businessId: selectedBusiness,
      packageId: selectedPackage,
    });
  };

  const openPrintableInvoice = (invoice: Invoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to view the invoice");
      return;
    }

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
            <p>${invoice.invoice_number}</p>
          </div>
        </div>
        
        <div class="details">
          <div class="details-section">
            <h3>Bill To</h3>
            <p><strong>${invoice.business?.name || "Unknown Business"}</strong></p>
          </div>
          <div class="details-section">
            <h3>Invoice Details</h3>
            <p><strong>Date:</strong> ${format(new Date(invoice.created_at), "MMM d, yyyy")}</p>
            ${invoice.due_date ? `<p><strong>Due Date:</strong> ${format(new Date(invoice.due_date), "MMM d, yyyy")}</p>` : ""}
            <p><strong>Status:</strong> <span class="status ${invoice.status}">${invoice.status.toUpperCase()}</span></p>
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
              <td>${invoice.description || "Advertising Services"}</td>
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

  // Calculate stats
  const totalRevenue = invoices?.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount_cents, 0) || 0;
  const pendingAmount = invoices?.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount_cents, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-muted-foreground">Loading invoices...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">${(pendingAmount / 100).toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{invoices?.length || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sponsor Invoices</h2>
          <p className="text-sm text-muted-foreground">
            Create invoices and process payments via Stripe
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Invoice
        </Button>
      </div>

      {/* Invoices Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices?.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono text-sm">
                  {invoice.invoice_number}
                </TableCell>
                <TableCell className="font-medium">
                  {invoice.business?.name || "Unknown"}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">
                  {invoice.description || "—"}
                </TableCell>
                <TableCell className="font-medium">
                  ${(invoice.amount_cents / 100).toFixed(2)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(invoice.status)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(invoice.created_at), "MMM d, yyyy")}
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
                        onClick={() => {
                          createCheckoutMutation.mutate({
                            businessId: invoice.business_id,
                            packageId: "newsletter_1mo", // Default, ideally would store original
                          });
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
            {(!invoices || invoices.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No invoices yet. Create your first invoice to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Business</Label>
              <Select value={selectedBusiness} onValueChange={setSelectedBusiness}>
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
              <Label>Ad Package</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a package" />
                </SelectTrigger>
                <SelectContent>
                  {AD_PACKAGES.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvoice} 
              disabled={isProcessing || !selectedBusiness || !selectedPackage}
            >
              {isProcessing ? "Creating..." : "Create & Send Payment Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
