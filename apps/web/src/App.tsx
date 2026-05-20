import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';
import { AppShell } from './components/layout/AppShell';
import { LoadingSpinner } from './components/ui/skeleton';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const SignInPage = lazy(() => import('./components/auth/SignInPage'));
const SignUpPage = lazy(() => import('./components/auth/SignUpPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PalaceBuilder = lazy(() => import('./pages/PalaceBuilder'));
const PalaceWalkthrough = lazy(() => import('./pages/PalaceWalkthrough'));
const PalaceList = lazy(() => import('./pages/PalaceList'));
const Palace3DView = lazy(() => import('./components/palace/Palace3DViewContent'));

// ⚠️ using lazy + Suspense — Three.js/r3f 170kB bundle stays out of main chunk
const StoryGenerator = lazy(() => import('./pages/StoryGenerator'));
const StoryList = lazy(() => import('./pages/StoryList'));
const SymbolForge = lazy(() => import('./pages/SymbolForge'));
const SymbolDictionary = lazy(() => import('./pages/SymbolDictionary'));
const TimetablePage = lazy(() => import('./pages/TimetablePage'));
const QBankPage = lazy(() => import('./pages/QBankPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const AnnotationTool = lazy(() => import('./pages/AnnotationTool'));
const RecallArena = lazy(() => import('./pages/RecallArena'));
const ReadingVault = lazy(() => import('./pages/ReadingVault'));
const ConceptChain = lazy(() => import('./pages/ConceptChain'));
const TechnocraticDashboard = lazy(() => import('./pages/TechnocraticDashboard'));
const XuebaCodex = lazy(() => import('./pages/XuebaCodex'));
const AbbreviationTool = lazy(() => import('./pages/AbbreviationTool'));
const Desktop = lazy(() => import('./pages/Desktop'));
const XuebaChat = lazy(() => import('./pages/XuebaChat'));

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Protected routes with AppShell */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/palaces"
            element={
              <AuthGuard>
                <AppShell>
                  <PalaceList />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/palaces/build"
            element={
              <AuthGuard>
                <AppShell>
                  <PalaceBuilder />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/palaces/3d"
            element={
              <AuthGuard>
                <Palace3DView />
              </AuthGuard>
            }
          />
          <Route
            path="/palaces/:id/walk"
            element={
              <AuthGuard>
                <PalaceWalkthrough />
              </AuthGuard>
            }
          />
          <Route
            path="/stories"
            element={
              <AuthGuard>
                <AppShell>
                  <StoryList />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/stories/generate"
            element={
              <AuthGuard>
                <AppShell>
                  <StoryGenerator />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/symbols"
            element={
              <AuthGuard>
                <AppShell>
                  <SymbolDictionary />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/symbols/forge"
            element={
              <AuthGuard>
                <AppShell>
                  <SymbolForge />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/timetable"
            element={
              <AuthGuard>
                <AppShell>
                  <TimetablePage />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/qbank"
            element={
              <AuthGuard>
                <AppShell>
                  <QBankPage />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/analytics"
            element={
              <AuthGuard>
                <AppShell>
                  <AnalyticsPage />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthGuard>
                <AppShell>
                  <SettingsPage />
                </AppShell>
              </AuthGuard>
            }
          />

          {/* NEW: Advanced features */}
          <Route
            path="/annotation"
            element={
              <AuthGuard>
                <AppShell>
                  <AnnotationTool />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/recall"
            element={
              <AuthGuard>
                <AppShell>
                  <RecallArena />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/reading-vault"
            element={
              <AuthGuard>
                <AppShell>
                  <ReadingVault />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/concept-chain"
            element={
              <AuthGuard>
                <AppShell>
                  <ConceptChain />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/technocratic"
            element={
              <AuthGuard>
                <AppShell>
                  <TechnocraticDashboard />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/codex"
            element={
              <AuthGuard>
                <AppShell>
                  <XuebaCodex />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/abbreviations"
            element={
              <AuthGuard>
                <AppShell>
                  <AbbreviationTool />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/chat"
            element={
              <AuthGuard>
                <AppShell>
                  <XuebaChat />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/desktop"
            element={
              <AuthGuard>
                <Desktop />
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

export default function App() {
  return <AnimatedRoutes />;
}
