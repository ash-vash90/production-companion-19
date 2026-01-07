import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, RefreshCw, Settings, Copy, Check, Send, Loader2, Download, AlertCircle, CheckCircle2, FileJson, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";

// Removed frequency/time options - webhooks are now configured in Settings

export default function ItemsManagement() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [testPayload, setTestPayload] = useState("");
  const [parseResult, setParseResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);
  const [isTestingReceive, setIsTestingReceive] = useState(false);

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("item_code");
      if (error) throw error;
      return data;
    },
  });

  // Fetch sync configuration
  const { data: syncConfig, isLoading: configLoading } = useQuery({
    queryKey: ["sync-config", "items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_configurations")
        .select("*")
        .eq("sync_type", "items")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  // Fetch incoming webhooks that could be used for items sync
  const { data: itemsSyncWebhooks = [] } = useQuery({
    queryKey: ["items-sync-webhooks"],
    queryFn: async () => {
      // Get all incoming webhooks - user can configure any for items sync
      const { data, error } = await supabase
        .from("incoming_webhooks_safe")
        .select("id, name, endpoint_key, enabled, trigger_count, last_triggered_at")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent webhook logs for items sync
  const { data: webhookLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["items-webhook-logs"],
    queryFn: async () => {
      // Get logs from webhooks with sync_products rules
      const webhookIds = itemsSyncWebhooks.map((w: any) => w.id).filter(Boolean);
      if (webhookIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .in("incoming_webhook_id", webhookIds)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: itemsSyncWebhooks.length > 0,
  });

  const [selectedLog, setSelectedLog] = useState<typeof webhookLogs[0] | null>(null);

  // Get unique groups
  const groups = [...new Set(products.map((p) => p.items_group).filter(Boolean))];

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.item_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGroup = groupFilter === "all" || product.items_group === groupFilter;
    return matchesSearch && matchesGroup;
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const receiverEndpoint = `${supabaseUrl}/functions/v1/webhook-receiver`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(language === "nl" ? "Gekopieerd!" : "Copied!");
  };

  const getDisplayName = (product: typeof products[0]) => {
    if (language === "nl" && product.name_nl) {
      return product.name_nl;
    }
    return product.name;
  };

  const testReceiveWebhook = async () => {
    if (!testPayload.trim()) {
      toast.error(language === "nl" ? "Voer een JSON payload in" : "Enter a JSON payload");
      return;
    }

    setIsTestingReceive(true);
    setParseResult(null);

    try {
      // First validate JSON
      let parsed;
      try {
        parsed = JSON.parse(testPayload);
      } catch {
        setParseResult({
          success: false,
          message: language === "nl" ? "Ongeldige JSON syntax" : "Invalid JSON syntax",
        });
        return;
      }

      // Validate expected structure
      if (!parsed.action) {
        setParseResult({
          success: false,
          message: language === "nl" ? "Ontbrekend 'action' veld" : "Missing 'action' field",
          data: parsed,
        });
        return;
      }

      if (parsed.action !== "sync_products") {
        setParseResult({
          success: false,
          message: language === "nl" 
            ? `Onverwachte action: '${parsed.action}'. Verwacht: 'sync_products'` 
            : `Unexpected action: '${parsed.action}'. Expected: 'sync_products'`,
          data: parsed,
        });
        return;
      }

      if (!parsed.data) {
        setParseResult({
          success: false,
          message: language === "nl" ? "Ontbrekend 'data' veld" : "Missing 'data' field",
          data: parsed,
        });
        return;
      }

      const requiredFields = ["exact_item_id", "item_code", "name"];
      const missingFields = requiredFields.filter((f) => !parsed.data[f]);

      if (missingFields.length > 0) {
        setParseResult({
          success: false,
          message: language === "nl" 
            ? `Ontbrekende verplichte velden: ${missingFields.join(", ")}` 
            : `Missing required fields: ${missingFields.join(", ")}`,
          data: parsed.data,
        });
        return;
      }

      // Send to actual webhook receiver for live test
      const response = await supabase.functions.invoke("webhook-receiver", {
        body: parsed,
      });

      if (response.error) {
        setParseResult({
          success: false,
          message: response.error.message || "Webhook receiver error",
          data: parsed.data,
        });
        return;
      }

      setParseResult({
        success: true,
        message: language === "nl" 
          ? "Payload succesvol verwerkt! Item toegevoegd/bijgewerkt." 
          : "Payload processed successfully! Item added/updated.",
        data: response.data,
      });

      // Refresh products list
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(language === "nl" ? "Item gesynchroniseerd" : "Item synced");
    } catch (error) {
      console.error("Test receive error:", error);
      setParseResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsTestingReceive(false);
    }
  };

  const samplePayload = JSON.stringify({
    action: "sync_products",
    data: {
      exact_item_id: "abc123",
      item_code: "SDM-ECO-001",
      name: "SDM ECO Sensor",
      name_nl: "SDM ECO Sensor",
      description: "Ultrasonic density meter",
      product_type: "SDM_ECO",
      items_group: "Sensors",
    },
  }, null, 2);

  return (
    <Layout>
    <div className="space-y-6">
      <PageHeader
        title={language === "nl" ? "Items Beheer" : "Items Management"}
        description={language === "nl" 
          ? "Beheer en synchroniseer items met Exact" 
          : "Manage and sync items with Exact"
        }
      />

      <Tabs defaultValue="items" className="space-y-6">
        <TabsList>
          <TabsTrigger value="items" className="gap-2">
            <Package className="h-4 w-4" />
            {language === "nl" ? "Items Database" : "Items Database"}
          </TabsTrigger>
          <TabsTrigger value="sync" className="gap-2">
            <Settings className="h-4 w-4" />
            {language === "nl" ? "Sync Instellingen" : "Sync Settings"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "nl" ? "Zoek items..." : "Search items..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder={language === "nl" ? "Alle groepen" : "All groups"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === "nl" ? "Alle groepen" : "All groups"}
                    </SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group} value={group!}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{language === "nl" ? "Items" : "Items"}</CardTitle>
                  <CardDescription>
                    {filteredProducts.length} {language === "nl" ? "items gevonden" : "items found"}
                  </CardDescription>
                </div>
                {syncConfig?.last_synced_at && (
                  <Badge variant="outline" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    {language === "nl" ? "Laatst gesynchroniseerd:" : "Last synced:"}{" "}
                    {format(new Date(syncConfig.last_synced_at), "dd/MM/yyyy HH:mm")}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {products.length === 0 ? (
                    <div className="space-y-2">
                      <Package className="h-12 w-12 mx-auto opacity-50" />
                      <p>{language === "nl" ? "Geen items gevonden" : "No items found"}</p>
                      <p className="text-sm">
                        {language === "nl" 
                          ? "Configureer de sync om items van Exact te importeren" 
                          : "Configure the sync to import items from Exact"}
                      </p>
                    </div>
                  ) : (
                    <p>{language === "nl" ? "Geen items gevonden voor deze zoekopdracht" : "No items match your search"}</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "nl" ? "Code" : "Code"}</TableHead>
                        <TableHead>{language === "nl" ? "Omschrijving" : "Description"}</TableHead>
                        <TableHead>{language === "nl" ? "Artikelgroep" : "Items Group"}</TableHead>
                        <TableHead>{language === "nl" ? "Type" : "Type"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono font-medium">
                            {product.item_code}
                          </TableCell>
                          <TableCell>{getDisplayName(product)}</TableCell>
                          <TableCell>
                            {product.items_group ? (
                              <Badge variant="secondary">{product.items_group}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{product.product_type}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          {/* Select Webhook from Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                {language === "nl" ? "Webhook Configuratie" : "Webhook Configuration"}
              </CardTitle>
              <CardDescription>
                {language === "nl" 
                  ? "Selecteer een incoming webhook voor items synchronisatie" 
                  : "Select an incoming webhook for items sync"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {itemsSyncWebhooks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground opacity-50 mb-3" />
                  <p className="font-medium mb-1">
                    {language === "nl" ? "Geen webhooks geconfigureerd" : "No webhooks configured"}
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {language === "nl" 
                      ? "Maak eerst een incoming webhook aan in Instellingen → Webhooks" 
                      : "First create an incoming webhook in Settings → Webhooks"}
                  </p>
                  <Button onClick={() => navigate("/settings")} className="gap-2">
                    <Settings className="h-4 w-4" />
                    {language === "nl" ? "Ga naar Instellingen" : "Go to Settings"}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Available Webhooks */}
                  <div className="space-y-3">
                    <Label>{language === "nl" ? "Beschikbare Webhooks" : "Available Webhooks"}</Label>
                    <div className="grid gap-3">
                      {itemsSyncWebhooks.map((webhook: any) => (
                        <div 
                          key={webhook.id} 
                          className="flex items-center justify-between p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${webhook.enabled ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            <div>
                              <p className="font-medium">{webhook.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                .../webhook-receiver?key={webhook.endpoint_key}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={webhook.enabled ? "default" : "secondary"}>
                              {webhook.enabled 
                                ? (language === "nl" ? "Actief" : "Active")
                                : (language === "nl" ? "Uitgeschakeld" : "Disabled")}
                            </Badge>
                            {webhook.trigger_count > 0 && (
                              <Badge variant="outline">{webhook.trigger_count}x</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate("/settings")}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {language === "nl" ? "Webhooks beheren" : "Manage Webhooks"}
                    </Button>
                  </div>

                  {/* Receiver Endpoint */}
                  <div className="space-y-2">
                    <Label>{language === "nl" ? "Ontvanger Endpoint" : "Receiver Endpoint"}</Label>
                    <div className="flex gap-2">
                      <Input value={receiverEndpoint} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(receiverEndpoint)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "nl" 
                        ? "Zapier moet items naar dit endpoint sturen met action: sync_products" 
                        : "Zapier should send items to this endpoint with action: sync_products"}
                    </p>
                  </div>

                  {/* Sync Status */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <h4 className="font-medium">{language === "nl" ? "Sync Status" : "Sync Status"}</h4>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {language === "nl" ? "Laatst gesynchroniseerd" : "Last synced"}
                        </span>
                        <span>
                          {syncConfig?.last_synced_at 
                            ? format(new Date(syncConfig.last_synced_at), "dd/MM/yyyy HH:mm")
                            : language === "nl" ? "Nooit" : "Never"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {language === "nl" ? "Totaal items" : "Total items"}
                        </span>
                        <span>{products.length}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Receive & Test Webhooks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                {language === "nl" ? "Webhook Ontvangen & Testen" : "Receive & Test Webhooks"}
              </CardTitle>
              <CardDescription>
                {language === "nl" 
                  ? "Test inkomende webhook payloads voordat je ze vanuit Zapier stuurt" 
                  : "Test incoming webhook payloads before sending from Zapier"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Expected Format */}
              <div className="space-y-2">
                <Label>{language === "nl" ? "Verwacht payload formaat" : "Expected payload format"}</Label>
                <pre className="rounded-lg bg-muted p-4 overflow-x-auto text-sm">
{samplePayload}
                </pre>
              </div>

              {/* Test Input */}
              <div className="space-y-2">
                <Label>{language === "nl" ? "Test JSON Payload" : "Test JSON Payload"}</Label>
                <Textarea
                  placeholder={language === "nl" ? "Plak hier je JSON payload..." : "Paste your JSON payload here..."}
                  value={testPayload}
                  onChange={(e) => {
                    setTestPayload(e.target.value);
                    setParseResult(null);
                  }}
                  className="font-mono text-sm min-h-[150px]"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTestPayload(samplePayload)}
                    size="sm"
                  >
                    {language === "nl" ? "Laad voorbeeld" : "Load sample"}
                  </Button>
                  <Button
                    onClick={testReceiveWebhook}
                    disabled={!testPayload.trim() || isTestingReceive}
                    size="sm"
                    className="gap-2"
                  >
                    {isTestingReceive ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {language === "nl" ? "Test & Verwerk" : "Test & Process"}
                  </Button>
                </div>
              </div>

              {/* Parse Result */}
              {parseResult && (
                <div className={`rounded-lg border p-4 ${parseResult.success ? "border-green-500/50 bg-green-500/10" : "border-destructive/50 bg-destructive/10"}`}>
                  <div className="flex items-start gap-3">
                    {parseResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    )}
                    <div className="space-y-2 flex-1">
                      <p className={`font-medium ${parseResult.success ? "text-green-500" : "text-destructive"}`}>
                        {parseResult.success 
                          ? (language === "nl" ? "Succes" : "Success")
                          : (language === "nl" ? "Fout" : "Error")}
                      </p>
                      <p className="text-sm">{parseResult.message}</p>
                      {parseResult.data && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            {language === "nl" ? "Bekijk parsed data" : "View parsed data"}
                          </summary>
                          <pre className="mt-2 rounded bg-muted p-2 overflow-x-auto text-xs">
                            {JSON.stringify(parseResult.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Field Reference */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">{language === "nl" ? "Veld referentie" : "Field Reference"}</h4>
                <div className="grid gap-2 text-sm">
                  <div className="grid grid-cols-3 gap-2 font-medium text-muted-foreground border-b pb-2">
                    <span>{language === "nl" ? "Veld" : "Field"}</span>
                    <span>{language === "nl" ? "Verplicht" : "Required"}</span>
                    <span>{language === "nl" ? "Beschrijving" : "Description"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">exact_item_id</code>
                    <span className="text-green-500">✓</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Unieke ID uit Exact" : "Unique ID from Exact"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">item_code</code>
                    <span className="text-green-500">✓</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Artikelcode" : "Item code"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">name</code>
                    <span className="text-green-500">✓</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Artikelnaam (EN)" : "Item name (EN)"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">name_nl</code>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Artikelnaam (NL)" : "Item name (NL)"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">description</code>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Omschrijving" : "Description"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">product_type</code>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Type product" : "Product type"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <code className="text-xs">items_group</code>
                    <span className="text-muted-foreground">—</span>
                    <span className="text-muted-foreground">{language === "nl" ? "Artikelgroep" : "Items group"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Webhook Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="h-5 w-5" />
                    {language === "nl" ? "Recente Webhook Logs" : "Recent Webhook Logs"}
                  </CardTitle>
                  <CardDescription>
                    {language === "nl" 
                      ? "Bekijk inkomende webhook payloads" 
                      : "View incoming webhook payloads"}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {language === "nl" ? "Vernieuwen" : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {itemsSyncWebhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto opacity-50 mb-2" />
                  <p className="font-medium">
                    {language === "nl" ? "Geen webhook geconfigureerd" : "No webhook configured"}
                  </p>
                  <p className="text-sm mt-1">
                    {language === "nl" 
                      ? "Maak eerst een incoming webhook aan in Instellingen → Webhooks" 
                      : "First create an incoming webhook in Settings → Webhooks"}
                  </p>
                  <Button variant="link" className="mt-2" onClick={() => window.location.href = "/settings"}>
                    {language === "nl" ? "Ga naar Instellingen" : "Go to Settings"}
                  </Button>
                </div>
              ) : webhookLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileJson className="h-12 w-12 mx-auto opacity-50 mb-2" />
                  <p>{language === "nl" ? "Nog geen webhook logs ontvangen" : "No webhook logs received yet"}</p>
                  <p className="text-sm mt-1">
                    {language === "nl" 
                      ? "Stuur een test webhook om het te proberen" 
                      : "Send a test webhook to try it out"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Configured webhooks info */}
                  <div className="flex flex-wrap gap-2">
                    {itemsSyncWebhooks.map((webhook: any) => (
                      <Badge 
                        key={webhook.id} 
                        variant={webhook.enabled ? "default" : "secondary"}
                        className="gap-1"
                      >
                        {webhook.enabled ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {webhook.name}
                        {webhook.trigger_count > 0 && (
                          <span className="ml-1 opacity-70">({webhook.trigger_count}x)</span>
                        )}
                      </Badge>
                    ))}
                  </div>

                  {/* Logs table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">{language === "nl" ? "Tijdstip" : "Time"}</TableHead>
                          <TableHead className="w-[80px]">{language === "nl" ? "Status" : "Status"}</TableHead>
                          <TableHead>{language === "nl" ? "Payload Preview" : "Payload Preview"}</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {webhookLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs">
                              {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.response_status === 200 ? "default" : log.response_status === 207 ? "secondary" : "destructive"}>
                                {log.response_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs truncate max-w-[300px]">
                              {log.request_body ? JSON.stringify(log.request_body).slice(0, 100) + "..." : "—"}
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Selected log detail */}
                  {selectedLog && (
                    <Card className="border-primary/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            {language === "nl" ? "Payload Details" : "Payload Details"} - {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss")}
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setTestPayload(JSON.stringify(selectedLog.request_body, null, 2));
                                toast.success(language === "nl" ? "Payload gekopieerd naar test veld" : "Payload copied to test field");
                              }}
                            >
                              {language === "nl" ? "Gebruik als test" : "Use as test"}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setSelectedLog(null)}
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                            {JSON.stringify(selectedLog.request_body, null, 2)}
                          </pre>
                        </ScrollArea>
                        {selectedLog.error_message && (
                          <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                            <p className="text-sm font-medium text-destructive">
                              {language === "nl" ? "Fout:" : "Error:"}
                            </p>
                            <p className="text-sm">{selectedLog.error_message}</p>
                          </div>
                        )}
                        {selectedLog.executed_rules && (selectedLog.executed_rules as unknown[]).length > 0 && (
                          <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                            <p className="text-sm font-medium text-green-500">
                              {language === "nl" ? "Uitgevoerde regels:" : "Executed rules:"}
                            </p>
                            <pre className="text-xs mt-2">
                              {JSON.stringify(selectedLog.executed_rules, null, 2)}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </Layout>
  );
}
