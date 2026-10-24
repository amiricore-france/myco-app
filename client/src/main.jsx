import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { Toaster } from './components/ui/toaster';
import { ConfirmRoot } from './hooks/useConfirm.jsx';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { registerServiceWorker } from './lib/sw-register.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster />
        <ConfirmRoot />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

registerServiceWorker();
