import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/survey');
  };

  return (
    <div style={{
      fontFamily: 'sans-serif',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#f0f4f8',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <h1>Future Transit Mapper</h1>
      <p style={{ maxWidth: '600px', margin: '0 auto 1rem auto' }}>
        Hi! This website allows you to see how new light rail and subway
        projects may affect your daily travel. Try entering some common trips you take, and see how
        how your options change!
      </p>

      <p style={{ maxWidth: '600px', margin: '0 auto 2rem auto' }}>
        This website is actually a tool that I (Alec Mak, transportation consultant) use to understand how people travel 
        around the GTHA. When using the website, the trips you input will be saved anonmyously and used to improve 
        transportation in the Toronto area. Would you be willing to help us further by completing a short exit survey 
        about your travel habits?
      </p>

      <button
        onClick={handleStart}
        style={{
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          backgroundColor: '#007BFF',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        Try It Now
      </button>
    </div>
  );
};

export default LandingPage;