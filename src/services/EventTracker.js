/**
 * EventTracker.js
 * Tracks comparison workflow and user interaction events
 */

import { supabase } from '../supabaseClient';

/**
 * Track comparison workflow events
 */
export const trackComparisonEvent = async (journeyId, sessionId, eventData) => {
  try {
    const { error } = await supabase
      .from('comparison_events')
      .insert([{
        journey_id: journeyId,
        session_id: sessionId,
        
        // Event details
        event_type: eventData.eventType,  // 'comparison_initiated', 'survey_opened', etc.
        
        // Routes being compared
        current_route_index: eventData.currentRouteIndex ?? null,
        future_route_index: eventData.futureRouteIndex ?? null,
        
        // Comparison type
        comparison_type: eventData.comparisonType || null,  // 'transit_vs_transit', 'auto_vs_transit', etc.
        
        // Timing
        event_timestamp: new Date().toISOString(),
        time_since_comparison_start_seconds: eventData.timeSinceStart || null,
        
        // Additional context
        metadata: eventData.metadata || null
      }]);
    
    if (error) {
      console.error('Error tracking comparison event:', error);
    }
    
  } catch (error) {
    console.error('Failed to track comparison event:', error);
  }
};

/**
 * Track general interaction event (button clicks, etc.)
 */
export const trackInteraction = async (sessionId, eventData, journeyId = null) => {
  try {
    const { error } = await supabase
      .from('interaction_events')
      .insert([{
        session_id: sessionId,
        journey_id: journeyId,
        
        // Event details
        event_type: eventData.eventType,  // 'click', 'hover', 'input', etc.
        event_target: eventData.target,  // Button/element identifier
        event_label: eventData.label || null,
        event_value: eventData.value || null,
        
        // Timing
        timestamp: new Date().toISOString(),
        time_since_session_start_seconds: eventData.timeSinceStart || null,
        
        // Context
        page_url: window.location.pathname,
        page_section: eventData.pageSection || null
      }]);
    
    if (error) {
      console.error('Error tracking interaction:', error);
    }
    
  } catch (error) {
    console.error('Failed to track interaction:', error);
  }
};

/**
 * Helper function to track button clicks
 */
export const trackButtonClick = async (sessionId, buttonId, journeyId = null) => {
  await trackInteraction(sessionId, {
    eventType: 'click',
    target: buttonId,
    pageSection: 'main'
  }, journeyId);
};

/**
 * Helper function to track modal opens
 */
export const trackModalOpen = async (sessionId, modalName, journeyId = null) => {
  await trackInteraction(sessionId, {
    eventType: 'modal_open',
    target: modalName,
    pageSection: 'modal'
  }, journeyId);
};

/**
 * Helper function to track modal closes
 */
export const trackModalClose = async (sessionId, modalName, journeyId = null) => {
  await trackInteraction(sessionId, {
    eventType: 'modal_close',
    target: modalName,
    pageSection: 'modal'
  }, journeyId);
};

export default {
  trackComparisonEvent,
  trackInteraction,
  trackButtonClick,
  trackModalOpen,
  trackModalClose
};