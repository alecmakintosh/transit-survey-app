/**
 * PreferenceService.js
 * Handles route preference and behavioral survey data
 */

import { supabase } from '../supabaseClient';

/**
 * Save user's route preferences (which routes they selected)
 */
export const saveRoutePreference = async (journeyId, sessionId, preferenceData) => {
  try {
    const { data, error } = await supabase
      .from('route_preferences')
      .insert([{
        journey_id: journeyId,
        session_id: sessionId,
        
        // Which routes they selected
        preferred_current_route_index: preferenceData.currentRouteIndex ?? null,
        preferred_future_route_index: preferenceData.futureRouteIndex ?? null,
        
        // Overall preference
        overall_preference: preferenceData.overallPreference || null,  // 'prefer_current', 'prefer_future', 'no_preference'
        
        // Current travel mode (CRITICAL DATA)
        current_travel_mode: preferenceData.currentTravelMode || 'transit',  // 'transit', 'drive_alone', 'carpool', 'walk', 'bike'
        
        // Would they switch?
        would_switch_to: preferenceData.wouldSwitchTo || null,  // 'would_use_new_transit', 'already_use_transit', 'stay_with_current_mode', 'unsure'
        
        // Confidence
        preference_certainty: preferenceData.certaint || null,
        
        // Timing
        preference_indicated_at: new Date().toISOString(),
        is_final_preference: true
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving route preference:', error);
      throw error;
    }
    
    console.log('Route preference saved');
    return data;
    
  } catch (error) {
    console.error('Failed to save route preference:', error);
    return null;
  }
};

/**
 * Save behavioral survey responses
 */
export const saveBehavioralResponse = async (journeyId, surveyData) => {
  try {
    const { data, error } = await supabase
      .from('behavioral_responses')
      .insert([{
        journey_id: journeyId,
        
        // Survey responses
        decision_factors: surveyData.decision_factors || [],
        decision_factors_other: surveyData.decision_factors_other || null,
        likelihood_use_future: surveyData.likelihood_use_future || null,
        
        // Survey metadata
        response_duration_seconds: surveyData.response_duration_seconds || null,
        survey_completed_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving behavioral response:', error);
      throw error;
    }
    
    console.log('Behavioral response saved');
    return data;
    
  } catch (error) {
    console.error('Failed to save behavioral response:', error);
    return null;
  }
};

/**
 * Track route selection event (when user clicks a route)
 */
export const trackRouteSelection = async (journeyId, sessionId, selectionData) => {
  try {
    const { error } = await supabase
      .from('route_selection_events')
      .insert([{
        journey_id: journeyId,
        session_id: sessionId,
        scenario_type: selectionData.scenarioType,  // 'current' or 'future'
        route_index: selectionData.routeIndex,
        event_type: selectionData.eventType,  // 'route_clicked', 'route_selected_for_comparison', etc.
        previous_selection: selectionData.previousSelection || null,
        event_timestamp: new Date().toISOString(),
        triggered_by: selectionData.triggeredBy || null
      }]);
    
    if (error) {
      console.error('Error tracking route selection:', error);
    }
    
  } catch (error) {
    console.error('Failed to track route selection:', error);
  }
};

export default {
  saveRoutePreference,
  saveBehavioralResponse,
  trackRouteSelection
};