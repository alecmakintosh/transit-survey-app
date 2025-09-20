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
    zIndexOffset: -5000 // Changed from -1000 to 100, still below origin/destination (1000) but above pills (500)
  });
};

// FIXED: Create route pill icon for map display with better sizing
// Updated createRoutePillIcon function with mode icons
const createRoutePillIcon = (routeName, duration, color, textColor = 'white', mode = null, isNewRoute = false) => {
  // Only show icons for TRAM, SUBWAY, RAIL
  const shouldShowIcon = ['TRAM', 'SUBWAY', 'RAIL'].includes(mode);
  
  let iconHTML = '';
  if (shouldShowIcon) {
    const modeIcons = {
      SUBWAY: 'fas fa-subway',
      TRAM: 'fas fa-tram', 
      RAIL: 'fas fa-train'
    };
    
    const iconClass = modeIcons[mode] || '';
    iconHTML = `<i class="${iconClass}" style="margin-right: 6px; font-size: 10px;"></i>`;
  }
  
  const textContent = `${routeName} • ${duration}min`;
  const approxWidth = Math.max(80, textContent.length * 7 + 16 + (shouldShowIcon ? 20 : 0) + (isNewRoute ? 20 : 0));
  
  // Sparkle indicator for new routes
  const sparkleHTML = isNewRoute ? `
    <img src="/stars.png"
         style="
           position: absolute;
           top: -3px;
           right: -3px;
           width: 16px;
           height: 16px;
           z-index: 10;
         " 
         alt="New route" />
  ` : '';
  
  return L.divIcon({
    className: 'route-pill',
    html: `
      <div style="
        background-color: ${color};
        color: ${textColor || 'white'};
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        border: 2px solid white;
        text-align: center;
        line-height: 1.1;
        min-width: 80px;
        position: relative;
        z-index: 500;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${iconHTML}${routeName} • ${duration}min
        ${sparkleHTML}
      </div>
    `,
    iconSize: [approxWidth, 26],
    iconAnchor: [approxWidth / 2, 13],
    className: 'route-pill-marker'
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

// Helper function to deduplicate itineraries with different start times
const deduplicateItineraries = (itineraries) => {
  const uniqueRoutes = new Map();
  
  itineraries.forEach(itinerary => {
    // Create a signature based on the transit routes used
    /*
    const routeSignature = itinerary.legs
      .filter(leg => leg.mode !== 'WALK')
      .map(leg => `${leg.mode}-${leg.route?.shortName || leg.mode}`)
      .join('|');
    */
    const routeSignature = itinerary.legs
      .filter(leg => leg.mode !== 'WALK')
      .map((leg, index) => {
        const transferPoint = index > 0 ? leg.from.name : '';
        return `${leg.mode}-${leg.route?.shortName || leg.mode}-${transferPoint}`;
      })
      .join('|');
    
    // For walking-only routes, use origin/destination as signature
    const signature = routeSignature || `WALK-${itinerary.legs[0]?.from?.lat}-${itinerary.legs[0]?.from?.lon}-${itinerary.legs[itinerary.legs.length-1]?.to?.lat}-${itinerary.legs[itinerary.legs.length-1]?.to?.lon}`;
    
    // Keep the first occurrence (which should be the best match for requested time)
    if (!uniqueRoutes.has(signature)) {
      uniqueRoutes.set(signature, itinerary);
    }
  });
  
  return Array.from(uniqueRoutes.values());
};

// Helper function to sort itineraries (non-walk-only first)
const sortItineraries = (itineraries) => {
  if (itineraries.length <= 1) return itineraries;
  
  const nonWalkOnly = itineraries.filter(itinerary => !isWalkOnlyItinerary(itinerary));
  const walkOnly = itineraries.filter(itinerary => isWalkOnlyItinerary(itinerary));
  
  // If there are non-walk-only routes, put them first
  return [...nonWalkOnly, ...walkOnly];
};

// Configuration for new routes - easy to modify
const NEW_ROUTES_CONFIG = {
  routeIdentifiers: [
    { type: 'longName', value: 'LINE 5 (EGLINTON)' },
    { type: 'longName', value: 'LINE 6 (FINCH WEST)' }
    // Add more routes here as needed:
    // { type: 'shortName', value: '5' },
    // { type: 'agency', value: 'TTC' }
  ]
};

const legHasNewRoute = (leg) => {
  if (!leg.route) return false;
  
  return NEW_ROUTES_CONFIG.routeIdentifiers.some(identifier => {
    switch (identifier.type) {
      case 'longName':
        return leg.route.longName === identifier.value;
      case 'shortName':
        return leg.route.shortName === identifier.value;
      case 'agency':
        return leg.route.agency === identifier.value;
      default:
        return false;
    }
  });
};

// Helper function to check if route uses new transit lines
const hasNewRoute = (itinerary) => {
  return itinerary.legs.some(leg => {
    if (!leg.route) return false;
    
    return NEW_ROUTES_CONFIG.routeIdentifiers.some(identifier => {
      switch (identifier.type) {
        case 'longName':
          return leg.route.longName === identifier.value;
        case 'shortName':
          return leg.route.shortName === identifier.value;
        case 'agency':
          return leg.route.agency === identifier.value;
        default:
          return false;
      }
    });
  });
};

// MODIFIED: Enhanced OTP query with fallback for loose restrictions
const fetchOTPRoute = async (fromCoords, toCoords, time, isArriveBy, dayType) => {
  try {
    const baseDate = dayType === 'weekday' ? "2025-09-10" : "2025-09-13";
    
    // Primary query with current restrictions
    const primaryQuery = `{
      plan(
        from: {lat: ${fromCoords[0]}, lon: ${fromCoords[1]}}
        to: {lat: ${toCoords[0]}, lon: ${toCoords[1]}}
        date: "${baseDate}"
        time: "${time}"
        ${isArriveBy ? 'arriveBy: true' : ''}
        numItineraries: 15
        transferPenalty: 60
        modeWeight: {BUS: 1.2, SUBWAY: 0.9, RAIL: 0.85, TRAM: 0.95}
        searchWindow: 1800
        walkReluctance: 2.0
        maxTransfers: 5
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
              agency {
                name
              }
            }
          }
        }
      }
    }`;

    const futureOTPUrl = process.env.REACT_APP_OTP_FUTURE_URL;
    
    // Try primary query first
    let response = await fetch(futureOTPUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: primaryQuery })
    });
    
    let data = await response.json();
    
    // Check if we got valid results
    if (data.data && data.data.plan && data.data.plan.itineraries && data.data.plan.itineraries.length > 0) {
      console.log("Primary query found", data.data.plan.itineraries.length, "route options");
      
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
            textColor: leg.route.textColor,
            agency: leg.route.agency?.name
          } : null
        }))
      }));
      
      const deduplicatedItineraries = deduplicateItineraries(processedItineraries);
      return sortItineraries(deduplicatedItineraries);
    }
    
    // If primary query failed, try fallback with looser restrictions
    console.log("Primary query returned no results, trying fallback with looser restrictions...");
    
    const fallbackQuery = `{
      plan(
        from: {lat: ${fromCoords[0]}, lon: ${fromCoords[1]}}
        to: {lat: ${toCoords[0]}, lon: ${toCoords[1]}}
        date: "${baseDate}"
        time: "${time}"
        ${isArriveBy ? 'arriveBy: true' : ''}
        numItineraries: 15
        transferPenalty: 60
        modeWeight: {BUS: 1.2, SUBWAY: 0.9, RAIL: 0.85, TRAM: 0.95}
        searchWindow: 7200
        walkReluctance: 2.0
        maxTransfers: 8
        maxWalkDistance: 2000
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
              agency {
                name
              }
            }
          }
        }
      }
    }`;
    
    response = await fetch(futureOTPUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: fallbackQuery })
    });
    
    data = await response.json();
    
    if (data.data && data.data.plan && data.data.plan.itineraries && data.data.plan.itineraries.length > 0) {
      console.log("Fallback query found", data.data.plan.itineraries.length, "route options");
      
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
            textColor: leg.route.textColor,
            agency: leg.route.agency?.name
          } : null
        }))
      }));
      
      const deduplicatedItineraries = deduplicateItineraries(processedItineraries);
      return sortItineraries(deduplicatedItineraries);
    }
    
    console.log("Both primary and fallback queries returned no results");
    return null;
    
  } catch (error) {
    console.error("OTP GraphQL error:", error);
    return null;
  }
};

// Sample transit lines data (you would replace this with actual GTFS data)
const TRANSIT_LINES = [
  // Line 1 (Yonge-University)
  { mode: 'SUBWAY', name: 'Line 1', color: '#FFD320', coordinates: [
    [43.7765, -79.4169], [43.7735, -79.4128], [43.7634, -79.4094], [43.7532, -79.4062],
    [43.7400, -79.4030], [43.7280, -79.3998], [43.7180, -79.3966], [43.7080, -79.3934],
    [43.6980, -79.3902], [43.6880, -79.3870], [43.6543, -79.3832], [43.6460, -79.3790],
    [43.6377, -79.3748], [43.6294, -79.3706], [43.6211, -79.3664]
  ]},
  // Line 2 (Bloor-Danforth)
  { mode: 'SUBWAY', name: 'Line 2', color: '#00B04F', coordinates: [
    [43.6481, -79.5463], [43.6501, -79.5363], [43.6521, -79.5263], [43.6541, -79.5163],
    [43.6561, -79.5063], [43.6581, -79.4963], [43.6601, -79.4863], [43.6621, -79.4763],
    [43.6641, -79.4663], [43.6661, -79.4563], [43.6681, -79.4463], [43.6701, -79.4363],
    [43.6721, -79.4263], [43.6741, -79.4163], [43.6761, -79.4063], [43.6781, -79.3963]
  ]},
  // Eglinton LRT (Line 5)
  { mode: 'TRAM', name: 'Line 5 Eglinton', color: '#8E6F00', coordinates: [
    [43.7000, -79.5500], [43.7010, -79.5300], [43.7020, -79.5100], [43.7030, -79.4900],
    [43.7040, -79.4700], [43.7050, -79.4500], [43.7060, -79.4300], [43.7070, -79.4100],
    [43.7080, -79.3900], [43.7090, -79.3700], [43.7100, -79.3500]
  ]},
  // Finch West LRT (Line 6)
  { mode: 'TRAM', name: 'Line 6 Finch West', color: '#800080', coordinates: [
    [43.7500, -79.5200], [43.7510, -79.5000], [43.7520, -79.4800], [43.7530, -79.4600],
    [43.7540, -79.4400], [43.7550, -79.4200]
  ]}
];

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

// Custom Zoom Control Component
function CustomZoomControl() {
  const map = useMap();
  
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    }}>
      <button
        style={{
          width: '34px',
          height: '34px',
          backgroundColor: '#fff',
          border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 5px rgba(0,0,0,0.65)'
        }}
        onClick={() => map.zoomIn()}
        onMouseOver={e => e.target.style.backgroundColor = '#f4f4f4'}
        onMouseOut={e => e.target.style.backgroundColor = '#fff'}
      >
        +
      </button>
      <button
        style={{
          width: '34px',
          height: '34px',
          backgroundColor: '#fff',
          border: '2px solid rgba(0,0,0,0.2)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 5px rgba(0,0,0,0.65)'
        }}
        onClick={() => map.zoomOut()}
        onMouseOver={e => e.target.style.backgroundColor = '#f4f4f4'}
        onMouseOut={e => e.target.style.backgroundColor = '#fff'}
      >
        −
      </button>
    </div>
  );
}

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

function FitMap({ originCoords, destinationCoords, routeLegs, shouldFit, triggerType}) {
  const map = useMap();
  React.useEffect(() => {
    if (!shouldFit || triggerType === 'drag') return;
    
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
  }, [originCoords, destinationCoords, routeLegs, map, shouldFit, triggerType]);
  return null;
}

// Component to render transit lines
function TransitLines({ showLines, transitLines = TRANSIT_LINES }) {
  if (!showLines) return null;
  
  return (
    <>
      {transitLines.map((line, index) => {
        return (
          <Polyline
            key={`transit-line-${index}`}
            positions={line.coordinates}
            color={line.color}
            weight={2}
            opacity={1}
          />
        );
      })}
    </>
  );
}

// Add this new component after your existing components (around line 500)
function TransferMarkers({ route, selectedRouteIndex }) {
  if (!route || !route.legs) return null;
  
  return (
    <>
      {route.legs.map((leg, legIndex) => {
        if (legIndex === 0) return null; // Skip first leg (no transfer point)
        
        return (
          <Marker 
            key={`transfer-${selectedRouteIndex}-${legIndex}`}
            position={[leg.from.lat, leg.from.lon]} 
            icon={transferIcon}
            zIndexOffset={-1000}
          >
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
        );
      })}
    </>
  );
}

function ClickableTransitLeg({ leg, legIndex, selectedRouteIndex, coords }) {
  const [showPopup, setShowPopup] = useState(false);
  
  const handleMouseOver = () => {
    setShowPopup(true);
  };

  const getRouteWidth = (mode) => {
    switch (mode) {
      case 'SUBWAY':
      case 'RAIL':
        return 8;
      case 'TRAM':
        return 6;
      default:
        return 4;
    }
  };

  return (
    <Polyline
      positions={coords}
      color={getRouteColor(leg)}
      weight={getRouteWidth(leg.mode)}
      opacity={0.8}
      dashArray={leg.mode === 'WALK' ? '10, 5' : null}
      eventHandlers={{
        mouseover: handleMouseOver,
      }}
    >
      {showPopup && (
        <Popup 
          onClose={() => setShowPopup(false)}
          autoPan={false}
        >
          <div style={{ minWidth: '200px' }}>
            <strong>{leg.route?.shortName || leg.mode}</strong><br/>
            {leg.route?.longName && <><em>{leg.route.longName}</em><br/></>}
            <span style={{ color: '#6c757d' }}>Duration: {Math.round(leg.duration / 60)} minutes</span><br/>
            <strong>From:</strong> {leg.from.name}<br/>
            <strong>To:</strong> {leg.to.name}
          </div>
        </Popup>
      )}
    </Polyline>
  );
}

const RouteOptionLeg = ({ leg, legIndex, displayLegs }) => {
  const legColor = getRouteColor(leg);
  const duration = Math.round(leg.duration / 60);
  const isNewRoute = legHasNewRoute(leg);
  let displayText = '';
  let iconClass = getModeIcon(leg);
  
  if (leg.mode === 'WALK') {
    displayText = `${duration}min`;
  } else if (leg.route && leg.route.shortName) {
    displayText = leg.route.shortName;
  } else {
    displayText = leg.mode.toLowerCase();
  }

  // Use textColor from route data
  const textColor = leg.route?.textColor ? `#${leg.route.textColor}` : (leg.mode === 'WALK' ? '#000' : '#fff');

  return (
    <React.Fragment>
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
          position: 'relative' // For sparkle positioning
        }}
      >
        <i className={iconClass} style={{ marginRight: '2px', fontSize: '8px' }}></i>
        {displayText}
        {isNewRoute && (
          <img 
            src="/stars.png" 
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '12px',
              height: '12px',
              zIndex: 10
            }}
            alt="New route"
          />
        )}
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
};

// NEW: User Profile Modal Component
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
          Welcome to the Transit Mapper
        </h2>
        <p style={{ marginBottom: '24px', color: '#6c757d', lineHeight: '1.5' }}>
          These questions help us design your user experience and understand how different types of travelers use transit services.
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
};

// NEW: No Routes Found Modal Component
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
};

// GTFS Integration Components
function GTFSFileLoader({ onDataLoaded }) {
  const [uploadedFiles, setUploadedFiles] = useState({
    routes: false,
    trips: false,
    shapes: false
  });

  const handleFileUpload = (event, fileType) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onDataLoaded(fileType, e.target.result);
        setUploadedFiles(prev => ({ ...prev, [fileType]: true }));
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ marginBottom: '16px', padding: '12px', border: '2px solid #e1e5e9', borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>GTFS Files (Optional)</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="file" 
            accept=".txt" 
            onChange={(e) => handleFileUpload(e, 'routes')}
            style={{ fontSize: '11px' }}
          />
          <span>routes.txt</span>
          {uploadedFiles.routes && <span style={{ color: '#28a745', fontSize: '11px' }}>✓</span>}
        </label>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="file" 
            accept=".txt" 
            onChange={(e) => handleFileUpload(e, 'trips')}
            style={{ fontSize: '11px' }}
          />
          <span>trips.txt</span>
          {uploadedFiles.trips && <span style={{ color: '#28a745', fontSize: '11px' }}>✓</span>}
        </label>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="file" 
            accept=".txt" 
            onChange={(e) => handleFileUpload(e, 'shapes')}
            style={{ fontSize: '11px' }}
          />
          <span>shapes.txt</span>
          {uploadedFiles.shapes && <span style={{ color: '#28a745', fontSize: '11px' }}>✓</span>}
        </label>
      </div>
    </div>
  );
}

const parseGTFSData = (routesData, tripsData, shapesData, agencyName) => {
  const transitModes = ['0', '1', '2']; // 0=Tram, 1=Subway, 2=Rail
  const transitLines = [];

  try {
    const routes = routesData.split(/\r?\n/).slice(1);
    const routeHeaders = routesData.split(/\r?\n/)[0].split(',');
    
    const trips = tripsData.split(/\r?\n/).slice(1);
    const tripHeaders = tripsData.split(/\r?\n/)[0].split(',');
    
    const shapes = shapesData.split(/\r?\n/).slice(1);
    const shapeHeaders = shapesData.split(/\r?\n/)[0].split(',');
    
    // Get column indices
    const routeTypeIdx = routeHeaders.indexOf('route_type');
    const routeIdIdx = routeHeaders.indexOf('route_id');
    const routeNameIdx = routeHeaders.indexOf('route_long_name');
    const routeShortNameIdx = routeHeaders.indexOf('route_short_name');
    const routeColorIdx = routeHeaders.indexOf('route_color');
    
    // Build route lookup with proper color handling
    const transitRoutes = new Map();
    routes.forEach(row => {
      if (!row.trim()) return; // Skip empty rows
      
      const fields = row.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
      
      if (routeTypeIdx >= 0 && transitModes.includes(fields[routeTypeIdx])) {
        let routeColor = '#000000'; // Default black
        
        // Handle route color properly
        if (routeColorIdx >= 0 && fields[routeColorIdx]) {
          let colorValue = fields[routeColorIdx].trim().replace(/"/g, '');
          // Add # if not present
          routeColor = colorValue.startsWith('#') ? colorValue : `#${colorValue}`;
        }
        
        transitRoutes.set(fields[routeIdIdx], {
          name: fields[routeNameIdx] || fields[routeShortNameIdx] || 'Unknown Route',
          shortName: fields[routeShortNameIdx] || '',
          type: fields[routeTypeIdx],
          color: routeColor,
          agency: agencyName
        });
      }
    });
    
    // Build shape lookup from trips
    const routeShapes = new Map();
    const routeIdIdx_trips = tripHeaders.indexOf('route_id');
    const shapeIdIdx_trips = tripHeaders.indexOf('shape_id');
    
    trips.forEach(row => {
      if (!row.trim()) return;
      
      const fields = row.split(',');
      const routeId = fields[routeIdIdx_trips];
      const shapeId = fields[shapeIdIdx_trips];
      
      if (transitRoutes.has(routeId) && shapeId) {
        if (!routeShapes.has(routeId)) {
          routeShapes.set(routeId, new Set());
        }
        routeShapes.get(routeId).add(shapeId);
      }
    });
    
    // Build coordinates from shapes
    const shapeCoords = new Map();
    const shapeIdIdx = shapeHeaders.indexOf('shape_id');
    const latIdx = shapeHeaders.indexOf('shape_pt_lat');
    const lonIdx = shapeHeaders.indexOf('shape_pt_lon');
    const seqIdx = shapeHeaders.indexOf('shape_pt_sequence');
    
    shapes.forEach(row => {
      if (!row.trim()) return;
      
      const fields = row.split(',');
      const shapeId = fields[shapeIdIdx];
      const lat = parseFloat(fields[latIdx]);
      const lon = parseFloat(fields[lonIdx]);
      const seq = parseInt(fields[seqIdx]);
      
      if (!isNaN(lat) && !isNaN(lon) && !isNaN(seq)) {
        if (!shapeCoords.has(shapeId)) {
          shapeCoords.set(shapeId, []);
        }
        shapeCoords.get(shapeId).push({ lat, lon, seq });
      }
    });
    
    // Sort coordinates by sequence and build transit lines
    routeShapes.forEach((shapeIds, routeId) => {
      const route = transitRoutes.get(routeId);
      
      // Convert Set to Array to get index, then only process first shape
      const shapeArray = Array.from(shapeIds);
      if (shapeArray.length > 0) {
        const shapeId = shapeArray[0]; // Only take first shape
        const coords = shapeCoords.get(shapeId);
        
        if (coords && coords.length > 1) {
          coords.sort((a, b) => a.seq - b.seq);
          transitLines.push({
            mode: route.type === '1' ? 'SUBWAY' : route.type === '2' ? 'RAIL' : 'TRAM',
            name: route.name,
            shortName: route.shortName,
            color: route.color,
            agency: route.agency,
            coordinates: coords.map(c => [c.lat, c.lon])
          });
        }
      }
    });
    
    return transitLines;
    
  } catch (error) {
    console.error(`Error parsing GTFS data for ${agencyName}:`, error);
    return [];
  }
};

const loadPreprocessedData = async () => {
  try {
    const response = await fetch('/gtfs/processed-transit-lines.json');
    
    if (!response.ok) {
      return TRANSIT_LINES;
    }
    
    const data = await response.json();
    
    return data.transitLines;
  } catch (error) {
    console.error('Error loading preprocessed data:', error);
    return TRANSIT_LINES;
  }
};

function ClickableRoutePill({ pill, leg }) {
  const [showPopup, setShowPopup] = useState(false);
  const isNewRoute = legHasNewRoute(leg);
  
  const handleMouseOver = () => {
    setShowPopup(true);
  };

  return (
    <Marker 
      position={pill.position} 
      icon={createRoutePillIcon(pill.routeName, pill.duration, pill.color, pill.textColor, leg?.mode, isNewRoute)}
      zIndexOffset={500}
      eventHandlers={{
        mouseover: handleMouseOver,
      }}
    >
      {showPopup && (
        <Popup 
          onClose={() => setShowPopup(false)}
          autoPan={false}
        >
          <div style={{ minWidth: '200px' }}>
            <strong>{leg?.route?.shortName || leg?.mode || pill.routeName}</strong>
            <br/>
            {leg?.route?.longName && <><em>{leg.route.longName}</em><br/></>}
            <span style={{ color: '#6c757d' }}>Duration: {Math.round((leg?.duration || pill.duration * 60) / 60)} minutes</span><br/>
            <strong>From:</strong> {leg?.from?.name || 'Transit segment'}<br/>
            <strong>To:</strong> {leg?.to?.name || 'Transit segment'}
          </div>
        </Popup>
      )}
    </Marker>
  );
}

const findBestPillPosition = (coords, occupiedPositions, map) => {
  if (coords.length === 0) return null;
  
  const minDistancePixels = 60; // Minimum distance in pixels from other markers
  
  // Try multiple positions along the route
  const candidatePositions = [];
  const segmentCount = Math.min(coords.length - 1, 10); // Check up to 10 segments
  
  for (let i = 0; i < segmentCount; i++) {
    const ratio = i / (segmentCount - 1);
    const index = Math.floor(ratio * (coords.length - 1));
    candidatePositions.push(coords[index]);
  }
  
  // Also include the middle position
  const midIndex = Math.floor(coords.length / 2);
  if (!candidatePositions.some(pos => pos[0] === coords[midIndex][0] && pos[1] === coords[midIndex][1])) {
    candidatePositions.push(coords[midIndex]);
  }
  
  // Find the position with maximum distance from occupied positions
  let bestPosition = null;
  let maxMinDistance = 0;
  
  candidatePositions.forEach(candidate => {
    let minDistance = Infinity;
    
    occupiedPositions.forEach(occupied => {
      const candidatePixel = map.latLngToContainerPoint(candidate);
      const occupiedPixel = map.latLngToContainerPoint(occupied);
      const distance = candidatePixel.distanceTo(occupiedPixel);
      minDistance = Math.min(minDistance, distance);
    });
    
    if (minDistance > maxMinDistance && minDistance >= minDistancePixels) {
      maxMinDistance = minDistance;
      bestPosition = candidate;
    }
  });
  
  // If no position meets the minimum distance requirement, return the one with maximum distance
  if (!bestPosition && candidatePositions.length > 0) {
    candidatePositions.forEach(candidate => {
      let minDistance = Infinity;
      
      occupiedPositions.forEach(occupied => {
        const candidatePixel = map.latLngToContainerPoint(candidate);
        const occupiedPixel = map.latLngToContainerPoint(occupied);
        const distance = candidatePixel.distanceTo(occupiedPixel);
        minDistance = Math.min(minDistance, distance);
      });
      
      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestPosition = candidate;
      }
    });
  }
  
  return bestPosition;
};

// FIXED: Component to handle responsive route pills that update on zoom
function RoutePills({ route, selectedRouteIndex, map, originCoords, destinationCoords }) {
  const [zoom, setZoom] = useState(map?.getZoom() || 11);
  const [pills, setPills] = useState([]);

  useEffect(() => {
    if (!map) return;

    const updatePills = () => {
      const currentZoom = map.getZoom();
      setZoom(currentZoom);
      
      if (!route || !route.legs) {
        setPills([]);
        return;
      }

      const newPills = [];
      const occupiedPositions = [];
      
      // Add origin/destination positions to occupied list
      if (originCoords) {
        occupiedPositions.push(originCoords);
      }
      if (destinationCoords) {
        occupiedPositions.push(destinationCoords);
      }
      
      // Add transfer points to occupied list
      route.legs.forEach((leg, legIndex) => {
        if (legIndex > 0) {
          occupiedPositions.push([leg.from.lat, leg.from.lon]);
        }
      });
      
      route.legs.forEach((leg, legIndex) => {
        if (leg.mode === 'WALK') return;
        
        const legDuration = Math.round(leg.duration / 60);
        if (legDuration < 3) return;
        
        try {
          if (!leg.legGeometry || !leg.legGeometry.points) return;
          
          const coords = polyline.decode(leg.legGeometry.points);
          if (coords.length < 5) return;
          
          const bounds = L.latLngBounds(coords);
          const pixelBounds = map.latLngToContainerPoint(bounds.getNorthEast())
            .distanceTo(map.latLngToContainerPoint(bounds.getSouthWest()));
          
          if (pixelBounds < 100) return;
          
          const bestPosition = findBestPillPosition(coords, occupiedPositions, map);
          if (!bestPosition) return;
          
          const textColor = leg.route?.textColor ? `#${leg.route.textColor}` : 'white';

          newPills.push({
            id: `pill-${selectedRouteIndex}-${legIndex}`,
            position: bestPosition,
            routeName: leg.route?.shortName || leg.mode,
            duration: legDuration,
            color: getRouteColor(leg),
            textColor: textColor,
            routeLongName: leg.route?.longName,
            leg: leg // Pass the full leg data for popup information
          });
          
          occupiedPositions.push(bestPosition);
          
        } catch (error) {
          console.error("Error processing route pill:", error);
        }
      });
      
      setPills(newPills);
    };

    updatePills();
    map.on('zoomend', updatePills);
    map.on('moveend', updatePills);

    return () => {
      map.off('zoomend', updatePills);
      map.off('moveend', updatePills);
    };
  }, [map, route, selectedRouteIndex, originCoords, destinationCoords]);

  return (
    <>
      {pills.map(pill => (
        <ClickableRoutePill 
          key={pill.id}
          pill={pill}
          leg={pill.leg}
        />
      ))}
    </>
  );
}

// Component to capture map instance
const MapHandler = ({ setMapInstance }) => {
  const map = useMap();
  
  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);

  return null;
};

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

// Calculate the midpoint of a line for route pill placement
const getLineMidpoint = (coordinates) => {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0];
  
  const midIndex = Math.floor(coordinates.length / 2);
  return coordinates[midIndex];
};

function App() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [travelTime, setTravelTime] = useState(null);
  // REMOVED: showModal and modalStartTime state - commenting out the modal functionality
  // const [showModal, setShowModal] = useState(false);
  // const [modalStartTime, setModalStartTime] = useState(null);
  const [seenODPairs, setSeenODPairs] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();
  const [tripHistory, setTripHistory] = useState([]);
  
  // Multi-route state
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [otpTravelTime, setOtpTravelTime] = useState(null);
  
  // NEW: User profile state
  const [showUserProfileModal, setShowUserProfileModal] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  
  // NEW: No routes found modal state
  const [showNoRoutesModal, setShowNoRoutesModal] = useState(false);
  
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
  
  // New state for map fitting control
  const [shouldFitMap, setShouldFitMap] = useState(false);
  
  // Map reference for pills component
  const [mapInstance, setMapInstance] = useState(null);

  // Remove the gtfsData state since we don't need it anymore
  const [parsedTransitLines, setParsedTransitLines] = useState([]);
  const [fitTriggerType, setFitTriggerType] = useState(null);

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

  useEffect(() => {
    const initializeTransitData = async () => {
      const transitLines = await loadPreprocessedData();
      setParsedTransitLines(transitLines);
    };
      
    initializeTransitData();
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

  // NEW: Handle user profile submission
  const handleUserProfileSubmit = async (profileData) => {
    setUserProfile(profileData);
    // TODO: Log to Supabase database when ready
    console.log('User profile data:', profileData);
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
    setFitTriggerType('drag'); // Don't auto-zoom on drag
    setShouldFitMap(false);
  };

  const handleDestinationDrag = async (coords) => {
    setDestinationCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
    setFitTriggerType('drag'); // Don't auto-zoom on drag
    setShouldFitMap(false);
  };

  // MODIFIED: Centralized trip planning function with modal for no routes
  const planTrip = async (oCoords, dCoords, originAddress, destinationAddress) => {
    setIsCalculating(true);
    setFitTriggerType('route'); // Enable auto-zoom for route calculation
    setShouldFitMap(true); // Enable map fitting for new route calculation
    
    // Clear previous route data
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setOtpTravelTime(null);

    let finalTravelTime;

    // Use OTP routing with enhanced fallback
    const otpRoutes = await fetchOTPRoute(oCoords, dCoords, departureTime, arriveBy, dayType);
    if (otpRoutes && otpRoutes.length > 0) {
      setRouteOptions(otpRoutes);
      setSelectedRouteIndex(0);
      setOtpTravelTime(Math.round(otpRoutes[0].duration / 60));
      finalTravelTime = Math.round(otpRoutes[0].duration / 60);
    } else {
      // Show modal instead of alert
      setShowNoRoutesModal(true);
      setIsCalculating(false);
      return;
    }

    setTravelTime(finalTravelTime);

    const odKey = `${originAddress.toLowerCase()}___${destinationAddress.toLowerCase()}`;
    const isNewPair = !seenODPairs.has(odKey);

    if (!sessionId) {
      console.warn("Session ID not ready yet. Skipping insert.");
      setIsCalculating(false);
      return;
    }

    // Insert log with selected route data (removed modal-related fields)
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
      would_consider: null, // Will be filled in later if needed
      exit_survey_data: null,
      session_id: sessionId,
      modal_shown: false, // No longer showing modal
    });

    if (error) console.error("Log insert error:", error);

    // Add to seen pairs without showing modal
    if (!seenODPairs.has(odKey)) {
      setSeenODPairs(prev => new Set(prev).add(odKey));
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

  // REMOVED: handleResponse function for modal

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
    setShouldFitMap(false);
  };

  // Handle route selection
  const handleRouteSelection = (index) => {
    setSelectedRouteIndex(index);
    setOtpTravelTime(Math.round(routeOptions[index].duration / 60));
    setTravelTime(Math.round(routeOptions[index].duration / 60));
    setFitTriggerType('route-select'); // Enable auto-zoom for route selection
    setShouldFitMap(true);
  };

  // Check if current route uses new transit lines
  const currentRouteHasNewTransit = routeOptions.length > 0 && hasNewRoute(routeOptions[selectedRouteIndex]);

  // Styles
  const sidebarStyle = {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '400px',
    height: '100vh',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e0e0e0',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column'
  };

  const mapStyle = {
    position: 'fixed',
    left: '400px',
    top: 0,
    right: 0,
    bottom: 0,
    height: '100vh'
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
      
      {/* NEW: User Profile Modal */}
      <UserProfileModal 
        isOpen={showUserProfileModal}
        onClose={() => setShowUserProfileModal(false)}
        onSubmit={handleUserProfileSubmit}
      />
      
      {/* NEW: No Routes Found Modal */}
      <NoRoutesFoundModal 
        isOpen={showNoRoutesModal}
        onClose={() => setShowNoRoutesModal(false)}
      />
      
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '16px', paddingBottom: '8px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px', color: '#2c3e50' }}>
            Future Toronto Transit Mapper
          </h1>
          <p style={{ color: '#6c757d', marginBottom: '16px', fontSize: '12px' }}> 
            Plan your trip and see how new transit lines can help!
          </p>
        </div>

        {/* Scrollable content area */}
        <div style={{ 
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 16px'
        }}>
          {/* Trip Information Container */}
          <div style={{ 
            marginBottom: '16px',
            flex: '0 0 auto'
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
              </div>
            )}

            {/* Travel Time Controls */}
            <div style={{ 
              border: '2px solid #e1e5e9', 
              borderRadius: '6px', 
              backgroundColor: '#fff',
              padding: '8px 12px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              {isCalculating ? 'Finding Route...' : 'Find Route'}
            </button>
          </div>

          {/* MODIFIED: Route Options Container with updated card design */}
          {routeOptions.length > 0 && (
            <div style={{ flex: '1 1 auto', minHeight: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                Route Options
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: currentRouteHasNewTransit ? '120px' : '80px' }}>
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
                      {/* MODIFIED: Enhanced first row emphasizing both duration and times */}
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
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>to {formatTime(route.endTime)}</div>
                        </div>
                      </div>

                      {/* MODIFIED: Second row with key stats in a more prominent way */}
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
                        {/* Future space for route tags like "Fastest", "Fewest transfers", etc. */}
                        <div style={{ fontSize: '11px', fontStyle: 'italic' }}>
                          {/* TODO: Add route optimization tags here */}
                        </div>
                      </div>
                      
                      {/* Third row: Route visualization pills */}
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        alignItems: 'center',
                        minHeight: '20px'
                      }}>
                        {displayLegs.map((leg, legIndex) => (
                          <RouteOptionLeg 
                            key={legIndex}
                            leg={leg} 
                            legIndex={legIndex} 
                            displayLegs={displayLegs} 
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fixed bottom buttons container */}
        {tripHistory.length > 0 && (
          <div style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            width: '368px',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* Compare button - only show if current route has new transit */}
            {currentRouteHasNewTransit && (
              <button
                onClick={() => {/* Add compare functionality here */}}
                style={{
                  ...buttonStyle,
                  margin: '0',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#0056b3'}
                onMouseOut={e => e.target.style.backgroundColor = '#007bff'}
              >
                Compare
              </button>
            )}
            
            {/* Finish Survey button */}
            <button
              onClick={() => navigate('/exit')}
              style={{
                ...buttonStyle,
                backgroundColor: '#28a745',
                margin: '0',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#218838'}
              onMouseOut={e => e.target.style.backgroundColor = '#28a745'}
            >
              Finish Survey
            </button>
          </div>
        )}
      </div>

      {/* REMOVED: Modal section - commented out
      {showModal && (
        <div style={{...modal styles...}}>
          ...modal content...
        </div>
      )}
      */}

      {/* Full-screen Map */}
      <div style={mapStyle}>
        <MapContainer 
          center={[43.7, -79.4]} 
          zoom={11.8} 
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {/* Map handler to capture map instance */}
          <MapHandler setMapInstance={setMapInstance} />
          
          {/* Custom zoom control */}
          <CustomZoomControl />
          
          {/* Background transit lines - only show when no routes are calculated */}
          <TransitLines showLines={routeOptions.length === 0} transitLines={parsedTransitLines.length > 0 ? parsedTransitLines : TRANSIT_LINES} />
          
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
          
          {/* Render only the selected route polylines */}
          {routeOptions.length > 0 && routeOptions[selectedRouteIndex] ? (
            <div key={`route-${selectedRouteIndex}`}>
              {/* Render transfer markers FIRST (so they appear behind other markers) */}
              <TransferMarkers 
                route={routeOptions[selectedRouteIndex]} 
                selectedRouteIndex={selectedRouteIndex}
              />
              
              {/* Render clickable route legs */}
              {routeOptions[selectedRouteIndex].legs.map((leg, legIndex) => {
                try {
                  if (!leg.legGeometry || !leg.legGeometry.points) {
                    return (
                      <ClickableTransitLeg
                        key={`route-${selectedRouteIndex}-leg-${legIndex}`}
                        leg={leg}
                        legIndex={legIndex}
                        selectedRouteIndex={selectedRouteIndex}
                        coords={[[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]]}
                      />
                    );
                  }

                  const coords = polyline.decode(leg.legGeometry.points);
                  return (
                    <ClickableTransitLeg
                      key={`route-${selectedRouteIndex}-leg-${legIndex}`}
                      leg={leg}
                      legIndex={legIndex}
                      selectedRouteIndex={selectedRouteIndex}
                      coords={coords}
                    />
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
          
          {/* Responsive route pills component */}
          {routeOptions.length > 0 && mapInstance && (
            <RoutePills 
              route={routeOptions[selectedRouteIndex]} 
              selectedRouteIndex={selectedRouteIndex}
              map={mapInstance} 
              originCoords={originCoords}
              destinationCoords={destinationCoords}
            />
          )}
          
          <FitMap 
            originCoords={originCoords} 
            destinationCoords={destinationCoords} 
            routeLegs={routeOptions[selectedRouteIndex]?.legs || []}
            shouldFit={shouldFitMap}
            triggerType={fitTriggerType}
          />
        </MapContainer>
      </div>
    </div>
  );
}

export default App;