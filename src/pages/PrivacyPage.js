import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PrivacyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // Check if we have a referrer from state (internal navigation)
    if (location.state?.from) {
      navigate(location.state.from);
    } 
    // Check if we have a referrer from query params (opened in new tab)
    else {
      const params = new URLSearchParams(location.search);
      const from = params.get('from');
      if (from) {
        window.close(); // Try to close the tab
        // If window.close() doesn't work (tab wasn't opened by script), 
        // redirect instead
        setTimeout(() => {
          window.location.href = from;
        }, 100);
      } else {
        // Default fallback
        navigate('/');
      }
    }
  };

  return (
    <div style={{
      fontFamily: 'sans-serif',
      padding: '2rem',
      backgroundColor: '#fff',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <button
          onClick={handleBack}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            backgroundColor: '#0369a1',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '2rem'
          }}
        >
          ← Back
        </button>

        <h1 style={{ color: '#0369a1', marginBottom: '1rem' }}>
          Privacy Policy for Future Toronto Transit Mapper
        </h1>
        
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            What We Collect
          </h2>
          <ul style={{ lineHeight: '1.8', color: '#333' }}>
            <li>Email address (optional, for follow-up surveys only)</li>
            <li>Transit route searches (origin, destination, time, selected routes)</li>
            <li>Demographic information you choose to provide (age range, vehicle access, etc.)</li>
            <li>Usage data (dates and times you use the service)</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Why We Collect It
          </h2>
          <ul style={{ lineHeight: '1.8', color: '#333' }}>
            <li>To provide route comparison features</li>
            <li>To send you personalized follow-up surveys about your transit usage (if you provided email)</li>
            <li>To improve transit planning through aggregated research</li>
            <li>To analyze how people use current vs. future transit networks</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            How We Use It
          </h2>
          <ul style={{ lineHeight: '1.8', color: '#333' }}>
            <li>Route data is stored anonymously and linked to your session</li>
            <li>If you provide an email, it is linked to your route data to enable follow-up surveys</li>
            <li>Aggregated, anonymized data may be used for research and publications</li>
            <li>We do <strong>NOT</strong> sell your data to third parties</li>
            <li>We do <strong>NOT</strong> share identifiable data without your explicit consent</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            How Long We Keep It
          </h2>
          <ul style={{ lineHeight: '1.8', color: '#333' }}>
            <li>Anonymous route data: retained for research purposes</li>
            <li>Email addresses and linked data: deleted after 24 months of inactivity</li>
            <li>You can request immediate deletion at any time</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Your Rights
          </h2>
          <ul style={{ lineHeight: '1.8', color: '#333' }}>
            <li><strong>Access your data:</strong> email us at futuretorontotransit@gmail.com</li>
            <li><strong>Correct your data:</strong> contact us to update any information</li>
            <li><strong>Delete your data:</strong> email us to request deletion of your information</li>
            <li><strong>Withdraw consent:</strong> stop using the service and request deletion</li>
            <li><strong>File a complaint:</strong> contact the Office of the Privacy Commissioner of Canada</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Security
          </h2>
          <ul style={{ lineHeight: '1.8', color: '#333' }}>
            <li>Data is encrypted in transit and at rest</li>
            <li>Access restricted to authorized personnel only</li>
            <li>Regular security practices followed</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Contact
          </h2>
          <p style={{ lineHeight: '1.8', color: '#333' }}>
            Alec Mak<br/>
            Transportation Consultant<br/>
            Toronto, Ontario<br/>
            Email: <a href="mailto:futuretorontotransit@gmail.com" style={{ color: '#0369a1' }}>
              futuretorontotransit@gmail.com
            </a>
          </p>
        </section>

        <section style={{ 
          marginTop: '3rem', 
          padding: '1.5rem', 
          backgroundColor: '#f0f9ff', 
          borderRadius: '8px',
          border: '1px solid #0369a1'
        }}>
          <p style={{ margin: 0, color: '#333', lineHeight: '1.6' }}>
            <strong>Questions about this policy?</strong> Feel free to reach out at{' '}
            <a href="mailto:futuretorontotransit@gmail.com" style={{ color: '#0369a1' }}>
              futuretorontotransit@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;