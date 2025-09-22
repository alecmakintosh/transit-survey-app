// TomTom API service and helper functions

// Helper function for date calculations
function getNextDateForDay(targetDay) {
  const today = new Date();
  const result = new Date(today);
  while (result.getDay() !== targetDay) {
    result.setDate(result.getDate() + 1);
  }
  return result.toISOString().split("T")[0];
}

// Extract major roads using importantRoadStretch sections as primary method
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

  return differentiateRoutes(majorRoads, sections);
}

// Differentiate routes when they use largely the same important roads
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

// Extract roads from guidance instructions (improved fallback)
function extractRoadsFromGuidance(instructions) {
  const roads = [];

  instructions.forEach(instruction => {
    const text = instruction.instruction || instruction.message || '';
    // Pattern to match road names in guidance text
    const roadPatterns = [
      /(?:onto|on|via|along)\s+([A-Z][A-Za-z0-9\s\-\/]+(?:Road|Street|Avenue|Boulevard|Highway|Expressway|Drive|Way|Lane))/gi,
      /(?:Highway|Route|Road)\s+(\d+[A-Z]*)/gi,
      /([A-Z]\d+[A-Z]*)/g // Highway codes like A401, M25, etc.
    ];

    roadPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const roadName = match[1].trim();
        if (roadName && !roads.includes(roadName)) {
          roads.push(roadName);
        }
      }
    });
  });

  return roads.slice(0, 3); // Limit to 3 road names
}

// Check for tolls using section analysis
function checkForTolls(sections) {
  return sections.some(section => section.sectionType === 'TOLL');
}

// Calculate traffic delay
function calculateTrafficDelay(summary) {
  const liveTime = summary.travelTimeInSeconds || 0;
  const historicTime = summary.historicTrafficTravelTimeInSeconds || liveTime;
  const noTrafficTime = summary.noTrafficTravelTimeInSeconds || historicTime;

  return {
    trafficDelayInSeconds: Math.max(0, liveTime - noTrafficTime),
    liveTime,
    historicTime,
    noTrafficTime,
    delayMinutes: Math.round(Math.max(0, liveTime - noTrafficTime) / 60)
  };
}

// Helper functions for debugging/analysis
function getImportantRoadSections(sections) {
  return sections.filter(s => s.sectionType === 'IMPORTANT_ROAD_STRETCH');
}

function getTollSections(sections) {
  return sections.filter(s => s.sectionType === 'TOLL');
}

function getTrafficSections(sections) {
  return sections.filter(s => s.sectionType === 'TRAFFIC');
}

// Main TomTom API function
export const fetchTomTomRoute = async (fromCoords, toCoords, departureTime, travelDate, arriveBy = false) => {
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
    const targetDate = isWeekend() ? getNextDateForDay(2) : getNextDateForDay(5);
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

    // Request all relevant section types for analysis
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

        // Extract major roads using importantRoadStretch sections FIRST
        let majorRoads = extractMajorRoadsFromSections(r.sections, r.guidance);

        // Check for tolls using section analysis
        const hasTolls = checkForTolls(r.sections);

        // Verify delay calculation (it should use summary values)
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