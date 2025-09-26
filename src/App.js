import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import MailListPage from './components/MailListPage';
import MailDetailPage from './components/MailDetailPage';
import OnboardingPage from './components/OnboardingPage';
import ConnectPage from './components/ConnectPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Set the default route to redirect to login */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* Login page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Onboarding page */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* The new page that lists all emails */}
        <Route path="/inbox" element={<MailListPage />} />

        {/* The new page that shows a single email's details */}
        <Route path="/email/:emailId" element={<MailDetailPage />} />

        {/* The new page for connecting to a new email account */}
        <Route path="/connect" element={<ConnectPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
