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

  // Helper function to format time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

const BehavioralSurvey = ({ 
  currentRoute, 
  futureRoute, 
  onComplete,
  onClose,
  onContinueComparing,  
  onExploreNewTrip,
  onNoPreference,  // ADD THIS
  hasMultipleCurrentRoutes = true,
  isComparingWithAuto = false      
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

  // Decision factors that change based on whether user selected transit or auto in Step 1
  // WHEN USER SELECTED TRANSIT ROUTE (comparing future transit vs current auto)
  const decisionFactorsTransitSelected = [
    // CUSTOMIZE: Add/remove/modify factors for when user prefers transit over auto
    { value: 'travel_time', label: 'Total travel time', icon: 'fas fa-clock' },
    { value: 'cost_savings', label: 'Cost savings', icon: 'fas fa-dollar-sign' },
    { value: 'avoid_traffic', label: 'Avoiding traffic/parking', icon: 'fas fa-car' },
    { value: 'environmental', label: 'Environmental benefits', icon: 'fas fa-leaf' },
    { value: 'reliability', label: 'Reliability/consistency', icon: 'fas fa-check-circle' },
    { value: 'comfort', label: 'Comfort (can relax/work)', icon: 'fas fa-couch' },
    { value: 'other', label: 'Other', icon: 'fas fa-ellipsis-h' }
  ];

  // WHEN USER SELECTED AUTO ROUTE (comparing current auto vs future transit)
  const decisionFactorsAutoSelected = [
    // CUSTOMIZE: Add/remove/modify factors for when user prefers auto over transit
    { value: 'travel_time', label: 'Total travel time', icon: 'fas fa-clock' },
    { value: 'flexibility', label: 'Flexibility/convenience', icon: 'fas fa-random' },
    { value: 'comfort', label: 'Comfort/privacy', icon: 'fas fa-car' },
    { value: 'safety', label: 'Safety', icon: 'fas fa-lock' },
    { value: 'carrying_items', label: 'Need to carry items', icon: 'fas fa-shopping-bag' },
    { value: 'weather', label: 'Weather protection', icon: 'fas fa-cloud-rain' },
    { value: 'trip_chaining', label: 'Multiple stops needed', icon: 'fas fa-map-marked-alt' },
    { value: 'other', label: 'Other', icon: 'fas fa-ellipsis-h' }
  ];

  // Select which factors to show based on comparison type and user's Step 1 choice
  const getDecisionFactorOptions = () => {
    if (!isComparingWithAuto) {
      // Transit vs Transit comparison - use original factors
      return decisionFactorOptions;
    } else {
      // Transit vs Auto comparison - use appropriate factors based on Step 1 selection
      if (responses.route_preference === 'future') {
        return decisionFactorsTransitSelected;
      } else {
        return decisionFactorsAutoSelected;
      }
    }
  };

  const handleRoutePreference = (preference) => {
    setResponses(prev => ({ ...prev, route_preference: preference }));
    //setStep(2);
  };

  const toggleFactor = (factor) => {
    const newSelectedFactors = new Set(selectedFactors);
    
    if (newSelectedFactors.has(factor)) {
      // Remove factor if already selected
      newSelectedFactors.delete(factor);
      if (factor === 'other') {
        setShowOtherInput(false);
        setResponses(prev => ({ ...prev, decision_factors_other: '' }));
      }
    } else {
      // Add factor only if less than 3 are selected
      if (newSelectedFactors.size < 3) {
        newSelectedFactors.add(factor);
        if (factor === 'other') {
          setShowOtherInput(true);
        }
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

  const canProceedFromStep1 = responses.route_preference !== null;
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
        minHeight: '700px',        // ADD THIS LINE - prevents resize jarring
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        position: 'relative',
        display: 'flex',           // ADD THIS LINE
        flexDirection: 'column'    // ADD THIS LINE
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
              color: step >= 1 ? 'white' : '#6c757d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>1</div>
            <div style={{
              flex: 1,
              height: '3px',
              backgroundColor: step >= 2 ? COLORS.primary : COLORS.border
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
              backgroundColor: step >= 3 ? COLORS.primary : COLORS.border
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
              backgroundColor: step >= 4 ? COLORS.primary : '#e9ecef',
              color: step >= 4 ? 'white' : '#6c757d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>✓</div>
          </div>
        </div>

        <div style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '30px 40px'                  // Adjust padding as needed
         }}>
          {/* Step 0: Route Preference Verification */}
          {step === 0 && hasMultipleCurrentRoutes && (
            <div style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '40px'
            }}>
              {/* Visual Icon */}
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 24px auto',
                borderRadius: '50%',
                backgroundColor: 'rgba(3, 105, 161, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: COLORS.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className="fas fa-check" style={{ 
                    fontSize: '28px', 
                    color: 'white' 
                  }}></i>
                </div>
              </div>

              {/* Title */}
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: '24px', 
                fontWeight: '700', 
                color: COLORS.textBlack,
                textAlign: 'center'
              }}>
                Before we begin...
              </h3>

              {/* Question Text */}
              <p style={{ 
                margin: '0 0 8px 0', 
                fontWeight: '600',
                fontSize: '15px',
                color: COLORS.textBold,
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                Of all the <strong>current</strong> route options available, is the your <strong>preferred current route</strong> for this trip?
              </p>

              {/* Helper Text */}
              <p style={{ 
                margin: '0 0 28px 0',
                fontSize: '13px', 
                color: COLORS.textSecondary,
                fontWeight: '400',
                textAlign: 'center'
              }}>
                This helps us understand which route you'd normally choose for this trip.
              </p>

              {/* ACTION BUTTONS - Horizontal layout matching Affected/Unaffected */}
              <div style={{ display: 'flex', gap: '12px' }}>
                {/* YES - Primary blue (advances) */}
                <button 
                  onClick={() => {
                    setResponses(prev => ({ ...prev, is_preferred_route: 'yes' }));
                    setStep(1);
                  }}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    backgroundColor: COLORS.primary,
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.primaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.primary}
                >
                  Yes
                </button>

                {/* UNSURE - Primary blue (advances) - MIDDLE POSITION */}
                <button 
                  onClick={() => {
                    setResponses(prev => ({ ...prev, is_preferred_route: 'unsure' }));
                    setStep(1);
                  }}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    backgroundColor: COLORS.primary,
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.primaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.primary}
                >
                  Unsure / Just Exploring
                </button>

                {/* NO - Grey (exits/closes) */}
                <button 
                  onClick={() => {
                    setResponses(prev => ({ ...prev, is_preferred_route: 'no' }));
                    onClose();
                    setTimeout(() => {
                      if (onNoPreference) onNoPreference();
                    }, 150);
                  }}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    backgroundColor: COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.bgSecondaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.bgSecondary}
                >
                  No
                </button>
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
                {isComparingWithAuto 
                  ? "Would you take transit or drive?" 
                  : "Which route would you choose?"}
              </h3>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                flex: 1,
                marginBottom: '10px'
              }}>
                {isComparingWithAuto ? (
                  <>
                    {/* Transit Route Card */}
                    <RouteOptionCard
                      title="Future (Transit)"
                      route={futureRoute}
                      selected={responses.route_preference === 'future'}
                      onClick={() => handleRoutePreference('future')}
                      accentColor={COLORS.primary}
                      isNew={true}
                    />

                    {/* Auto Route Card */}
                    <AutoRouteOptionCard
                      title="Current (Driving)"
                      route={currentRoute}
                      selected={responses.route_preference === 'current'}
                      onClick={() => handleRoutePreference('current')}
                      accentColor={COLORS.present}
                    />
                  </>
                ) : (
                  <>
                    <RouteOptionCard
                      title="Future Route"
                      route={futureRoute}
                      selected={responses.route_preference === 'future'}
                      onClick={() => handleRoutePreference('future')}
                      accentColor={COLORS.primary}
                      isNew={true}
                    />

                    <RouteOptionCard
                      title="Current Route"
                      route={currentRoute}
                      selected={responses.route_preference === 'current'}
                      onClick={() => handleRoutePreference('current')}
                      accentColor={COLORS.present}
                    />
                  </>
                )}
                
                <button
                  onClick={() => handleRoutePreference('no_preference')}
                  style={{
                    padding: '16px',
                    border: responses.route_preference === 'no_preference' 
                      ? `2px solid ${COLORS.primary}` 
                      : `2px solid ${COLORS.border}`,
                    borderRadius: '6px',
                    backgroundColor: responses.route_preference === 'no_preference' 
                      ? COLORS.primaryLight 
                      : COLORS.bgPrimary,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    boxShadow: responses.route_preference === 'no_preference' ? '0 2px 6px rgba(0,123,255,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                    width: '100%'
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: responses.route_preference === 'no_preference' ? COLORS.primary : COLORS.textBold
                  }}>
                    No preference
                  </div>
                </button>
              </div>
              <div style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end'
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
                    padding: '12px 24px',
                    backgroundColor: COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.bgSecondaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.bgSecondary}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedFromStep1}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: canProceedFromStep1 ? COLORS.primary : COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: canProceedFromStep1 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: canProceedFromStep1 ? 1 : 0.6,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => {
                    if (canProceedFromStep1) {
                      e.target.style.backgroundColor = COLORS.primaryHover;
                    }
                  }}
                  onMouseOut={e => {
                    if (canProceedFromStep1) {
                      e.target.style.backgroundColor = COLORS.primary;
                    }
                  }}
                >
                  Continue
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
                {isComparingWithAuto 
                  ? (responses.route_preference === 'future'
                      ? "Why would you switch to transit from driving?" 
                      : "Why did you choose driving over transit?")
                  : (responses.route_preference === 'future'
                      ? "Why did you prefer the future transit route?"
                      : "Why did you prefer the current transit route?")}
              </h3>
              <p style={{
                color: '#6c757d',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                <strong>Select up to 3 factors</strong> that were most important in your decision.
              </p>
              
              {selectedFactors.size === 3 && (
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: COLORS.advanceLight,
                  border: `1px solid ${COLORS.advance}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: COLORS.advance,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <i className="fas fa-info-circle"></i>
                  You've selected 3 factors (maximum reached).
                </div>
              )}
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '10px',
                marginBottom: '20px'
              }}>
                {getDecisionFactorOptions().map(option => (
                  <button
                    key={option.value}
                    onClick={() => toggleFactor(option.value)}
                    disabled={!selectedFactors.has(option.value) && selectedFactors.size >= 3}
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
                    padding: '12px 24px',
                    backgroundColor: COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.bgSecondaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.bgSecondary}
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!canProceedFromStep2}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: canProceedFromStep2 ? COLORS.primary : COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: canProceedFromStep2 ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: canProceedFromStep2 ? 1 : 0.6,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => {
                    if (canProceedFromStep2) {
                      e.target.style.backgroundColor = COLORS.primaryHover;
                    }
                  }}
                  onMouseOut={e => {
                    if (canProceedFromStep2) {
                      e.target.style.backgroundColor = COLORS.primary;
                    }
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Frequency of trip */}
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
                marginBottom: '20px'
              }}>
                {[
                  { value: 'daily', label: 'At least daily', icon: 'fas fa-calendar-day' },
                  { value: 'multiple_weekly', label: 'More than 2 times a week', icon: 'fas fa-calendar-week' },
                  { value: 'weekly', label: 'At least once a week', icon: 'fas fa-calendar-alt' },
                  { value: 'multiple_monthly', label: 'At least once a month', icon: 'fas fa-calendar' },
                  { value: 'less_than_monthly', label: 'Less than once a month', icon: 'fas fa-calendar-minus' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setResponses(prev => ({
                      ...prev,
                      trip_frequency: option.value
                    }))}
                    style={{
                      padding: '14px 16px',
                      border: responses.trip_frequency === option.value 
                        ? `2px solid ${COLORS.primary}` 
                        : '2px solid #dee2e6',
                      borderRadius: '8px',
                      backgroundColor: responses.trip_frequency === option.value 
                        ? COLORS.primaryLight 
                        : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      outline: 'none'
                    }}
                    /*
                    onMouseOver={e => {
                      if (responses.trip_frequency !== option.value) {
                        e.target.style.backgroundColor = '#f8f9fa';
                      }
                    }}
                    onMouseOut={e => {
                      if (responses.trip_frequency !== option.value) {
                        e.target.style.backgroundColor = 'white';
                      }
                    }}
                    */
                  >
                    <i 
                      className={option.icon} 
                      style={{ 
                        color: responses.trip_frequency === option.value ? COLORS.primary : '#6c757d',
                        fontSize: '18px',
                        minWidth: '18px',
                        pointerEvents: 'none'
                      }}
                    ></i>
                    <span style={{
                      fontSize: '14px',
                      //fontWeight: '600',
                      color: responses.trip_frequency === option.value ? COLORS.textBold : "#495057",
                      pointerEvents: 'none'
                    }}>
                      {option.label}
                    </span>
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
                    padding: '12px 24px',
                    backgroundColor: COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => e.target.style.backgroundColor = COLORS.bgSecondaryHover}
                  onMouseOut={e => e.target.style.backgroundColor = COLORS.bgSecondary}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={responses.trip_frequency === null}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: (responses.trip_frequency !== null) ? COLORS.advance : COLORS.bgSecondary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (responses.trip_frequency !== null) ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600',
                    opacity: (!responses.trip_frequency !== null) ? 1 : 0.6,
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={e => {
                    if (responses.trip_frequency !== null) {
                      e.target.style.backgroundColor = COLORS.advanceHover;
                    }
                  }}
                  onMouseOut={e => {
                    if (responses.trip_frequency !== null) {
                      e.target.style.backgroundColor = COLORS.advance;
                    }
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
  
  // Calculate walking time in minutes (matching sidebar)
  const walkingTime = Math.round(
    route.legs
      .filter(leg => leg.mode === 'WALK')
      .reduce((sum, leg) => sum + (leg.duration || 0), 0) / 60
  );

  // Helper to get route color
  const getRouteColor = (leg) => {
    if (leg.route && leg.route.color) {
      return `#${leg.route.color}`;
    }
    const modeColors = {
      WALK: '#28a745',
      BUS: '#000000',
      SUBWAY: '#000000',
      TRAM: '#000000',
      RAIL: '#6f42c1',
      FERRY: '#17a2b8'
    };
    return modeColors[leg.mode] || '#6c757d';
  };

  // Helper to get mode icon
  const getModeIcon = (leg) => {
    const modeIcons = {
      WALK: 'fas fa-walking',
      BUS: 'fas fa-bus',
      SUBWAY: 'fas fa-subway',
      TRAM: 'fas fa-tram',
      RAIL: 'fas fa-train',
      FERRY: 'fas fa-ship'
    };
    return modeIcons[leg.mode] || 'fas fa-bus';
  };

  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px',
        backgroundColor: selected ? COLORS.primaryLight : COLORS.bgPrimary,
        color: COLORS.textBlack,
        border: `2px solid ${selected ? COLORS.primary : COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        textAlign: 'left',
        transition: 'all 0.2s',
        boxShadow: selected ? '0 2px 6px rgba(0,123,255,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
        width: '100%'
      }}
    >
      {/* Title section (not in sidebar) */}
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: selected ? COLORS.primary : COLORS.textBold,
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {title}
        {isNew && (
          <img 
            src="/stars.png" 
            alt="New" 
            style={{ width: '14px', height: '14px' }}
          />
        )}
      </div>

      {/* Duration section - matches sidebar exactly */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ 
          fontSize: '20px', 
          fontWeight: '700',
          color: selected ? COLORS.primary : COLORS.advance
        }}>
          {totalDuration} min
        </div>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: '600',
          color: COLORS.textBold,
          textAlign: 'right'
        }}>
          <div>{formatTime(route.startTime)}</div>
          <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>
            to {formatTime(route.endTime)}
          </div>
        </div>
      </div>

      {/* Stats section - matches sidebar exactly */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px',
        fontSize: '12px',
        color: COLORS.textSecondary
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
      </div>
      
      {/* Route pills - matches sidebar exactly */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center',
        minHeight: '20px'
      }}>
        {route.legs.map((leg, legIndex) => {
          const legColor = getRouteColor(leg);
          const duration = Math.round(leg.duration / 60);
          const iconClass = getModeIcon(leg);
          
          let displayText = '';
          if (leg.mode === 'WALK') {
            displayText = `${duration}min`;
          } else if (leg.route && leg.route.shortName) {
            displayText = leg.route.shortName;
          } else {
            displayText = leg.mode.toLowerCase();
          }

          const textColor = leg.route?.textColor ? `#${leg.route.textColor}` : (leg.mode === 'WALK' ? '#000' : '#fff');
          
          return (
            <React.Fragment key={legIndex}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: legColor,
                  color: textColor,
                  padding: '2px 6px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: '600',
                  margin: '1px',
                  minWidth: '24px',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <i className={iconClass} style={{ marginRight: '2px', fontSize: '8px' }}></i>
                {displayText}
              </div>
              {legIndex < route.legs.length - 1 && (
                <span style={{ 
                  margin: '0 2px', 
                  color: COLORS.textSecondary,
                  fontSize: '10px'
                }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </button>
  );
};

// Helper component for auto route option cards (matching MapSurveyPage format exactly)
const AutoRouteOptionCard = ({ title, route, selected, onClick, accentColor }) => {
  if (!route) return null;

  // Calculate traffic impact
  const trafficRatio = route.delay / route.duration;
  let trafficColor = COLORS.noTraffic; // Green for light traffic
  
  if (trafficRatio > 0.3) {
    trafficColor = COLORS.heavyTraffic; // Red for heavy traffic
  } else if (trafficRatio > 0.15) {
    trafficColor = COLORS.mediumTraffic; // Orange for moderate traffic
  } else if (trafficRatio > 0.05) {
    trafficColor = COLORS.lightTraffic; // Yellow for light-moderate traffic
  }

  const majorRoads = route.majorRoads || [];
  const arrival = new Date(route.arrivalTime).toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  const departure = new Date(route.departureTime).toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <button
      onClick={onClick}
      style={{
        padding: '16px',
        backgroundColor: selected ? COLORS.primaryLight : COLORS.bgPrimary,
        color: COLORS.textBlack,
        border: `2px solid ${selected ? COLORS.primary : COLORS.border}`,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        textAlign: 'left',
        transition: 'all 0.2s',
        boxShadow: selected ? '0 2px 6px rgba(220,53,69,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
        minHeight: '120px',
        width: '100%'
      }}
    >
      {/* Title section */}
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: selected ? COLORS.primary : COLORS.textBold,
        marginBottom: '8px'
      }}>
        {title}
      </div>

      {/* Duration section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {/* Traffic indicator dot */}
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: trafficColor,
            flexShrink: 0
          }}></div>
          <div style={{ 
            fontSize: '20px',
            fontWeight: '700',
            color: selected ? COLORS.primary : COLORS.advance
          }}>
            {Math.round(route.duration / 60)} min
          </div>
        </div>
        <div style={{ 
          fontSize: '16px',
          fontWeight: '600',
          color: COLORS.textBold,
          textAlign: 'right'
        }}>
          <div>{departure}</div>
          <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>to {arrival}</div>
        </div>
      </div>

      {/* Second row - stats */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px',
        fontSize: '12px',
        color: COLORS.textSecondary
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '500' }}>
            <i className="fas fa-road" style={{ fontSize: '10px' }}></i>
            {Math.round(route.distance / 1000)} km
          </span>
          {route.delay > 0 && (
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '2px', 
              fontWeight: '500',
              color: trafficColor
            }}>
              <i className="fas fa-clock" style={{ fontSize: '10px' }}></i>
              +{Math.round(route.delay / 60)}min delay
            </span>
          )}
        </div>
        {route.hasTollRoad && (
          <span style={{ 
            backgroundColor: COLORS.bgToll,
            color: COLORS.textToll,
            padding: '2px 6px',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: '600'
          }}>
            <i className="fas fa-dollar-sign" style={{ fontSize: '8px', marginRight: '2px' }}></i>
            Tolls
          </span>
        )}
      </div>
      
      {/* Third row - roads display */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center',
        minHeight: '20px'
      }}>
        {majorRoads.length > 0 ? (
          <>
            <span style={{ 
              fontSize: '10px', 
              color: COLORS.textSecondary, 
              marginRight: '4px',
              fontWeight: '500'
            }}>
              via
            </span>
            {majorRoads.map((road, roadIndex) => (
              <React.Fragment key={roadIndex}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: COLORS.bgSecondary,
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: '600',
                    margin: '1px',
                    minWidth: '24px',
                    justifyContent: 'center'
                  }}
                >
                  <i className="fas fa-road" style={{ marginRight: '2px', fontSize: '8px' }}></i>
                  {typeof road === 'object' ? road.text || road.name || 'Unknown Road' : road}
                </div>
                {roadIndex < majorRoads.length - 1 && (
                  <span style={{ 
                    margin: '0 2px', 
                    color: COLORS.textSecondary,
                    fontSize: '10px'
                  }}>→</span>
                )}
              </React.Fragment>
            ))}
          </>
        ) : (
          <span style={{ 
            fontSize: '10px', 
            color: COLORS.textSecondary,
            fontStyle: 'italic'
          }}>
            Direct route
          </span>
        )}
      </div>
    </button>
  );
};

export default BehavioralSurvey;