/**
 * JourneyService.js - UPDATED VERSION
 * Handles both TRANSIT routes (from OTP) and AUTO routes (from TomTom)
 * Properly stores different route types with their unique characteristics
 */

import { supabase } from '../supabaseClient';
import { sanitizeText, validateTime, validateDayType } from './validationService';

/**
 * Detect if route uses new LRT lines (TRANSIT only)
 */
const detectNewLRTUsage = (route) => {
  if (!route || !route.legs) return { line5: false, line6: false, any: false };
  
  let usesLine5 = false;
  let usesLine6 = false;
  
  route.legs.forEach(leg => {
    if (leg.route && leg.route.longName) {
      const longName = leg.route.longName.toUpperCase();
      if (longName.includes('LINE 5') || longName.includes('EGLINTON')) {
        usesLine5 = true;
      }
      if (longName.includes('LINE 6') || longName.includes('FINCH WEST')) {
        usesLine6 = true;
      }
    }
  });
  
  return {
    line5: usesLine5,
    line6: usesLine6,
    any: usesLine5 || usesLine6
  };
};

/**
 * Calculate walk statistics from TRANSIT route
 */
const calculateWalkStats = (route) => {
  if (!route || !route.legs) {
    return {
      totalWalkTime: 0,
      totalWalkDistance: 0,
      maxSingleWalk: 0,
      numWalkSegments: 0
    };
  }
  
  let totalWalkTime = 0;
  let totalWalkDistance = 0;
  let maxSingleWalk = 0;
  let numWalkSegments = 0;
  
  route.legs.forEach(leg => {
    if (leg.mode === 'WALK') {
      const walkTime = leg.duration || 0;
      const walkDistance = leg.distance || 0;
      
      totalWalkTime += walkTime;
      totalWalkDistance += walkDistance;
      numWalkSegments++;
      
      if (walkTime > maxSingleWalk) {
        maxSingleWalk = walkTime;
      }
    }
  });
  
  return {
    totalWalkTime,
    totalWalkDistance,
    maxSingleWalk,
    numWalkSegments
  };
};

/**
 * Extract modes used in TRANSIT route
 */
const extractModesUsed = (route) => {
  if (!route || !route.legs) return [];
  
  const modes = new Set();
  route.legs.forEach(leg => {
    if (leg.mode) {
      modes.add(leg.mode);
    }
  });
  
  return Array.from(modes);
};

/**
 * Detect if route is an AUTO route (from TomTom)
 */
const isAutoRoute = (route) => {
  return route && (route.mode === 'CAR' || route.id?.startsWith('car-'));
};

/**
 * Process AUTO route for storage
 */
const processAutoRoute = (route, index, scenarioType, journeyId) => {
  return {
    journey_id: journeyId,
    scenario_type: scenarioType,
    route_index: index,
    
    // Core characteristics
    total_duration_seconds: route.duration || 0,
    total_distance_meters: route.distance || 0,
    num_transfers: 0,  // No transfers in auto routes
    num_legs: 1,  // Auto routes are single-leg
    
    // Walk characteristics (all zero for auto)
    total_walk_time_seconds: 0,
    total_walk_distance_meters: 0,
    max_single_walk_seconds: 0,
    num_walk_segments: 0,
    
    // Mode composition
    modes_used: ['CAR'],
    has_walk: false,
    has_bus: false,
    has_subway: false,
    has_tram: false,
    has_rail: false,
    has_ferry: false,
    
    // New LRT detection (not applicable for auto)
    uses_line_5_eglinton: false,
    uses_line_6_finch: false,
    uses_any_new_lrt: false,
    
    // Timing
    start_time: route.departureTime ? new Date(route.departureTime).toTimeString().split(' ')[0] : '00:00:00',
    end_time: route.arrivalTime ? new Date(route.arrivalTime).toTimeString().split(' ')[0] : '00:00:00',
    
    // Full route data (includes TomTom-specific fields)
    route_data_jsonb: {
      ...route,
      // Store auto-specific metadata
      traffic_delay_seconds: route.delay || 0,
      has_toll_road: route.hasTollRoad || false,
      major_roads: route.majorRoads || [],
      route_analysis: route.routeAnalysis || null
    },
    
    is_walk_only: false
  };
};

/**
 * Process TRANSIT route for storage
 */
const processTransitRoute = (route, index, scenarioType, journeyId) => {
  const lrtUsage = detectNewLRTUsage(route);
  const walkStats = calculateWalkStats(route);
  const modesUsed = extractModesUsed(route);
  
  return {
    journey_id: journeyId,
    scenario_type: scenarioType,
    route_index: index,
    
    // Route characteristics
    total_duration_seconds: route.duration || 0,
    total_distance_meters: route.legs?.reduce((sum, leg) => sum + (leg.distance || 0), 0) || null,
    num_transfers: route.legs?.filter((leg, idx) => idx > 0 && leg.mode !== 'WALK').length || 0,
    num_legs: route.legs?.length || 0,
    
    // Walk statistics
    total_walk_time_seconds: walkStats.totalWalkTime,
    total_walk_distance_meters: walkStats.totalWalkDistance,
    max_single_walk_seconds: walkStats.maxSingleWalk,
    num_walk_segments: walkStats.numWalkSegments,
    
    // Mode composition
    modes_used: modesUsed,
    has_walk: modesUsed.includes('WALK'),
    has_bus: modesUsed.includes('BUS'),
    has_subway: modesUsed.includes('SUBWAY'),
    has_tram: modesUsed.includes('TRAM'),
    has_rail: modesUsed.includes('RAIL'),
    has_ferry: modesUsed.includes('FERRY'),
    
    // New LRT detection
    uses_line_5_eglinton: lrtUsage.line5,
    uses_line_6_finch: lrtUsage.line6,
    uses_any_new_lrt: lrtUsage.any,
    
    // Timing
    start_time: route.startTime ? new Date(route.startTime).toTimeString().split(' ')[0] : '00:00:00',
    end_time: route.endTime ? new Date(route.endTime).toTimeString().split(' ')[0] : '00:00:00',
    
    // Full route data
    route_data_jsonb: route,
    
    // Walk-only detection
    is_walk_only: modesUsed.length === 1 && modesUsed[0] === 'WALK'
  };
};

/**
 * Create journey record
 */
export const createJourney = async (sessionId, journeyData) => {
  try {
    const sanitizedData = {
      session_id: sessionId,
      
      // Trip parameters (NO COORDINATES)
      origin_name: sanitizeText(journeyData.origin_name, 200),
      destination_name: sanitizeText(journeyData.destination_name, 200),
      location_pair_uuid: journeyData.location_pair_uuid || null,
      
      query_time: validateTime(journeyData.query_time),
      is_arrive_by: Boolean(journeyData.is_arrive_by),
      day_type: validateDayType(journeyData.day_type),
      travel_date: journeyData.travel_date || null,
      
      // Summary stats
      total_current_routes_shown: journeyData.total_current_routes || 0,
      total_future_routes_shown: journeyData.total_future_routes || 0,
      
      // Browser metadata
      user_agent: sanitizeText(navigator.userAgent, 500),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      
      journey_start_timestamp: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('journeys')
      .insert([sanitizedData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating journey:', error);
      throw error;
    }
    
    console.log('Journey created:', data.id);
    return data;
    
  } catch (error) {
    console.error('Failed to create journey:', error);
    return null;
  }
};

/**
 * Save all route options (choice set) - handles BOTH transit and auto routes
 */
export const saveRouteOptions = async (journeyId, currentRoutes = [], futureRoutes = []) => {
  try {
    const routeRecords = [];
    
    // Process current routes (can be transit OR auto)
    currentRoutes.forEach((route, index) => {
      if (isAutoRoute(route)) {
        routeRecords.push(processAutoRoute(route, index, 'current', journeyId));
      } else {
        routeRecords.push(processTransitRoute(route, index, 'current', journeyId));
      }
    });
    
    // Process future routes (typically always transit)
    futureRoutes.forEach((route, index) => {
      if (isAutoRoute(route)) {
        routeRecords.push(processAutoRoute(route, index, 'future', journeyId));
      } else {
        routeRecords.push(processTransitRoute(route, index, 'future', journeyId));
      }
    });
    
    if (routeRecords.length === 0) {
      console.warn('No route options to save');
      return [];
    }
    
    const { data, error } = await supabase
      .from('route_options')
      .insert(routeRecords)
      .select();
    
    if (error) {
      console.error('Error saving route options:', error);
      throw error;
    }
    
    console.log(`Saved ${data.length} route options (transit + auto)`);
    return data;
    
  } catch (error) {
    console.error('Failed to save route options:', error);
    return null;
  }
};

/**
 * Update journey with completion status
 */
export const updateJourneyCompletion = async (journeyId, updates) => {
  try {
    const { data, error } = await supabase
      .from('journeys')
      .update(updates)
      .eq('id', journeyId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating journey:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to update journey:', error);
    return null;
  }
};

export default {
  createJourney,
  saveRouteOptions,
  updateJourneyCompletion
};