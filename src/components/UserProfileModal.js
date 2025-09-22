import React, { useState } from 'react';

function UserProfileModal({ isOpen, onClose, onSubmit }) {
  const [hasVehicle, setHasVehicle] = useState(null);
  const [isRegularTransitUser, setIsRegularTransitUser] = useState(null);

  const handleSubmit = () => {
    if (hasVehicle !== null && isRegularTransitUser !== null) {
      onSubmit({ hasVehicle, isRegularTransitUser });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 3000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '32px',
        borderRadius: '12px',
        width: '500px',
        maxWidth: '90vw',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '600', color: '#2c3e50' }}>
          Welcome to the Future Toronto Transit Mapper!
        </h2>
        <p style={{ marginBottom: '24px', color: '#6c757d', lineHeight: '1.5' }}>
          These questions help me design your user experience and understand how different types of travelers use transit services.
        </p>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
            Do you own or have regular access to a motor vehicle (car, motorcycle)?
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setHasVehicle(true)}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: hasVehicle === true ? '#007bff' : '#f8f9fa',
                color: hasVehicle === true ? 'white' : '#495057',
                border: '2px solid ' + (hasVehicle === true ? '#007bff' : '#e1e5e9'),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Yes
            </button>
            <button
              onClick={() => setHasVehicle(false)}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: hasVehicle === false ? '#007bff' : '#f8f9fa',
                color: hasVehicle === false ? 'white' : '#495057',
                border: '2px solid ' + (hasVehicle === false ? '#007bff' : '#e1e5e9'),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              No
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
            Would you classify yourself as a regular transit user?
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6c757d' }}>
            (more than 2 trips on transit per week)
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setIsRegularTransitUser(true)}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: isRegularTransitUser === true ? '#007bff' : '#f8f9fa',
                color: isRegularTransitUser === true ? 'white' : '#495057',
                border: '2px solid ' + (isRegularTransitUser === true ? '#007bff' : '#e1e5e9'),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Yes
            </button>
            <button
              onClick={() => setIsRegularTransitUser(false)}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: isRegularTransitUser === false ? '#007bff' : '#f8f9fa',
                color: isRegularTransitUser === false ? 'white' : '#495057',
                border: '2px solid ' + (isRegularTransitUser === false ? '#007bff' : '#e1e5e9'),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              No
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={hasVehicle === null || isRegularTransitUser === null}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: (hasVehicle !== null && isRegularTransitUser !== null) ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: (hasVehicle !== null && isRegularTransitUser !== null) ? 'pointer' : 'not-allowed'
          }}
        >
          Continue to Transit Mapper
        </button>
      </div>
    </div>
  );
}

export default UserProfileModal;