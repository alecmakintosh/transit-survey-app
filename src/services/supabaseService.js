import { supabase } from '../supabaseClient';
import { 
  validateJourneyData, 
  validateBehavioralData,
  sanitizeText 
} from './validationService';

/**
 * Save a complete journey with routes to the database
 */
export const saveJourney = async (journeyData) => {
  try {
    // Validate and sanitize all inputs
    const validatedData = validateJourneyData(journeyData);
    
    // Insert journey
    const { data, error } = await supabase
      .from('journeys')
      .insert([validatedData])
      .select()
      .single();
    
    if (error) {
      console.error('Supabase journey insert error:', error);
      throw error;
    }
    
    console.log('Journey saved successfully:', data.id);
    return data;
    
  } catch (error) {
    console.error('Error saving journey:', error);
    // Don't throw - fail gracefully so user experience isn't broken
    return null;
  }
};

/**
 * Save detailed leg-by-leg data for a journey
 */
export const saveJourneyLegs = async (journeyId, currentRoute, futureRoute, selectedCurrentIndex, selectedFutureIndex) => {
  try {
    const legs = [];
    
    // Process current route legs
    if (currentRoute && currentRoute.legs) {
      currentRoute.legs.forEach((leg, index) => {
        legs.push({
          journey_id: journeyId,
          route_type: 'current',
          route_index: selectedCurrentIndex,
          leg_index: index,
          mode: sanitizeText(leg.mode, 50),
          duration: parseInt(leg.duration, 10),
          distance: leg.distance ? parseFloat(leg.distance) : null,
          route_short_name: sanitizeText(leg.route?.shortName, 50),
          route_long_name: sanitizeText(leg.route?.longName, 200),
          route_color: sanitizeText(leg.route?.color, 10),
          agency_name: sanitizeText(leg.route?.agency, 100),
          from_name: sanitizeText(leg.from?.name, 200),
          from_lat: leg.from?.lat ? parseFloat(leg.from.lat) : null,
          from_lon: leg.from?.lon ? parseFloat(leg.from.lon) : null,
          to_name: sanitizeText(leg.to?.name, 200),
          to_lat: leg.to?.lat ? parseFloat(leg.to.lat) : null,
          to_lon: leg.to?.lon ? parseFloat(leg.to.lon) : null,
          leg_geometry: sanitizeText(leg.legGeometry?.points, 5000)
        });
      });
    }
    
    // Process future route legs
    if (futureRoute && futureRoute.legs) {
      futureRoute.legs.forEach((leg, index) => {
        legs.push({
          journey_id: journeyId,
          route_type: 'future',
          route_index: selectedFutureIndex,
          leg_index: index,
          mode: sanitizeText(leg.mode, 50),
          duration: parseInt(leg.duration, 10),
          distance: leg.distance ? parseFloat(leg.distance) : null,
          route_short_name: sanitizeText(leg.route?.shortName, 50),
          route_long_name: sanitizeText(leg.route?.longName, 200),
          route_color: sanitizeText(leg.route?.color, 10),
          agency_name: sanitizeText(leg.route?.agency, 100),
          from_name: sanitizeText(leg.from?.name, 200),
          from_lat: leg.from?.lat ? parseFloat(leg.from.lat) : null,
          from_lon: leg.from?.lon ? parseFloat(leg.from.lon) : null,
          to_name: sanitizeText(leg.to?.name, 200),
          to_lat: leg.to?.lat ? parseFloat(leg.to.lat) : null,
          to_lon: leg.to?.lon ? parseFloat(leg.to.lon) : null,
          leg_geometry: sanitizeText(leg.legGeometry?.points, 5000)
        });
      });
    }
    
    if (legs.length === 0) {
      console.warn('No legs to save for journey:', journeyId);
      return;
    }
    
    const { data, error } = await supabase
      .from('journey_legs')
      .insert(legs)
      .select();
    
    if (error) {
      console.error('Supabase legs insert error:', error);
      throw error;
    }
    
    console.log(`Saved ${legs.length} journey legs`);
    return data;
    
  } catch (error) {
    console.error('Error saving journey legs:', error);
    return null;
  }
};

/**
 * Save behavioral survey responses
 */
export const saveBehavioralResponse = async (journeyId, responseData) => {
  try {
    // Validate and sanitize
    const validatedData = validateBehavioralData(responseData);
    
    const { data, error } = await supabase
      .from('behavioral_responses')
      .insert([{
        journey_id: journeyId,
        ...validatedData
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Supabase behavioral response error:', error);
      throw error;
    }
    
    console.log('Behavioral response saved successfully');
    return data;
    
  } catch (error) {
    console.error('Error saving behavioral response:', error);
    return null;
  }
};

/**
 * Get browser and viewport metadata
 */
export const getSessionMetadata = () => {
  return {
    user_agent: navigator.userAgent,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight
  };
};