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
    popupAnchor: [0, -25],
    zIndexOffset: 1000
  });
};

// Transfer point icon - matches the style of origin/destination markers
const createTransferIcon = () => {
  return L.divIcon({
    className: 'transfer-marker',
    html: `
      <div style="
        background-color: #ffc107;
        width: 20px;
        height: 20px;
        border-radius: 50% 50% 50% 0;
        border: 2px solid white;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-weight: bold;
          font-size: 10px;
          transform: rotate(45deg);
        ">T</span>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -20],
    zIndexOffset: -1000
  });
};

const originIcon = createCustomIcon('#28a745', false);
const destinationIcon = createCustomIcon('#dc3545', true);
const transferIcon = createTransferIcon();

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
    BUS: '#000000',       // Black
    SUBWAY: '#000000',    // Black
    TRAM: '#000000',      // Black
    RAIL: '#6f42c1',      // Purple
    FERRY: '#17a2b8'      // Teal
  };
  
  return modeColors[leg.mode] || '#6c757d';
};

// Helper function to get Font Awesome class for transport modes
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

// Helper function to check if an itinerary is exclusively walking
const isWalkOnlyItinerary = (itinerary) => {
  return itinerary.legs.every(leg => leg.mode === 'WALK');
};

// Helper function to sort itineraries (non-walk-only first)
const sortItineraries = (itineraries) => {
  if (itineraries.length <= 1) return itineraries;
  
  const nonWalkOnly = itineraries.filter(itinerary => !isWalkOnlyItinerary(itinerary));
  const walkOnly = itineraries.filter(itinerary => isWalkOnlyItinerary(itinerary));
  
  // If there are non-walk-only routes, put them first
  return [...nonWalkOnly, ...walkOnly];
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
      
      const processedItineraries = data.data.plan.itineraries.map((itinerary, index) => ({
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
      
      // Sort itineraries to prioritize non-walk-only routes
      return sortItineraries(processedItineraries);
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

  // Route calculation state
  const [isCalculating, setIsCalculating] = useState(false);
  const [readyToCalculate, setReadyToCalculate] = useState(false);

  useEffect(() => {
    let storedSessionId = localStorage.getItem('session_id');
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem('session_id', storedSessionId);
    }
    setSessionId(storedSessionId);  
  }, []);

  // Check if both origin and destination are set
  useEffect(() => {
    if (inputMode === 'text') {
      setReadyToCalculate(origin.trim().length > 0 && destination.trim().length > 0);
    } else {
      setReadyToCalculate(originCoords && destinationCoords);
    }
  }, [origin, destination, originCoords, destinationCoords, inputMode]);

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

  // Handle setting origin via map click (no auto-calculation)
  const handleOriginSet = async (coords) => {
    setOriginCoords(coords);
    setMapMode('none');
    
    // Reverse geocode to get address
    const address = await reverseGeocode(coords, mapboxToken);
    setOrigin(address);
  };

  // Handle setting destination via map click (no auto-calculation)
  const handleDestinationSet = async (coords) => {
    setDestinationCoords(coords);
    setMapMode('none');
    
    // Reverse geocode to get address
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
  };

  // Handle marker drag (no auto-calculation)
  const handleOriginDrag = async (coords) => {
    setOriginCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setOrigin(address);
  };

  const handleDestinationDrag = async (coords) => {
    setDestinationCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
  };

  // Centralized trip planning function
  const planTrip = async (oCoords, dCoords, originAddress, destinationAddress) => {
    setIsCalculating(true);
    
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
      setIsCalculating(false);
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
    
    setIsCalculating(false);
  };

  const handleCalculateRoute = async () => {
    if (inputMode === 'text') {
      // Text mode - geocode addresses first
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
    } else {
      // Map mode - use existing coordinates
      if (originCoords && destinationCoords) {
        planTrip(originCoords, destinationCoords, origin, destination);
      }
    }
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

  // Styles
  const sidebarStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '400px',
    height: '100vh',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e0e0e0',
    padding: '16px',
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
    padding: '8px 12px',
    border: '2px solid #e1e5e9',
    borderRadius: '6px',
    fontSize: '14px',
    marginBottom: '12px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  const buttonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    marginBottom: '16px'
  };

  const smallButtonStyle = {
    padding: '6px 10px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    marginRight: '6px',
    marginBottom: '6px',
    transition: 'background-color 0.2s'
  };

  return (
    <div style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Include Font Awesome CSS */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
      
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#2c3e50' }}>
          Transit Survey
        </h1>
        <p style={{ color: '#6c757d', marginBottom: '16px', fontSize: '12px' }}>
          Plan your trip and help us improve transit services
        </p>

        {/* Unified Trip Information Container */}
        <div style={{ 
          marginBottom: '12px', 
          padding: '12px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px',
          height: '380px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Trip Information Header with Input Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: '0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
              Trip Information
            </h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                style={{
                  ...smallButtonStyle,
                  backgroundColor: inputMode === 'text' ? '#007bff' : '#6c757d',
                  marginRight: '4px',
                  marginBottom: '0',
                  fontSize: '11px',
                  padding: '4px 8px'
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
                  backgroundColor: inputMode === 'map' ? '#007bff' : '#6c757d',
                  marginBottom: '0',
                  fontSize: '11px',
                  padding: '4px 8px'
                }}
                onClick={() => setInputMode('map')}
              >
                Click on Map
              </button>
            </div>
          </div>
          
          {/* Address Input Container - Always Visible */}
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
                transform: 'translateY(-50%)',
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
              onClick={() => {
                // Swap origin and destination
                const tempOrigin = origin;
                const tempOriginCoords = originCoords;
                setOrigin(destination);
                setDestination(tempOrigin);
                setOriginCoords(destinationCoords);
                setDestinationCoords(tempOriginCoords);
              }}
              title="Swap origin and destination"
            >
              ⇅
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
              <p style={{ fontSize: '12px', color: '#6c757d', marginBottom: '8px', margin: '0 0 8px 0' }}>
                Click the buttons below, then click on the map to set locations:
              </p>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button
                  style={{
                    ...smallButtonStyle,
                    backgroundColor: mapMode === 'setOrigin' ? '#28a745' : '#6c757d',
                    marginBottom: '0'
                  }}
                  onClick={() => setMapMode('setOrigin')}
                >
                  Set Origin (A)
                </button>
                <button
                  style={{
                    ...smallButtonStyle,
                    backgroundColor: mapMode === 'setDestination' ? '#dc3545' : '#6c757d',
                    marginBottom: '0'
                  }}
                  onClick={() => setMapMode('setDestination')}
                >
                  Set Destination (B)
                </button>
                <button
                  style={{
                    ...smallButtonStyle,
                    backgroundColor: '#ffc107',
                    color: '#000',
                    marginBottom: '0'
                  }}
                  onClick={handleClear}
                >
                  Clear All
                </button>
              </div>
              {mapMode !== 'none' && (
                <p style={{ fontSize: '11px', color: '#007bff', margin: '0' }}>
                  {mapMode === 'setOrigin' ? 'Click on map to set origin (green pin)' : 'Click on map to set destination (red pin)'}
                </p>
              )}
            </div>
          )}

          {/* Travel Time Controls - Compact horizontal layout */}
          <div style={{ 
            border: '2px solid #e1e5e9', 
            borderRadius: '6px', 
            backgroundColor: '#fff',
            padding: '8px 12px',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="radio" 
                    checked={!arriveBy} 
                    onChange={() => setArriveBy(false)}
                    style={{ marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#495057' }}>Leave By</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="radio" 
                    checked={arriveBy} 
                    onChange={() => setArriveBy(true)}
                    style={{ marginRight: '4px' }}
                  />
                  <span style={{ fontSize: '12px', color: '#495057' }}>Arrive By</span>
                </label>
              </div>
              
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

          {/* Calculate Route Button */}
          <button 
            onClick={handleCalculateRoute}
            disabled={!readyToCalculate || isCalculating}
            style={{
              ...buttonStyle,
              backgroundColor: !readyToCalculate || isCalculating ? '#6c757d' : '#007bff',
              cursor: !readyToCalculate || isCalculating ? 'not-allowed' : 'pointer',
              marginBottom: '0',
              flex: '0 0 auto'
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
            {isCalculating ? 'Calculating Route...' : 'Calculate Route'}
          </button>
        </div>

        {/* Route Options - Transitous-inspired design */}
        {routeOptions.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
              Route Options
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {routeOptions.map((route, index) => {
                // Calculate total walking time
                const walkingTime = route.legs
                  .filter(leg => leg.mode === 'WALK')
                  .reduce((total, leg) => total + Math.round(leg.duration / 60), 0);
                
                // Filter out walk legs under 1.5 minutes for display
                const displayLegs = route.legs.filter(leg => {
                  if (leg.mode === 'WALK') {
                    return leg.duration >= 90;
                  }
                  return true;
                });

                // Count transfers (number of transit legs - 1)
                const transitLegs = route.legs.filter(leg => leg.mode !== 'WALK');
                const transfers = Math.max(0, transitLegs.length - 1);

                return (
                  <button
                    key={route.id}
                    style={{
                      padding: '12px',
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
                    onClick={() => {
                      setSelectedRouteIndex(index);
                      setOtpTravelTime(Math.round(route.duration / 60));
                      setTravelTime(Math.round(route.duration / 60));
                    }}
                  >
                    {/* Header with departure time, arrival time, and total duration */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px',
                      fontWeight: '600'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span>{formatTime(route.startTime)}</span>
                        <span style={{ color: '#6c757d' }}>→</span>
                        <span>{formatTime(route.endTime)}</span>
                      </div>
                      <div style={{ 
                        fontSize: '16px', 
                        color: selectedRouteIndex === index ? '#007bff' : '#28a745',
                        fontWeight: '700'
                      }}>
                        {Math.round(route.duration / 60)} min
                      </div>
                    </div>
                    
                    {/* Route visualization pills */}
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      alignItems: 'center',
                      marginBottom: '8px',
                      minHeight: '20px'
                    }}>
                      {displayLegs.map((leg, legIndex) => {
                        const legColor = getRouteColor(leg);
                        const duration = Math.round(leg.duration / 60);
                        let displayText = '';
                        let iconClass = getModeIcon(leg);
                        
                        if (leg.mode === 'WALK') {
                          displayText = `${duration}min`;
                        } else if (leg.route && leg.route.shortName) {
                          displayText = leg.route.shortName;
                        } else {
                          displayText = leg.mode.toLowerCase();
                        }

                        return (
                          <React.Fragment key={legIndex}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                backgroundColor: legColor,
                                color: leg.mode === 'WALK' ? '#000' : '#fff',
                                padding: '2px 6px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: '600',
                                margin: '1px',
                                minWidth: '24px',
                                justifyContent: 'center'
                              }}
                            >
                              <i className={iconClass} style={{ marginRight: '2px', fontSize: '8px' }}></i>
                              {displayText}
                            </div>
                            {legIndex < displayLegs.length - 1 && (
                              <span style={{ 
                                margin: '0 2px', 
                                color: '#6c757d',
                                fontSize: '10px'
                              }}>→</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    
                    {/* Stats row - Walking time and transfers */}
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '11px',
                      color: '#6c757d'
                    }}>
                      <span>
                        {walkingTime > 0 && `${walkingTime} min walking`}
                        {walkingTime > 0 && transfers > 0 && ' • '}
                        {transfers > 0 && `${transfers} transfer${transfers > 1 ? 's' : ''}`}
                        {walkingTime === 0 && transfers === 0 && 'Direct route'}
                      </span>
                      <span>Option {index + 1}</span>
                    </div>
                  </button>
                );
              })}
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
            <div key={`route-${selectedRouteIndex}`}>
              {routeOptions[selectedRouteIndex].legs.map((leg, legIndex) => {
                try {
                  if (!leg.legGeometry || !leg.legGeometry.points) {
                    return (
                      <Polyline
                        key={`route-${selectedRouteIndex}-leg-${legIndex}`}
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
                    <React.Fragment key={`route-${selectedRouteIndex}-leg-${legIndex}`}>
                      <Polyline
                        positions={coords}
                        color={getRouteColor(leg)}
                        weight={6}
                        opacity={0.8}
                        dashArray={leg.mode === 'WALK' ? '10, 5' : null}
                      />
                      {/* Only show transfer markers for non-start/end points */}
                      {legIndex > 0 && (
                        <Marker position={[leg.from.lat, leg.from.lon]} icon={transferIcon}>
                          <Popup>
                            <div style={{ minWidth: '200px' }}>
                              <strong>{leg.from.name}</strong><br/>
                              <span style={{ color: '#6c757d' }}>Transfer Point</span>
                              {leg.route && (
                                <>
                                  <br/><strong>Next: {leg.route.shortName}</strong> {leg.route.longName}
                                  <br/>Duration: {Math.round(leg.duration / 60)} minutes
                                </>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      )}
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