import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom'; 
import polyline from "@mapbox/polyline";
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom marker icons
const createCustomIcon = (color, isDestination = false) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 25px;
        height: 25px;
        border-radius: 50% 50% 50% 0;
        border: 3px solid white;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-weight: bold;
          font-size: 12px;
          transform: rotate(45deg);
        ">${isDestination ? 'B' : 'A'}</span>
      </div>
    `,
    iconSize: [25, 25],
    iconAnchor: [12, 25],
    popupAnchor: [0, -25]
  });
};

const originIcon = createCustomIcon('#28a745', false);
const destinationIcon = createCustomIcon('#dc3545', true);

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
  if (leg.route && leg.route.color) {
    return `#${leg.route.color}`;
  }
  
  const modeColors = {
    WALK: '#28a745',      // Green
    BUS: '#007bff',       // Blue  
    SUBWAY: '#dc3545',    // Red
    TRAM: '#ffc107',      // Yellow
    RAIL: '#6f42c1',      // Purple
    FERRY: '#17a2b8'      // Teal
  };
  
  return modeColors[leg.mode] || '#6c757d';
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

// Component for handling map clicks and marker dragging
function MapClickHandler({ onOriginSet, onDestinationSet, originCoords, destinationCoords, mapMode }) {
  useMapEvents({
    click: (e) => {
      if (mapMode === 'setOrigin') {
        onOriginSet([e.latlng.lat, e.latlng.lng]);
      } else if (mapMode === 'setDestination') {
        onDestinationSet([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return null;
}

// Component for draggable markers
function DraggableMarker({ position, onDragEnd, icon, popupText }) {
  if (!position) return null;

  const eventHandlers = {
    dragend: (e) => {
      const { lat, lng } = e.target.getLatLng();
      onDragEnd([lat, lng]);
    },
  };

  return (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={eventHandlers}
      icon={icon}
    >
      <Popup>{popupText}</Popup>
    </Marker>
  );
}

function FitMap({ originCoords, destinationCoords, routeLegs }) {
  const map = useMap();
  React.useEffect(() => {
    if (routeLegs && routeLegs.length > 0) {
      const allPoints = [];
      routeLegs.forEach(leg => {
        if (leg.legGeometry && leg.legGeometry.points) {
          try {
            const legPoints = polyline.decode(leg.legGeometry.points);
            allPoints.push(...legPoints);
          } catch (error) {
            allPoints.push([leg.from.lat, leg.from.lon]);
            allPoints.push([leg.to.lat, leg.to.lon]);
          }
        } else {
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

// Reverse geocoding function
const reverseGeocode = async (coords, mapboxToken) => {
  try {
    const [lat, lon] = coords;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${mapboxToken}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
  }
};

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
  
  // New time/date controls
  const [departureTime, setDepartureTime] = useState('08:00');
  const [travelDate, setTravelDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [arriveBy, setArriveBy] = useState(false);
  const [dayType, setDayType] = useState('weekday');

  // Map interaction state
  const [mapMode, setMapMode] = useState('none'); // 'none', 'setOrigin', 'setDestination'
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'map'

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

  const getDateTimeForOTP = () => {
    // Create a date that represents the selected day type
    const baseDate = dayType === 'weekday' ? 
      new Date('2024-01-02') : // Tuesday (weekday)
      new Date('2024-01-06');  // Saturday (weekend)
    
    const [hours, minutes] = departureTime.split(':');
    baseDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    return baseDate.toISOString();
  };

  // Handle setting origin via map click
  const handleOriginSet = async (coords) => {
    setOriginCoords(coords);
    setMapMode('none');
    
    // Reverse geocode to get address
    const address = await reverseGeocode(coords, mapboxToken);
    setOrigin(address);
    
    // Auto-plan trip if both origin and destination are set
    if (destinationCoords) {
      planTrip(coords, destinationCoords, address, destination);
    }
  };

  // Handle setting destination via map click
  const handleDestinationSet = async (coords) => {
    setDestinationCoords(coords);
    setMapMode('none');
    
    // Reverse geocode to get address
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
    
    // Auto-plan trip if both origin and destination are set
    if (originCoords) {
      planTrip(originCoords, coords, origin, address);
    }
  };

  // Handle marker drag
  const handleOriginDrag = async (coords) => {
    setOriginCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setOrigin(address);
    
    if (destinationCoords) {
      planTrip(coords, destinationCoords, address, destination);
    }
  };

  const handleDestinationDrag = async (coords) => {
    setDestinationCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
    
    if (originCoords) {
      planTrip(originCoords, coords, origin, address);
    }
  };

  // Centralized trip planning function
  const planTrip = async (oCoords, dCoords, originAddress, destinationAddress) => {
    // Clear previous route data
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setOtpTravelTime(null);

    let finalTravelTime;

    // Always use OTP routing now
    const dateTime = getDateTimeForOTP();
    const otpRoutes = await fetchOTPRoute(oCoords, dCoords);
    if (otpRoutes && otpRoutes.length > 0) {
      setRouteOptions(otpRoutes);
      setSelectedRouteIndex(0);
      setOtpTravelTime(Math.round(otpRoutes[0].duration / 60));
      finalTravelTime = Math.round(otpRoutes[0].duration / 60);
    } else {
      // Fallback to haversine calculation
      const distance = haversineDistance(oCoords, dCoords);
      const estimatedTime = estimateTravelTime(distance);
      finalTravelTime = estimatedTime;
    }

    setTravelTime(finalTravelTime);

    const odKey = `${originAddress.toLowerCase()}___${destinationAddress.toLowerCase()}`;
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
      departure_time: departureTime,
      day_type: dayType,
      arrive_by: arriveBy,
      route_legs_summary: selectedRoute.legs.map(leg => ({
        mode: leg.mode,
        duration_min: Math.round(leg.duration / 60),
        route_name: leg.route?.shortName || null
      }))
    } : null;

    const { error } = await supabase.from('survey_responses').insert({
      origin: originAddress,
      destination: destinationAddress,
      travel_time_old_min: finalTravelTime,
      travel_time_new_min: otpTravelTime,
      //route_details: routeDetails,
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
      { origin: originAddress, destination: destinationAddress, travelTime: finalTravelTime, timestamp: new Date().toISOString() }
    ]);
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

    planTrip(oCoords, dCoords, trimmedOrigin, trimmedDestination);
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

  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Clear all markers and routes
  const handleClear = () => {
    setOrigin('');
    setDestination('');
    setOriginCoords(null);
    setDestinationCoords(null);
    setTravelTime(null);
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setOtpTravelTime(null);
    setMapMode('none');
  };

  // Sidebar styles
  const sidebarStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '400px',
    height: '100vh',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e0e0e0',
    padding: '20px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
  };

  const mapStyle = {
    position: 'fixed',
    left: '400px',
    top: 0,
    right: 0,
    bottom: 0,
    height: '100vh'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '2px solid #e1e5e9',
    borderRadius: '8px',
    fontSize: '16px',
    marginBottom: '16px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '14px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginBottom: '20px'
  };

  const smallButtonStyle = {
    padding: '8px 12px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    marginRight: '8px',
    marginBottom: '8px',
    transition: 'background-color 0.2s'
  };

  return (
    <div style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#2c3e50' }}>
          Transit Survey
        </h1>
        <p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '14px' }}>
          Plan your trip and help us improve transit services
        </p>

        {/* Input Mode Toggle */}
        <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
            Input Method
          </h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              style={{
                ...smallButtonStyle,
                backgroundColor: inputMode === 'text' ? '#007bff' : '#6c757d',
                marginRight: '8px'
              }}
              onClick={() => {
                setInputMode('text');
                setMapMode('none');
              }}
            >
              Type Addresses
            </button>
            <button
              style={{
                ...smallButtonStyle,
                backgroundColor: inputMode === 'map' ? '#007bff' : '#6c757d'
              }}
              onClick={() => setInputMode('map')}
            >
              Click on Map
            </button>
          </div>
          
          {inputMode === 'map' && (
            <div>
              <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '12px' }}>
                Click the buttons below, then click on the map to set locations:
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button
                  style={{
                    ...smallButtonStyle,
                    backgroundColor: mapMode === 'setOrigin' ? '#28a745' : '#6c757d'
                  }}
                  onClick={() => setMapMode('setOrigin')}
                >
                  Set Origin (A)
                </button>
                <button
                  style={{
                    ...smallButtonStyle,
                    backgroundColor: mapMode === 'setDestination' ? '#dc3545' : '#6c757d'
                  }}
                  onClick={() => setMapMode('setDestination')}
                >
                  Set Destination (B)
                </button>
              </div>
              <button
                style={{
                  ...smallButtonStyle,
                  backgroundColor: '#ffc107',
                  color: '#000'
                }}
                onClick={handleClear}
              >
                Clear All
              </button>
              {mapMode !== 'none' && (
                <p style={{ fontSize: '12px', color: '#007bff', marginTop: '8px' }}>
                  {mapMode === 'setOrigin' ? 'Click on map to set origin (green pin)' : 'Click on map to set destination (red pin)'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Location Inputs - only show in text mode */}
        {inputMode === 'text' && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
              From
            </label>
            <input 
              type="text"
              value={origin} 
              onChange={e => setOrigin(e.target.value)} 
              placeholder="Enter starting address..."
              style={{...inputStyle, ':focus': {borderColor: '#007bff', outline: 'none'}}}
            />
            
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
              To
            </label>
            <input 
              type="text"
              value={destination} 
              onChange={e => setDestination(e.target.value)} 
              placeholder="Enter destination address..."
              style={inputStyle}
            />
          </div>
        )}

        {/* Show current locations if set via map */}
        {inputMode === 'map' && (originCoords || destinationCoords) && (
          <div style={{ marginBottom: '24px', padding: '12px', backgroundColor: '#e8f4f8', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#0c5460' }}>
              Selected Locations:
            </h4>
            {originCoords && (
              <div style={{ fontSize: '12px', color: '#0c5460', marginBottom: '4px' }}>
                <strong>Origin (A):</strong> {origin || `${originCoords[0].toFixed(4)}, ${originCoords[1].toFixed(4)}`}
              </div>
            )}
            {destinationCoords && (
              <div style={{ fontSize: '12px', color: '#0c5460' }}>
                <strong>Destination (B):</strong> {destination || `${destinationCoords[0].toFixed(4)}, ${destinationCoords[1].toFixed(4)}`}
              </div>
            )}
            <p style={{ fontSize: '11px', color: '#6c757d', marginTop: '8px', marginBottom: '0' }}>
              Drag the pins on the map to adjust locations
            </p>
          </div>
        )}

        {/* Time Controls */}
        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
            Travel Time
          </h3>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <input 
                type="radio" 
                checked={!arriveBy} 
                onChange={() => setArriveBy(false)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: '500' }}>Leave at</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="radio" 
                checked={arriveBy} 
                onChange={() => setArriveBy(true)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: '500' }}>Arrive by</span>
            </label>
          </div>

          <input 
            type="time" 
            value={departureTime}
            onChange={e => setDepartureTime(e.target.value)}
            style={{...inputStyle, marginBottom: '12px'}}
          />

          <select 
            value={dayType}
            onChange={e => setDayType(e.target.value)}
            style={inputStyle}
          >
            <option value="weekday">Weekday</option>
            <option value="weekend">Weekend</option>
          </select>
        </div>

        {/* Plan Trip Button - only show in text mode */}
        {inputMode === 'text' && (
          <button 
            onClick={handleMapSubmit}
            style={buttonStyle}
            onMouseOver={e => e.target.style.backgroundColor = '#0056b3'}
            onMouseOut={e => e.target.style.backgroundColor = '#007bff'}
          >
            Plan Trip
          </button>
        )}

        {/* Travel Time Display */}
        {travelTime && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#e8f4f8', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #17a2b8'
          }}>
            <div style={{ fontWeight: '600', fontSize: '18px', color: '#0c5460' }}>
              {travelTime} minutes
            </div>
            <div style={{ fontSize: '14px', color: '#0c5460', marginTop: '4px' }}>
              Estimated travel time
            </div>
          </div>
        )}

        {/* Route Options */}
        {routeOptions.length > 1 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#495057' }}>
              Route Options
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {routeOptions.map((route, index) => (
                <button
                  key={route.id}
                  style={{
                    padding: '12px',
                    backgroundColor: selectedRouteIndex === index ? '#007bff' : '#fff',
                    color: selectedRouteIndex === index ? '#fff' : '#000',
                    border: `2px solid ${selectedRouteIndex === index ? '#007bff' : '#e1e5e9'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setSelectedRouteIndex(index);
                    setOtpTravelTime(Math.round(route.duration / 60));
                    setTravelTime(Math.round(route.duration / 60));
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    Option {index + 1}: {Math.round(route.duration / 60)} min
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {formatTime(route.startTime)} → {formatTime(route.endTime)}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    {route.legs.map((leg, legIndex) => {
                      if (leg.mode === 'WALK') {
                        return `Walk ${Math.round(leg.duration / 60)}min`;
                      } else if (leg.route) {
                        return `${leg.route.shortName || leg.mode} ${Math.round(leg.duration / 60)}min`;
                      } else {
                        return `${leg.mode} ${Math.round(leg.duration / 60)}min`;
                      }
                    }).join(' → ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Finish Survey Button */}
        {tripHistory.length > 0 && (
          <button
            onClick={() => navigate('/exit')}
            style={{
              ...buttonStyle,
              backgroundColor: '#28a745',
              marginTop: '20px'
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#218838'}
            onMouseOut={e => e.target.style.backgroundColor = '#28a745'}
          >
            Finish Survey
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
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
            <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600' }}>Quick Survey</h2>
            <p style={{ marginBottom: '20px', color: '#6c757d' }}>
              This trip takes approximately {travelTime} minutes.
            </p>
            <p style={{ marginBottom: '24px', fontWeight: '500' }}>
              Would you consider using this service?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => handleResponse(true)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Yes
              </button>
              <button 
                onClick={() => handleResponse(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Map */}
      <div style={mapStyle}>
        <MapContainer 
          center={[43.7, -79.4]} 
          zoom={11} 
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Map click handler for setting origins/destinations */}
          <MapClickHandler 
            onOriginSet={handleOriginSet}
            onDestinationSet={handleDestinationSet}
            originCoords={originCoords}
            destinationCoords={destinationCoords}
            mapMode={mapMode}
          />
          
          {/* Draggable markers */}
          <DraggableMarker
            position={originCoords}
            onDragEnd={handleOriginDrag}
            icon={originIcon}
            popupText="Origin (A) - Drag to move"
          />
          <DraggableMarker
            position={destinationCoords}
            onDragEnd={handleDestinationDrag}
            icon={destinationIcon}
            popupText="Destination (B) - Drag to move"
          />
          
          {/* Render only the selected route */}
          {routeOptions.length > 0 && routeOptions[selectedRouteIndex] ? (
            <div>
              {routeOptions[selectedRouteIndex].legs.map((leg, legIndex) => {
                try {
                  if (!leg.legGeometry || !leg.legGeometry.points) {
                    return (
                      <Polyline 
                        key={`selected-${legIndex}`}
                        positions={[[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]]}
                        color={getRouteColor(leg)}
                        weight={6}
                        opacity={0.8}
                        dashArray={leg.mode === 'WALK' ? '10, 5' : null}
                      />
                    );
                  }
                  
                  const coords = polyline.decode(leg.legGeometry.points);
                  
                  return (
                    <React.Fragment key={`selected-${legIndex}`}>
                      <Polyline 
                        positions={coords} 
                        color={getRouteColor(leg)}
                        weight={6}
                        opacity={0.8}
                        dashArray={leg.mode === 'WALK' ? '10, 5' : null}
                      />
                      <Marker position={[leg.from.lat, leg.from.lon]}>
                        <Popup>
                          <div style={{ minWidth: '200px' }}>
                            <strong>{leg.from.name}</strong><br/>
                            <span style={{ color: '#6c757d' }}>{leg.mode} - Start</span>
                            {leg.route && (
                              <>
                                <br/><strong>{leg.route.shortName}</strong> {leg.route.longName}
                                <br/>Duration: {Math.round(leg.duration / 60)} minutes
                              </>
                            )}
                          </div>
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
            originCoords && destinationCoords && 
            <Polyline positions={[originCoords, destinationCoords]} color="#007bff" weight={4} opacity={0.7} />
          )}
          
          <FitMap 
            originCoords={originCoords} 
            destinationCoords={destinationCoords} 
            routeLegs={routeOptions[selectedRouteIndex]?.legs || []}
          />
        </MapContainer>
      </div>
    </div>
  );
}

export default App;