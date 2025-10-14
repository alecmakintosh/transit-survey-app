import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import MapSurveyPage from './pages/MapSurveyPage';
import ExitSurveyForm from './pages/ExitSurveyPage';
import PrivacyPage from './pages/PrivacyPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<MapSurveyPage />} />
        <Route path="/exit" element={<ExitSurveyForm />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
