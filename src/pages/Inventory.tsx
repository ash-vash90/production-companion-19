import { useState } from 'react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useStockLevels, useLowStock, useReceiveStock, useRecentTransactions } from '@/hooks/useInventory';
import { useMaterials, getMaterialName } from '@/hooks/useMaterials';
import { LowStockAlert } from '@/components/inventory/LowStockAlert';
import { CameraScannerDialog } from '@/components/scanner/CameraScannerDialog';
import {
  Package,
  Plus,
  Search,
  Camera,
  Loader2,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

export default function Inventory() {
  const { language, t } = useLanguage();
  const { canManageInventory } = useUserProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showScannerDialog, setShowScannerDialog] = useState(false);

  // Form state for receive dialog
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const { data: stockLevels, isLoading: stockLoading } = useStockLevels();
  const { data: materials } = useMaterials();
  const { data: lowStockItems } = useLowStock();
  const { data: recentTransactions } = useRecentTransactions(10);
  const receiveStock = useReceiveStock();

  // Filter stock by search query
  const filteredStock = stockLevels?.filter((stock) => {
    if (!searchQuery) return true;
    const material = stock.material;
    if (!material) return false;
    const query = searchQuery.toLowerCase();
    return (
      material.name.toLowerCase().includes(query) ||
      material.sku.toLowerCase().includes(query) ||
      (stock.batch_number?.toLowerCase().includes(query) ?? false)
    );
  });

  const handleReceiveStock = async () => {
    if (!selectedMaterialId || !quantity) return;

    try {
      await receiveStock.mutateAsync({
        materialId: selectedMaterialId,
        batchNumber: batchNumber || null,
        quantity: parseFloat(quantity),
        expiryDate: expiryDate || undefined,
      });
      setShowReceiveDialog(false);
      resetReceiveForm();
    } catch {
      // Error handled by mutation
    }
  };

  const resetReceiveForm = () => {
    setSelectedMaterialId('');
    setBatchNumber('');
    setQuantity('');
    setExpiryDate('');
  };

  const handleScanResult = (scannedBatch: string) => {
    setBatchNumber(scannedBatch);
    setShowScannerDialog(false);
    if (!showReceiveDialog) {
      setShowReceiveDialog(true);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'receive':
        return <ArrowDownCircle className="h-4 w-4 text-success" />;
      case 'consume':
        return <ArrowUpCircle className="h-4 w-4 text-warning" />;
      case 'adjust':
        return <RefreshCw className="h-4 w-4 text-info" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, { en: string; nl: string }> = {
      receive: { en: 'Received', nl: 'Ontvangen' },
      consume: { en: 'Consumed', nl: 'Verbruikt' },
      adjust: { en: 'Adjusted', nl: 'Aangepast' },
      reserve: { en: 'Reserved', nl: 'Gereserveerd' },
      unreserve: { en: 'Unreserved', nl: 'Vrijgegeven' },
    };
    return labels[type]?.[language as 'en' | 'nl'] || type;
  };

  if (!canManageInventory) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-warning mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              {language === 'nl' ? 'Toegang Geweigerd' : 'Access Denied'}
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
              {language === 'nl'
                ? 'Je hebt geen toegang tot voorraadbeheer. Neem contact op met een beheerder.'
                : 'You do not have access to inventory management. Contact an administrator.'}
            </p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader
          title={language === 'nl' ? 'Voorraad' : 'Inventory'}
          description={
            language === 'nl'
              ? 'Beheer materiaalvoorraad en batches'
              : 'Manage material stock and batches'
          }
        />

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {language === 'nl' ? 'Totaal Materialen' : 'Total Materials'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{materials?.length || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {language === 'nl' ? 'Unieke Batches' : 'Unique Batches'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stockLevels?.length || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {language === 'nl' ? 'Lage Voorraad' : 'Low Stock'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-warning">
                  {lowStockItems?.length || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alert */}
          <LowStockAlert />

          {/* Actions and Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={
                  language === 'nl'
                    ? 'Zoeken op naam, SKU of batch...'
                    : 'Search by name, SKU or batch...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowScannerDialog(true)}
              >
                <Camera className="h-4 w-4 mr-2" />
                {language === 'nl' ? 'Scan' : 'Scan'}
              </Button>
              <Button onClick={() => setShowReceiveDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {language === 'nl' ? 'Ontvangen' : 'Receive'}
              </Button>
            </div>
          </div>

          {/* Stock Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {language === 'nl' ? 'Voorraadniveaus' : 'Stock Levels'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stockLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !filteredStock || filteredStock.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {searchQuery
                      ? language === 'nl'
                        ? 'Geen resultaten gevonden'
                        : 'No results found'
                      : language === 'nl'
                      ? 'Nog geen voorraad geregistreerd'
                      : 'No stock registered yet'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'nl' ? 'Materiaal' : 'Material'}</TableHead>
                        <TableHead>{language === 'nl' ? 'Batch' : 'Batch'}</TableHead>
                        <TableHead className="text-right">
                          {language === 'nl' ? 'Op Voorraad' : 'On Hand'}
                        </TableHead>
                        <TableHead className="text-right">
                          {language === 'nl' ? 'Gereserveerd' : 'Reserved'}
                        </TableHead>
                        <TableHead className="text-right">
                          {language === 'nl' ? 'Beschikbaar' : 'Available'}
                        </TableHead>
                        <TableHead>{language === 'nl' ? 'Vervaldatum' : 'Expiry'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStock.map((stock) => {
                        const available = stock.quantity_on_hand - stock.quantity_reserved;
                        const material = stock.material;
                        return (
                          <TableRow key={stock.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {material
                                    ? getMaterialName(material, language as 'en' | 'nl')
                                    : '-'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {material?.sku}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {stock.batch_number || '-'}
                              </code>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {stock.quantity_on_hand}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {stock.quantity_reserved}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  available <= 0
                                    ? 'destructive'
                                    : available < (material?.reorder_point || 0)
                                    ? 'secondary'
                                    : 'default'
                                }
                              >
                                {available}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {stock.expiry_date ? (
                                <span
                                  className={
                                    new Date(stock.expiry_date) < new Date()
                                      ? 'text-destructive'
                                      : ''
                                  }
                                >
                                  {stock.expiry_date}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {language === 'nl' ? 'Recente Transacties' : 'Recent Transactions'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recentTransactions || recentTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'nl'
                    ? 'Nog geen transacties'
                    : 'No transactions yet'}
                </p>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 p-2 rounded border bg-muted/30"
                    >
                      {getTransactionIcon(tx.transaction_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">
                            {getTransactionLabel(tx.transaction_type)}
                          </span>
                          {tx.batch_number && (
                            <span className="text-muted-foreground">
                              {' '}
                              - {tx.batch_number}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(tx.created_at), {
                            addSuffix: true,
                            locale: language === 'nl' ? nl : enUS,
                          })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {tx.quantity > 0 ? '+' : ''}
                        {tx.quantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receive Stock Dialog */}
        <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === 'nl' ? 'Voorraad Ontvangen' : 'Receive Stock'}
              </DialogTitle>
              <DialogDescription>
                {language === 'nl'
                  ? 'Voeg nieuwe voorraad toe aan het systeem'
                  : 'Add new stock to the system'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Materiaal' : 'Material'}</Label>
                <Select
                  value={selectedMaterialId}
                  onValueChange={setSelectedMaterialId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        language === 'nl' ? 'Selecteer materiaal...' : 'Select material...'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {materials?.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {getMaterialName(material, language as 'en' | 'nl')} ({material.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Batchnummer' : 'Batch Number'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder={
                      language === 'nl' ? 'Scan of typ batchnummer' : 'Scan or type batch number'
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowScannerDialog(true)}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Hoeveelheid' : 'Quantity'}</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Vervaldatum (optioneel)' : 'Expiry Date (optional)'}</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>
                {language === 'nl' ? 'Annuleren' : 'Cancel'}
              </Button>
              <Button
                onClick={handleReceiveStock}
                disabled={receiveStock.isPending || !selectedMaterialId || !quantity}
              >
                {receiveStock.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'nl' ? 'Ontvangen...' : 'Receiving...'}
                  </>
                ) : (
                  <>{language === 'nl' ? 'Ontvangen' : 'Receive'}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Camera Scanner Dialog */}
        <CameraScannerDialog
          open={showScannerDialog}
          onOpenChange={setShowScannerDialog}
          onScan={handleScanResult}
          title={language === 'nl' ? 'Scan Batchnummer' : 'Scan Batch Number'}
        />
      </Layout>
    </ProtectedRoute>
  );
}
