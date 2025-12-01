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
    <div className="min-h-screen bg-[hsl(var(--c-slate-50))]">
      <header className="sticky top-0 z-50 w-full border-b-2 border-[hsl(var(--c-slate-200))] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
        <div className="container flex h-20 md:h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="h-11 w-11 md:h-9 md:w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <Factory className="h-6 w-6 md:h-5 md:w-5 text-white" />
              </div>
              <span className="font-logo text-xl md:text-lg text-[hsl(var(--c-obsidian))] lowercase">rhosonics</span>
            </button>
            
            <nav className="hidden md:flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className="font-sans"
              >
                {t('dashboard')}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/work-orders')}
                className="font-sans"
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
              className="font-data text-xs uppercase tracking-wider h-10 w-10 md:h-9 md:w-auto md:px-3"
            >
              {language === 'en' ? 'NL' : 'EN'}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-12 w-12 md:h-10 md:w-10">
              <Settings className="h-6 w-6 md:h-5 md:w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-12 w-12 md:h-10 md:w-10">
              <LogOut className="h-6 w-6 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
};

export default Layout;
