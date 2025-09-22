// Route utility functions

export const isWalkOnlyItinerary = (itinerary) => {
  return itinerary.legs.every(leg => leg.mode === 'WALK');
};

export const deduplicateItineraries = (itineraries) => {
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

export const sortItineraries = (itineraries) => {
  if (itineraries.length <= 1) return itineraries;

  const nonWalkOnly = itineraries.filter(itinerary => !isWalkOnlyItinerary(itinerary));
  const walkOnly = itineraries.filter(itinerary => isWalkOnlyItinerary(itinerary));

  return [...nonWalkOnly, ...walkOnly];
};

export const legHasNewRoute = (leg, newRoutesConfig) => {
  if (!leg.route) return false;

  return newRoutesConfig.routeIdentifiers.some(identifier => {
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

export const hasNewRoute = (itinerary, newRoutesConfig) => {
  return itinerary.legs.some(leg => {
    if (!leg.route) return false;

    return newRoutesConfig.routeIdentifiers.some(identifier => {
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

export const getLineMidpoint = (coordinates) => {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0];

  const midIndex = Math.floor(coordinates.length / 2);
  return coordinates[midIndex];
};

export const haversineDistance = (coords1, coords2) => {
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

export const estimateTravelTime = (distanceKm) => {
  if (distanceKm < 2) return 5;
  if (distanceKm < 5) return 15;
  if (distanceKm < 10) return 25;
  if (distanceKm < 20) return 40;
  return 60;
};

export const getRouteColor = (leg) => {
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

export const getModeIcon = (leg) => {
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