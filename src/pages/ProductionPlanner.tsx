import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { PageIdentity, PrimaryAction, DataControlsBar } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useIsMobile } from '@/hooks/use-mobile';
import PlannerCalendar from '@/components/planner/PlannerCalendar';
import PlannerWorkOrderDetail from '@/components/planner/PlannerWorkOrderDetail';
import MobilePlannerFlow from '@/components/planner/MobilePlannerFlow';
import DesktopCapacityBar from '@/components/planner/DesktopCapacityBar';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

export interface PlannerWorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  start_date: string | null;
  shipping_date: string | null;
  customer_name: string | null;
  order_value: number | null;
  notes: string | null;
  external_order_number: string | null;
  assigned_to: string | null;
}

type CalendarView = 'month' | 'week' | 'day';

const ProductionPlanner = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const { isAdmin } = useUserProfile();
  const isMobile = useIsMobile();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [workOrders, setWorkOrders] = useState<PlannerWorkOrder[]>([]);
  const [unscheduledOrders, setUnscheduledOrders] = useState<PlannerWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected work order
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(
    searchParams.get('workOrder')
  );

  // Mobile flow state
  const [mobileStep, setMobileStep] = useState<'calendar' | 'list' | 'detail' | 'items' | 'steps'>('calendar');

  // Calculate date range for current view
  const getDateRange = useCallback(() => {
    if (calendarView === 'month') {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      };
    }
    if (calendarView === 'day') {
      return {
        start: currentDate,
        end: currentDate,
      };
    }
    return {
      start: startOfWeek(currentDate, { weekStartsOn: 1 }),
      end: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  }, [currentDate, calendarView]);

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      // Fetch scheduled work orders
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, start_date, shipping_date, customer_name, order_value, notes, external_order_number, assigned_to')
        .neq('status', 'cancelled')
        .or(`start_date.gte.${format(start, 'yyyy-MM-dd')},shipping_date.gte.${format(start, 'yyyy-MM-dd')}`)
        .or(`start_date.lte.${format(end, 'yyyy-MM-dd')},shipping_date.lte.${format(end, 'yyyy-MM-dd')}`)
        .order('start_date', { ascending: true });

      if (error) throw error;

      // Filter to orders that overlap with the view range
      const filtered = (data || []).filter((wo) => {
        const woStart = wo.start_date ? parseISO(wo.start_date) : null;
        const woEnd = wo.shipping_date ? parseISO(wo.shipping_date) : null;

        if (woStart && woEnd) {
          return woStart <= end && woEnd >= start;
        }
        if (woStart) return woStart >= start && woStart <= end;
        if (woEnd) return woEnd >= start && woEnd <= end;
        return false;
      });

      setWorkOrders(filtered);

      // Fetch unscheduled orders
      const { data: unscheduled } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, start_date, shipping_date, customer_name, order_value, notes, external_order_number, assigned_to')
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .is('start_date', null)
        .order('created_at', { ascending: false })
        .limit(50);

      setUnscheduledOrders(unscheduled || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Navigation handlers
  const goToPrevious = () => {
    if (calendarView === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (calendarView === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Work order selection
  const handleSelectWorkOrder = (workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId);
    if (isMobile) {
      setMobileStep('detail');
    }
  };

  const handleCloseDetail = () => {
    setSelectedWorkOrderId(null);
    if (isMobile) {
      setMobileStep('calendar');
    }
  };

  const handleWorkOrderUpdate = () => {
    fetchWorkOrders();
  };

  // Create work order dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Mobile navigation
  const handleMobileBack = () => {
    switch (mobileStep) {
      case 'list':
        setMobileStep('calendar');
        break;
      case 'detail':
        setMobileStep('calendar');
        setSelectedWorkOrderId(null);
        break;
      case 'items':
        setMobileStep('detail');
        break;
      case 'steps':
        setMobileStep('detail');
        break;
      default:
        break;
    }
  };

  const handleMobileNavigate = (step: 'calendar' | 'list' | 'detail' | 'items' | 'steps') => {
    setMobileStep(step);
  };

  // Desktop layout
  if (!isMobile) {
    return (
      <Layout>
        <div className="space-y-4">
          {/* Layer 2: Page Identity */}
          <PageIdentity
            title={language === 'nl' ? 'Productieplanner' : 'Production Planner'}
            description={language === 'nl' ? 'Plan en beheer productieorders visueel op de kalender' : 'Plan and manage production orders visually on the calendar'}
          />

          {/* Layer 3: Primary Action */}
          {isAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto h-11 sm:h-10">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'nl' ? 'Nieuwe order' : 'New Order'}
            </Button>
          )}

          {/* Desktop: Split view - Calendar left, Detail right */}
          <div className="flex h-[calc(100vh-14rem)] overflow-hidden border rounded-lg">
            {/* Calendar Panel */}
            <div className={cn(
              "flex-1 overflow-hidden border-r transition-all duration-300",
              selectedWorkOrderId ? "w-1/2" : "w-full"
            )}>
              <PlannerCalendar
                currentDate={currentDate}
                calendarView={calendarView}
                workOrders={workOrders}
                unscheduledOrders={unscheduledOrders}
                loading={loading}
                selectedWorkOrderId={selectedWorkOrderId}
                onSelectWorkOrder={handleSelectWorkOrder}
                onNavigatePrevious={goToPrevious}
                onNavigateNext={goToNext}
                onNavigateToday={goToToday}
                onViewChange={setCalendarView}
                onWorkOrderUpdate={handleWorkOrderUpdate}
                isAdmin={isAdmin}
              />
            </div>

            {/* Detail Panel */}
            {selectedWorkOrderId && (
              <div className="w-1/2 overflow-hidden animate-in slide-in-from-right-5 duration-300">
                <PlannerWorkOrderDetail
                  workOrderId={selectedWorkOrderId}
                  onClose={handleCloseDetail}
                  onUpdate={handleWorkOrderUpdate}
                />
              </div>
            )}
          </div>

          {/* Desktop Capacity Bar */}
          <DesktopCapacityBar currentDate={currentDate} />
        </div>

        <CreateWorkOrderDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleWorkOrderUpdate}
        />
      </Layout>
    );
  }

  // Mobile layout: Multi-step flow
  return (
    <MobilePlannerFlow
      currentStep={mobileStep}
      currentDate={currentDate}
      calendarView={calendarView}
      workOrders={workOrders}
      unscheduledOrders={unscheduledOrders}
      loading={loading}
      selectedWorkOrderId={selectedWorkOrderId}
      onSelectWorkOrder={handleSelectWorkOrder}
      onBack={handleMobileBack}
      onNavigate={handleMobileNavigate}
      onNavigatePrevious={goToPrevious}
      onNavigateNext={goToNext}
      onNavigateToday={goToToday}
      onViewChange={setCalendarView}
      onWorkOrderUpdate={handleWorkOrderUpdate}
      onCloseDetail={handleCloseDetail}
      isAdmin={isAdmin}
    />
  );
};

export default ProductionPlanner;
