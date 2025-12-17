import { useState } from 'react';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Users, Calendar as CalendarIcon, BarChart3 } from 'lucide-react';
import WeeklyCapacityPlanner from '@/components/calendar/WeeklyCapacityPlanner';
import CapacityUtilizationChart from '@/components/workorders/CapacityUtilizationChart';

const CapacityPlanning = () => {
  const { t, language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'planner' | 'overview'>('planner');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const goToPrevious = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const goToNext = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <PageHeader 
          title={language === 'nl' ? 'Capaciteitsplanning' : 'Capacity Planning'} 
          description={language === 'nl' 
            ? 'Plan en beheer operator werkbelasting en toewijzingen' 
            : 'Plan and manage operator workload and assignments'
          } 
        />

        {/* Navigation and view controls */}
        <Card>
          <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevious}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-base sm:text-lg">
                  {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs">
                  {language === 'nl' ? 'Vandaag' : 'Today'}
                </Button>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'planner' | 'overview')} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="planner" className="text-xs gap-1.5 px-3">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === 'nl' ? 'Planner' : 'Planner'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="overview" className="text-xs gap-1.5 px-3">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === 'nl' ? 'Overzicht' : 'Overview'}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
        </Card>

        {/* Main content */}
        {activeTab === 'planner' ? (
          <WeeklyCapacityPlanner />
        ) : (
          <div className="grid gap-4 md:gap-6">
            {/* Capacity utilization charts for each day of the week */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = new Date(weekStart);
                day.setDate(day.getDate() + i);
                return (
                  <CapacityUtilizationChart 
                    key={i} 
                    selectedDate={day}
                  />
                );
              })}
            </div>

            {/* Summary statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {language === 'nl' ? 'Wekelijks Overzicht' : 'Weekly Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 border rounded-lg bg-card">
                    <div className="text-sm text-muted-foreground">
                      {language === 'nl' ? 'Totale Capaciteit' : 'Total Capacity'}
                    </div>
                    <div className="text-2xl font-bold">40h</div>
                    <div className="text-xs text-muted-foreground">
                      {language === 'nl' ? 'per operator/week' : 'per operator/week'}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-card">
                    <div className="text-sm text-muted-foreground">
                      {language === 'nl' ? 'Gepland' : 'Scheduled'}
                    </div>
                    <div className="text-2xl font-bold text-warning">--h</div>
                    <div className="text-xs text-muted-foreground">
                      {language === 'nl' ? 'deze week' : 'this week'}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-card">
                    <div className="text-sm text-muted-foreground">
                      {language === 'nl' ? 'Beschikbaar' : 'Available'}
                    </div>
                    <div className="text-2xl font-bold text-success">--h</div>
                    <div className="text-xs text-muted-foreground">
                      {language === 'nl' ? 'resterende capaciteit' : 'remaining capacity'}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-card">
                    <div className="text-sm text-muted-foreground">
                      {language === 'nl' ? 'Benutting' : 'Utilization'}
                    </div>
                    <div className="text-2xl font-bold">--%</div>
                    <div className="text-xs text-muted-foreground">
                      {language === 'nl' ? 'gemiddeld' : 'average'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CapacityPlanning;
