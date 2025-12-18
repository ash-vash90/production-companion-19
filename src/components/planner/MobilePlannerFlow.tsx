import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { PlannerWorkOrder } from '@/pages/ProductionPlanner';
import QuickScheduleDialog from './QuickScheduleDialog';
import {
  MobileCalendarPage,
  MobileWorkOrderDetailPage,
  MobileAssignmentPage,
  MobileOperatorCapacityPage,
} from './mobile';
import { Calendar, List } from 'lucide-react';

type MobileStep = 'calendar' | 'detail' | 'assignment' | 'capacity';
type CalendarView = 'day' | 'week' | 'month';

interface MobilePlannerFlowProps {
  currentStep: string;
  currentDate: Date;
  calendarView: 'month' | 'week';
  workOrders: PlannerWorkOrder[];
  unscheduledOrders: PlannerWorkOrder[];
  loading: boolean;
  selectedWorkOrderId: string | null;
  onSelectWorkOrder: (id: string) => void;
  onBack: () => void;
  onNavigate: (step: string) => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onViewChange: (view: 'month' | 'week') => void;
  onWorkOrderUpdate: () => void;
  onCloseDetail: () => void;
  isAdmin: boolean;
}

const MobilePlannerFlow: React.FC<MobilePlannerFlowProps> = ({
  currentDate: initialDate,
  workOrders,
  unscheduledOrders,
  loading,
  selectedWorkOrderId,
  onSelectWorkOrder,
  onWorkOrderUpdate,
  onCloseDetail,
}) => {
  const { language } = useLanguage();
  const [step, setStep] = useState<MobileStep>('calendar');
  const [calendarView, setCalendarView] = useState<CalendarView>('day');
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [workOrderDetail, setWorkOrderDetail] = useState<{
    id: string;
    productType: string;
    scheduledDate: string | null;
  } | null>(null);

  // Quick schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; woNumber: string } | null>(null);

  // When a work order is selected externally, fetch its details
  useEffect(() => {
    if (selectedWorkOrderId && step === 'calendar') {
      fetchWorkOrderDetail(selectedWorkOrderId);
    }
  }, [selectedWorkOrderId]);

  const fetchWorkOrderDetail = async (id: string) => {
    const { data } = await supabase
      .from('work_orders')
      .select('id, product_type, start_date, scheduled_date')
      .eq('id', id)
      .single();

    if (data) {
      setWorkOrderDetail({
        id: data.id,
        productType: data.product_type,
        scheduledDate: data.scheduled_date || data.start_date,
      });
      setStep('detail');
    }
  };

  const handleSelectWorkOrder = (id: string) => {
    onSelectWorkOrder(id);
    fetchWorkOrderDetail(id);
  };

  const handleBack = () => {
    switch (step) {
      case 'detail':
        setStep('calendar');
        setWorkOrderDetail(null);
        onCloseDetail();
        break;
      case 'assignment':
        setStep('detail');
        break;
      case 'capacity':
        setStep('calendar');
        break;
      default:
        break;
    }
  };

  const handleScheduleOrder = (orderId: string) => {
    // Find the work order to get its WO number
    const order = unscheduledOrders.find(o => o.id === orderId);
    if (order) {
      setScheduleTarget({ id: orderId, woNumber: order.wo_number });
      setScheduleDialogOpen(true);
    }
  };

  const handleScheduled = () => {
    setScheduleTarget(null);
    onWorkOrderUpdate();
  };

  const renderContent = () => {
    switch (step) {
      case 'calendar':
        return (
          <MobileCalendarPage
            currentDate={currentDate}
            calendarView={calendarView}
            workOrders={workOrders}
            unscheduledOrders={unscheduledOrders}
            loading={loading}
            onSelectWorkOrder={handleSelectWorkOrder}
            onDateChange={setCurrentDate}
            onViewCapacity={() => setStep('capacity')}
            onScheduleOrder={handleScheduleOrder}
            onViewChange={setCalendarView}
          />
        );

      case 'detail':
        if (!workOrderDetail) return null;
        return (
          <MobileWorkOrderDetailPage
            workOrderId={workOrderDetail.id}
            onBack={handleBack}
            onUpdate={onWorkOrderUpdate}
            onAssign={() => setStep('assignment')}
          />
        );

      case 'assignment':
        if (!workOrderDetail) return null;
        return (
          <MobileAssignmentPage
            workOrderId={workOrderDetail.id}
            productType={workOrderDetail.productType}
            scheduledDate={workOrderDetail.scheduledDate}
            onBack={handleBack}
            onUpdate={onWorkOrderUpdate}
          />
        );

      case 'capacity':
        return (
          <MobileOperatorCapacityPage
            currentDate={currentDate}
            onBack={handleBack}
            onSelectWorkOrder={handleSelectWorkOrder}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {step === 'calendar' && (
          <PageHeader
            title={language === 'nl' ? 'Productieplanner' : 'Production Planner'}
            description={language === 'nl' ? 'Plan en beheer productieorders' : 'Plan and manage production orders'}
            actions={
              <div className="flex items-center border rounded-md">
                <Button
                  variant={calendarView === 'day' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCalendarView('day')}
                  className="rounded-r-none px-3"
                >
                  {language === 'nl' ? 'Dag' : 'Day'}
                </Button>
                <Button
                  variant={calendarView === 'week' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCalendarView('week')}
                  className="rounded-none border-x px-3"
                >
                  {language === 'nl' ? 'Week' : 'Week'}
                </Button>
                <Button
                  variant={calendarView === 'month' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setCalendarView('month')}
                  className="rounded-l-none px-3"
                >
                  {language === 'nl' ? 'Maand' : 'Month'}
                </Button>
              </div>
            }
          />
        )}
        <div className="flex-1 -mx-3 md:-mx-4 lg:-mx-6">
          {renderContent()}
        </div>
      </div>

      {/* Quick Schedule Dialog */}
      {scheduleTarget && (
        <QuickScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          workOrderId={scheduleTarget.id}
          woNumber={scheduleTarget.woNumber}
          onScheduled={handleScheduled}
        />
      )}
    </Layout>
  );
};

export default MobilePlannerFlow;
