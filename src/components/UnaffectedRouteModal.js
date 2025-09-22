import React from 'react';

function UnaffectedRouteModal({ isOpen, onClose }) {
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
        <h2 style={{ marginBottom: '12px', color: '#007bff' }}>Route Unaffected</h2>
        <p>Your chosen route already exists today.
        To compare, please select a route that uses a new transit service.</p>
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
          Okay
        </button>
      </div>
    </div>
  );
}

export default UnaffectedRouteModal;