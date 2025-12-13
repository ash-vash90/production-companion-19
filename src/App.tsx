import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { Loader2 } from "lucide-react";
import { initializePrefetch } from "./services/prefetchService";
import ProtectedRoute from "./components/ProtectedRoute";

// Auth page loads eagerly for fast initial login experience
import Auth from "./pages/Auth";

// Lazy load all other pages to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const WorkOrders = lazy(() => import("./pages/WorkOrders"));
const Production = lazy(() => import("./pages/Production"));
const ProductionStep = lazy(() => import("./pages/ProductionStep"));
const ProductionSensor = lazy(() => import("./pages/ProductionSensor"));
const QualityCertificates = lazy(() => import("./pages/QualityCertificates"));
const ProductionReports = lazy(() => import("./pages/ProductionReports"));
const ProductionReportDetail = lazy(() => import("./pages/ProductionReportDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const PersonalSettings = lazy(() => import("./pages/PersonalSettings"));
const Analytics = lazy(() => import("./pages/Analytics"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));
const ProductionCalendar = lazy(() => import("./pages/ProductionCalendar"));
const Genealogy = lazy(() => import("./pages/Genealogy"));
const Search = lazy(() => import("./pages/Search"));
const Inventory = lazy(() => import("./pages/Inventory"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Garbage collect unused data after 10 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus to reduce unnecessary requests
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  // Initialize prefetch on app load
  useEffect(() => {
    initializePrefetch();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <UserProfileProvider>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                    <Route path="/work-orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />
                    <Route path="/production/:itemId" element={<ProtectedRoute><Production /></ProtectedRoute>} />
                    <Route path="/production/step/:itemId" element={<ProtectedRoute><ProductionStep /></ProtectedRoute>} />
                    <Route path="/production/sensor/:itemId" element={<ProtectedRoute><ProductionSensor /></ProtectedRoute>} />
                    <Route path="/quality-certificates" element={<ProtectedRoute><QualityCertificates /></ProtectedRoute>} />
                    <Route path="/production-reports" element={<ProtectedRoute><ProductionReports /></ProtectedRoute>} />
                    <Route path="/production-reports/:id" element={<ProtectedRoute><ProductionReportDetail /></ProtectedRoute>} />
                    <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                    <Route path="/role-management" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
                    <Route path="/calendar" element={<ProtectedRoute><ProductionCalendar /></ProtectedRoute>} />
                    <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
                    <Route path="/genealogy/:serialNumber" element={<ProtectedRoute><Genealogy /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/personal-settings" element={<ProtectedRoute><PersonalSettings /></ProtectedRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </UserProfileProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
