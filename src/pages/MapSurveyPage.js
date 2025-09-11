import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom'; 
import polyline from "@mapbox/polyline";

const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => x * Math.PI / 180;
  const [lat1, lon1] = coords1;
  const [lat2, lon2] = coords2;

  const R = 6371; // Radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const estimateTravelTime = (distanceKm) => {
  const averageSpeedKmH = 25;
  return Math.round((distanceKm / averageSpeedKmH) * 60);
};

// Helper function to get route colors from GTFS or fallback to defaults
const getRouteColor = (leg) => {
  // Use GTFS route color if available
  if (leg.route && leg.route.color) {
    return `#${leg.route.color}`;
  }
  
  // Fallback to mode-based colors
  const modeColors = {
    WALK: '#28a745',      // Green
    BUS: '#007bff',       // Blue  
    SUBWAY: '#dc3545',    // Red
    TRAM: '#ffc107',      // Yellow
    RAIL: '#6f42c1',      // Purple
    FERRY: '#17a2b8'      // Teal
  };
  
  return modeColors[leg.mode] || '#6c757d'; // Gray as ultimate fallback
};

const fetchOTPRoute = async (fromCoords, toCoords) => {
  try {
    console.log("Attempting OTP GraphQL API with coords:", fromCoords, "to", toCoords);
    
    const query = `{
      plan(
        from: {lat: ${fromCoords[0]}, lon: ${fromCoords[1]}}
        to: {lat: ${toCoords[0]}, lon: ${toCoords[1]}}
        numItineraries: 3
      ) {
        itineraries {
          duration
          startTime
          endTime
          legs {
            mode
            duration
            distance
            from { 
              name
              lat 
              lon 
            }
            to { 
              name
              lat 
              lon 
            }
            legGeometry {
              points
            }
            route {
              shortName
              longName
              color
              textColor
            }
          }
        }
      }
    }`;
    
    console.log("Sending GraphQL query:", query);
    
    const response = await fetch("http://localhost:8080/otp/gtfs/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    
    console.log("GraphQL response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("GraphQL failed:", response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log("GraphQL success! Response:", data);
    
    if (data.errors) {
      console.error("GraphQL query errors:", data.errors);
      return null;
    }
    
    if (data.data && data.data.plan && data.data.plan.itineraries && data.data.plan.itineraries.length > 0) {
      console.log("Found", data.data.plan.itineraries.length, "route options");
      return data.data.plan.itineraries.map((itinerary, index) => ({
        id: index,
        duration: itinerary.duration,
        startTime: itinerary.startTime,
        endTime: itinerary.endTime,
        legs: itinerary.legs.map(leg => ({
          mode: leg.mode,
          duration: leg.duration,
          distance: leg.distance,
          from: { 
            name: leg.from.name || 'Unknown',
            lat: leg.from.lat, 
            lon: leg.from.lon 
          },
          to: { 
            name: leg.to.name || 'Unknown',
            lat: leg.to.lat, 
            lon: leg.to.lon 
          },
          legGeometry: { points: leg.legGeometry?.points || '' },
          route: leg.route ? {
            shortName: leg.route.shortName,
            longName: leg.route.longName,
            color: leg.route.color,
            textColor: leg.route.textColor
          } : null
        }))
      }));
    }
    
    console.log("No itineraries found in GraphQL response");
    return null;
    
  } catch (error) {
    console.error("GraphQL error:", error);
    return null;
  }
};

function FitMap({ originCoords, destinationCoords, routeLegs }) {
  const map = useMap();
  React.useEffect(() => {
    if (routeLegs && routeLegs.length > 0) {
      // Collect all points from all legs
      const allPoints = [];
      routeLegs.forEach(leg => {
        if (leg.legGeometry && leg.legGeometry.points) {
          try {
            const legPoints = polyline.decode(leg.legGeometry.points);
            allPoints.push(...legPoints);
          } catch (error) {
            // Fallback to leg endpoints if polyline decode fails
            allPoints.push([leg.from.lat, leg.from.lon]);
            allPoints.push([leg.to.lat, leg.to.lon]);
          }
        } else {
          // Fallback to leg endpoints
          allPoints.push([leg.from.lat, leg.from.lon]);
          allPoints.push([leg.to.lat, leg.to.lon]);
        }
      });
      
      if (allPoints.length > 0) {
        map.fitBounds(allPoints, { padding: [50, 50] });
      }
    } else if (originCoords && destinationCoords) {
      map.fitBounds([originCoords, destinationCoords], { padding: [50, 50] });
    }
  }, [originCoords, destinationCoords, routeLegs, map]);
  return null;
}

function App() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [travelTime, setTravelTime] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalStartTime, setModalStartTime] = useState(null);
  const [seenODPairs, setSeenODPairs] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();
  const [tripHistory, setTripHistory] = useState([]);
  
  // Multi-route state
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [otpTravelTime, setOtpTravelTime] = useState(null);
  const [useOTPRouting, setUseOTPRouting] = useState(true);

  useEffect(() => {
    let storedSessionId = localStorage.getItem('session_id');
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem('session_id', storedSessionId);
    }
    setSessionId(storedSessionId);  
  }, []);

  const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN;

  const geocodeAddress = async (address) => {
    const baseUrl = "https://api.mapbox.com/geocoding/v5/mapbox.places";
    const proximity = "-79.3832,43.6532";
    const country = "ca";
    const encodedAddress = encodeURIComponent(address);
    const url = `${baseUrl}/${encodedAddress}.json?proximity=${proximity}&country=${country}&access_token=${mapboxToken}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!data.features || data.features.length === 0) {
        alert("Location not found!");
        return null;
      }
      const [lon, lat] = data.features[0].center;
      return [lat, lon];
    } catch (err) {
      console.error("Mapbox geocoding error:", err);
      alert("Geocoding failed. Please try again.");
      return null;
    }
  };

  const handleMapSubmit = async () => {
    const trimmedOrigin = origin.trim();
    const trimmedDestination = destination.trim();

    if (!trimmedOrigin || !trimmedDestination) {
      alert("Please enter both origin and destination.");
      return;
    }

    if (trimmedOrigin.length < 2 || trimmedDestination.length < 2) {
      alert("Please enter more complete addresses.");
      return;
    }

    const originValidPattern = /[a-zA-Z]/.test(trimmedOrigin) && /[0-9]/.test(trimmedOrigin);
    if (!originValidPattern) {
      alert("Origin must contain both letters and numbers.");
      return;
    }

    const destinationValidPattern = /[a-zA-Z]/.test(trimmedDestination) && /[0-9]/.test(trimmedDestination);
    if (!destinationValidPattern) {
      alert("Destination must contain both letters and numbers.");
      return;
    }

    const oCoords = await geocodeAddress(trimmedOrigin);
    const dCoords = await geocodeAddress(trimmedDestination);

    if (!oCoords || !dCoords) return;

    setOriginCoords(oCoords);
    setDestinationCoords(dCoords);

    // Clear previous route data
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setOtpTravelTime(null);

    let finalTravelTime;

    if (useOTPRouting) {
      // Try to get OTP route options
      const otpRoutes = await fetchOTPRoute(oCoords, dCoords);
      if (otpRoutes && otpRoutes.length > 0) {
        setRouteOptions(otpRoutes);
        setSelectedRouteIndex(0); // Default to first route
        setOtpTravelTime(Math.round(otpRoutes[0].duration / 60)); // Convert seconds to minutes
        finalTravelTime = Math.round(otpRoutes[0].duration / 60);
      } else {
        // Fallback to haversine calculation
        const distance = haversineDistance(oCoords, dCoords);
        const estimatedTime = estimateTravelTime(distance);
        finalTravelTime = estimatedTime;
      }
    } else {
      // Use original haversine calculation
      const distance = haversineDistance(oCoords, dCoords);
      const estimatedTime = estimateTravelTime(distance);
      finalTravelTime = estimatedTime;
    }

    setTravelTime(finalTravelTime);

    const odKey = `${origin.toLowerCase()}___${destination.toLowerCase()}`;
    const isNewPair = !seenODPairs.has(odKey);

    if (!sessionId) {
      console.warn("Session ID not ready yet. Skipping insert.");
      return;
    }

    // Insert log with selected route data
    const selectedRoute = routeOptions[selectedRouteIndex];
    const routeDetails = selectedRoute ? {
      route_option_count: routeOptions.length,
      selected_route_index: selectedRouteIndex,
      route_legs_summary: selectedRoute.legs.map(leg => ({
        mode: leg.mode,
        duration_min: Math.round(leg.duration / 60),
        route_name: leg.route?.shortName || null
      }))
    } : null;

    const { error } = await supabase.from('survey_responses').insert({
      origin,
      destination,
      travel_time_old_min: finalTravelTime,
      travel_time_new_min: otpTravelTime,
      route_details: routeDetails, // Store additional route info as JSON
      would_consider: null,
      exit_survey_data: null,
      session_id: sessionId,
      modal_shown: isNewPair,
    });

    if (error) console.error("Log insert error:", error);

    if (!seenODPairs.has(odKey)) {
      setSeenODPairs(prev => new Set(prev).add(odKey));
      setModalStartTime(Date.now());
      setShowModal(true);
    }

    setTripHistory(prev => [
      ...prev,
      { origin, destination, travelTime: finalTravelTime, timestamp: new Date().toISOString() }
    ]);
  };

  const handleResponse = async (response) => {
    const responseTimeMs = modalStartTime ? Date.now() - modalStartTime : null;

    const { error } = await supabase
      .from("survey_responses")
      .update({ 
        would_consider: response,
        response_time_ms: responseTimeMs,
      })
      .match({ 
        origin, 
        destination, 
        travel_time_old_min: travelTime, 
        session_id: sessionId 
      });

    if (error) {
      console.error("Survey response update error:", error);
    }

    setShowModal(false);
    setModalStartTime(null);
  };

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <h1 style={{ padding: '1rem' }}>Neighborhood Travel Survey (Map)</h1>
      
      <div style={{ padding: '1rem' }}>
        <label>
          <input 
            type="checkbox" 
            checked={useOTPRouting} 
            onChange={e => setUseOTPRouting(e.target.checked)}
          />
          Use transit routing (requires OTP server)
        </label>
      </div>

      <div style={{ padding: '1rem' }}>
        <label>
          Origin:
          <input value={origin} onChange={e => setOrigin(e.target.value)} style={{ marginLeft: '1rem' }} />
        </label>
        <br /><br />
        <label>
          Destination:
          <input value={destination} onChange={e => setDestination(e.target.value)} style={{ marginLeft: '1rem' }} />
        </label>
        <br /><br />
        <button onClick={handleMapSubmit}>Show on Map</button>
      </div>

      {travelTime && (
        <div style={{ padding: '1rem', fontWeight: 'bold' }}>
          Estimated Travel Time: {travelTime} minutes
          {otpTravelTime && (
            <div style={{ fontSize: '0.9em', fontWeight: 'normal', color: '#666' }}>
              (Transit route: {otpTravelTime} minutes)
            </div>
          )}
        </div>
      )}

      {/* Route Options Selector */}
      {routeOptions.length > 1 && (
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', margin: '1rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1em' }}>Route Options (showing option {selectedRouteIndex + 1}):</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {routeOptions.map((route, index) => (
              <button
                key={route.id}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: selectedRouteIndex === index ? '#007bff' : '#fff',
                  color: selectedRouteIndex === index ? '#fff' : '#000',
                  border: '1px solid #007bff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9em'
                }}
                onClick={() => {
                  setSelectedRouteIndex(index);
                  setOtpTravelTime(Math.round(route.duration / 60));
                  setTravelTime(Math.round(route.duration / 60));
                }}
              >
                Option {index + 1}<br/>
                {Math.round(route.duration / 60)}min
              </button>
            ))}
          </div>
          
          {/* Selected Route Details */}
          <div style={{ 
            padding: '0.75rem',
            backgroundColor: '#e3f2fd',
            border: '1px solid #2196f3',
            borderRadius: '4px'
          }}>
            <div style={{ fontWeight: 'bold' }}>
              Selected: {Math.round(routeOptions[selectedRouteIndex].duration / 60)} minutes
            </div>
            <div style={{ fontSize: '0.9em', marginTop: '0.25rem' }}>
              {routeOptions[selectedRouteIndex].legs.map((leg, legIndex) => {
                if (leg.mode === 'WALK') {
                  return `Walk ${Math.round(leg.duration / 60)}min`;
                } else if (leg.route) {
                  return `${leg.route.shortName || leg.mode} ${Math.round(leg.duration / 60)}min`;
                } else {
                  return `${leg.mode} ${Math.round(leg.duration / 60)}min`;
                }
              }).join(' → ')}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          border: '1px solid #ccc',
          padding: '2rem',
          zIndex: 9999,
          borderRadius: '8px',
          width: '400px',
          boxShadow: '0 0 10px rgba(0,0,0,0.3)'
        }}>
          <h2>Quick Survey</h2>
          <p>This trip takes approximately {travelTime} minutes.</p>
          <p>Would you consider using this service?</p>
          <button onClick={() => handleResponse(true)}>Yes</button>
          <button onClick={() => handleResponse(false)} style={{ marginLeft: '1rem' }}>No</button>
        </div>
      )}

      <MapContainer center={[43.7, -79.4]} zoom={11} style={{ height: "500px", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Origin and destination markers */}
        {originCoords && <Marker position={originCoords} />}
        {destinationCoords && <Marker position={destinationCoords} />}
        
        {/* Render only the selected route */}
        {routeOptions.length > 0 && routeOptions[selectedRouteIndex] ? (
          <div>
            {routeOptions[selectedRouteIndex].legs.map((leg, legIndex) => {
              try {
                if (!leg.legGeometry || !leg.legGeometry.points) {
                  // Fallback to straight line if no geometry
                  return (
                    <Polyline 
                      key={`selected-${legIndex}`}
                      positions={[[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]]}
                      color={getRouteColor(leg)}
                      weight={5}
                      opacity={1}
                      dashArray={leg.mode === 'WALK' ? '5, 5' : null}
                    />
                  );
                }
                
                // Decode polyline geometry
                const coords = polyline.decode(leg.legGeometry.points);
                
                return (
                  <React.Fragment key={`selected-${legIndex}`}>
                    <Polyline 
                      positions={coords} 
                      color={getRouteColor(leg)}
                      weight={5}
                      opacity={1}
                      dashArray={leg.mode === 'WALK' ? '5, 5' : null}
                    />
                    {/* Markers for each leg */}
                    <Marker position={[leg.from.lat, leg.from.lon]}>
                      <Popup>
                        <strong>{leg.from.name}</strong><br/>
                        {leg.mode} - Start
                        {leg.route && (
                          <>
                            <br/>{leg.route.shortName} {leg.route.longName}
                            <br/>Duration: {Math.round(leg.duration / 60)} minutes
                          </>
                        )}
                      </Popup>
                    </Marker>
                    <Marker position={[leg.to.lat, leg.to.lon]}>
                      <Popup>
                        <strong>{leg.to.name}</strong><br/>
                        {leg.mode} - End
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              } catch (error) {
                console.error("Error rendering leg", legIndex, error);
                return null;
              }
            })}
          </div>
        ) : (
          /* Fallback: simple straight line */
          originCoords && destinationCoords && 
          <Polyline positions={[originCoords, destinationCoords]} color="blue" />
        )}
        
        <FitMap 
          originCoords={originCoords} 
          destinationCoords={destinationCoords} 
          routeLegs={routeOptions[selectedRouteIndex]?.legs || []}
        />
      </MapContainer>
      
      {tripHistory.length > 0 && (
        <div style={{ padding: '1rem', marginTop: '1rem' }}>
          <button
            onClick={() => navigate('/exit')}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Finish Survey
          </button>
        </div>
      )}
    </div>
  );
}

export default App;