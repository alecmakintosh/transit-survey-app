import React from 'react';

function TravelModeModal({ isOpen, onClose, onModeSelect }) {
  if (!isOpen) return null;

  const travelModes = [
    { id: 'transit', label: 'Transit (bus, subway, etc.)', icon: 'fas fa-bus' },
    { id: 'vehicle', label: 'Private motor vehicle (car, motorcycle, etc.)', icon: 'fas fa-car' },
    { id: 'other', label: 'Other (walking, cycling, scootering, etc.)', icon: 'fas fa-walking' },
    { id: 'none', label: "I don't usually make this trip", icon: 'fas fa-question' }
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255,255,255,0.95)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '32px',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        border: '1px solid #e1e5e9'
      }}>
        <h2 style={{
          margin: '0 0 24px 0',
          fontSize: '24px',
          fontWeight: '600',
          color: '#2c3e50',
          textAlign: 'center'
        }}>
          How do you usually make this trip?
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {travelModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              style={{
                padding: '16px 20px',
                backgroundColor: '#f8f9fa',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                color: '#495057',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              onMouseOver={e => {
                e.target.style.backgroundColor = '#e9ecef';
                e.target.style.borderColor = '#007bff';
              }}
              onMouseOut={e => {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#e1e5e9';
              }}
            >
              <i className={mode.icon} style={{ fontSize: '20px', color: '#6c757d', width: '24px' }}></i>
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TravelModeModal;