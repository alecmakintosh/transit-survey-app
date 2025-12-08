import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleStart = () => {
    navigate('/map');
  };

  const handlePrivacyClick = (e) => {
    e.preventDefault();
    navigate('/privacy', { state: { from: location.pathname } });
  };


  return (
    <div style={{
      fontFamily: 'sans-serif',
      //padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#fff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1>Welcome to the Future Toronto Transit Mapper!</h1>
      <p style={{ maxWidth: '600px', margin: '0 auto 1rem auto' }}>
        Explore if and how the <strong>Eglinton Crosstown LRT </strong> 
         and <strong>Finch West LRT</strong> will affect your daily travel. 
        Search your regular trips and see future route options!
      </p>

      <p style={{ maxWidth: '600px', margin: '0 auto 2rem auto' }}>
        <strong>This is a research tool.</strong> Your route searches and 
        preferences are collected anonymously to improve transit planning. 
        You can optionally provide your email to receive follow-up surveys.
        You will be asked questions throughout the website as part of your usage.
        <br/>
        <a href="/privacy" style={{ color: '#0369a1', fontSize: '12px' }}>
          Privacy Policy
        </a>
      </p>

      <button
        onClick={handleStart}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          backgroundColor: '#0369a1',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
        onMouseOver={e => e.target.style.backgroundColor = '#075985'}
        onMouseOut={e => e.target.style.backgroundColor = '#0369a1'}
      >
        Try It Now
      </button>
    </div>
  );
};

export default LandingPage;