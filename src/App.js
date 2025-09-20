import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import MapSurveyPage from './pages/MapSurveyPage';
import ExitSurveyForm from './pages/ExitSurveyPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<MapSurveyPage />} />
        <Route path="/survey" element={<ExitSurveyForm />} />
      </Routes>
    </Router>
  );
}

export default App;
