import { useState } from 'react';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, UserMinus } from 'lucide-react';
import WeeklyCapacityPlanner from '@/components/calendar/WeeklyCapacityPlanner';
import QuickAvailabilityForm from '@/components/calendar/QuickAvailabilityForm';

const CapacityPlanning = () => {
  const { language } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'planner' | 'availability'>('planner');
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleAvailabilityAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <PageHeader 
          title={language === 'nl' ? 'Capaciteitsplanning' : 'Capacity Planning'} 
          description={language === 'nl' 
            ? 'Plan dagelijkse toewijzingen en beheer beschikbaarheid' 
            : 'Plan daily assignments and manage availability'
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

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'planner' | 'availability')} className="w-auto">
                <TabsList className="h-8">
                  <TabsTrigger value="planner" className="text-xs gap-1.5 px-3">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === 'nl' ? 'Planner' : 'Planner'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="availability" className="text-xs gap-1.5 px-3">
                    <UserMinus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{language === 'nl' ? 'Afwezigheid' : 'Availability'}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
        </Card>

        {/* Main content */}
        {activeTab === 'planner' ? (
          <WeeklyCapacityPlanner key={refreshKey} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <QuickAvailabilityForm onAvailabilityAdded={handleAvailabilityAdded} />
            <Card className="md:col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  {language === 'nl' ? 'Over Afwezigheid' : 'About Availability'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>
                  {language === 'nl' 
                    ? 'Gebruik dit formulier om afwezigheid van medewerkers te registreren, zoals vakantie, ziekte of training.'
                    : 'Use this form to record employee absences such as vacation, sick leave, or training.'
                  }
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    {language === 'nl'
                      ? 'Vakantie - Geplande vrije dagen'
                      : 'Holiday - Planned time off'}
                  </li>
                  <li>
                    {language === 'nl'
                      ? 'Ziek - Ongeplande afwezigheid door ziekte'
                      : 'Sick - Unplanned absence due to illness'}
                  </li>
                  <li>
                    {language === 'nl'
                      ? 'Training - Deelname aan opleidingen'
                      : 'Training - Participation in training sessions'}
                  </li>
                  <li>
                    {language === 'nl'
                      ? 'Overig - Andere redenen voor afwezigheid'
                      : 'Other - Other reasons for absence'}
                  </li>
                </ul>
                <p>
                  {language === 'nl'
                    ? 'Wanneer een medewerker als afwezig is gemarkeerd, kan deze niet worden ingepland voor werkorders op die datum.'
                    : 'When an employee is marked as absent, they cannot be scheduled for work orders on that date.'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CapacityPlanning;
