import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient'
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import polyline from "@mapbox/polyline";
import L from 'leaflet';

// Extracted components and utilities
import {
  createCustomIcon,
  createTransferIcon,
  createRoutePillIcon,
  originIcon,
  destinationIcon,
  transferIcon
} from '../components/MapIcons';
import TravelModeModal from '../components/TravelModeModal';
import UserProfileModal from '../components/UserProfileModal';
import NoRoutesFoundModal from '../components/NoRoutesFoundModal';
import UnaffectedRouteModal from '../components/UnaffectedRouteModal';
import ChangedODModal from '../components/ChangedODModal';
import {
  isWalkOnlyItinerary,
  deduplicateItineraries,
  sortItineraries,
  legHasNewRoute,
  hasNewRoute,
  getLineMidpoint,
  haversineDistance,
  estimateTravelTime,
  getRouteColor,
  getModeIcon
} from '../utils/routeUtils';
import { reverseGeocode } from '../utils/geocodingUtils';
import { NEW_ROUTES_CONFIG } from '../config/routeConfig';
import { useRouteCalculation } from '../hooks/useRouteCalculation';
import { useMapState } from '../hooks/useMapState';
import { useCompareMode } from '../hooks/useCompareMode';
import { fetchTomTomRoute } from '../services/tomtomService';
import TripPlannerForm from '../components/TripPlannerForm';
import RouteResults from '../components/RouteResults';
import MapDisplay from '../components/MapDisplay';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Extracted components and utilities have been moved to separate modules

// All TomTom-related functions have been moved to tomtomService.js

// Enhanced OTP fetch function with API selection

// Enhanced OTP fetch function with API selection
const fetchOTPRoute = async (fromCoords, toCoords, time, isArriveBy, dayType, useCurrentAPI = false) => {
  try {
    const baseDate = dayType === 'weekday' ? "2025-09-10" : "2025-09-13";
    
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
        searchWindow: 1200
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

    // Use appropriate OTP API based on useCurrentAPI parameter
    const otpUrl = useCurrentAPI 
      ? process.env.REACT_APP_OTP_PRESENT_URL 
      : process.env.REACT_APP_OTP_FUTURE_URL;
    
    let response = await fetch(otpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: primaryQuery })
    });
    
    let data = await response.json();
    
    if (data.data && data.data.plan && data.data.plan.itineraries && data.data.plan.itineraries.length > 0) {
      console.log(`${useCurrentAPI ? 'Current' : 'Future'} API found`, data.data.plan.itineraries.length, "route options");
      
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
    
    // Fallback query for looser restrictions
    console.log(`${useCurrentAPI ? 'Current' : 'Future'} API primary query returned no results, trying fallback...`);
    
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
    
    response = await fetch(otpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: fallbackQuery })
    });
    
    data = await response.json();
    
    if (data.data && data.data.plan && data.data.plan.itineraries && data.data.plan.itineraries.length > 0) {
      console.log(`${useCurrentAPI ? 'Current' : 'Future'} API fallback found`, data.data.plan.itineraries.length, "route options");
      
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
    
    console.log(`Both ${useCurrentAPI ? 'current' : 'future'} primary and fallback queries returned no results`);
    return null;
    
  } catch (error) {
    console.error(`${useCurrentAPI ? 'Current' : 'Future'} OTP GraphQL error:`, error);
    return null;
  }
};

// Sample transit lines data
const TRANSIT_LINES = [
  { mode: 'SUBWAY', name: 'Line 1', color: '#FFD320', coordinates: [
    [43.7765, -79.4169], [43.7735, -79.4128], [43.7634, -79.4094], [43.7532, -79.4062],
    [43.7400, -79.4030], [43.7280, -79.3998], [43.7180, -79.3966], [43.7080, -79.3934],
    [43.6980, -79.3902], [43.6880, -79.3870], [43.6543, -79.3832], [43.6460, -79.3790],
    [43.6377, -79.3748], [43.6294, -79.3706], [43.6211, -79.3664]
  ]},
  { mode: 'SUBWAY', name: 'Line 2', color: '#00B04F', coordinates: [
    [43.6481, -79.5463], [43.6501, -79.5363], [43.6521, -79.5263], [43.6541, -79.5163],
    [43.6561, -79.5063], [43.6581, -79.4963], [43.6601, -79.4863], [43.6621, -79.4763],
    [43.6641, -79.4663], [43.6661, -79.4563], [43.6681, -79.4463], [43.6701, -79.4363],
    [43.6721, -79.4263], [43.6741, -79.4163], [43.6761, -79.4063], [43.6781, -79.3963]
  ]},
  { mode: 'TRAM', name: 'Line 5 Eglinton', color: '#8E6F00', coordinates: [
    [43.7000, -79.5500], [43.7010, -79.5300], [43.7020, -79.5100], [43.7030, -79.4900],
    [43.7040, -79.4700], [43.7050, -79.4500], [43.7060, -79.4300], [43.7070, -79.4100],
    [43.7080, -79.3900], [43.7090, -79.3700], [43.7100, -79.3500]
  ]},
  { mode: 'TRAM', name: 'Line 6 Finch West', color: '#800080', coordinates: [
    [43.7500, -79.5200], [43.7510, -79.5000], [43.7520, -79.4800], [43.7530, -79.4600],
    [43.7540, -79.4400], [43.7550, -79.4200]
  ]}
];

// GTFS data processing functions
const parseGTFSData = (routesData, tripsData, shapesData, agencyName) => {
  const transitModes = ['0', '1', '2'];
  const transitLines = [];

  try {
    const routes = routesData.split(/\r?\n/).slice(1);
    const routeHeaders = routesData.split(/\r?\n/)[0].split(',');
    
    const trips = tripsData.split(/\r?\n/).slice(1);
    const tripHeaders = tripsData.split(/\r?\n/)[0].split(',');
    
    const shapes = shapesData.split(/\r?\n/).slice(1);
    const shapeHeaders = shapesData.split(/\r?\n/)[0].split(',');
    
    const routeTypeIdx = routeHeaders.indexOf('route_type');
    const routeIdIdx = routeHeaders.indexOf('route_id');
    const routeNameIdx = routeHeaders.indexOf('route_long_name');
    const routeShortNameIdx = routeHeaders.indexOf('route_short_name');
    const routeColorIdx = routeHeaders.indexOf('route_color');
    
    const transitRoutes = new Map();
    routes.forEach(row => {
      if (!row.trim()) return;
      
      const fields = row.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
      
      if (routeTypeIdx >= 0 && transitModes.includes(fields[routeTypeIdx])) {
        let routeColor = '#000000';
        
        if (routeColorIdx >= 0 && fields[routeColorIdx]) {
          let colorValue = fields[routeColorIdx].trim().replace(/"/g, '');
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
    
    // Process trips and shapes data...
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
    
    routeShapes.forEach((shapeIds, routeId) => {
      const route = transitRoutes.get(routeId);
      
      const shapeArray = Array.from(shapeIds);
      if (shapeArray.length > 0) {
        const shapeId = shapeArray[0];
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

// Travel Mode Selection Modal Component
// TravelModeModal component moved to src/components/TravelModeModal.js

// UserProfileModal component moved to src/components/UserProfileModal.js

// NoRoutesFoundModal component moved to src/components/NoRoutesFoundModal.js

// UnaffectedRouteModal component moved to src/components/UnaffectedRouteModal.js
// ChangedODModal component moved to src/components/ChangedODModal.js

// GTFS File Loader Component
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
function CustomZoomControl({ compareMode }) {
  const map = useMap();
  const topOffset = compareMode === "default" ? "20px" : "70px"; // shift down if banner

  return (
    <div style={{
      position: 'absolute',
      top: topOffset,
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

function DraggableMarker({ position, onDragEnd, icon, popupText, isDisabled = false }) {
  if (!position) return null;

  const eventHandlers = !isDisabled ? {
    dragend: (e) => {
      const { lat, lng } = e.target.getLatLng();
      onDragEnd([lat, lng]);
    },
  } : {};

  return (
    <Marker
      position={position}
      draggable={!isDisabled}
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

function TransferMarkers({ route, selectedRouteIndex }) {
  if (!route || !route.legs) return null;
  
  return (
    <>
      {route.legs.map((leg, legIndex) => {
        if (legIndex === 0) return null;
        
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
          position: 'relative'
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
  if (!coords || coords.length === 0) return null;

  // ✅ prevent errors if map is not ready or already unmounted
  if (!map || !map.getContainer || !map._loaded) return null;

  const minDistancePixels = 60;
  const candidatePositions = [];
  const segmentCount = Math.min(coords.length - 1, 10);

  for (let i = 0; i < segmentCount; i++) {
    const ratio = i / (segmentCount - 1);
    const index = Math.floor(ratio * (coords.length - 1));
    candidatePositions.push(coords[index]);
  }

  const midIndex = Math.floor(coords.length / 2);
  if (!candidatePositions.some(pos => pos[0] === coords[midIndex][0] && pos[1] === coords[midIndex][1])) {
    candidatePositions.push(coords[midIndex]);
  }

  let bestPosition = null;
  let maxMinDistance = 0;

  candidatePositions.forEach(candidate => {
    let minDistance = Infinity;

    occupiedPositions.forEach(occupied => {
      // ✅ wrap pixel conversion in try/catch
      try {
        const candidatePixel = map.latLngToContainerPoint(candidate);
        const occupiedPixel = map.latLngToContainerPoint(occupied);
        const distance = candidatePixel.distanceTo(occupiedPixel);
        minDistance = Math.min(minDistance, distance);
      } catch (err) {
        console.warn("latLngToContainerPoint failed:", err);
      }
    });

    if (minDistance > maxMinDistance && minDistance >= minDistancePixels) {
      maxMinDistance = minDistance;
      bestPosition = candidate;
    }
  });

  return bestPosition;
};

function RoutePills({ route, selectedRouteIndex, originCoords, destinationCoords }) {
  const map = useMap(); // ✅ always points to the current MapContainer
  const [pills, setPills] = useState([]);

  useEffect(() => {
    if (!map || !map.getContainer || !map._loaded) {
      setPills([]);
      return;
    }

    const updatePills = () => {
      if (!route || !route.legs) {
        setPills([]);
        return;
      }

      const newPills = [];
      const occupiedPositions = [];

      if (originCoords) occupiedPositions.push(originCoords);
      if (destinationCoords) occupiedPositions.push(destinationCoords);

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
          const size = map.latLngToContainerPoint(bounds.getNorthEast())
            .distanceTo(map.latLngToContainerPoint(bounds.getSouthWest()));

          if (size < 100) return;

          const bestPosition = findBestPillPosition(coords, occupiedPositions, map);
          if (!bestPosition) return;

          newPills.push({
            id: `pill-${selectedRouteIndex}-${legIndex}`,
            position: bestPosition,
            routeName: leg.route?.shortName || leg.mode,
            duration: legDuration,
            color: getRouteColor(leg),
            textColor: leg.route?.textColor ? `#${leg.route.textColor}` : 'white',
            routeLongName: leg.route?.longName,
            leg
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
        <ClickableRoutePill key={pill.id} pill={pill} leg={pill.leg} />
      ))}
    </>
  );
}

function MapHandler({ setMapInstance }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // wait for the map to be fully initialized
    map.whenReady(() => {
      setMapInstance(map);

      // ✅ use requestAnimationFrame instead of setTimeout
      requestAnimationFrame(() => {
        if (map && map.getContainer() && map._loaded) {
          map.invalidateSize();
        }
      });
    });
  }, [map, setMapInstance]);

  return null;
}

function App() {
  // Basic state
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [travelTime, setTravelTime] = useState(null);
  const [seenODPairs, setSeenODPairs] = useState(new Set());
  const [sessionId, setSessionId] = useState(null);
  const navigate = useNavigate();
  const [tripHistory, setTripHistory] = useState([]);
  
  // Use custom hooks for state management
  const {
    routeOptions,
    setRouteOptions,
    selectedRouteIndex,
    setSelectedRouteIndex,
    otpTravelTime,
    setOtpTravelTime,
    currentRouteOptions,
    setCurrentRouteOptions,
    selectedCurrentRouteIndex,
    setSelectedCurrentRouteIndex,
    isCalculating,
    setIsCalculating,
    readyToCalculate,
    setReadyToCalculate,
    isLoadingCurrentRoutes,
    setIsLoadingCurrentRoutes
  } = useRouteCalculation();
  
  // User profile state
  const [showUserProfileModal, setShowUserProfileModal] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  
  // No routes found modal state
  const [showNoRoutesModal, setShowNoRoutesModal] = useState(false);
  
  // Time/date controls
  const [departureTime, setDepartureTime] = useState('08:00');
  const [travelDate, setTravelDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [arriveBy, setArriveBy] = useState(false);
  const [dayType, setDayType] = useState('weekday');

  // Map state hook
  const {
    mapMode,
    setMapMode,
    inputMode,
    setInputMode,
    shouldFitMap,
    setShouldFitMap,
    mapInstance,
    setMapInstance,
    currentMapInstance,
    setCurrentMapInstance,
    parsedTransitLines,
    setParsedTransitLines,
    fitTriggerType,
    setFitTriggerType
  } = useMapState();

  // Compare mode hook
  const {
    compareMode,
    setCompareMode,
    showTravelModeModal,
    setShowTravelModeModal,
    selectedTravelMode,
    setSelectedTravelMode,
    lastPlannedOrigin,
    setLastPlannedOrigin,
    lastPlannedDestination,
    setLastPlannedDestination,
    showUnaffectedModal,
    setShowUnaffectedModal,
    showChangedODModal,
    setShowChangedODModal,
    handleBackFromCompare
  } = useCompareMode();

  // handleBackFromCompare is now provided by the useCompareMode hook

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

  // Handle user profile submission
  const handleUserProfileSubmit = async (profileData) => {
    setUserProfile(profileData);
    console.log('User profile data:', profileData);
  };

  // Handle setting origin via map click
  const handleOriginSet = async (coords) => {
    setOriginCoords(coords);
    setMapMode('none');
    
    const address = await reverseGeocode(coords, mapboxToken);
    setOrigin(address);
  };

  // Handle setting destination via map click
  const handleDestinationSet = async (coords) => {
    setDestinationCoords(coords);
    setMapMode('none');
    
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
  };

  // Handle marker drag
  const handleOriginDrag = async (coords) => {
    if (compareMode !== 'default') return; // Disable dragging in compare mode
    setOriginCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setOrigin(address);
    setFitTriggerType('drag');
    setShouldFitMap(false);
  };

  const handleDestinationDrag = async (coords) => {
    if (compareMode !== 'default') return; // Disable dragging in compare mode
    setDestinationCoords(coords);
    const address = await reverseGeocode(coords, mapboxToken);
    setDestination(address);
    setFitTriggerType('drag');
    setShouldFitMap(false);
  };

  // Centralized trip planning function
  const planTrip = async (oCoords, dCoords, originAddress, destinationAddress) => {
    setIsCalculating(true);
    setFitTriggerType('route');
    setShouldFitMap(true);
    
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setOtpTravelTime(null);

    setLastPlannedOrigin(originAddress);
    setLastPlannedDestination(destinationAddress);

    let finalTravelTime;

    const otpRoutes = await fetchOTPRoute(oCoords, dCoords, departureTime, arriveBy, dayType);
    if (otpRoutes && otpRoutes.length > 0) {
      setRouteOptions(otpRoutes);
      setSelectedRouteIndex(0);
      setOtpTravelTime(Math.round(otpRoutes[0].duration / 60));
      finalTravelTime = Math.round(otpRoutes[0].duration / 60);
    } else {
      setShowNoRoutesModal(true);
      setIsCalculating(false);
      return;
    }

    setTravelTime(finalTravelTime);

    const odKey = `${originAddress.toLowerCase()}___${destinationAddress.toLowerCase()}`;

    if (!sessionId) {
      console.warn("Session ID not ready yet. Skipping insert.");
      setIsCalculating(false);
      return;
    }

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
      modal_shown: false,
    });

    if (error) console.error("Log insert error:", error);

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
      if (originCoords && destinationCoords) {
        planTrip(originCoords, destinationCoords, origin, destination);
      }
    }
  };

  // Handle compare button click
  const handleCompareClick = () => {
    // Check if OD changed
    if (origin !== lastPlannedOrigin || destination !== lastPlannedDestination) {
      setShowChangedODModal(true);
      return;
    }

    // Check if route uses new transit
    if (!hasNewRoute(routeOptions[selectedRouteIndex])) {
      setShowUnaffectedModal(true);
      return;
    }

    // Otherwise proceed
    setCompareMode('selecting');
    setShowTravelModeModal(true);
  };

  // Handle travel mode selection
  const handleTravelModeSelect = async (mode) => {
    setSelectedTravelMode(mode);
    setShowTravelModeModal(false);

    if (mode === 'vehicle') {
      setCompareMode('comparing');
      setIsLoadingCurrentRoutes(true);

      try {
        // Pass the arriveBy parameter to TomTom
        const carRoutes = await fetchTomTomRoute(originCoords, destinationCoords, departureTime, travelDate, arriveBy);
        if (carRoutes) {
          setCurrentRouteOptions(carRoutes);
          setSelectedCurrentRouteIndex(0);
        } else {
          setCurrentRouteOptions([]);
        }
      } catch (err) {
        console.error("TomTom fetch failed:", err);
        setCurrentRouteOptions([]);
      }
      setIsLoadingCurrentRoutes(false);
    } else {
      setIsLoadingCurrentRoutes(true);
      try {
        const currentRoutes = await fetchOTPRoute(originCoords, destinationCoords, departureTime, arriveBy, dayType, true);
        if (currentRoutes && currentRoutes.length > 0) {
          setCurrentRouteOptions(currentRoutes);
          setSelectedCurrentRouteIndex(0);
        } else {
          setCurrentRouteOptions([]);
        }
      } catch (error) {
        console.error('Error loading current routes:', error);
        setCurrentRouteOptions([]);
      }
      setIsLoadingCurrentRoutes(false);
      setCompareMode('comparing');
    }
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
    setShouldFitMap(false);
    setCompareMode('default');
    setCurrentRouteOptions([]);
    setSelectedTravelMode(null);
  };

  // Handle route selection
  const handleRouteSelection = (index) => {
    setSelectedRouteIndex(index);
    setOtpTravelTime(Math.round(routeOptions[index].duration / 60));
    setTravelTime(Math.round(routeOptions[index].duration / 60));
    setFitTriggerType('route-select');
    setShouldFitMap(true);
  };

  // Handle current route selection
  const handleCurrentRouteSelection = (index) => {
  console.log(`Selecting driving route ${index} out of ${currentRouteOptions.length} routes`);
  console.log(`Previous selectedCurrentRouteIndex: ${selectedCurrentRouteIndex}`);
  
  // Force state update
  setSelectedCurrentRouteIndex(prevIndex => {
    console.log(`Updating from ${prevIndex} to ${index}`);
    return index;
  });
  
  // Optional: Force map refresh after state update
  setTimeout(() => {
    if (currentMapInstance && currentMapInstance.getContainer && currentMapInstance._loaded) {
      try {
        currentMapInstance.invalidateSize();
      } catch (e) {
        console.warn("Map invalidate failed:", e);
      }
    }
  }, 100);
};


  // Check if current route uses new transit lines
  const currentRouteHasNewTransit = routeOptions.length > 0 && hasNewRoute(routeOptions[selectedRouteIndex]);

  // Determine map layout styles based on compare mode
  const getMapStyles = () => {
    if (compareMode === 'default') {
      return {
        mapContainer: {
          position: 'fixed',
          left: '400px',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100vh'
        }
      };
    } else {
      return {
        mapContainer: {
          position: 'fixed',
          left: '400px',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100vh',
          display: 'flex',
          backgroundColor: '#f8f9fa'
        },
        leftMap: {
          flex: '1',
          height: '100%',
          position: 'relative',
          minWidth: 0, // This is important for flex items
          borderRight: '3px solid #dee2e6'
        },
        rightPanel: {
          flex: '1',
          height: '100%',
          position: 'relative',
          backgroundColor: '#f8f9fa',
          minWidth: 0 // This is important for flex items
        }
      };
    }
  };

  const mapStyles = getMapStyles();

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

  // Determine what to show in the sidebar based on compare mode
  const renderSidebarContent = () => {
    if (compareMode === 'default') {
      // Default mode - show normal interface
      return (
        <>
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

          {/* Route Options Container */}
          {routeOptions.length > 0 && (
            <div style={{ flex: '1 1 auto', minHeight: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                Route Options
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: currentRouteHasNewTransit ? '120px' : '80px' }}>
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
                      </div>
                      
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
        </>
      );
    } else {
      // Compare mode - show frozen state with selected route
      return (
        <>
      {/* Frozen Trip Information */}
      <div style={{ 
        marginBottom: '16px',
        flex: '0 0 auto'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
          Trip Information
        </h3>
        
        {/* Frozen Address Display */}
        <div style={{ 
          border: '2px solid #e1e5e9', 
          borderRadius: '6px', 
          backgroundColor: '#f8f9fa',
          overflow: 'hidden',
          marginBottom: '12px',
          opacity: 0.8
        }}>
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
            <span style={{ fontSize: '14px', color: '#000000', fontWeight: '500' }}>{origin}</span>
          </div>
          
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
            <span style={{ fontSize: '14px', color: '#000000', fontWeight: '500' }}>{destination}</span>
          </div>
        </div>

        {/* Frozen Travel Time Controls */}
          <div style={{ 
            border: '2px solid #e1e5e9', 
            borderRadius: '6px', 
            backgroundColor: '#f8f9fa',
            padding: '8px 12px',
            marginBottom: '12px',
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#000000', fontWeight: '500' }}>
                {arriveBy ? 'Arrive by' : 'Leave at'}
              </span>
              <span style={{ fontSize: '12px', color: '#000000', fontWeight: '600' }}>
                {departureTime}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#000000', fontWeight: '500' }}>
              {dayType}
            </span>
          </div>
        </div>

          {/* Future Route Card */}
          {routeOptions.length > 0 && (
            <div style={{ flex: '0 0 auto', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                Future Route
              </h3>
              {(() => {
                const route = routeOptions[selectedRouteIndex];
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

                return (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: '#e8f4fd',
                      color: '#000',
                      border: '2px solid #007bff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      boxShadow: '0 2px 6px rgba(0,123,255,0.15)',
                      animation: compareMode === 'selecting' ? 'slideUp 0.3s ease-out' : 'none'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '10px'
                    }}>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '700',
                        color: '#007bff'
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
                    </div>
                    
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
                  </div>
                );
              })()}
            </div>
          )}

          {/* Current Route Options - only show when comparing and not vehicle mode */}
          {compareMode === 'comparing' && selectedTravelMode !== 'vehicle' && (
            <div style={{ flex: '1 1 auto', minHeight: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                Current Route Options
              </h3>
              
              {isLoadingCurrentRoutes ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#6c757d',
                  fontSize: '14px'
                }}>
                  Loading current routes...
                </div>
              ) : currentRouteOptions.length > 0 ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px', 
                  paddingBottom: '80px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {currentRouteOptions.map((route, index) => {
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

                    return (
                      <button
                        key={route.id}
                        style={{
                          padding: '16px',
                          backgroundColor: selectedCurrentRouteIndex === index ? '#fff5f5' : '#fff',
                          color: '#000',
                          border: `2px solid ${selectedCurrentRouteIndex === index ? '#dc3545' : '#e1e5e9'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          boxShadow: selectedCurrentRouteIndex === index ? '0 2px 6px rgba(220,53,69,0.15)' : '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                        onClick={() => handleCurrentRouteSelection(index)}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '10px'
                        }}>
                          <div style={{ 
                            fontSize: '20px', 
                            fontWeight: '700',
                            color: selectedCurrentRouteIndex === index ? '#dc3545' : '#28a745'
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
                        </div>
                        
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
              ) : (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#6c757d',
                  fontSize: '14px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '6px',
                  backgroundColor: '#f8f9fa'
                }}>
                  No current routes found for this trip.
                </div>
              )}
            </div>
          )}

          {/* Message for vehicle mode */}
          {compareMode === 'comparing' && selectedTravelMode === 'vehicle' && (
            <div style={{ flex: '1 1 auto', paddingBottom: '80px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#495057' }}>
                Driving Route Options
              </h3>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px', 
                paddingBottom: '80px',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {currentRouteOptions.map((route, index) => {
                  // Calculate traffic impact
                  const trafficRatio = route.delay / route.duration;
                  let trafficColor = "#28a745"; // Green for light traffic
                  
                  if (trafficRatio > 0.3) {
                    trafficColor = "#dc3545"; // Red for heavy traffic
                  } else if (trafficRatio > 0.15) {
                    trafficColor = "#fd7e14"; // Orange for moderate traffic
                  } else if (trafficRatio > 0.05) {
                    trafficColor = "#ffc107"; // Yellow for light-moderate traffic
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
                      key={route.id}
                      style={{
                        padding: '16px', // EXACT same as transit cards
                        backgroundColor: selectedCurrentRouteIndex === index ? '#fff5f5' : '#fff',
                        color: '#000',
                        border: `2px solid ${selectedCurrentRouteIndex === index ? '#dc3545' : '#e1e5e9'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        boxShadow: selectedCurrentRouteIndex === index ? '0 2px 6px rgba(220,53,69,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                        minHeight: '120px' // Same minimum height as transit cards
                      }}
                      onClick={() => handleCurrentRouteSelection(index)}
                    >
                      {/* EXACT same structure as transit cards */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '10px' // EXACT same margin as transit
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
                            fontSize: '20px', // EXACT same as transit
                            fontWeight: '700',
                            color: selectedCurrentRouteIndex === index ? '#dc3545' : '#28a745'
                          }}>
                            {Math.round(route.duration / 60)} min
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: '16px', // EXACT same as transit
                          fontWeight: '600',
                          color: '#495057',
                          textAlign: 'right'
                        }}>
                          <div>{departure}</div>
                          <div style={{ fontSize: '12px', color: '#6c757d' }}>to {arrival}</div>
                        </div>
                      </div>

                      {/* Second row - same structure as transit */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '10px', // EXACT same as transit
                        fontSize: '12px',
                        color: '#6c757d'
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
                            backgroundColor: '#fff3cd',
                            color: '#856404',
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
                      
                      {/* Third row - roads display, same structure as transit legs */}
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        alignItems: 'center',
                        minHeight: '20px' // EXACT same as transit
                      }}>
                        {majorRoads.length > 0 ? (
                          <>
                            <span style={{ 
                              fontSize: '10px', 
                              color: '#6c757d', 
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
                                    backgroundColor: '#6c757d',
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
                                    color: '#6c757d',
                                    fontSize: '10px'
                                  }}>→</span>
                                )}
                              </React.Fragment>
                            ))}
                          </>
                        ) : (
                          <span style={{ 
                            fontSize: '10px', 
                            color: '#6c757d',
                            fontStyle: 'italic'
                          }}>
                            Alternative route {index + 1}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      );
    }
  };

  // Centralized resize handling
  useEffect(() => {
    const resizeMaps = () => {
      if (mapInstance && mapInstance.getContainer && mapInstance._loaded) {
        try {
          mapInstance.invalidateSize();
        } catch (e) {
          console.warn("Future map resize failed:", e);
        }
      }
      if (currentMapInstance && currentMapInstance.getContainer && currentMapInstance._loaded) {
        try {
          currentMapInstance.invalidateSize();
        } catch (e) {
          console.warn("Current map resize failed:", e);
        }
      }
    };

    // Run once when compareMode changes
    requestAnimationFrame(resizeMaps);

    // Also listen for window resizes
    window.addEventListener("resize", resizeMaps);
    return () => window.removeEventListener("resize", resizeMaps);
  }, [compareMode, mapInstance, currentMapInstance]);

  return (
    <div style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Include Font Awesome CSS */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
      
      {/* Add CSS for animations */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes mapShrink {
          from {
            width: 100%;
          }
          to {
            width: 50%;
          }
        }
        
        .map-shrink {
          animation: mapShrink 0.5s ease-out forwards;
        }
      `}</style>
      
      {/* User Profile Modal */}
      <UserProfileModal 
        isOpen={showUserProfileModal}
        onClose={() => setShowUserProfileModal(false)}
        onSubmit={handleUserProfileSubmit}
      />
      
      {/* No Routes Found Modal */}
      <NoRoutesFoundModal 
        isOpen={showNoRoutesModal}
        onClose={() => setShowNoRoutesModal(false)}
      />

      <UnaffectedRouteModal
        isOpen={showUnaffectedModal}
        onClose={() => setShowUnaffectedModal(false)}
      />
      <ChangedODModal
        isOpen={showChangedODModal}
        onClose={() => setShowChangedODModal(false)}
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
          {renderSidebarContent()}
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
            {/* Compare/Back button logic */}
            {compareMode === 'default' &&  (
              <button
                onClick={handleCompareClick}
                style={{
                  ...buttonStyle,
                  margin: '0',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#0056b3'}
                onMouseOut={e => e.target.style.backgroundColor = '#007bff'}
              >
                Compare to Today
              </button>
            )}
            
            {compareMode !== 'default' && (
              <button
                onClick={handleBackFromCompare}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#6c757d',
                  margin: '0',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#5a6268'}
                onMouseOut={e => e.target.style.backgroundColor = '#6c757d'}
              >
                Back
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

      {/* Map Container */}
      <div style={mapStyles.mapContainer}>
        {compareMode === 'default' ? (
          // Single map in default mode
          <MapContainer 
            center={[43.7, -79.4]} 
            zoom={11.8} 
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            
            <MapHandler setMapInstance={setMapInstance} />
            <CustomZoomControl compareMode={compareMode} />
            
            <TransitLines showLines={routeOptions.length === 0} transitLines={parsedTransitLines.length > 0 ? parsedTransitLines : TRANSIT_LINES} />
            
            <MapClickHandler 
              onOriginSet={handleOriginSet}
              onDestinationSet={handleDestinationSet}
              originCoords={originCoords}
              destinationCoords={destinationCoords}
              mapMode={mapMode}
            />
            
            <DraggableMarker
              position={originCoords}
              onDragEnd={handleOriginDrag}
              icon={originIcon}
              popupText="Origin (A) - Drag to move"
              isDisabled={compareMode !== 'default'}
            />
            <DraggableMarker
              position={destinationCoords}
              onDragEnd={handleDestinationDrag}
              icon={destinationIcon}
              popupText="Destination (B) - Drag to move"
              isDisabled={compareMode !== 'default'}
            />
            
            {routeOptions.length > 0 && routeOptions[selectedRouteIndex] ? (
              <div key={`route-${selectedRouteIndex}`}>
                <TransferMarkers 
                  route={routeOptions[selectedRouteIndex]} 
                  selectedRouteIndex={selectedRouteIndex}
                />
                
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
        ) : (
          // Split screen in compare mode
          <>
            {/* Left map - Future routes */}
            <div style={mapStyles.leftMap}>
                <MapContainer 
                  key={`left-map-${compareMode}`} // This will force a complete remount
                  center={[43.7, -79.4]} 
                  zoom={11.8} 
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                
                <MapHandler setMapInstance={setMapInstance} />
                <CustomZoomControl compareMode={compareMode} />
                
                <TransitLines showLines={false} transitLines={parsedTransitLines.length > 0 ? parsedTransitLines : TRANSIT_LINES} />
                
                <DraggableMarker
                  position={originCoords}
                  onDragEnd={() => {}}
                  icon={originIcon}
                  popupText="Origin (A)"
                  isDisabled={true}
                />
                <DraggableMarker
                  position={destinationCoords}
                  onDragEnd={() => {}}
                  icon={destinationIcon}
                  popupText="Destination (B)"
                  isDisabled={true}
                />
                
                {routeOptions.length > 0 && routeOptions[selectedRouteIndex] && (
                  <div key={`future-route-${selectedRouteIndex}`}>
                    <TransferMarkers 
                      route={routeOptions[selectedRouteIndex]} 
                      selectedRouteIndex={selectedRouteIndex}
                    />
                    
                    {routeOptions[selectedRouteIndex].legs.map((leg, legIndex) => {
                      try {
                        if (!leg.legGeometry || !leg.legGeometry.points) {
                          return (
                            <ClickableTransitLeg
                              key={`future-route-${selectedRouteIndex}-leg-${legIndex}`}
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
                            key={`future-route-${selectedRouteIndex}-leg-${legIndex}`}
                            leg={leg}
                            legIndex={legIndex}
                            selectedRouteIndex={selectedRouteIndex}
                            coords={coords}
                          />
                        );
                      } catch (error) {
                        console.error("Error rendering future leg", legIndex, error);
                        return null;
                      }
                    })}
                  </div>
                )}
                
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
                  shouldFit={true}
                  triggerType={'compare'}
                />
              </MapContainer>
              
              {/* Future route label */}
              <div style={{
                position: 'absolute',
                //top: '10px',
                //left: '10px',
                top: 0,
                left: 0,
                right: 0,
                textAlign: 'center',
                backgroundColor: 'rgba(0, 123, 255, 0.9)',
                color: 'white',
                padding: '8px 12px',
                //borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                zIndex: 1000
              }}>
                Future Route (with new transit lines)
              </div>
            </div>

            {/* Right panel */}
            <div style={mapStyles.rightPanel}>
              {compareMode === 'selecting' && (
                <TravelModeModal 
                  isOpen={showTravelModeModal}
                  onClose={() => {}}
                  onModeSelect={handleTravelModeSelect}
                />
              )}
              
              {compareMode === 'comparing' && selectedTravelMode !== 'vehicle' && (
                <>
                  {/* Current route map */}
                  <MapContainer 
                    center={[43.7, -79.4]} 
                    zoom={11.8} 
                    style={{ height: "100%", width: "100%" }} // Make sure this is set
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    
                    <MapHandler setMapInstance={setCurrentMapInstance} />
                    <CustomZoomControl compareMode={compareMode} />
                    
                    <TransitLines showLines={false} transitLines={parsedTransitLines.length > 0 ? parsedTransitLines : TRANSIT_LINES} />
                    
                    <DraggableMarker
                      position={originCoords}
                      onDragEnd={() => {}}
                      icon={originIcon}
                      popupText="Origin (A)"
                      isDisabled={true}
                    />
                    <DraggableMarker
                      position={destinationCoords}
                      onDragEnd={() => {}}
                      icon={destinationIcon}
                      popupText="Destination (B)"
                      isDisabled={true}
                    />
                    
                    {currentRouteOptions.length > 0 && currentRouteOptions[selectedCurrentRouteIndex] && (
                      <div key={`current-route-${selectedCurrentRouteIndex}`}>
                        <TransferMarkers 
                          route={currentRouteOptions[selectedCurrentRouteIndex]} 
                          selectedRouteIndex={selectedCurrentRouteIndex}
                        />
                        
                        {currentRouteOptions[selectedCurrentRouteIndex].legs.map((leg, legIndex) => {
                          try {
                            if (!leg.legGeometry || !leg.legGeometry.points) {
                              return (
                                <ClickableTransitLeg
                                  key={`current-route-${selectedCurrentRouteIndex}-leg-${legIndex}`}
                                  leg={leg}
                                  legIndex={legIndex}
                                  selectedRouteIndex={selectedCurrentRouteIndex}
                                  coords={[[leg.from.lat, leg.from.lon], [leg.to.lat, leg.to.lon]]}
                                />
                              );
                            }

                            const coords = polyline.decode(leg.legGeometry.points);
                            return (
                              <ClickableTransitLeg
                                key={`current-route-${selectedCurrentRouteIndex}-leg-${legIndex}`}
                                leg={leg}
                                legIndex={legIndex}
                                selectedRouteIndex={selectedCurrentRouteIndex}
                                coords={coords}
                              />
                            );
                          } catch (error) {
                            console.error("Error rendering current leg", legIndex, error);
                            return null;
                          }
                        })}
                      </div>
                    )}
                    
                    {currentRouteOptions.length > 0 && currentMapInstance && (
                      <RoutePills 
                        route={currentRouteOptions[selectedCurrentRouteIndex]} 
                        selectedRouteIndex={selectedCurrentRouteIndex}
                        map={currentMapInstance} 
                        originCoords={originCoords}
                        destinationCoords={destinationCoords}
                      />
                    )}
                    
                    <FitMap 
                      originCoords={originCoords} 
                      destinationCoords={destinationCoords} 
                      routeLegs={currentRouteOptions[selectedCurrentRouteIndex]?.legs || []}
                      shouldFit={true}
                      triggerType={'compare'}
                    />
                  </MapContainer>
                  
                  {/* Current route label */}
                  <div style={{
                    position: 'absolute',
                    //top: '10px',
                    //left: '10px',
                    top: 0,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    backgroundColor: 'rgba(220, 53, 69, 0.9)',
                    color: 'white',
                    padding: '8px 12px',
                    //borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 1000
                  }}>
                    Current Route (existing transit)
                  </div>
                </>
              )}
              
              {compareMode === 'comparing' && selectedTravelMode === 'vehicle' && (
                <>
                  <MapContainer
                    center={[43.7, -79.4]}
                    zoom={11.8}
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />

                    <MapHandler setMapInstance={setCurrentMapInstance} />
                    <CustomZoomControl compareMode={compareMode} />

                    <DraggableMarker
                      position={originCoords}
                      onDragEnd={() => {}}
                      icon={originIcon}
                      popupText="Origin (A)"
                      isDisabled={true}
                    />
                    <DraggableMarker
                      position={destinationCoords}
                      onDragEnd={() => {}}
                      icon={destinationIcon}
                      popupText="Destination (B)"
                      isDisabled={true}
                    />

                    {/* FIXED: Add key prop to force re-render when selection changes */}
                    {currentRouteOptions.map((route, index) => {
                      const isSelected = index === selectedCurrentRouteIndex;
                      
                      return (
                        <Polyline
                          key={`car-route-${index}-selected-${selectedCurrentRouteIndex}`} // Forces re-render
                          positions={route.points.map(pt => [pt.latitude, pt.longitude])}
                          color={isSelected ? "#dc3545" : "#5e3a3eff"}
                          weight={isSelected ? 4 : 3}
                          opacity={isSelected ? 1.0 : 0.3}
                          eventHandlers={{
                            click: () => {
                              console.log(`Map clicked on route ${index}`);
                              handleCurrentRouteSelection(index);
                            },
                            mouseover: (e) => {
                              if (!isSelected) {
                                e.target.setStyle({ color: "#ff6666", weight: 5, opacity: 0.7 });
                              }
                            },
                            mouseout: (e) => {
                              if (!isSelected) {
                                e.target.setStyle({ color: "#999999", weight: 3, opacity: 0.3 });
                              }
                            }
                          }}
                        />
                      );
                    })}

                    <FitMap
                      originCoords={originCoords}
                      destinationCoords={destinationCoords}
                      routeLegs={[]}
                      shouldFit={true}
                      triggerType={'compare'}
                    />
                  </MapContainer>

                  {/* Driving route label */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    backgroundColor: 'rgba(220, 53, 69, 0.9)',
                    color: 'white',
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 1000
                  }}>
                    Driving Route (TomTom)
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;