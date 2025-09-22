import React from 'react';

function NoRoutesFoundModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '32px',
        borderRadius: '12px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#dc3545' }}>
          No Routes Found
        </h2>
        <p style={{ marginBottom: '20px', color: '#6c757d', lineHeight: '1.5' }}>
          We couldn't find any transit routes for this trip. This might be because:
        </p>
        <ul style={{ marginBottom: '24px', color: '#6c757d', paddingLeft: '20px' }}>
          <li>The locations are too far apart for transit service</li>
          <li>No transit service is available at the selected time</li>
          <li>The locations are not well-connected by public transit</li>
        </ul>
        <p style={{ marginBottom: '24px', color: '#495057', fontWeight: '500' }}>
          Try adjusting your departure time, day type, or choose different locations.
        </p>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Okay
        </button>
      </div>
    </div>
  );
}

export default NoRoutesFoundModal;