/**
 * Input validation and sanitization utilities
 * Protects against injection attacks and malformed data
 */

// GTHA bounding box (approximate)
const GTHA_BOUNDS = {
  MIN_LAT: 43.0,
  MAX_LAT: 44.5,
  MIN_LON: -80.0,
  MAX_LON: -78.5
};

/**
 * Validate and sanitize coordinates
 */
export const validateCoordinates = (lat, lon) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Invalid coordinates: must be numbers');
  }
  
  if (latitude < GTHA_BOUNDS.MIN_LAT || latitude > GTHA_BOUNDS.MAX_LAT) {
    throw new Error(`Latitude out of GTHA bounds: ${latitude}`);
  }
  
  if (longitude < GTHA_BOUNDS.MIN_LON || longitude > GTHA_BOUNDS.MAX_LON) {
    throw new Error(`Longitude out of GTHA bounds: ${longitude}`);
  }
  
  return {
    lat: Number(latitude.toFixed(8)),
    lon: Number(longitude.toFixed(8))
  };
};

/**
 * Sanitize text input (removes HTML, limits length)
 */
export const sanitizeText = (text, maxLength = 500) => {
  if (!text) return null;
  
  // Convert to string and trim
  let sanitized = String(text).trim();
  
  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters for SQL (extra safety layer)
  sanitized = sanitized.replace(/[;<>]/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized || null;
};

/**
 * Validate time format (HH:MM)
 */
export const validateTime = (timeString) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!timeRegex.test(timeString)) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
  }
  
  return timeString;
};

/**
 * Validate day type
 */
export const validateDayType = (dayType) => {
  const validTypes = ['weekday', 'weekend'];
  
  if (!validTypes.includes(dayType)) {
    throw new Error(`Invalid day type: ${dayType}`);
  }
  
  return dayType;
};

/**
 * Validate route preference
 */
export const validateRoutePreference = (preference) => {
  const validPreferences = ['current', 'future', 'no_preference'];
  
  if (!validPreferences.includes(preference)) {
    throw new Error(`Invalid route preference: ${preference}`);
  }
  
  return preference;
};

/**
 * Validate decision factors array
 */
export const validateDecisionFactors = (factors) => {
  const validFactors = [
    'travel_time',
    'transfers',
    'walking_distance',
    'transit_mode',
    'reliability',
    'comfort',
    'cost',
    'other'
  ];
  
  if (!Array.isArray(factors)) {
    throw new Error('Decision factors must be an array');
  }
  
  // Filter to only valid factors
  const sanitizedFactors = factors.filter(f => validFactors.includes(f));
  
  return sanitizedFactors;
};

/**
 * Validate likelihood rating (1-5)
 */
export const validateLikelihood = (rating) => {
  const num = parseInt(rating, 10);
  
  if (isNaN(num) || num < 1 || num > 5) {
    throw new Error(`Invalid likelihood rating: ${rating}. Must be 1-5`);
  }
  
  return num;
};

/**
 * Validate route index
 */
export const validateRouteIndex = (index) => {
  const num = parseInt(index, 10);
  
  if (isNaN(num) || num < 0) {
    throw new Error(`Invalid route index: ${index}`);
  }
  
  return num;
};

/**
 * Validate and sanitize complete journey data before DB insert
 */
export const validateJourneyData = (journeyData) => {
  try {
    const origin = validateCoordinates(journeyData.origin_lat, journeyData.origin_lon);
    const destination = validateCoordinates(journeyData.destination_lat, journeyData.destination_lon);
    
    return {
      origin_lat: origin.lat,
      origin_lon: origin.lon,
      origin_name: sanitizeText(journeyData.origin_name, 200),
      destination_lat: destination.lat,
      destination_lon: destination.lon,
      destination_name: sanitizeText(journeyData.destination_name, 200),
      query_time: validateTime(journeyData.query_time),
      is_arrive_by: Boolean(journeyData.is_arrive_by),
      day_type: validateDayType(journeyData.day_type),
      selected_current_route_index: journeyData.selected_current_route_index !== null 
        ? validateRouteIndex(journeyData.selected_current_route_index) 
        : null,
      selected_future_route_index: journeyData.selected_future_route_index !== null 
        ? validateRouteIndex(journeyData.selected_future_route_index) 
        : null,
      current_route_data: journeyData.current_route_data || null,
      future_route_data: journeyData.future_route_data || null,
      user_agent: sanitizeText(journeyData.user_agent, 500),
      viewport_width: journeyData.viewport_width ? parseInt(journeyData.viewport_width, 10) : null,
      viewport_height: journeyData.viewport_height ? parseInt(journeyData.viewport_height, 10) : null
    };
  } catch (error) {
    console.error('Journey validation error:', error);
    throw error;
  }
};

/**
 * Validate behavioral response data
 */
export const validateBehavioralData = (responseData) => {
  try {
    return {
      route_preference: responseData.route_preference 
        ? validateRoutePreference(responseData.route_preference) 
        : null,
      decision_factors: responseData.decision_factors 
        ? validateDecisionFactors(responseData.decision_factors) 
        : [],
      decision_factors_other: sanitizeText(responseData.decision_factors_other, 500),
      likelihood_use_future: responseData.likelihood_use_future 
        ? validateLikelihood(responseData.likelihood_use_future) 
        : null,
      response_duration_seconds: responseData.response_duration_seconds 
        ? parseInt(responseData.response_duration_seconds, 10) 
        : null
    };
  } catch (error) {
    console.error('Behavioral validation error:', error);
    throw error;
  }
};