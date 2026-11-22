import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ReferralProvider } from './context/ReferralContext';
import { SiteProvider } from './context/SiteContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <AuthProvider>
          <ReferralProvider>
            <App />
            <Toaster position="top-center" toastOptions={{ className: '!rounded-xl !text-sm', duration: 3500 }} />
          </ReferralProvider>
        </AuthProvider>
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>
);
