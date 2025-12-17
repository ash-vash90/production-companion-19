import React from 'react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
import { PlannerWorkOrder } from '@/pages/ProductionPlanner';
import PlannerCalendar from './PlannerCalendar';
import PlannerWorkOrderDetail from './PlannerWorkOrderDetail';

interface MobilePlannerFlowProps {
  currentStep: 'calendar' | 'list' | 'detail' | 'items' | 'steps';
  currentDate: Date;
  calendarView: 'month' | 'week';
  workOrders: PlannerWorkOrder[];
  unscheduledOrders: PlannerWorkOrder[];
  loading: boolean;
  selectedWorkOrderId: string | null;
  onSelectWorkOrder: (id: string) => void;
  onBack: () => void;
  onNavigate: (step: 'calendar' | 'list' | 'detail' | 'items' | 'steps') => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onViewChange: (view: 'month' | 'week') => void;
  onWorkOrderUpdate: () => void;
  onCloseDetail: () => void;
  isAdmin: boolean;
}

const MobilePlannerFlow: React.FC<MobilePlannerFlowProps> = ({
  currentStep,
  currentDate,
  calendarView,
  workOrders,
  unscheduledOrders,
  loading,
  selectedWorkOrderId,
  onSelectWorkOrder,
  onBack,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  onViewChange,
  onWorkOrderUpdate,
  onCloseDetail,
  isAdmin,
}) => {
  const { language } = useLanguage();

  // Calendar view
  if (currentStep === 'calendar') {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex flex-col">
          <PlannerCalendar
            currentDate={currentDate}
            calendarView={calendarView}
            workOrders={workOrders}
            unscheduledOrders={unscheduledOrders}
            loading={loading}
            selectedWorkOrderId={selectedWorkOrderId}
            onSelectWorkOrder={onSelectWorkOrder}
            onNavigatePrevious={onNavigatePrevious}
            onNavigateNext={onNavigateNext}
            onNavigateToday={onNavigateToday}
            onViewChange={onViewChange}
            onWorkOrderUpdate={onWorkOrderUpdate}
            isAdmin={isAdmin}
          />
        </div>
      </Layout>
    );
  }

  // Work Order Detail view (full screen on mobile)
  if (currentStep === 'detail' && selectedWorkOrderId) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] flex flex-col">
          {/* Mobile back header */}
          <div className="flex-none p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              {language === 'nl' ? 'Terug naar kalender' : 'Back to calendar'}
            </Button>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <PlannerWorkOrderDetail
              workOrderId={selectedWorkOrderId}
              onClose={onCloseDetail}
              onUpdate={onWorkOrderUpdate}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Fallback to calendar
  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <PlannerCalendar
          currentDate={currentDate}
          calendarView={calendarView}
          workOrders={workOrders}
          unscheduledOrders={unscheduledOrders}
          loading={loading}
          selectedWorkOrderId={selectedWorkOrderId}
          onSelectWorkOrder={onSelectWorkOrder}
          onNavigatePrevious={onNavigatePrevious}
          onNavigateNext={onNavigateNext}
          onNavigateToday={onNavigateToday}
          onViewChange={onViewChange}
          onWorkOrderUpdate={onWorkOrderUpdate}
          isAdmin={isAdmin}
        />
      </div>
    </Layout>
  );
};

export default MobilePlannerFlow;
