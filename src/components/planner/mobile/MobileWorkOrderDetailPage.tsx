import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { toast } from 'sonner';
import { formatDate, formatProductType, cn } from '@/lib/utils';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { 
  ChevronLeft, 
  Package, 
  Calendar as CalendarIcon, 
  Truck, 
  DollarSign, 
  Play, 
  AlertTriangle, 
  Users,
  ChevronRight
} from 'lucide-react';
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
  work_order_items?: Array<{ id: string; status: string; product_type: string | null; assigned_to: string | null }>;
}

interface MobileWorkOrderDetailPageProps {
  workOrderId: string;
  onBack: () => void;
  onUpdate: () => void;
  onAssign: () => void;
}

const MobileWorkOrderDetailPage: React.FC<MobileWorkOrderDetailPageProps> = ({
  workOrderId,
  onBack,
  onUpdate,
  onAssign,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { isAdmin } = useUserProfile();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
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
          work_order_items(id, status, product_type, assigned_to)
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
    if (!workOrder?.work_order_items) return { percent: 0, completed: 0, total: 0, assigned: 0 };
    const items = workOrder.work_order_items;
    const completed = items.filter((i) => i.status === 'completed').length;
    const assigned = items.filter((i) => i.assigned_to).length;
    const total = items.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { percent, completed, total, assigned };
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
  const isActiveWorkOrder = workOrder && workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  const hasDateChanges = (
    (startDate?.toISOString().split('T')[0] !== workOrder?.start_date) ||
    (shipDate?.toISOString().split('T')[0] !== workOrder?.shipping_date)
  );
  const hasUnassignedItems = progress.assigned < progress.total;

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none p-4 border-b">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none p-4 border-b">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ChevronLeft className="h-4 w-4" />
            {language === 'nl' ? 'Terug' : 'Back'}
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            {language === 'nl' ? 'Werkorder niet gevonden' : 'Work order not found'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-xl font-semibold truncate">{workOrder.wo_number}</h1>
              <StatusIndicator status={workOrder.status as any} size="default" />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {workOrder.customer_name || (language === 'nl' ? 'Geen klant' : 'No customer')}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Progress Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{language === 'nl' ? 'Voortgang' : 'Progress'}</span>
              <span className="font-mono font-medium">
                {progress.completed}/{progress.total} ({progress.percent}%)
              </span>
            </div>
            <Progress value={progress.percent} className="h-2" />
          </CardContent>
        </Card>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                {language === 'nl' ? 'Product' : 'Product'}
              </div>
              <Badge variant="outline" className="font-mono">
                {formatProductType(workOrder.product_type)}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {workOrder.batch_size} items
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                {language === 'nl' ? 'Waarde' : 'Value'}
              </div>
              <p className="font-mono font-semibold">
                {workOrder.order_value ? `€${workOrder.order_value.toLocaleString('nl-NL')}` : '-'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scheduling Section - Admin only */}
        {isAdmin && isActiveWorkOrder && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-medium text-sm">{language === 'nl' ? 'Planning' : 'Scheduling'}</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Startdatum' : 'Start Date'}
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-11">
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
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-11">
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
                <Button onClick={handleSaveDates} disabled={saving} className="w-full h-11">
                  {saving 
                    ? (language === 'nl' ? 'Opslaan...' : 'Saving...') 
                    : (language === 'nl' ? 'Datums opslaan' : 'Save Dates')
                  }
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Non-editable dates display */}
        {(!isAdmin || !isActiveWorkOrder) && (workOrder.start_date || workOrder.shipping_date) && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                {workOrder.start_date && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {language === 'nl' ? 'Startdatum' : 'Start Date'}
                    </div>
                    <p className="font-medium">{formatDate(workOrder.start_date)}</p>
                  </div>
                )}
                {workOrder.shipping_date && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Truck className="h-3.5 w-3.5" />
                      {language === 'nl' ? 'Verzenddatum' : 'Ship Date'}
                    </div>
                    <p className="font-medium">{formatDate(workOrder.shipping_date)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assignment Warning */}
        {hasUnassignedItems && isActiveWorkOrder && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {language === 'nl' 
                      ? `${progress.total - progress.assigned} items niet toegewezen` 
                      : `${progress.total - progress.assigned} items unassigned`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'nl'
                      ? 'Wijs operators toe aan items of stappen hieronder.'
                      : 'Assign operators to items or steps below.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {workOrder.notes && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{language === 'nl' ? 'Notities' : 'Notes'}</p>
              <p className="text-sm">{workOrder.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex-none p-4 border-t bg-background/95 backdrop-blur space-y-2">
        {isActiveWorkOrder && (
          <Button 
            variant="outline" 
            className="w-full h-12 gap-2"
            onClick={onAssign}
          >
            <Users className="h-5 w-5" />
            {language === 'nl' ? 'Toewijzingen beheren' : 'Manage Assignments'}
          </Button>
        )}
        
        {isActiveWorkOrder && (
          <Button 
            onClick={handleOpenProduction} 
            className="w-full h-12 gap-2"
          >
            <Play className="h-5 w-5" />
            {language === 'nl' ? 'Open productie' : 'Open Production'}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default MobileWorkOrderDetailPage;
