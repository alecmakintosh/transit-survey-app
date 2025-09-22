import React from 'react';

const TripPlannerForm = ({
  origin,
  setOrigin,
  destination,
  setDestination,
  inputMode,
  setInputMode,
  mapMode,
  setMapMode,
  departureTime,
  setDepartureTime,
  arriveBy,
  setArriveBy,
  dayType,
  setDayType,
  readyToCalculate,
  isCalculating,
  handleCalculateRoute,
  originCoords,
  destinationCoords,
  setOriginCoords,
  setDestinationCoords
}) => {
  const buttonStyle = {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
    width: '100%',
    marginBottom: '8px'
  };

  const handleSwapLocations = () => {
    const tempOrigin = origin;
    const tempOriginCoords = originCoords;
    setOrigin(destination);
    setDestination(tempOrigin);
    setOriginCoords(destinationCoords);
    setDestinationCoords(tempOriginCoords);
  };

  return (
    <div style={{
      width: '320px',
      backgroundColor: '#fff',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: 'relative',
      zIndex: 1000
    }}>
      {/* Input Method Toggle */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <button
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: inputMode === 'text' ? '#007bff' : '#f8f9fa',
              color: inputMode === 'text' ? 'white' : '#495057',
              border: 'none',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            onClick={() => setInputMode('text')}
          >
            Type Address
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: inputMode === 'map' ? '#007bff' : '#f8f9fa',
              color: inputMode === 'map' ? 'white' : '#495057',
              border: 'none',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            onClick={() => setInputMode('map')}
          >
            Click on Map
          </button>
        </div>
      </div>

      {/* Address Input Container */}
      <div style={{
        border: '2px solid #e1e5e9',
        borderRadius: '6px',
        backgroundColor: '#fff',
        overflow: 'hidden',
        marginBottom: '12px',
        position: 'relative'
      }}>
        {/* Origin input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #e1e5e9'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#28a745',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            marginRight: '10px',
            flexShrink: 0
          }}>A</div>
          <input
            type="text"
            value={origin}
            onChange={e => setOrigin(e.target.value)}
            placeholder="Enter starting address..."
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              width: '100%',
              backgroundColor: 'transparent'
            }}
            readOnly={inputMode === 'map'}
          />
        </div>

        {/* Swap button */}
        <button
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%) rotate(90deg)',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#6c757d'
          }}
          onClick={handleSwapLocations}
          title="Swap origin and destination"
        >
          ⇄
        </button>

        {/* Destination input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#dc3545',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            marginRight: '10px',
            flexShrink: 0
          }}>B</div>
          <input
            type="text"
            value={destination}
            onChange={e => setDestination(e.target.value)}
            placeholder="Enter destination address..."
            style={{
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              width: '100%',
              backgroundColor: 'transparent'
            }}
            readOnly={inputMode === 'map'}
          />
        </div>
      </div>

      {/* Map interaction controls - only show when Click on Map is selected */}
      {inputMode === 'map' && (
        <div style={{ marginBottom: '12px' }}>
          <p style={{ fontSize: '12px', color: '#6c757d', margin: '0 0 8px 0' }}>
            Click the buttons below, then click on the map to set locations:
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              style={{
                flex: 1,
                padding: '6px 8px',
                backgroundColor: mapMode === 'setOrigin' ? '#28a745' : '#f8f9fa',
                color: mapMode === 'setOrigin' ? 'white' : '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              onClick={() => setMapMode(mapMode === 'setOrigin' ? 'none' : 'setOrigin')}
            >
              {mapMode === 'setOrigin' ? '✓ ' : ''}Set Origin (A)
            </button>
            <button
              style={{
                flex: 1,
                padding: '6px 8px',
                backgroundColor: mapMode === 'setDestination' ? '#dc3545' : '#f8f9fa',
                color: mapMode === 'setDestination' ? 'white' : '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              onClick={() => setMapMode(mapMode === 'setDestination' ? 'none' : 'setDestination')}
            >
              {mapMode === 'setDestination' ? '✓ ' : ''}Set Destination (B)
            </button>
          </div>
        </div>
      )}

      {/* Time and Date Controls */}
      <div style={{
        border: '1px solid #e1e5e9',
        borderRadius: '4px',
        padding: '8px',
        marginBottom: '12px',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <input
                type="radio"
                checked={!arriveBy}
                onChange={() => setArriveBy(false)}
                style={{ marginRight: '4px' }}
              />
              <span style={{ fontSize: '12px', color: '#495057' }}>Leave</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <input
                type="radio"
                checked={arriveBy}
                onChange={() => setArriveBy(true)}
                style={{ marginRight: '4px' }}
              />
              <span style={{ fontSize: '12px', color: '#495057' }}>Arrive</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="time"
              value={departureTime}
              onChange={e => setDepartureTime(e.target.value)}
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '12px'
              }}
            />

            <select
              value={dayType}
              onChange={e => setDayType(e.target.value)}
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '4px 6px',
                fontSize: '12px'
              }}
            >
              <option value="weekday">Weekday</option>
              <option value="weekend">Weekend</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calculate Route Button */}
      <button
        onClick={handleCalculateRoute}
        disabled={!readyToCalculate || isCalculating}
        style={{
          ...buttonStyle,
          backgroundColor: !readyToCalculate || isCalculating ? '#6c757d' : '#007bff',
          cursor: !readyToCalculate || isCalculating ? 'not-allowed' : 'pointer',
          marginBottom: '0'
        }}
        onMouseOver={e => {
          if (readyToCalculate && !isCalculating) {
            e.target.style.backgroundColor = '#0056b3';
          }
        }}
        onMouseOut={e => {
          if (readyToCalculate && !isCalculating) {
            e.target.style.backgroundColor = '#007bff';
          }
        }}
      >
        {isCalculating ? 'Finding Routes...' : 'Find Routes'}
      </button>
    </div>
  );
};

export default TripPlannerForm;