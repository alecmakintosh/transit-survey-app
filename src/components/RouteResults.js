import React from 'react';
import { hasNewRoute } from '../utils/routeUtils';
import { NEW_ROUTES_CONFIG } from '../config/routeConfig';

const RouteResults = ({
  routeOptions,
  selectedRouteIndex,
  handleRouteSelection,
  formatTime,
  compareMode,
  handleCompareClick,
  currentRouteHasNewTransit,
  getRouteColor,
  legHasNewRoute
}) => {
  if (routeOptions.length === 0) {
    return null;
  }

  return (
    <div style={{ flex: '1 1 auto', minHeight: '200px' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
        Route Options
      </h3>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        paddingBottom: currentRouteHasNewTransit ? '120px' : '80px'
      }}>
        {routeOptions.map((route, index) => {
          const walkingTime = route.legs
            .filter(leg => leg.mode === 'WALK')
            .reduce((total, leg) => total + Math.round(leg.duration / 60), 0);

          const displayLegs = route.legs.filter(leg => {
            if (leg.mode === 'WALK') {
              return leg.duration >= 90;
            }
            return true;
          });

          const transitLegs = route.legs.filter(leg => leg.mode !== 'WALK');
          const transfers = Math.max(0, transitLegs.length - 1);
          const routeHasNewTransit = hasNewRoute(route, NEW_ROUTES_CONFIG);

          return (
            <button
              key={route.id}
              style={{
                padding: '16px',
                backgroundColor: selectedRouteIndex === index ? '#f0f8ff' : '#fff',
                color: '#000',
                border: `2px solid ${selectedRouteIndex === index ? '#007bff' : '#e1e5e9'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                textAlign: 'left',
                transition: 'all 0.2s',
                boxShadow: selectedRouteIndex === index ? '0 2px 6px rgba(0,123,255,0.15)' : '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onClick={() => handleRouteSelection(index)}
            >
              {/* Header with duration and times */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: selectedRouteIndex === index ? '#007bff' : '#28a745'
                }}>
                  {Math.round(route.duration / 60)} min
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#495057',
                  textAlign: 'right'
                }}>
                  <div>{formatTime(route.startTime)}</div>
                  <div style={{ fontSize: '12px', color: '#6c757d' }}>
                    to {formatTime(route.endTime)}
                  </div>
                </div>
              </div>

              {/* Walking time and transfers info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                fontSize: '12px',
                color: '#6c757d'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {walkingTime > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '500' }}>
                      <i className="fas fa-walking" style={{ fontSize: '10px' }}></i>
                      {walkingTime}min walk
                    </span>
                  )}
                  {transfers > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '500' }}>
                      <i className="fas fa-exchange-alt" style={{ fontSize: '10px' }}></i>
                      {transfers} transfer{transfers > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {routeHasNewTransit && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    backgroundColor: '#ffd700',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#000'
                  }}>
                    <img src="/stars.png" alt="New" style={{ width: '12px', height: '12px' }} />
                    NEW
                  </div>
                )}
              </div>

              {/* Route visualization */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexWrap: 'wrap'
              }}>
                {displayLegs.map((leg, legIndex) => (
                  <React.Fragment key={legIndex}>
                    {leg.mode === 'WALK' ? (
                      <div style={{
                        padding: '2px 6px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: '500',
                        color: '#6c757d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        <i className="fas fa-walking" style={{ fontSize: '8px' }}></i>
                        {Math.round(leg.duration / 60)}min
                      </div>
                    ) : (
                      <div style={{
                        padding: '4px 8px',
                        backgroundColor: getRouteColor(leg),
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: '600',
                        border: legHasNewRoute(leg, NEW_ROUTES_CONFIG) ? '2px solid #ffd700' : 'none',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {legHasNewRoute(leg, NEW_ROUTES_CONFIG) && (
                          <img src="/stars.png" alt="New route" style={{
                            position: 'absolute',
                            top: '-3px',
                            right: '-3px',
                            width: '12px',
                            height: '12px'
                          }} />
                        )}
                        {leg.route?.shortName || leg.mode}
                      </div>
                    )}
                    {legIndex < displayLegs.length - 1 && (
                      <i className="fas fa-arrow-right" style={{
                        fontSize: '8px',
                        color: '#6c757d'
                      }}></i>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Car route specific info */}
              {route.mode === 'CAR' && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
                  {route.majorRoads && route.majorRoads.length > 0 && (
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Via:</strong> {route.majorRoads.join(', ')}
                    </div>
                  )}
                  {route.hasTollRoad && (
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      backgroundColor: '#ffc107',
                      color: '#000',
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: '600',
                      marginTop: '4px'
                    }}>
                      TOLL
                    </div>
                  )}
                  {route.delay > 0 && (
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: '600',
                      marginTop: '4px',
                      marginLeft: route.hasTollRoad ? '4px' : '0'
                    }}>
                      +{Math.round(route.delay / 60)}min delay
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Compare button for routes with new transit */}
      {compareMode === 'default' && currentRouteHasNewTransit && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          right: '16px'
        }}>
          <button
            onClick={handleCompareClick}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#ffd700',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(255,215,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <img src="/stars.png" alt="Compare" style={{ width: '16px', height: '16px' }} />
            Compare with Current Transit
          </button>
        </div>
      )}
    </div>
  );
};

export default RouteResults;