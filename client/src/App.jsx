import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { useAuth } from './auth.jsx';
import { useIsMobile } from './hooks/useIsMobile';
import { useOnlineStatus } from './hooks/useOnlineStatus.js';
import { WifiOff } from 'lucide-react';
import Navbar from './components/Navbar.jsx';
import MobileNav from './components/MobileNav.jsx';
import Header from './components/Header.jsx';
import Login from './pages/Login.jsx';
import Landing from './pages/Landing.jsx';
import OutingBanner from './components/OutingBanner.jsx';
import { resumeOuting } from './lib/outing.js';

// Chargement différé des pages lourdes / secondaires (réduit le bundle initial :
// Leaflet et Recharts ne sont chargés qu'au besoin).
const MapPage       = lazy(() => import('./pages/Map.jsx'));
const Spots         = lazy(() => import('./pages/Spots.jsx'));
const Finds         = lazy(() => import('./pages/Finds.jsx'));
const Dashboard     = lazy(() => import('./pages/Dashboard.jsx'));
const SharedSpot    = lazy(() => import('./pages/SharedSpot.jsx'));
const Shares        = lazy(() => import('./pages/Shares.jsx'));
const Profile       = lazy(() => import('./pages/Profile.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword.jsx'));
const VerifyEmail    = lazy(() => import('./pages/VerifyEmail.jsx'));
const Sortie         = lazy(() => import('./pages/Sortie.jsx'));
const Follow         = lazy(() => import('./pages/Follow.jsx'));

function Loader() {
  return <div className="container-page text-sm text-neutral-500">Chargement…</div>;
}

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

// Accueil : l'app (carte) si connecté, sinon la landing page publique.
function Home() {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  return user ? <MapPage /> : <Landing />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const location = useLocation();
  const online = useOnlineStatus();

  const path = location.pathname;
  const PUBLIC_PREFIXES = ['/login', '/shared/', '/suivi/', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe', '/verifier-email'];
  const isPublicPage = PUBLIC_PREFIXES.some(p => path === p || path.startsWith(p));
  const isLanding = path === '/' && !user;
  const showAppNav = user && !isPublicPage && !isLanding;

  // Reprend une sortie en cours (rechargement de page, retour dans l'appli, connexion).
  useEffect(() => { if (user) resumeOuting(); }, [user?.id]);

  return (
    <>
      <ScrollToTop />

      {isMobile && showAppNav && <Header />}
      {!isMobile && showAppNav && <Navbar />}

      {showAppNav && <OutingBanner />}

      {!online && showAppNav && (
        <div role="status" className="flex items-center justify-center gap-2 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white">
          <WifiOff className="h-3.5 w-3.5" />
          Hors-ligne : cartes téléchargées et dernières données consultées
        </div>
      )}

      <main className={showAppNav && isMobile ? 'pb-24' : ''}>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
            <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
            <Route path="/verifier-email" element={<VerifyEmail />} />
            <Route path="/shared/:token" element={<SharedSpot />} />
            <Route path="/suivi/:token" element={<Follow />} />
            <Route path="/sortie" element={<Private><Sortie /></Private>} />
            <Route path="/" element={<Home />} />
            <Route path="/cueillettes" element={<Private><Finds /></Private>} />
            <Route path="/spots" element={<Private><Spots /></Private>} />
            <Route path="/shares" element={<Private><Shares /></Private>} />
            <Route path="/profile" element={<Private><Profile /></Private>} />
            <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {isMobile && showAppNav && <MobileNav />}
    </>
  );
}
