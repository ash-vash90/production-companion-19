import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { toast } from 'sonner';
import { formatDate, formatProductType, cn } from '@/lib/utils';
import { StatusIndicator } from '@/components/ui/status-indicator';
import ItemLevelAssignmentPanel from '@/components/workorders/ItemLevelAssignmentPanel';
import StepAssignmentPanel from '@/components/workorders/StepAssignmentPanel';
import { X, Package, Calendar as CalendarIcon, Truck, DollarSign, Play, AlertTriangle, Users, FileText, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface WorkOrderDetail {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  customer_name: string | null;
  shipping_date: string | null;
  start_date: string | null;
  scheduled_date: string | null;
  order_value: number | null;
  notes: string | null;
  external_order_number: string | null;
  assigned_to: string | null;
  created_at: string;
  work_order_items?: Array<{ id: string; status: string; product_type: string | null }>;
}

interface PlannerWorkOrderDetailProps {
  workOrderId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const PlannerWorkOrderDetail: React.FC<PlannerWorkOrderDetailProps> = ({
  workOrderId,
  onClose,
  onUpdate,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { isAdmin } = useUserProfile();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'steps'>('overview');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [shipDate, setShipDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkOrder();
  }, [workOrderId]);

  const fetchWorkOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          work_order_items(id, status, product_type)
        `)
        .eq('id', workOrderId)
        .single();

      if (error) throw error;
      setWorkOrder(data);
      setStartDate(data.start_date ? parseISO(data.start_date) : undefined);
      setShipDate(data.shipping_date ? parseISO(data.shipping_date) : undefined);
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressData = () => {
    if (!workOrder?.work_order_items) return { percent: 0, completed: 0, total: 0 };
    const items = workOrder.work_order_items;
    const completed = items.filter((i) => i.status === 'completed').length;
    const total = items.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { percent, completed, total };
  };

  const handleSaveDates = async () => {
    if (!workOrder) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          shipping_date: shipDate ? format(shipDate, 'yyyy-MM-dd') : null,
        })
        .eq('id', workOrder.id);

      if (error) throw error;

      toast.success(language === 'nl' ? 'Datums opgeslagen' : 'Dates saved');
      fetchWorkOrder();
      onUpdate();
    } catch (error) {
      console.error('Error saving dates:', error);
      toast.error(language === 'nl' ? 'Opslaan mislukt' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenProduction = () => {
    navigate(`/production/${workOrder?.id}`);
  };

  const progress = getProgressData();
  const isUnassigned = !workOrder?.assigned_to;
  const isActiveWorkOrder = workOrder && workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  const hasDateChanges = (
    (startDate?.toISOString().split('T')[0] !== workOrder?.start_date) ||
    (shipDate?.toISOString().split('T')[0] !== workOrder?.shipping_date)
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-none p-4 border-b">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">
          {language === 'nl' ? 'Werkorder niet gevonden' : 'Work order not found'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-mono text-xl font-semibold truncate">{workOrder.wo_number}</h2>
            <StatusIndicator status={workOrder.status as any} size="default" />
          </div>
          <div className="flex items-center gap-2">
            {isActiveWorkOrder && (
              <Button onClick={handleOpenProduction} size="sm" className="gap-1.5">
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">{language === 'nl' ? 'Productie' : 'Production'}</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          {workOrder.customer_name || (language === 'nl' ? 'Geen klant opgegeven' : 'No customer specified')}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'overview' | 'items' | 'steps')}
        className="flex-none px-4 pt-3"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" />
            {language === 'nl' ? 'Overzicht' : 'Overview'}
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2 text-xs">
            <Layers className="h-3.5 w-3.5" />
            {language === 'nl' ? 'Items' : 'Items'}
          </TabsTrigger>
          <TabsTrigger value="steps" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            {language === 'nl' ? 'Stappen' : 'Steps'}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeTab === 'overview' ? (
            <div className="space-y-5">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'nl' ? 'Voortgang' : 'Progress'}</span>
                  <span className="font-medium font-mono">
                    {progress.completed}/{progress.total} ({progress.percent}%)
                  </span>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Producttype' : 'Product Type'}
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {formatProductType(workOrder.product_type)}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Orderwaarde' : 'Order Value'}
                  </div>
                  <p className="font-medium font-mono">
                    {workOrder.order_value ? `€${workOrder.order_value.toLocaleString('nl-NL')}` : '-'}
                  </p>
                </div>
              </div>

              {/* Batch Size */}
              <div className="text-sm">
                <span className="text-muted-foreground">{language === 'nl' ? 'Batchgrootte' : 'Batch Size'}: </span>
                <span className="font-medium font-mono">{workOrder.batch_size} items</span>
              </div>

              <Separator />

              {/* Date Scheduling - Admin only */}
              {isAdmin && isActiveWorkOrder && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">{language === 'nl' ? 'Planning' : 'Scheduling'}</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {language === 'nl' ? 'Startdatum' : 'Start Date'}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                            {startDate ? format(startDate, 'dd MMM yyyy') : (language === 'nl' ? 'Selecteer...' : 'Select...')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" />
                        {language === 'nl' ? 'Verzenddatum' : 'Ship Date'}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                            {shipDate ? format(shipDate, 'dd MMM yyyy') : (language === 'nl' ? 'Selecteer...' : 'Select...')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={shipDate}
                            onSelect={setShipDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {hasDateChanges && (
                    <Button onClick={handleSaveDates} disabled={saving} className="w-full">
                      {saving 
                        ? (language === 'nl' ? 'Opslaan...' : 'Saving...') 
                        : (language === 'nl' ? 'Datums opslaan' : 'Save Dates')
                      }
                    </Button>
                  )}
                </div>
              )}

              {/* Non-editable dates display */}
              {(!isAdmin || !isActiveWorkOrder) && (workOrder.start_date || workOrder.shipping_date) && (
                <div className="grid grid-cols-2 gap-4">
                  {workOrder.start_date && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {language === 'nl' ? 'Startdatum' : 'Start Date'}
                      </div>
                      <p className="font-medium">{formatDate(workOrder.start_date)}</p>
                    </div>
                  )}
                  {workOrder.shipping_date && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Truck className="h-3.5 w-3.5" />
                        {language === 'nl' ? 'Verzenddatum' : 'Ship Date'}
                      </div>
                      <p className="font-medium">{formatDate(workOrder.shipping_date)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Unassigned Warning */}
              {isUnassigned && isActiveWorkOrder && (
                <>
                  <Separator />
                  <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {language === 'nl' ? 'Werkorder is nog niet toegewezen' : 'Work order is not yet assigned'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {language === 'nl'
                            ? 'Wijs operators toe aan items of stappen.'
                            : 'Assign operators to items or steps.'}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveTab('items')}>
                            <Layers className="h-3.5 w-3.5" />
                            {language === 'nl' ? 'Items toewijzen' : 'Assign Items'}
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveTab('steps')}>
                            <Users className="h-3.5 w-3.5" />
                            {language === 'nl' ? 'Stappen toewijzen' : 'Assign Steps'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              {workOrder.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{language === 'nl' ? 'Notities' : 'Notes'}: </span>
                  <span>{workOrder.notes}</span>
                </div>
              )}

              {workOrder.external_order_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{language === 'nl' ? 'Extern ordernr' : 'External Order'}: </span>
                  <span className="font-mono">{workOrder.external_order_number}</span>
                </div>
              )}
            </div>
          ) : activeTab === 'items' ? (
            <ItemLevelAssignmentPanel
              workOrderId={workOrder.id}
              scheduledDate={workOrder.scheduled_date || workOrder.start_date}
              onAssignmentChange={() => {
                fetchWorkOrder();
                onUpdate();
              }}
            />
          ) : (
            <StepAssignmentPanel
              workOrderId={workOrder.id}
              productType={workOrder.product_type}
              scheduledDate={workOrder.scheduled_date || workOrder.start_date}
              onAssignmentChange={() => {
                fetchWorkOrder();
                onUpdate();
              }}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PlannerWorkOrderDetail;
