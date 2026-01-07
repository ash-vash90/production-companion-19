import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, RefreshCw, Settings, Clock, Calendar, ExternalLink, Copy, Check, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const FREQUENCY_OPTIONS = [
  { value: "5min", label: "Every 5 minutes" },
  { value: "15min", label: "Every 15 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: `${i.toString().padStart(2, "0")}:00`,
  label: `${i.toString().padStart(2, "0")}:00 CET`,
}));

export default function ItemsManagement() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

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

  // Update sync configuration
  const updateConfig = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase
        .from("sync_configurations")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("sync_type", "items");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-config", "items"] });
      toast.success(language === "nl" ? "Configuratie opgeslagen" : "Configuration saved");
    },
    onError: () => {
      toast.error(language === "nl" ? "Fout bij opslaan" : "Failed to save");
    },
  });

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

  const webhookUrl = syncConfig?.webhook_url || "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const receiverEndpoint = `${supabaseUrl}/functions/v1/webhook-receiver`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(language === "nl" ? "Gekopieerd!" : "Copied!");
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error(language === "nl" ? "Voer eerst een webhook URL in" : "Enter a webhook URL first");
      return;
    }

    setIsTesting(true);
    try {
      // Send request to Zapier webhook to trigger a sync
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors", // Required for Zapier webhooks
        body: JSON.stringify({
          action: "request_items_sync",
          timestamp: new Date().toISOString(),
          triggered_from: window.location.origin,
          receiver_endpoint: receiverEndpoint,
        }),
      });

      toast.success(
        language === "nl" 
          ? "Test verzonden naar Zapier. Controleer de Zap-geschiedenis om te bevestigen." 
          : "Test sent to Zapier. Check your Zap history to confirm."
      );
    } catch (error) {
      console.error("Webhook test error:", error);
      toast.error(
        language === "nl" 
          ? "Fout bij verzenden naar Zapier" 
          : "Failed to send to Zapier"
      );
    } finally {
      setIsTesting(false);
    }
  };

  const getDisplayName = (product: typeof products[0]) => {
    if (language === "nl" && product.name_nl) {
      return product.name_nl;
    }
    return product.name;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
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
          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                {language === "nl" ? "Webhook Synchronisatie" : "Webhook Synchronization"}
              </CardTitle>
              <CardDescription>
                {language === "nl" 
                  ? "Configureer hoe items worden gesynchroniseerd met Exact via webhook" 
                  : "Configure how items are synced with Exact via webhook"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "nl" ? "Synchronisatie ingeschakeld" : "Sync enabled"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "nl" 
                      ? "Automatisch items synchroniseren op schema" 
                      : "Automatically sync items on schedule"}
                  </p>
                </div>
                <Switch
                  checked={syncConfig?.enabled || false}
                  onCheckedChange={(enabled) => updateConfig.mutate({ enabled })}
                  disabled={configLoading}
                />
              </div>

              {/* Webhook URL from Exact */}
              <div className="space-y-2">
                <Label>{language === "nl" ? "Zapier Webhook URL" : "Zapier Webhook URL"}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    value={webhookUrl}
                    onChange={(e) => updateConfig.mutate({ webhook_url: e.target.value })}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={testWebhook}
                    disabled={!webhookUrl || isTesting}
                    className="gap-2"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {language === "nl" ? "Test" : "Test"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === "nl" 
                    ? "De Zapier webhook die Exact items ophaalt en doorstuurt" 
                    : "The Zapier webhook that fetches Exact items and forwards them"}
                </p>
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

              {/* Frequency */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === "nl" ? "Frequentie" : "Frequency"}
                  </Label>
                  <Select
                    value={syncConfig?.frequency || "hourly"}
                    onValueChange={(frequency) => updateConfig.mutate({ frequency })}
                    disabled={configLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(syncConfig?.frequency === "daily" || syncConfig?.frequency === "weekly") && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {language === "nl" ? "Tijdstip (CET)" : "Time (CET)"}
                    </Label>
                    <Select
                      value={syncConfig?.scheduled_time?.slice(0, 5) || "08:00"}
                      onValueChange={(time) => updateConfig.mutate({ scheduled_time: time })}
                      disabled={configLoading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                      {language === "nl" ? "Volgende sync" : "Next sync"}
                    </span>
                    <span>
                      {syncConfig?.next_sync_at 
                        ? format(new Date(syncConfig.next_sync_at), "dd/MM/yyyy HH:mm")
                        : language === "nl" ? "Niet gepland" : "Not scheduled"}
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
            </CardContent>
          </Card>

          {/* Payload Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                {language === "nl" ? "Webhook Payload Formaat" : "Webhook Payload Format"}
              </CardTitle>
              <CardDescription>
                {language === "nl" 
                  ? "Het verwachte formaat voor sync_products webhook calls" 
                  : "The expected format for sync_products webhook calls"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 overflow-x-auto text-sm">
{`{
  "action": "sync_products",
  "data": {
    "exact_item_id": "abc123",
    "item_code": "SDM-ECO-001",
    "name": "SDM ECO Sensor",
    "name_nl": "SDM ECO Sensor",
    "description": "Ultrasonic density meter",
    "product_type": "SDM_ECO",
    "items_group": "Sensors"
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
