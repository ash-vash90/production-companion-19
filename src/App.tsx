import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import WorkOrders from "./pages/WorkOrders";
import Production from "./pages/Production";
import ProductionStep from "./pages/ProductionStep";
import ProductionSensor from "./pages/ProductionSensor";
import QualityCertificates from "./pages/QualityCertificates";
import ProductionReports from "./pages/ProductionReports";
import Settings from "./pages/Settings";
import PersonalSettings from "./pages/PersonalSettings";
import Analytics from "./pages/Analytics";
import RoleManagement from "./pages/RoleManagement";
import ProductionCalendar from "./pages/ProductionCalendar";
import Genealogy from "./pages/Genealogy";
import GenealogySearch from "./pages/GenealogySearch";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/production/:itemId" element={<Production />} />
              <Route path="/production/step/:itemId" element={<ProductionStep />} />
              <Route path="/production/sensor/:itemId" element={<ProductionSensor />} />
              <Route path="/quality-certificates" element={<QualityCertificates />} />
              <Route path="/production-reports" element={<ProductionReports />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/role-management" element={<RoleManagement />} />
              <Route path="/calendar" element={<ProductionCalendar />} />
              <Route path="/genealogy" element={<GenealogySearch />} />
              <Route path="/genealogy/:serialNumber" element={<Genealogy />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/personal-settings" element={<PersonalSettings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
