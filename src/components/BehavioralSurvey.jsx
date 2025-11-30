import React, { useState, useEffect } from 'react';

const COLORS = {
  primary: '#0369a1',
  primaryHover: '#075985',
  primaryLight: '#e0f2fe',
  primaryLabel: 'rgba(3, 105, 161, 0.9)',
  
  advance: '#16a34a',
  advanceHover: '#15803d',
  advanceLight: '#dcfce7',
  
  danger: '#be123c',
  dangerLight: '#ffe4e6',
  
  present: '#be123c',
  presentLight: '#ffe4e6',
  presentLabel: 'rgba(190, 18, 60, 0.9)',
  
  warning: '#ca8a04',
  
  textPrimary: '#18181b',
  textSecondary: '#71717a',
  textBold: '#3f3f46',
  textBlack: '#09090b',
  
  bgPrimary: '#ffffff',
  bgSecondary: '#71717a',
  bgTertiary: '#f8f9fa',
  bgPrimaryHover: '#f4f4f5',
  bgSecondaryHover: '#52525b',
  bgTertiaryHover: '#e4e4e7',
  
  border: '#d4d4d8',
  borderHover: '#a1a1aa',
  borderSecondary: '#d4d4d8',
  borderSidebar: '#d4d4d8',
  
  // Specific UI elements
  originMarker: '#16a34a',
  destinationMarker: '#be123c',
  transferMarker: '#ca8a04',
  vehicleIcon: '#71717a',
  comparisonBorder: '#d4d4d8',
  bgToll: '#fef3c7',
  textToll: '#92400e',
  
  //Traffic Condition Colors
  heavyTraffic: '#be123c',
  mediumTraffic: '#f97316',
  lightTraffic: '#f59e0b',
  noTraffic: '#16a34a',
  
  //AutoRoutes
  autoSelected: '#be123c',
  autoHover: '#e11d48',
  autoLight: '#52525b',
  
  // Mode colors
  WALK: '#16a34a',
  BUS: '#18181b',
  SUBWAY: '#18181b',
  TRAM: '#18181b',
  RAIL: '#7c3aed',
  FERRY: '#0891b2'
};

const BehavioralSurvey = ({ 
  currentRoute, 
  futureRoute, 
  onComplete,
  onClose,
  onContinueComparing,  
  onExploreNewTrip,
  hasMultipleCurrentRoutes = true      

}) => {
  const initialStep = hasMultipleCurrentRoutes ? 0 : 1;
  const [step, setStep] = useState(initialStep);
  const [showThankYou, setShowThankYou] = useState(false);
  const [startTime] = useState(Date.now());
  const [responses, setResponses] = useState({
    is_preferred_route: null,  // ADD THIS
    route_preference: null,
    decision_factors: [],
    decision_factors_other: '',
    trip_frequency: null
  });

  // Track which factors are selected
  const [selectedFactors, setSelectedFactors] = useState(new Set());
  const [showOtherInput, setShowOtherInput] = useState(false);

  const decisionFactorOptions = [
    { value: 'travel_time', label: 'Total travel time', icon: 'fas fa-clock' },
    { value: 'transfers', label: 'Number of transfers', icon: 'fas fa-exchange-alt' },
    { value: 'walking_distance', label: 'Walking distance', icon: 'fas fa-walking' },
    { value: 'transit_mode', label: 'Type of transit (subway, bus, LRT)', icon: 'fas fa-subway' },
    { value: 'reliability', label: 'Reliability/consistency', icon: 'fas fa-check-circle' },
    { value: 'comfort', label: 'Comfort/crowding', icon: 'fas fa-couch' },
    { value: 'cost', label: 'Cost', icon: 'fas fa-dollar-sign' },
    { value: 'other', label: 'Other', icon: 'fas fa-ellipsis-h' }
  ];

  const handleRoutePreference = (preference) => {
    setResponses(prev => ({ ...prev, route_preference: preference }));
    setStep(2);
  };

  const toggleFactor = (factor) => {
    const newSelectedFactors = new Set(selectedFactors);
    
    if (newSelectedFactors.has(factor)) {
      newSelectedFactors.delete(factor);
      if (factor === 'other') {
        setShowOtherInput(false);
        setResponses(prev => ({ ...prev, decision_factors_other: '' }));
      }
    } else {
      newSelectedFactors.add(factor);
      if (factor === 'other') {
        setShowOtherInput(true);
      }
    }
    
    setSelectedFactors(newSelectedFactors);
    setResponses(prev => ({
      ...prev,
      decision_factors: Array.from(newSelectedFactors)
    }));
  };

  const handleSubmit = () => {
    const responseDuration = Math.round((Date.now() - startTime) / 1000);
    
    // Save responses but don't close modal yet
    onComplete({
      ...responses,
      response_duration_seconds: responseDuration
    });
    
    // Show thank you screen
    setShowThankYou(true);
    setStep(4);
  };

  const canProceedFromStep2 = selectedFactors.size > 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#6c757d',
            padding: '5px',
            lineHeight: 1
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Progress indicator */}
        <div style={{
          padding: '20px 30px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
            paddingRight: '40px'  // Space for close button
          }}>
            {hasMultipleCurrentRoutes && (
              <>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: step >= 0 ? COLORS.primary : COLORS.border,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>0</div>
                <div style={{
                  flex: 1,
                  height: '3px',
                  backgroundColor: step >= 1 ? COLORS.primary : COLORS.border
                }}></div>
              </>
            )}
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: step >= 1 ? COLORS.primary : '#e9ecef',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>1</div>
            <div style={{
              flex: 1,
              height: '3px',
              backgroundColor: step >= 2 ? COLORS.primary : '#e9ecef'
            }}></div>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: step >= 2 ? COLORS.primary : '#e9ecef',
              color: step >= 2 ? 'white' : '#6c757d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>2</div>
            <div style={{
              flex: 1,
              height: '3px',
              backgroundColor: step >= 3 ? COLORS.primary : '#e9ecef'
            }}></div>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: step >= 3 ? COLORS.primary : '#e9ecef',
              color: step >= 3 ? 'white' : '#6c757d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>3</div>
            <div style={{
              flex: 1,
              height: '3px',
              backgroundColor: step >= 4 ? COLORS.primary : COLORS.border
            }}></div>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: step >= 4 ? COLORS.primary : COLORS.border,
              color: step >= 4 ? 'white' : COLORS.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>✓</div>
          </div>
        </div>

        <div style={{ padding: '30px' }}>
          {/* Step 0: Route Preference Verification */}
          {step === 0 && hasMultipleCurrentRoutes && (
            <div>
              <h3 style={{
                marginTop: 0,
                marginBottom: '10px',
                color: COLORS.primary,
                fontSize: '24px'
              }}>
                Before we begin...
              </h3>
              
              <p style={{
                color: COLORS.textSecondary,
                marginBottom: '10px',
                fontSize: '16px',
                lineHeight: '1.5'
              }}>
                Of all the route options available, is the <strong>current route</strong> you selected 
                your preferred route for this trip?
              </p>
              
              <p style={{
                fontSize: '13px',
                color: COLORS.textSecondary,
                fontWeight: '400',
                marginTop: '4px',
                marginBottom: '25px'
              }}>
                This helps us understand which route you'd normally choose for this trip.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {[
                  { value: 'yes', label: 'Yes', description: 'This is my preferred route' },
                  { value: 'no', label: 'No', description: "I'd prefer a different route" },
                  { value: 'unsure', label: 'Unsure / Just Exploring', description: 'Not sure yet' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setResponses(prev => ({ ...prev, is_preferred_route: option.value }));
                      
                      // Close modal if user selects "No", otherwise continue to Step 1
                      if (option.value === 'no') {
                        onClose();
                      } else {
                        setStep(1);
                      }
                    }}
                    style={{
                      padding: '16px 20px',
                      border: `2px solid ${COLORS.border}`,
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                    /*
                    onMouseOver={e => {
                      e.target.style.backgroundColor = COLORS.bgPrimaryHover;
                      e.target.style.borderColor = COLORS.primary;
                    }}
                    onMouseOut={e => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = COLORS.border;
                    }}
                    */
                  >
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: COLORS.textPrimary,
                      pointerEvents: 'none'  // ADD THIS!
                    }}>
                      {option.label}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: COLORS.textSecondary,
                      pointerEvents: 'none'  // ADD THIS!
                    }}>
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Step 1: Route Preference */}
          {step === 1 && (
            <div>
              <h3 style={{
                marginTop: 0,
                marginBottom: '20px',
                color: COLORS.primary,
                fontSize: '24px'
              }}>
                Which route would you choose?
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <RouteOptionCard
                  title="Future Transit Network (with new LRT lines)"
                  route={futureRoute}
                  selected={responses.route_preference === 'future'}
                  onClick={() => handleRoutePreference('future')}
                  accentColor="#475569"
                  isNew={true}
                />

                <RouteOptionCard
                  title="Current Transit Network"
                  route={currentRoute}
                  selected={responses.route_preference === 'current'}
                  onClick={() => handleRoutePreference('current')}
                  accentColor="#475569"
                />
                
                <button
                  onClick={() => handleRoutePreference('no_preference')}
                  style={{
                    padding: '15px 20px',
                    border: responses.route_preference === 'no_preference' 
                      ? `3px solid ${COLORS.primary}` 
                      : '2px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: responses.route_preference === 'no_preference' 
                      ? '#f8f9fa' 
                      : 'white',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '500',
                    color: '#495057',
                    transition: 'all 0.2s'
                  }}
                >
                  No preference
                </button>
              </div>
                            <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '30px'
              }}>
                <button
                  onClick={() => {
                    // Go back to Step 0 if it was shown, otherwise close modal
                    if (hasMultipleCurrentRoutes) {
                      setStep(0);
                    } else {
                      onClose();
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    border: `2px solid ${COLORS.border}`,
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: COLORS.textPrimary,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => {
                    e.target.style.backgroundColor = COLORS.bgPrimaryHover;
                    e.target.style.borderColor = COLORS.borderHover;
                  }}
                  onMouseOut={e => {
                    e.target.style.backgroundColor = 'white';
                    e.target.style.borderColor = COLORS.border;
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Decision Factors */}
          {step === 2 && (
            <div>
              <h3 style={{
                marginTop: 0,
                marginBottom: '10px',
                color: COLORS.primary,
                fontSize: '24px'
              }}>
                What influenced your choice?
              </h3>
              <p style={{
                color: '#6c757d',
                marginBottom: '25px',
                fontSize: '14px'
              }}>
                Select all that apply
              </p>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '12px',
                marginBottom: '20px'
              }}>
                {decisionFactorOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => toggleFactor(option.value)}
                    style={{
                      padding: '12px 16px',
                      border: selectedFactors.has(option.value) 
                        ? `2px solid ${COLORS.primary}` 
                        : '2px solid #dee2e6',
                      borderRadius: '8px',
                      backgroundColor: selectedFactors.has(option.value) 
                        ? '#e8f4f8' 
                        : 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#495057',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      boxSizing: 'border-box',  // ADD THIS
                      minHeight: '48px'          // ADD THIS
                    }}
                  >
                    <i className={option.icon} style={{
                      color: selectedFactors.has(option.value) ? COLORS.primary : '#6c757d',
                      fontSize: '16px',
                      minWidth: '16px'
                    }}></i>
                    {option.label}
                  </button>
                ))}
              </div>

              {showOtherInput && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: '#495057',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    Please specify:
                  </label>
                  <input
                    type="text"
                    value={responses.decision_factors_other}
                    onChange={(e) => setResponses(prev => ({
                      ...prev,
                      decision_factors_other: e.target.value
                    }))}
                    placeholder="What other factors influenced your choice?"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #dee2e6',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontFamily: 'inherit'
                    }}
                    maxLength={500}
                  />
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setStep(1)}
                  style={{
                    padding: '10px 20px',
                    border: '2px solid #dee2e6',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedFromStep2}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: canProceedFromStep2 ? COLORS.primary : '#dee2e6',
                    color: 'white',
                    cursor: canProceedFromStep2 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Likelihood to Use Future Route */}
          {step === 3 && (
            <div>
              <h3 style={{
                marginTop: 0,
                marginBottom: '10px',
                color: COLORS.primary,
                fontSize: '24px'
              }}>
                One last question
              </h3>
              <p style={{
                color: '#6c757d',
                marginBottom: '25px',
                fontSize: '14px'
              }}>
                How often do you make this trip?
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginBottom: '30px'
              }}>
                {[
                  { value: 'daily', label: 'Daily', icon: 'fas fa-calendar-day' },
                  { value: 'multiple_weekly', label: 'More than 2 times a week', icon: 'fas fa-calendar-week' },
                  { value: 'weekly', label: 'At least once a week', icon: 'fas fa-calendar-alt' },
                  { value: 'multiple_monthly', label: 'More than once a month', icon: 'fas fa-calendar' },
                  { value: 'less_than_monthly', label: 'Less than once a month', icon: 'fas fa-calendar-minus' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setResponses(prev => ({
                      ...prev,
                      likelihood_use_future: option.value
                    }))}
                    style={{
                      padding: '15px 20px',
                      border: responses.likelihood_use_future === option.value 
                        ? `2px solid ${option.color}` 
                        : '2px solid #dee2e6',
                      borderRadius: '8px',
                      backgroundColor: responses.likelihood_use_future === option.value 
                        ? `${option.color}15` 
                        : 'white',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '500',
                      color: '#495057',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      minHeight: '56px'  // ADD THIS to prevent resizing
                    }}
                  >
                    <span>{option.label}</span>
                    {responses.likelihood_use_future === option.value && (
                      <i className="fas fa-check-circle" style={{ color: option.color }}></i>
                    )}
                  </button>
                ))}
              </div>

              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setStep(2)}
                  style={{
                    padding: '10px 20px',
                    border: '2px solid #dee2e6',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#495057'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={responses.likelihood_use_future === null}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: responses.likelihood_use_future !== null ? COLORS.advance : '#dee2e6',
                    color: 'white',
                    cursor: responses.likelihood_use_future !== null ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Thank You Screen */}
          {step === 4 && showThankYou && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                marginBottom: '30px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: COLORS.advanceLight,
                  margin: '0 auto 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className="fas fa-check-circle" style={{
                    fontSize: '40px',
                    color: COLORS.advance
                  }}></i>
                </div>
                
                <h3 style={{
                  marginTop: 0,
                  marginBottom: '10px',
                  color: COLORS.textPrimary,
                  fontSize: '28px',
                  fontWeight: '700'
                }}>
                  Thank You!
                </h3>
                
                <p style={{
                  color: COLORS.textSecondary,
                  fontSize: '16px',
                  lineHeight: '1.6',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}>
                  Your feedback helps us understand how new transit infrastructure affects travel choices in Toronto.
                </p>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <button
                  onClick={onContinueComparing}
                  style={{
                    padding: '14px 24px',
                    backgroundColor: COLORS.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.primaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.primary}
                >
                  <i className="fas fa-map-marked-alt"></i>
                  Continue Comparing This Trip
                </button>

                <button
                  onClick={onExploreNewTrip}
                  style={{
                    padding: '14px 24px',
                    backgroundColor: COLORS.advance,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.advanceHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.advance}
                >
                  <i className="fas fa-route"></i>
                  Explore New Trip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper component for route option cards
const RouteOptionCard = ({ title, route, selected, onClick, accentColor, isNew }) => {
  if (!route) return null;

  const totalDuration = Math.round(route.duration / 60);
  const transitLegs = route.legs.filter(leg => leg.mode !== 'WALK');
  const transfers = transitLegs.length > 1 ? transitLegs.length - 1 : 0;
  const walkingDistance = route.legs
    .filter(leg => leg.mode === 'WALK')
    .reduce((sum, leg) => sum + (leg.distance || 0), 0);

  return (
    <button
      onClick={onClick}
      style={{
        padding: '20px',
        border: selected ? `3px solid ${accentColor}` : '2px solid #dee2e6',
        borderRadius: '8px',
        backgroundColor: selected ? '#f8f9fa' : 'white',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        position: 'relative'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '15px'
      }}>
        <div>
          <h4 style={{
            margin: 0,
            color: accentColor,
            fontSize: '16px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {title}
            {isNew && (
              <img 
                src="/stars.png" 
                alt="New" 
                style={{ width: '16px', height: '16px' }}
              />
            )}
          </h4>
        </div>
        {selected && (
          <i className="fas fa-check-circle" style={{
            color: accentColor,
            fontSize: '20px'
          }}></i>
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-clock" style={{ color: '#6c757d', fontSize: '14px' }}></i>
          <span style={{ fontSize: '14px', color: '#495057', fontWeight: '500' }}>
            {totalDuration} min
          </span>
        </div>

        {transfers > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-exchange-alt" style={{ color: '#6c757d', fontSize: '14px' }}></i>
            <span style={{ fontSize: '14px', color: '#495057', fontWeight: '500' }}>
              {transfers} transfer{transfers !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {walkingDistance > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-walking" style={{ color: '#6c757d', fontSize: '14px' }}></i>
            <span style={{ fontSize: '14px', color: '#495057', fontWeight: '500' }}>
              {Math.round(walkingDistance)}m walk
            </span>
          </div>
        )}
      </div>

      {/* Route pills preview */}
      <div style={{
        marginTop: '12px',
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap'
      }}>
        {transitLegs.map((leg, idx) => {
          const legColor = leg.route?.color ? `#${leg.route.color}` : '#000';
          const textColor = leg.route?.textColor ? `#${leg.route.textColor}` : '#fff';
          
          return (
            <div
              key={idx}
              style={{
                backgroundColor: legColor,
                color: textColor,
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {leg.route?.shortName || leg.mode}
            </div>
          );
        })}
      </div>
    </button>
  );
};

export default BehavioralSurvey;