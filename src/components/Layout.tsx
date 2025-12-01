import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Factory, LogOut, Settings, FileText, Package } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg">Production MES</span>
            </button>
            
            <nav className="hidden md:flex gap-6">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="font-medium"
              >
                {t('dashboard')}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => navigate('/work-orders')}
                className="font-medium"
              >
                <Package className="mr-2 h-4 w-4" />
                {t('workOrders')}
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
            >
              {language === 'en' ? 'NL' : 'EN'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
