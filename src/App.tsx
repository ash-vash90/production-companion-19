import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { Loader2 } from "lucide-react";
import { initializePrefetch, cleanupPrefetch } from "./services/prefetchService";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy load all pages including Auth to reduce initial bundle size
const Auth = lazy(() => import("./pages/Auth"));
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

// Persist and restore the last non-auth route so hard refresh keeps you on the same page
const LAST_ROUTE_KEY = "last_route";
const ROUTE_RESTORED_KEY = "route_restored";

const RoutePersistence = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Store the last visited route (excluding the auth page)
  useEffect(() => {
    // Don't store auth page or during initial restoration
    if (location.pathname !== "/auth") {
      const fullPath = `${location.pathname}${location.search}${location.hash}`;
      localStorage.setItem(LAST_ROUTE_KEY, fullPath);
    }
  }, [location]);

  // On initial load, if we land on root but have a last route, restore it
  // Only do this once per session to avoid conflicts with auth redirects
  useEffect(() => {
    // Check if we already restored in this session
    const alreadyRestored = sessionStorage.getItem(ROUTE_RESTORED_KEY);
    if (alreadyRestored) return;

    // Mark as restored for this session
    sessionStorage.setItem(ROUTE_RESTORED_KEY, "true");

    if (location.pathname === "/") {
      const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
      if (lastRoute && lastRoute !== "/" && lastRoute !== "/auth") {
        // Use a small delay to ensure auth state is settled
        const timer = setTimeout(() => {
          navigate(lastRoute, { replace: true });
        }, 50);
        return () => clearTimeout(timer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

// Clear the route restored flag on logout so next login can restore properly
export const clearRouteRestoredFlag = () => {
  sessionStorage.removeItem(ROUTE_RESTORED_KEY);
};

const App = () => {
  // Initialize prefetch on app load and cleanup on unmount
  useEffect(() => {
    initializePrefetch();
    return () => {
      cleanupPrefetch();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Ensure we restore last route on hard refresh */}
          <RoutePersistence />
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
