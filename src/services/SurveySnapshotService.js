/**
 * SurveySnapshotService.js - NEW SERVICE
 * 
 * Handles incremental survey response saving
 * Saves responses after EVERY step, even if survey is abandoned
 * Tracks when users change their minds (response versioning)
 */

import { supabase } from '../supabaseClient';

/**
 * Save survey snapshot after each step
 * 
 * @param {string} journeyId - Journey ID
 * @param {string} sessionId - Session ID
 * @param {object} snapshotData - Survey response data
 * @param {number} snapshotData.stepNumber - Which step (0, 1, 2...)
 * @param {number} snapshotData.responseVersion - Version number (increments if user changes answer)
 * @param {boolean} snapshotData.isComplete - True only for final submission
 * @param {string} snapshotData.triggeredBy - 'step_advance', 'back_button', 'modal_close', 'survey_complete'
 * @param {object} snapshotData.responses - The actual survey responses
 */
export const saveSurveySnapshot = async (journeyId, sessionId, snapshotData) => {
  try {
    const { data, error } = await supabase
      .from('survey_response_snapshots')
      .insert([{
        journey_id: journeyId,
        session_id: sessionId,
        
        // Versioning
        response_version: snapshotData.responseVersion || 1,
        step_number: snapshotData.stepNumber,
        is_complete: snapshotData.isComplete || false,
        is_superseded: false, // Will be updated if user changes this later
        
        // Survey responses (all nullable)
        is_preferred_route: snapshotData.responses?.isPreferredRoute ?? null,
        route_preference: snapshotData.responses?.routePreference || null,
        current_travel_mode: snapshotData.responses?.currentTravelMode || null,
        would_switch_to: snapshotData.responses?.wouldSwitchTo || null,
        decision_factors: snapshotData.responses?.decisionFactors || null,
        decision_factors_other: snapshotData.responses?.decisionFactorsOther || null,
        likelihood_use_future: snapshotData.responses?.likelihoodUseFuture || null,
        
        // Timing
        saved_at: new Date().toISOString(),
        time_since_survey_start_seconds: snapshotData.timeSinceSurveyStart || null,
        
        // Context
        triggered_by: snapshotData.triggeredBy || 'step_advance'
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving survey snapshot:', error);
      throw error;
    }
    
    console.log(`Survey snapshot saved: step ${snapshotData.stepNumber}, version ${snapshotData.responseVersion}`);
    return data;
    
  } catch (error) {
    console.error('Failed to save survey snapshot:', error);
    return null;
  }
};

/**
 * Mark previous snapshots as superseded when user changes an answer
 */
export const markSnapshotsAsSuperseded = async (journeyId, stepNumber, oldResponseVersion) => {
  try {
    const { error } = await supabase
      .from('survey_response_snapshots')
      .update({ is_superseded: true })
      .eq('journey_id', journeyId)
      .eq('step_number', stepNumber)
      .eq('response_version', oldResponseVersion);
    
    if (error) throw error;
    
    console.log(`Marked snapshot as superseded: step ${stepNumber}, version ${oldResponseVersion}`);
    return true;
    
  } catch (error) {
    console.error('Failed to mark snapshot as superseded:', error);
    return false;
  }
};

/**
 * Get the latest response version for a step
 * Used to determine next version number when user changes answer
 */
export const getLatestResponseVersion = async (journeyId, stepNumber) => {
  try {
    const { data, error } = await supabase
      .from('survey_response_snapshots')
      .select('response_version')
      .eq('journey_id', journeyId)
      .eq('step_number', stepNumber)
      .order('response_version', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      return data[0].response_version;
    }
    
    return 0; // No previous version exists
    
  } catch (error) {
    console.error('Error getting latest response version:', error);
    return 0;
  }
};

/**
 * Get all snapshots for a journey (for analysis)
 */
export const getJourneySnapshots = async (journeyId) => {
  try {
    const { data, error } = await supabase
      .from('survey_response_snapshots')
      .select('*')
      .eq('journey_id', journeyId)
      .order('step_number', { ascending: true })
      .order('response_version', { ascending: true });
    
    if (error) throw error;
    
    return data;
    
  } catch (error) {
    console.error('Error getting journey snapshots:', error);
    return [];
  }
};

/**
 * Check if survey was completed
 */
export const isSurveyCompleted = async (journeyId) => {
  try {
    const { data, error } = await supabase
      .from('survey_response_snapshots')
      .select('is_complete')
      .eq('journey_id', journeyId)
      .eq('is_complete', true)
      .limit(1);
    
    if (error) throw error;
    
    return data && data.length > 0;
    
  } catch (error) {
    console.error('Error checking survey completion:', error);
    return false;
  }
};

/**
 * Get survey abandonment point (last step reached)
 */
export const getSurveyAbandonmentStep = async (journeyId) => {
  try {
    const { data, error } = await supabase
      .from('survey_response_snapshots')
      .select('step_number')
      .eq('journey_id', journeyId)
      .order('step_number', { ascending: false })
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      return data[0].step_number;
    }
    
    return null; // Survey never started
    
  } catch (error) {
    console.error('Error getting abandonment step:', error);
    return null;
  }
};

export default {
  saveSurveySnapshot,
  markSnapshotsAsSuperseded,
  getLatestResponseVersion,
  getJourneySnapshots,
  isSurveyCompleted,
  getSurveyAbandonmentStep
};