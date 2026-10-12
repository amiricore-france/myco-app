import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import MapPage from './pages/Map.jsx';
import Spots from './pages/Spots.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SharedSpot from './pages/SharedSpot.jsx';
import Shares from './pages/Shares.jsx';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="container">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/shared/:token" element={<SharedSpot />} />
        <Route path="/" element={<Private><MapPage /></Private>} />
        <Route path="/spots" element={<Private><Spots /></Private>} />
        <Route path="/shares" element={<Private><Shares /></Private>} />
        <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
