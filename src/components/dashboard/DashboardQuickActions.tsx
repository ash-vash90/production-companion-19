import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, BarChart3, Boxes, Search, LineChart } from 'lucide-react';

const actionIconStyles = 'h-5 w-5 text-primary';

export const DashboardQuickActions = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const actions = [
    {
      key: 'work-orders',
      title: t('workOrders'),
      description: t('quickActionWorkOrders'),
      icon: <ClipboardList className={actionIconStyles} />,
      path: '/work-orders',
    },
    {
      key: 'reports',
      title: t('reports'),
      description: t('quickActionReports'),
      icon: <BarChart3 className={actionIconStyles} />,
      path: '/production-reports',
    },
    {
      key: 'inventory',
      title: t('inventory'),
      description: t('quickActionInventory'),
      icon: <Boxes className={actionIconStyles} />,
      path: '/inventory',
    },
    {
      key: 'search',
      title: t('search'),
      description: t('quickActionSearch'),
      icon: <Search className={actionIconStyles} />,
      path: '/search',
    },
    {
      key: 'analytics',
      title: t('analytics'),
      description: t('quickActionAnalytics'),
      icon: <LineChart className={actionIconStyles} />,
      path: '/analytics',
    },
  ];

  return (
    <Card className="rounded-xl shadow-sm border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">{t('quickActionsTitle')}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {t('quickActionsSubtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Button
            key={action.key}
            variant="outline"
            className="h-auto w-full justify-start px-4 py-3"
            onClick={() => navigate(action.path)}
          >
            <div className="flex items-start gap-3 text-left">
              <div className="rounded-md bg-primary/10 p-2">
                {action.icon}
              </div>
              <div className="space-y-1">
                <div className="font-medium leading-tight">{action.title}</div>
                <p className="text-sm text-muted-foreground leading-snug">
                  {action.description}
                </p>
              </div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};
