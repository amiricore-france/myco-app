import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './auth.jsx';
import { useIsMobile } from './hooks/useIsMobile';
import Navbar from './components/Navbar.jsx';
import MobileNav from './components/MobileNav.jsx';
import Header from './components/Header.jsx';
import Login from './pages/Login.jsx';
import MapPage from './pages/Map.jsx';
import Spots from './pages/Spots.jsx';
import Finds from './pages/Finds.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SharedSpot from './pages/SharedSpot.jsx';
import Shares from './pages/Shares.jsx';
import Profile from './pages/Profile.jsx';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container-page">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container-page">Chargement…</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
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

  const isAuthPage = location.pathname === '/login';
  const isSharedPage = location.pathname.startsWith('/shared/');
  const showAppNav = user && !isAuthPage && !isSharedPage;

  return (
    <>
      <ScrollToTop />

      {isMobile && showAppNav && <Header />}
      {!isMobile && showAppNav && <Navbar />}

      <main className={showAppNav && isMobile ? 'pb-24' : ''}>
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/shared/:token" element={<SharedSpot />} />
          <Route path="/" element={<Private><MapPage /></Private>} />
          <Route path="/cueillettes" element={<Private><Finds /></Private>} />
          <Route path="/spots" element={<Private><Spots /></Private>} />
          <Route path="/shares" element={<Private><Shares /></Private>} />
          <Route path="/profile" element={<Private><Profile /></Private>} />
          <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {isMobile && showAppNav && <MobileNav />}
    </>
  );
}
