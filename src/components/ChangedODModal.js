import React from 'react';

function ChangedODModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 3000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '400px'
      }}>
        <h2 style={{ marginBottom: '12px', color: '#dc3545' }}>Origin/Destination Changed</h2>
        <p>It looks like your origin or destination has changed since your last search.
        Please find a route for this trip before comparing.</p>
        <button
          onClick={onClose}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export default ChangedODModal;