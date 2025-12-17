import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { initializePrefetch, cleanupPrefetch } from "./services/prefetchService";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";

// Lazy load all pages - store imports for prefetching
const pageImports = {
  '/auth': () => import("./pages/Auth"),
  '/': () => import("./pages/Index"),
  '/work-orders': () => import("./pages/WorkOrders"),
  '/production': () => import("./pages/Production"),
  '/production/step': () => import("./pages/ProductionStep"),
  '/production/sensor': () => import("./pages/ProductionSensor"),
  '/quality-certificates': () => import("./pages/QualityCertificates"),
  '/production-reports': () => import("./pages/ProductionReports"),
  '/production-reports-detail': () => import("./pages/ProductionReportDetail"),
  '/analytics': () => import("./pages/Analytics"),
  '/role-management': () => import("./pages/RoleManagement"),
  '/calendar': () => import("./pages/ProductionCalendar"),
  '/capacity-planning': () => import("./pages/CapacityPlanning"),
  '/search': () => import("./pages/Search"),
  '/genealogy': () => import("./pages/Genealogy"),
  '/settings': () => import("./pages/Settings"),
  '/personal-settings': () => import("./pages/PersonalSettings"),
  '/inventory': () => import("./pages/Inventory"),
  '/profile': () => import("./pages/UserProfile"),
};

// Export prefetch function for use in sidebar
export const prefetchRoute = (url: string) => {
  const importFn = pageImports[url as keyof typeof pageImports];
  if (importFn) {
    importFn();
  }
};

const Auth = lazy(pageImports['/auth']);
const Index = lazy(pageImports['/']);
const WorkOrders = lazy(pageImports['/work-orders']);
const Production = lazy(pageImports['/production']);
const ProductionStep = lazy(pageImports['/production/step']);
const ProductionSensor = lazy(pageImports['/production/sensor']);
const QualityCertificates = lazy(pageImports['/quality-certificates']);
const ProductionReports = lazy(pageImports['/production-reports']);
const ProductionReportDetail = lazy(pageImports['/production-reports-detail']);
const Settings = lazy(pageImports['/settings']);
const PersonalSettings = lazy(pageImports['/personal-settings']);
const Analytics = lazy(pageImports['/analytics']);
const RoleManagement = lazy(pageImports['/role-management']);
const ProductionCalendar = lazy(pageImports['/calendar']);
const CapacityPlanning = lazy(pageImports['/capacity-planning']);
const Genealogy = lazy(pageImports['/genealogy']);
const Search = lazy(pageImports['/search']);
const Inventory = lazy(pageImports['/inventory']);
const UserProfile = lazy(pageImports['/profile']);
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

// Minimal loading fallback for page transitions (no flash)
const PageLoader = () => null;

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

// Auth gate that shows skeleton during auth initialization
const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const key = `${location.pathname}${location.search}${location.hash}`;

  return (
    <div className="w-full">
      <Routes location={location}>
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
        <Route path="/capacity-planning" element={<ProtectedRoute><CapacityPlanning /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
        <Route path="/genealogy/:serialNumber" element={<ProtectedRoute><Genealogy /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/personal-settings" element={<ProtectedRoute><PersonalSettings /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/profile/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
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
            <AuthGate>
              <LanguageProvider>
                <UserProfileProvider>
                  <Suspense fallback={<PageLoader />}>
                    <AnimatedRoutes />
                  </Suspense>
                </UserProfileProvider>
              </LanguageProvider>
            </AuthGate>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
