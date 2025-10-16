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

const createTransferIcon = () => {
  return L.divIcon({
    className: 'transfer-marker',
    html: `
      <div style="
        background-color: ${COLORS.transferMarker};
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
    zIndexOffset: -5000
  });
};

const createRoutePillIcon = (routeName, duration, color, textColor = 'white', mode = null, isNewRoute = false) => {
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

const originIcon = createCustomIcon(COLORS.originMarker, false);
const destinationIcon = createCustomIcon(COLORS.destinationMarker, true);
const transferIcon = createTransferIcon();

// Helper functions
const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => x * Math.PI / 180;
  const [lat1, lon1] = coords1;
  const [lat2, lon2] = coords2;

  const R = 6371;
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

const getRouteColor = (leg) => {
  if (leg.route && leg.route.color) {
    return `#${leg.route.color}`;
  }
  
  const modeColors = {
    WALK: COLORS.WALK,
    BUS: COLORS.BUS,
    SUBWAY: COLORS.SUBWAY,
    TRAM: COLORS.TRAM,
    RAIL: COLORS.RAIL,
    FERRY: COLORS.FERRY
  };
  
  return modeColors[leg.mode] || '#6c757d';
};

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

const isWalkOnlyItinerary = (itinerary) => {
  return itinerary.legs.every(leg => leg.mode === 'WALK');
};

const deduplicateItineraries = (itineraries) => {
  const uniqueRoutes = new Map();
  
  itineraries.forEach(itinerary => {
    const routeSignature = itinerary.legs
      .filter(leg => leg.mode !== 'WALK')
      .map((leg, index) => {
        const transferPoint = index > 0 ? leg.from.name : '';
        return `${leg.mode}-${leg.route?.shortName || leg.mode}-${transferPoint}`;
      })
      .join('|');
    
    const signature = routeSignature || `WALK-${itinerary.legs[0]?.from?.lat}-${itinerary.legs[0]?.from?.lon}-${itinerary.legs[itinerary.legs.length-1]?.to?.lat}-${itinerary.legs[itinerary.legs.length-1]?.to?.lon}`;
    
    if (!uniqueRoutes.has(signature)) {
      uniqueRoutes.set(signature, itinerary);
    }
  });
  
  return Array.from(uniqueRoutes.values());
};

const sortItineraries = (itineraries) => {
  if (itineraries.length <= 1) return itineraries;
  
  const nonWalkOnly = itineraries.filter(itinerary => !isWalkOnlyItinerary(itinerary));
  const walkOnly = itineraries.filter(itinerary => isWalkOnlyItinerary(itinerary));
  
  return [...nonWalkOnly, ...walkOnly];
};

// Configuration for new routes
const NEW_ROUTES_CONFIG = {
  routeIdentifiers: [
    { type: 'longName', value: 'LINE 5 (EGLINTON)' },
    { type: 'longName', value: 'LINE 6 (FINCH WEST)' }
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

const getLineMidpoint = (coordinates) => {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0];
  
  const midIndex = Math.floor(coordinates.length / 2);
  return coordinates[midIndex];
};

// Enhanced fetchTomTomRoute function with better debugging:
// Corrected TomTom API function with proper parameters and road extraction
const fetchTomTomRoute = async (fromCoords, toCoords, departureTime, dayType, arriveBy = false) => {
  function isWeekend(date = new Date()) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
  
  // Get Toronto timezone offset (EDT/EST)
  const getTorontoTimezone = () => {
    const now = new Date();
    const january = new Date(now.getFullYear(), 0, 1);
    const july = new Date(now.getFullYear(), 6, 1);
    const stdTimezoneOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());
    const isDST = now.getTimezoneOffset() < stdTimezoneOffset;
    return isDST ? '-04:00' : '-05:00'; // EDT or EST
  };
  
  try {
    const apiKey = process.env.REACT_APP_TOMTOM_KEY;
    //const targetDate = isWeekend() ? getNextDateForDay(2) : getNextDateForDay(5);
    const targetDate = dayType === 'weekend' ? getNextDateForDay(6) : getNextDateForDay(2);
    const torontoOffset = getTorontoTimezone();
    console.log(targetDate, ", ", departureTime);
    
    // Format time properly for Toronto timezone
    const departAt = `${targetDate}T${departureTime}:00${torontoOffset}`;
    
    // Build URL with proper parameters based on TomTom documentation
    let url = `https://api.tomtom.com/routing/1/calculateRoute/${fromCoords[0]},${fromCoords[1]}:${toCoords[0]},${toCoords[1]}/json`;
    url += `?key=${apiKey}`;
    url += `&traffic=true`;
    url += `&computeTravelTimeFor=all`;
    url += `&routeType=fastest`;
    url += `&maxAlternatives=3`;
    url += `&instructionsType=text`;
    
    // ✅ Request all relevant section types for analysis
    url += `&sectionType=traffic`;
    url += `&sectionType=toll`;
    url += `&sectionType=importantRoadStretch`;
    url += `&sectionType=motorway`;
    url += `&sectionType=country`;
    url += `&sectionType=travelMode`;
    
    // Handle arrive by vs depart at
    if (arriveBy) {
      url += `&arriveAt=${departAt}`;
    } else {
      url += `&departAt=${departAt}`;
    }

    console.log("TomTom API URL:", url);

    const response = await fetch(url);
    const data = await response.json();

    console.log("TomTom API Full Response:", data);

    if (data.routes && data.routes.length > 0) {
      return data.routes.map((r, idx) => {
        const summary = r.summary;

        console.log(`Route ${idx} summary:`, summary);
        console.log(`Route ${idx} sections:`, r.sections);

        // ✅ 1. Extract major roads using importantRoadStretch sections FIRST
        let majorRoads = extractMajorRoadsFromSections(r.sections, r.guidance);
        
        // ✅ 2. Check for tolls using section analysis
        const hasTolls = checkForTolls(r.sections);
        
        // ✅ 3. Verify delay calculation (it should use summary values)
        const verifiedDelay = calculateTrafficDelay(summary);

        console.log(`Route ${idx} extracted major roads:`, majorRoads);
        console.log(`Route ${idx} has tolls:`, hasTolls);
        console.log(`Route ${idx} traffic delay verification:`, verifiedDelay);

        const routeData = {
          id: `car-${idx}`,
          mode: "CAR",
          duration: summary.travelTimeInSeconds,
          delay: verifiedDelay.trafficDelayInSeconds,
          distance: summary.lengthInMeters,
          points: r.legs.flatMap(leg => leg.points),
          departureTime: summary.departureTime,
          arrivalTime: summary.arrivalTime,
          hasTollRoad: hasTolls,
          majorRoads: majorRoads,
          // Additional fields for debugging/analysis
          routeAnalysis: {
            importantRoadSections: getImportantRoadSections(r.sections),
            tollSections: getTollSections(r.sections),
            trafficSections: getTrafficSections(r.sections),
            delayAnalysis: verifiedDelay
          },
          // Add route legs structure similar to transit for consistency
          legs: [{
            mode: 'CAR',
            duration: summary.travelTimeInSeconds,
            distance: summary.lengthInMeters,
            from: { 
              name: 'Origin',
              lat: fromCoords[0], 
              lon: fromCoords[1] 
            },
            to: { 
              name: 'Destination',
              lat: toCoords[0], 
              lon: toCoords[1] 
            },
            legGeometry: { 
              points: '' // TomTom uses different geometry format
            }
          }]
        };

        console.log(`Route ${idx} final data:`, routeData);
        return routeData;
      });
    }
    return null;
  } catch (error) {
    console.error("TomTom route error:", error);
    return null;
  }
};

// ✅ NEW: Extract major roads using importantRoadStretch sections as primary method
function extractMajorRoadsFromSections(sections, guidance) {
  let majorRoads = [];
  
  const importantRoadSections = sections.filter(section => 
    section.sectionType === 'IMPORTANT_ROAD_STRETCH'
  );
  
  if (importantRoadSections.length > 0) {
    console.log("Found important road stretch sections:", importantRoadSections);
    
    importantRoadSections.forEach(section => {
      try {
        // Safe extraction with object handling
        let roadName = null;
        
        if (section.streetName) {
          if (typeof section.streetName === 'string') {
            roadName = section.streetName.trim();
          } else if (typeof section.streetName === 'object') {
            roadName = section.streetName.text || section.streetName.name || null;
          }
        }
        
        if (roadName && roadName !== '' && !majorRoads.includes(roadName)) {
          majorRoads.push(roadName);
        } else if (section.roadNumbers && Array.isArray(section.roadNumbers) && section.roadNumbers.length > 0) {
          section.roadNumbers.forEach(roadNum => {
            const safeRoadNum = typeof roadNum === 'string' ? roadNum : String(roadNum);
            if (safeRoadNum && !majorRoads.includes(safeRoadNum)) {
              majorRoads.push(safeRoadNum);
            }
          });
        } else if (section.roadNumber) {
          const safeRoadNumber = typeof section.roadNumber === 'string' ? section.roadNumber : String(section.roadNumber);
          if (safeRoadNumber && !majorRoads.includes(safeRoadNumber)) {
            majorRoads.push(safeRoadNumber);
          }
        }
      } catch (error) {
        console.warn('Error processing section:', error, section);
      }
    });
  }
  
  // Continue with motorway sections if needed...
  // (apply same safe extraction pattern)
  
  return differentiateRoutes(majorRoads, sections);
}

// ✅ NEW: Differentiate routes when they use largely the same important roads
function differentiateRoutes(majorRoads, sections) {
  // If we have few major roads, add distinguishing characteristics
  if (majorRoads.length < 2) {
    // Look for distinctive sections
    const tollSections = sections.filter(s => s.sectionType === 'TOLL');
    const countrySections = sections.filter(s => s.sectionType === 'COUNTRY');
    
    // Add toll indicator
    if (tollSections.length > 0) {
      majorRoads.push('Toll Route');
    }
    
    // Add country changes if applicable
    if (countrySections.length > 1) {
      majorRoads.push('Multi-Country');
    }
    
    // Add traffic level indicator
    const trafficSections = sections.filter(s => s.sectionType === 'TRAFFIC');
    const heavyTrafficSections = trafficSections.filter(s => 
      s.effectiveSpeedInKmh && s.simpleCategory === 'JAM'
    );
    
    if (heavyTrafficSections.length > 0) {
      majorRoads.push('Heavy Traffic');
    }
  }
  
  return majorRoads.slice(0, 3); // Limit to 3 identifiers
}

// ✅ NEW: Extract roads from guidance instructions (improved fallback)
function extractRoadsFromGuidance(instructions) {
  const roads = [];
  
  instructions.forEach(instruction => {
    const text = instruction.instruction || instruction.message || '';
    
    // Enhanced regex patterns for road extraction
    const patterns = [
      /(?:onto|on|along|via|take|follow)\s+([A-Z]\d+[A-Z]?)/gi, // Highway numbers (A1, M25, etc.)
      /(?:onto|on|along|via|take|follow)\s+(Highway\s+\d+)/gi,   // Highway 401
      /(?:onto|on|along|via|take|follow)\s+([^,\.\s]+(?:\s+(?:Highway|Hwy|Route|Rd|Road|Ave|Avenue|St|Street|Blvd|Boulevard|Dr|Drive|Way|Pkwy|Parkway|Expy|Expressway))?)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const roadName = match.replace(/^(?:onto|on|along|via|take|follow)\s+/i, '').trim();
          if (roadName.length > 2 && !roads.includes(roadName)) {
            roads.push(roadName);
          }
        });
      }
    });
  });
  
  return roads.slice(0, 3);
}

// ✅ NEW: Check for tolls using section analysis (CORRECT METHOD)
function checkForTolls(sections) {
  // Look for toll sections in the route
  const tollSections = sections.filter(section => 
    section.sectionType === 'TOLL' || 
    section.sectionType === 'TOLL_ROAD' ||
    (section.sectionType === 'TRAVEL_MODE' && section.tollSummary)
  );
  
  console.log("Toll sections found:", tollSections);
  
  return tollSections.length > 0;
}

// ✅ NEW: Verify traffic delay calculation using summary values
function calculateTrafficDelay(summary) {
  const result = {
    trafficDelayInSeconds: summary.trafficDelayInSeconds || 0,
    calculationMethod: 'summary_direct',
    verification: null
  };
  
  // Verify the calculation if we have the component travel times
  if (summary.noTrafficTravelTimeInSeconds && summary.travelTimeInSeconds) {
    const calculatedDelay = summary.travelTimeInSeconds - summary.noTrafficTravelTimeInSeconds;
    
    result.verification = {
      directDelay: summary.trafficDelayInSeconds || 0,
      calculatedDelay: calculatedDelay,
      matches: Math.abs((summary.trafficDelayInSeconds || 0) - calculatedDelay) < 5 // 5 second tolerance
    };
    
    // Use the calculated delay if the direct one seems incorrect
    if (!result.verification.matches && calculatedDelay > 0) {
      result.trafficDelayInSeconds = calculatedDelay;
      result.calculationMethod = 'calculated_from_components';
    }
  }
  
  console.log("Traffic delay analysis:", result);
  return result;
}

// ✅ Helper functions to extract specific section types for analysis
function getImportantRoadSections(sections) {
  return sections.filter(section => section.sectionType === 'IMPORTANT_ROAD_STRETCH');
}

function getTollSections(sections) {
  return sections.filter(section => 
    section.sectionType === 'TOLL' || section.sectionType === 'TOLL_ROAD'
  );
}

function getTrafficSections(sections) {
  return sections.filter(section => section.sectionType === 'TRAFFIC');
}

// Update the existing helper function
function getNextDateForDay(targetDay) {
  const today = new Date();
  const result = new Date(today);
  while (result.getDay() !== targetDay) {
    result.setDate(result.getDate() + 1);
  }
  return result.toISOString().split("T")[0];
}

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
        modeWeight: {BUS: 1.1, SUBWAY: 0.9, RAIL: 0.85, TRAM: 0.95}
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
        modeWeight: {BUS: 1.1, SUBWAY: 0.9, RAIL: 0.85, TRAM: 0.95}
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
function TravelModeModal({ isOpen, onClose, onModeSelect }) {
  if (!isOpen) return null;

  const travelModes = [
    { id: 'transit', label: 'Transit (bus, subway, etc.)', icon: 'fas fa-bus' },
    { id: 'vehicle', label: 'Private motor vehicle (car, motorcycle, etc.)', icon: 'fas fa-car' },
    { id: 'other', label: 'Other (walking, cycling, scootering, etc.)', icon: 'fas fa-walking' },
    { id: 'none', label: "I don't make this trip regularly", icon: 'fas fa-question' }
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255,255,255,0.95)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: COLORS.bgPrimary,
        padding: '32px',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        border: `1px solid ${COLORS.border}`
      }}>
        <h2 style={{ 
          margin: '0 0 24px 0', 
          fontSize: '20px', 
          fontWeight: '600', 
          color: COLORS.textPrimary,
          textAlign: 'center'
        }}>
          How do you usually make this trip?
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {travelModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              style={{
                padding: '16px 20px',
                backgroundColor: 'transparent',
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: COLORS.textBold,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s',
                textAlign: 'left'
              }}
              /*
              onMouseOver={e => {
                e.target.style.backgroundColor = COLORS.bgTertiaryHover;
                e.target.style.borderColor = COLORS.primary;
              }}
              onMouseOut={e => {
                e.target.style.backgroundColor = COLORS.bgTertiary;
                e.target.style.borderColor = COLORS.border;
              }}
              */
            >
              <i className={mode.icon} style={{ fontSize: '20px', color: COLORS.textSecondary, width: '24px' }}></i>
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// User Profile Modal Component
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
        backgroundColor: COLORS.bgPrimary,
        padding: '32px',
        borderRadius: '12px',
        width: '460px',
        maxWidth: '90vw',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '20px', 
          fontWeight: '600', 
          color: COLORS.textPrimary 
        }}>
          Two quick questions:
        </h2>
        <p style={{ 
          marginBottom: '28px', 
          color: COLORS.textSecondary, 
          lineHeight: '1.5',
          fontSize: '14px'
        }}>
          These help me understand who is using the website.
        </p>
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{ 
            display: 'block',
            margin: '0 0 10px 0', 
            fontSize: '15px', 
            fontWeight: '500',
            color: COLORS.textPrimary
          }}>
            Do you own or have regular access to a motor vehicle (car, motorcycle)?
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setHasVehicle(true)}
              style={{
                flex: 1,
                padding: '11px',
                backgroundColor: hasVehicle === true ? COLORS.primary : 'transparent',
                color: hasVehicle === true ? 'white' : COLORS.textPrimary,
                border: '1.5px solid ' + (hasVehicle === true ? COLORS.primary : COLORS.border),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Yes
            </button>
            <button 
              onClick={() => setHasVehicle(false)}
              style={{
                flex: 1,
                padding: '11px',
                backgroundColor: hasVehicle === false ? COLORS.primary : 'transparent',
                color: hasVehicle === false ? 'white' : COLORS.textPrimary,
                border: '1.5px solid ' + (hasVehicle === false ? COLORS.primary : COLORS.border),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              No
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={{ 
            display: 'block',
            margin: '0 0 10px 0', 
            fontSize: '15px', 
            fontWeight: '500',
            color: COLORS.textPrimary
          }}>
            Would you classify yourself as a regular transit user?
            <span style={{ 
              display: 'block',
              fontSize: '13px', 
              color: COLORS.textSecondary,
              fontWeight: '400',
              marginTop: '4px'
            }}>
              (more than 2 trips on transit per week)
            </span>
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setIsRegularTransitUser(true)}
              style={{
                flex: 1,
                padding: '11px',
                backgroundColor: isRegularTransitUser === true ? COLORS.primary : 'transparent',
                color: isRegularTransitUser === true ? 'white' : COLORS.textPrimary,
                border: '1.5px solid ' + (isRegularTransitUser === true ? COLORS.primary : COLORS.border),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              Yes
            </button>
            <button 
              onClick={() => setIsRegularTransitUser(false)}
              style={{
                flex: 1,
                padding: '11px',
                backgroundColor: isRegularTransitUser === false ? COLORS.primary : 'transparent',
                color: isRegularTransitUser === false ? 'white' : COLORS.textPrimary,
                border: '1.5px solid ' + (isRegularTransitUser === false ? COLORS.primary : COLORS.border),
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.2s'
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
            padding: '13px',
            backgroundColor: (hasVehicle !== null && isRegularTransitUser !== null) ? COLORS.advance : COLORS.bgSecondary,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: (hasVehicle !== null && isRegularTransitUser !== null) ? 'pointer' : 'not-allowed',
            opacity: (hasVehicle !== null && isRegularTransitUser !== null) ? 1 : 0.6
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// No Routes Found Modal Component
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
        backgroundColor: COLORS.bgPrimary,
        padding: '32px',
        borderRadius: '12px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: COLORS.danger }}>
          No Routes Found
        </h2>
        <p style={{ marginBottom: '20px', color: COLORS.textSecondary, lineHeight: '1.5' }}>
          No transit routes could be found for this trip. This might be because:
        </p>
        <ul style={{ marginBottom: '24px', color: COLORS.textSecondary, paddingLeft: '20px' }}>
          <li>Locations may be outside of the mappable area (presently only trips within Toronto, Mississauga, Brampton and York Region are supported),</li>
          <li>The locations are not well-connected by public transit,</li>
          <li>Issues with the route finding on our end.</li>
        </ul>
        <p style={{ marginBottom: '24px', color: COLORS.textBold, fontWeight: '500' }}>
          Try adjusting your departure time (add or subtract 5 minutes) or moving your origin and destination closer to a main road.
        </p>
        <button 
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: COLORS.primary,
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
}

function UnaffectedRouteModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ backgroundColor: COLORS.bgPrimary, padding: '24px', borderRadius: '8px', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '12px', color: COLORS.primary }}>Route Unaffected</h2>
        <p>Your selected route only uses transit lines that exist today.  
        If this is your preferred route for this trip, then your trip will be unaffected by the new transit services.</p>
        <p>Is this your preferred route for this trip?</p>
        <button onClick={onClose} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: COLORS.primary, color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
          Okay
        </button>
      </div>
    </div>
  );
}

function ChangedODModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ backgroundColor: COLORS.bgPrimary, padding: '24px', borderRadius: '8px', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '12px', color: COLORS.danger }}>Origin/Destination Changed</h2>
        <p>It looks like your origin or destination has changed since your last search.  
        Please find a route for this trip before comparing.</p>
        <button onClick={onClose} style={{ marginTop: '12px', padding: '8px 16px', backgroundColor: COLORS.primary, color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
          Got it
        </button>
      </div>
    </div>
  );
}

// FAQ Modal Component - add before the return statement
function FAQModal({ isOpen, onClose }) {
  const handlePrivacyClick = (e) => {
    e.preventDefault();
    
    const confirmed = window.confirm(
      "You may lose any unsaved route data if you navigate to the privacy policy. Are you sure you want to continue?"
    );
    
    if (confirmed) {
      // Get current path and open in new tab
      const currentPath = window.location.pathname;
      const privacyUrl = '/privacy?from=' + encodeURIComponent(currentPath);
      window.open(privacyUrl, '_blank', 'noopener,noreferrer');
    }
    
    return false;
  };

  React.useEffect(() => {
    window.handlePrivacyClick = handlePrivacyClick;
    return () => {
      delete window.handlePrivacyClick;
    };
  }, []);

  if (!isOpen) return null;


  const faqs = [
    {
      question: "What is this?",
      answer: "This is a research tool to help understand how new transit lines (like the Eglinton Crosstown LRT and Finch West LRT) might change travel patterns in Toronto. It however doubles as a public-facing tool for you to explore our hopefully soon-to-be transit network. Please also note this is a prototype tool and will have errors."
    },
    {
      question: "Why does my data and input matter?",
      answer: "Your data helps transportation planners and engineers understand what things are important and what things we should be prioritizing. The more information we have from tools like this, the more effectively we can work to deliver a transportation system that meet your needs."
    },
    {
      question: "What new routes are currently included?",
      answer: "Currently, the Eglinton Crosstown LRT and Finch West LRT, both projected to open in 2025, are included. Lines that are further from completion, such as the Ontario Line, are not included as of now."
    },
    {
      question: "How accurate are the route predictions and travel times?",
      answer: "The future routes are determined use my best estimates at travel times, and also do not encapsulate all expected changes to the bus network. Current transit routes use the same basic data used by platforms such as Google Maps today. Current auto routes use data provided by TomTom, a well-regarded transportation data company."
    },
    {
      question: "Why are expected bus changes not incorporated?",
      answer: "Programming in new LRTs is relatively simple, but modifying the bus network takes a lot of work. I'm waiting for the TTC and City of Toronto to release their latest bus network modifications in a format I can use, and will update the site once this becomes available."
    },
    {
      question: "Why aren't fares included/considered?",
      answer: "I am looking to add consideration for fares in the future, but as of right now it is difficult to incorporate. If you're someone who uses only local transit and avoids GO Transit, I apologize as the tool is not optimized for you yet."
    },
    {
      question: "Why can't I drag markers in compare mode?",
      answer: "Markers are locked during comparison to ensure you're comparing the same trip across different scenarios."
    },
    {
      question: "When I enter my address, why can't I find my exact location?",
      answer: `The software I'm using to find addresses is not the best; try using the "Click On Map" button to find your address. Sorry!`
    },
    {
      question: "What does 'new route' mean?",
      answer: "Routes marked with a star (✨) use newly opened or planned transit lines that aren't available in current service. This currently only includes the Eglinton Crosstown LRT and Finch West LRT."
    },
    {
      question: "How is travel time calculated?",
      answer: "Travel times include walking, waiting, and transit time."
    },
    {
      question: "Can I save my routes?",
      answer: "At present, this tool doesn't allow users to save routes. I may add this functionality in the future."
    },
    {
      question: "What if no routes are found?",
      answer: "Try different departure/arrival times (add or subtract 5 minutes). Please note that only trips within Toronto, Mississauga, Brampton and York Region are supported (apologies to the rest of the GTHA!)"
    },
    {
      question: "How do I interpret the comparison?",
      answer: "The left map shows future routes with new transit lines. The right shows current options of your usual travel mode. Consider travel times, but also number of transfers, the amount of walking required, etc."
    },
    {
      question: "How is my data used and stored?",
      answer: `All data you enter into the site is stored anonymously, and is used in research to better understand the things that matter to travelers. Read more about my privacy policy <a href='/privacy' rel='noopener noreferrer' style='color: ${COLORS.link}' onclick='return window.handlePrivacyClick(event)'>here</a>.`,
      isHTML: true
    },
    {
      question: "Why are you asking for my email?",
      answer: "A key feature of my research is that once the Eglinton Crosstown LRT and Finch West LRT open, I want to see if they meet users' expectations. I'm not a marketer, I'm just a transportation researcher, and will only use your data for research purposes."
    },
    {
      question: "Who are you?",
      answer: "I'm Alec Mak, a transportation consultant working in Toronto. I'm a recent civil engineering graduate from the University of Toronto, looking to keep my research skills sharp."
    },
    {
      question: "Do you know when the Eglinton Crosstown LRT will open?",
      answer: "Despite my profession, I have no information about the Eglinton Crosstown LRT's projected opening date. Full disclosure: I interned at Metrolinx in 2024, but was not privy to that information."
    },
    {
      question: "How can I contact you?",
      answer: "If you have any questions, concerns or comments, please reach out to me at futuretorontotransit@gmail.com."
    },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      zIndex: 4000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: COLORS.bgPrimary,
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          padding: '24px 32px 16px 32px',
        }}>
          <h2 style={{ 
            margin: '0', 
            fontSize: '20px', 
            fontWeight: '600', 
            color: COLORS.textPrimary,
          }}>
            Frequently Asked Questions
          </h2>
        </div>
        
        <div style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          padding: '16px 32px'
        }}>
          {faqs.map((faq, index) => (
            <div key={index} style={{ marginBottom: '24px' }}>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: COLORS.textBold
              }}>
                {faq.question}
              </h3>
              {faq.isHTML ? (
                <p 
                  style={{
                    margin: '0',
                    fontSize: '14px',
                    color: COLORS.textSecondary,
                    lineHeight: '1.5'
                  }}
                  dangerouslySetInnerHTML={{ __html: faq.answer }}
                />
              ) : (
                <p style={{
                  margin: '0',
                  fontSize: '14px',
                  color: COLORS.textSecondary,
                  lineHeight: '1.5'
                }}>
                  {faq.answer}
                </p>
              )}
            </div>
          ))}
        </div>
        
        <div style={{
          padding: '16px 32px 24px 32px',
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: COLORS.primary,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <div style={{ marginBottom: '16px', padding: '12px', border: `2px solid #e1e5e9`, borderRadius: '6px', backgroundColor: '#f8f9fa' }}>
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
          backgroundColor: COLORS.bgPrimary,
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
        onMouseOver={e => e.target.style.backgroundColor = COLORS.bgPrimaryHover}
        onMouseOut={e => e.target.style.backgroundColor = COLORS.bgPrimary}
      >
        +
      </button>
      <button
        style={{
          width: '34px',
          height: '34px',
          backgroundColor: COLORS.bgPrimary,
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
        onMouseOver={e => e.target.style.backgroundColor = COLORS.bgPrimaryHover}
        onMouseOut={e => e.target.style.backgroundColor = COLORS.bgPrimary}
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

// Replace the existing FitMap component
function FitMap({ originCoords, destinationCoords, routeLegs, shouldFit, triggerType, carRoutePoints}) {
  const map = useMap();
  
  React.useEffect(() => {
    if (!shouldFit || triggerType === 'drag') return;
    
    let allPoints = [];
    
    // Add origin and destination
    if (originCoords) allPoints.push(originCoords);
    if (destinationCoords) allPoints.push(destinationCoords);
    
    // Handle car route points (for driving routes)
    if (carRoutePoints && carRoutePoints.length > 0) {
      carRoutePoints.forEach(pt => {
        allPoints.push([pt.latitude, pt.longitude]);
      });
    }
    // Handle transit route legs
    else if (routeLegs && routeLegs.length > 0) {
      routeLegs.forEach(leg => {
        // Add leg endpoints
        allPoints.push([leg.from.lat, leg.from.lon]);
        allPoints.push([leg.to.lat, leg.to.lon]);
        
        // Add geometry points if available
        if (leg.legGeometry && leg.legGeometry.points) {
          try {
            const legPoints = polyline.decode(leg.legGeometry.points);
            allPoints.push(...legPoints);
          } catch (error) {
            console.warn("Error decoding polyline:", error);
          }
        }
      });
    }
    
    if (allPoints.length > 0) {
      // Remove duplicate points and ensure bounds make sense
      const uniquePoints = allPoints.filter((point, index, self) => 
        index === self.findIndex(p => p[0] === point[0] && p[1] === point[1])
      );
      
      if (uniquePoints.length === 1) {
        // Single point - center and zoom appropriately
        map.setView(uniquePoints[0], 14);
      } else {
        // Multiple points - fit bounds with padding
        const bounds = L.latLngBounds(uniquePoints);
        
        // Add padding based on the bounds size
        const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
        let padding = [50, 50]; // Default padding
        
        // Adjust padding for larger routes
        if (boundsSize > 20000) { // > 20km
          padding = [100, 100];
        } else if (boundsSize > 50000) { // > 50km  
          padding = [150, 150];
        }
        
        map.fitBounds(bounds, { 
          padding: padding,
          maxZoom: 15 // Prevent zooming in too much for long routes
        });
      }
    }
  }, [originCoords, destinationCoords, routeLegs, map, shouldFit, triggerType, carRoutePoints]);
  
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
                <span style={{ color: COLORS.textSecondary }}>Transfer Point</span>
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
            <span style={{ color: COLORS.textSecondary }}>Duration: {Math.round(leg.duration / 60)} minutes</span><br/>
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
          color: COLORS.textSecondary,
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
            <span style={{ color: COLORS.textSecondary }}>Duration: {Math.round((leg?.duration || pill.duration * 60) / 60)} minutes</span><br/>
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
  
  // Multi-route state
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [otpTravelTime, setOtpTravelTime] = useState(null);
  
  // Current routes state (for comparison)
  const [currentRouteOptions, setCurrentRouteOptions] = useState([]);
  const [selectedCurrentRouteIndex, setSelectedCurrentRouteIndex] = useState(0);
  
  // User profile state
  const [showUserProfileModal, setShowUserProfileModal] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  
  // No routes found modal state
  const [showNoRoutesModal, setShowNoRoutesModal] = useState(false);

  const [showFAQModal, setShowFAQModal] = useState(false);
  
  // Time/date controls
  const [departureTime, setDepartureTime] = useState('08:00');
  const [travelDate, setTravelDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [arriveBy, setArriveBy] = useState(false);
  const [dayType, setDayType] = useState('weekday');

  // Map interaction state
  const [mapMode, setMapMode] = useState('none');
  const [inputMode, setInputMode] = useState('text');

  // Route calculation state
  const [isCalculating, setIsCalculating] = useState(false);
  const [readyToCalculate, setReadyToCalculate] = useState(false);
  
  // Map fitting control
  const [shouldFitMap, setShouldFitMap] = useState(false);
  
  // Map reference
  const [mapInstance, setMapInstance] = useState(null);
  const [currentMapInstance, setCurrentMapInstance] = useState(null);

  const [parsedTransitLines, setParsedTransitLines] = useState([]);
  const [fitTriggerType, setFitTriggerType] = useState(null);

  // Compare mode states
  const [compareMode, setCompareMode] = useState('default'); // 'default', 'selecting', 'comparing'
  const [showTravelModeModal, setShowTravelModeModal] = useState(false);
  const [selectedTravelMode, setSelectedTravelMode] = useState(null);
  const [isLoadingCurrentRoutes, setIsLoadingCurrentRoutes] = useState(false);

  const [lastPlannedOrigin, setLastPlannedOrigin] = useState(null);
  const [lastPlannedDestination, setLastPlannedDestination] = useState(null);
  const [showUnaffectedModal, setShowUnaffectedModal] = useState(false);
  const [showChangedODModal, setShowChangedODModal] = useState(false);

  const handleBackFromCompare = () => {
    // Reset compare mode
    //setCompareMode("default");

    // Clear current routes so only future route shows
    //setCurrentRouteOptions([]);
    //setSelectedCurrentRouteIndex(null);

    // You don’t need invalidateSize here anymore,
    // central resize effect will handle it
      if (compareMode === "comparing") {
      // 👈 go back to the selecting step instead of all the way out
      setCompareMode("selecting");
      setShowTravelModeModal(true);   
      setCurrentRouteOptions([]);
      setSelectedCurrentRouteIndex(0);
    } else {
      // fallback: go to default mode
      setCompareMode("default");
      setCurrentRouteOptions([]);
      setSelectedCurrentRouteIndex(0);
    }
  };

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
  // Replace the existing handleCompareClick function
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

    // Try multiple selectors to find the map container
    let mapContainer = document.querySelector('[style*="position: fixed"][style*="left: 400px"]');
    
    if (!mapContainer) {
      // Fallback: find by content structure
      mapContainer = document.querySelector('.leaflet-container')?.parentElement?.parentElement;
    }
    
    if (!mapContainer) {
      // Another fallback: look for the map div by its position
      const allDivs = document.querySelectorAll('div');
      mapContainer = Array.from(allDivs).find(div => {
        const styles = window.getComputedStyle(div);
        return styles.position === 'fixed' && styles.left === '400px';
      });
    }
    
    if (mapContainer) {
      console.log('Found map container:', mapContainer);
      mapContainer.classList.add('map-transition');
      
      setTimeout(() => {
        mapContainer.classList.add('map-shrinking');
        console.log('Added shrinking class');
      }, 50);
    } else {
      console.log('Map container not found - available elements:', document.querySelectorAll('[style*="position"]'));
    }

    setTimeout(() => {
      setCompareMode('selecting');
      setShowTravelModeModal(true);
    }, 300);
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
        const carRoutes = await fetchTomTomRoute(originCoords, destinationCoords, departureTime, dayType, arriveBy);
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
  // Update the getMapStyles function
  const getMapStyles = () => {
    if (compareMode === 'default') {
      return {
        mapContainer: {
          position: 'fixed',
          left: '400px',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100vh',
          // Remove transition class when in default mode
          className: ''
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
          backgroundColor: COLORS.bgTertiary,
        },
        leftMap: {
          flex: '1',
          height: '100%',
          position: 'relative',
          minWidth: 0,
          borderRight: `3px solid ${COLORS.comparisonBorder}`
        },
        rightPanel: {
          flex: '1',
          height: '100%',
          position: 'relative',
          backgroundColor: COLORS.bgTertiary,
          minWidth: 0,
          className: compareMode === 'comparing' ? 'fade-in-right' : ''
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
    backgroundColor: COLORS.bgPrimary,
    borderRight: `1px solid ${COLORS.borderSidebar}`,
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column'
  };

  const buttonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.textSecondary,
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
              <h3 style={{ margin: '0', fontSize: '14px', fontWeight: '600', color: COLORS.textBold }}>
                Trip Information
              </h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{
                    ...smallButtonStyle,
                    backgroundColor: inputMode === 'text' ? COLORS.primary : COLORS.bgSecondary,
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
                    backgroundColor: inputMode === 'map' ? COLORS.primary : COLORS.bgSecondary,
                    marginBottom: '0',
                    fontSize: '11px',
                    padding: '4px 8px'
                  }}
                  onClick={() => setInputMode('map')}
                >
                  Click On Map
                </button>
              </div>
            </div>
            
            {/* Address Input Container */}
            <div style={{ 
              border: `2px solid ${COLORS.border}`, 
              borderRadius: '6px', 
              backgroundColor: COLORS.bgPrimary,
              overflow: 'hidden',
              marginBottom: '12px',
              position: 'relative'
            }}>
              {/* Origin input */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '8px 12px',
                borderBottom: `1px solid ${COLORS.border}`
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: COLORS.originMarker,
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
                  backgroundColor: COLORS.bgTertiary,
                  border: `1px solid ${COLORS.borderSecondary}`,
                  borderRadius: '4px',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: COLORS.textSecondary
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
                  backgroundColor: COLORS.destinationMarker,
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
                <p style={{ fontSize: '12px', color: COLORS.textSecondary, margin: '0 0 8px 0' }}>
                  Click the buttons below, then click on the map to set locations:
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    style={{
                      ...smallButtonStyle,
                      backgroundColor: mapMode === 'setOrigin' ? COLORS.originMarker : COLORS.bgSecondary,
                      marginBottom: '0'
                    }}
                    onClick={() => setMapMode(mapMode === 'setOrigin' ? 'none' : 'setOrigin')}
                  >
                    Set Origin (A)
                  </button>
                  <button
                    style={{
                      ...smallButtonStyle,
                      backgroundColor: mapMode === 'setDestination' ? COLORS.destinationMarker : COLORS.bgSecondary,
                      marginBottom: '0'
                    }}
                    onClick={() => setMapMode(mapMode === 'setDestination' ? 'none' : 'setDestination')}
                  >
                    Set Destination (B)
                  </button>
                  <button
                    style={{
                      ...smallButtonStyle,
                      backgroundColor: COLORS.warning,
                      color: 'white',
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
              border: `2px solid ${COLORS.border}`, 
              borderRadius: '6px', 
              backgroundColor: COLORS.bgPrimary,
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
                    <span style={{ fontSize: '12px', color: COLORS.textBold }}>Leave</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <input 
                      type="radio" 
                      checked={arriveBy} 
                      onChange={() => setArriveBy(true)}
                      style={{ marginRight: '4px' }}
                    />
                    <span style={{ fontSize: '12px', color: COLORS.textBold }}>Arrive</span>
                  </label>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="time" 
                    value={departureTime}
                    onChange={e => setDepartureTime(e.target.value)}
                    style={{
                      border: `1px solid ${COLORS.borderSecondary}`,
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '12px'
                    }}
                  />
                  
                  <select 
                    value={dayType}
                    onChange={e => setDayType(e.target.value)}
                    style={{
                      border: `1px solid ${COLORS.borderSecondary}`,
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
                backgroundColor: !readyToCalculate || isCalculating ? COLORS.bgSecondary : COLORS.primary,
                cursor: !readyToCalculate || isCalculating ? 'not-allowed' : 'pointer',
                marginBottom: '0'
              }}
              onMouseOver={e => {
                if (readyToCalculate && !isCalculating) {
                  e.target.style.backgroundColor = COLORS.primaryHover;
                }
              }}
              onMouseOut={e => {
                if (readyToCalculate && !isCalculating) {
                  e.target.style.backgroundColor = COLORS.primary;
                }
              }}
            >
              {isCalculating ? 'Finding Route...' : 'Find Route'}
            </button>
          </div>

          {/* Route Options Container */}
          {routeOptions.length > 0 && (
            <div style={{ flex: '1 1 auto', minHeight: '200px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: COLORS.textBold }}>
                Route Options
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '16px' }}> {/*currentRouteHasNewTransit ? '120px' : '80px' }}>*/}
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
                        backgroundColor: selectedRouteIndex === index ? COLORS.primaryLight : COLORS.bgPrimary,
                        color: COLORS.textBlack,
                        border: `2px solid ${selectedRouteIndex === index ? COLORS.primary : COLORS.border}`,
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
                          color: selectedRouteIndex === index ? COLORS.primary : COLORS.advance
                        }}>
                          {Math.round(route.duration / 60)} min
                        </div>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '600',
                          color: COLORS.textBold,
                          textAlign: 'right'
                        }}>
                          <div>{formatTime(route.startTime)}</div>
                          <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>to {formatTime(route.endTime)}</div>
                        </div>
                      </div>

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
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: COLORS.textBold }}>
            Trip Information
          </h3>
          
          {/* Frozen Address Display */}
          <div style={{ 
            border: `2px solid ${COLORS.border}`, 
            borderRadius: '6px', 
            backgroundColor: COLORS.bgTertiary,
            overflow: 'hidden',
            marginBottom: '12px',
            opacity: 0.8
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              padding: '8px 12px',
              borderBottom: `px solid ${COLORS.border}`
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: COLORS.originMarker,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                marginRight: '10px',
                flexShrink: 0
              }}>A</div>
              <span style={{ fontSize: '14px', color: COLORS.textBlack, fontWeight: '500' }}>{origin}</span>
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
                backgroundColor: COLORS.destinationMarker,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                marginRight: '10px',
                flexShrink: 0
              }}>B</div>
              <span style={{ fontSize: '14px', color: COLORS.textBlack, fontWeight: '500' }}>{destination}</span>
            </div>
          </div>

        {/* Frozen Travel Time Controls */}
          <div style={{ 
            border: `2px solid ${COLORS.border}`, 
            borderRadius: '6px', 
            backgroundColor: COLORS.bgTertiary,
            padding: '8px 12px',
            marginBottom: '12px',
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: COLORS.textBlack, fontWeight: '500' }}>
                {arriveBy ? 'Arrive by' : 'Leave at'}
              </span>
              <span style={{ fontSize: '12px', color: COLORS.textBlack, fontWeight: '600' }}>
                {departureTime}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: COLORS.textBlack, fontWeight: '500' }}>
              {dayType}
            </span>
          </div>
        </div>

          {/* Future Route Card */}
          {routeOptions.length > 0 && (
            <div style={{ flex: '0 0 auto', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: COLORS.textBold }}>
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
                      backgroundColor: COLORS.primaryLight,
                      color: COLORS.textBlack,
                      border: `2px solid ${COLORS.primary}`,
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
                        color: COLORS.primary
                      }}>
                        {Math.round(route.duration / 60)} min
                      </div>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: '600',
                        color: COLORS.textBold,
                        textAlign: 'right'
                      }}>
                        <div>{formatTime(route.startTime)}</div>
                        <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>to {formatTime(route.endTime)}</div>
                      </div>
                    </div>

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
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: COLORS.textBold }}>
                Current Route Options
              </h3>
              
              {isLoadingCurrentRoutes ? (
                <div style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: COLORS.textSecondary,
                  fontSize: '14px'
                }}>
                  Loading current routes...
                </div>
              ) : currentRouteOptions.length > 0 ? (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px', 
                  paddingBottom: '16px',
                  //maxHeight: '400px',
                  //overflowY: 'auto'
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
                          backgroundColor: selectedCurrentRouteIndex === index ? COLORS.presentLight : COLORS.bgPrimary,
                          color: COLORS.textBlack,
                          border: `2px solid ${selectedCurrentRouteIndex === index ? COLORS.present : COLORS.border}`,
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
                            color: selectedCurrentRouteIndex === index ? COLORS.present : COLORS.advance
                          }}>
                            {Math.round(route.duration / 60)} min
                          </div>
                          <div style={{ 
                            fontSize: '16px', 
                            fontWeight: '600',
                            color: COLORS.textBold,
                            textAlign: 'right'
                          }}>
                            <div>{formatTime(route.startTime)}</div>
                            <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>to {formatTime(route.endTime)}</div>
                          </div>
                        </div>

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
                  color: COLORS.textSecondary,
                  fontSize: '14px',
                  border: `2px solid ${COLORS.border}`,
                  borderRadius: '6px',
                  backgroundColor: COLORS.bgTertiary
                }}>
                  No current routes found for this trip.
                </div>
              )}
            </div>
          )}

          {/* Message for vehicle mode */}
          {compareMode === 'comparing' && selectedTravelMode === 'vehicle' && (
            <div style={{ flex: '1 1 auto', paddingBottom: '80px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: COLORS.textBold }}>
                Driving Route Options
              </h3>
              
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px', 
                paddingBottom: '16px',
                //maxHeight: '400px',
                //overflowY: 'auto'
              }}>
                {currentRouteOptions.map((route, index) => {
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
                      key={route.id}
                      style={{
                        padding: '16px', // EXACT same as transit cards
                        backgroundColor: selectedCurrentRouteIndex === index ? COLORS.presentLight : COLORS.bgPrimary,
                        color: COLORS.textBlack,
                        border: `2px solid ${selectedCurrentRouteIndex === index ? COLORS.present : COLORS.border}`,
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
                            color: selectedCurrentRouteIndex === index ? COLORS.present : COLORS.advance
                          }}>
                            {Math.round(route.duration / 60)} min
                          </div>
                        </div>
                        <div style={{ 
                          fontSize: '16px', // EXACT same as transit
                          fontWeight: '600',
                          color: COLORS.textBold,
                          textAlign: 'right'
                        }}>
                          <div>{departure}</div>
                          <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>to {arrival}</div>
                        </div>
                      </div>

                      {/* Second row - same structure as transit */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: '10px', // EXACT same as transit
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

        .map-transition {
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
          transform-origin: left center !important;
        }

        .map-shrinking {
          width: 50% !important;
          border-right: 3px solid ${COLORS.borderSecondary} !important;
        }

        .fade-in-right {
          animation: fadeInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
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
          <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: COLORS.textPrimary, letterSpacing: '-0.02em' }}>
            Future Toronto Transit Mapper
          </h1>
          <p style={{ color: COLORS.textSecondary, marginBottom: '16px', fontSize: '14px' }}> 
            Plan your trip and see how the Eglinton Crosstown LRT and Finch West LRT can help!

            Presently only searches within Toronto, Missisauga, Brampton, and York Region are supported.
          </p>
        </div>

        {/* Scrollable content area */}
        <div style={{ 
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 16px',
          paddingBottom: '16px', // Just normal padding at bottom
          marginBottom: tripHistory.length > 0 ? '120px' : '0' // Reserve space for buttons when they exist
        }}>
          {renderSidebarContent()}
        </div>

        {/* Fixed bottom buttons container - now truly separate */}
        {tripHistory.length > 0 && (
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '368px',
            backgroundColor: COLORS.bgPrimary,
            //borderTop: `1px solid ${COLORS.borderSidebar}`,
            padding: '16px',
            zIndex: 1001,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            //boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' // Subtle shadow above
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
                onMouseOver={e => e.target.style.backgroundColor = COLORS.primaryHover}
                onMouseOut={e => e.target.style.backgroundColor = COLORS.primary}
              >
                Compare Selected Route To Today
              </button>
            )}
            
            {compareMode !== 'default' && (
              <button
                onClick={handleBackFromCompare}
                style={{
                  ...buttonStyle,
                  backgroundColor: COLORS.bgSecondary,
                  margin: '0',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
                onMouseOver={e => e.target.style.backgroundColor = COLORS.bgSecondaryHover}
                onMouseOut={e => e.target.style.backgroundColor = COLORS.bgSecondary}
              >
                Back
              </button>
            )}
            
            {/* Finish Survey button */}
            <button
              onClick={() => navigate('/exit')}
              style={{
                ...buttonStyle,
                backgroundColor: COLORS.advance,
                margin: '0',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
              onMouseOver={e => e.target.style.backgroundColor = COLORS.advanceHover}
              onMouseOut={e => e.target.style.backgroundColor = COLORS.advance}
            >
              Try What-If Scenarios!
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
              <Polyline positions={[originCoords, destinationCoords]} color={COLORS.primary} weight={4} opacity={0.7} />
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
                backgroundColor: COLORS.primaryLabel,
                color: 'white',
                padding: '8px 12px',
                //borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                zIndex: 1000
              }}>
                Future Route (Using New Transit Network)
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
                    backgroundColor: COLORS.presentLabel,
                    color: 'white',
                    padding: '8px 12px',
                    //borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    zIndex: 1000
                  }}>
                    Current Route (Using Existing Transit Network)
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
                          color={isSelected ? COLORS.autoSelected : COLORS.autoLight}
                          weight={isSelected ? 4 : 3}
                          opacity={isSelected ? 1.0 : 0.3}
                          eventHandlers={{
                            click: () => {
                              console.log(`Map clicked on route ${index}`);
                              handleCurrentRouteSelection(index);
                            },
                            mouseover: (e) => {
                              if (!isSelected) {
                                e.target.setStyle({ color: COLORS.autoHover, weight: 5, opacity: 0.7 });
                              }
                            },
                            mouseout: (e) => {
                              if (!isSelected) {
                                e.target.setStyle({ color: COLORS.autoLight, weight: 3, opacity: 0.3 });
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
                    carRoutePoints={currentRouteOptions[selectedCurrentRouteIndex]?.points || []}
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
                    Current Route (Driving)
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ADD FAQ BUTTON AND MODAL HERE - right before the closing </div> */}
      <button
        onClick={() => setShowFAQModal(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: COLORS.primary,
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,123,255,0.3)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        onMouseOver={e => {
          e.target.style.backgroundColor = COLORS.primaryHover;
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseOut={e => {
          e.target.style.backgroundColor = COLORS.primary;
          e.target.style.transform = 'scale(1)';
        }}
        title="Frequently Asked Questions"
      >
        ?
      </button>

      <FAQModal 
        isOpen={showFAQModal}
        onClose={() => setShowFAQModal(false)}
      />
    </div>
  );
}

export default App;