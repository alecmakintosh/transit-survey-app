/**
 * SessionManager.js - FIXED VERSION
 * Manages user sessions with persistence across page loads
 * Compatible with Supabase v2
 */

import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const SESSION_STORAGE_KEY = 'ftt_session_id';
const SESSION_EXPIRY_HOURS = 24;

/**
 * Get device type based on viewport width
 */
const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

/**
 * Get session metadata (browser, viewport info)
 */
const getSessionMetadata = () => {
  return {
    user_agent: navigator.userAgent,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_type: getDeviceType(),
    referrer_url: document.referrer || null,
    // Extract UTM parameters from URL
    utm_source: new URLSearchParams(window.location.search).get('utm_source'),
    utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
    utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign')
  };
};

/**
 * Check if stored session is still valid (not expired)
 */
const isSessionValid = (sessionData) => {
  if (!sessionData || !sessionData.timestamp) return false;
  
  const sessionAge = Date.now() - sessionData.timestamp;
  const expiryMs = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
  
  return sessionAge < expiryMs;
};

/**
 * Get session from localStorage
 */
const getStoredSession = () => {
  try {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    
    const sessionData = JSON.parse(stored);
    
    // Check if session is still valid
    if (!isSessionValid(sessionData)) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error('Error reading stored session:', error);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

/**
 * Store session in localStorage
 */
const storeSession = (sessionId, userProfileId = null) => {
  try {
    const sessionData = {
      session_id: sessionId,
      user_profile_id: userProfileId,
      timestamp: Date.now()
    };
    
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error('Error storing session:', error);
    return false;
  }
};

/**
 * Create new session in Supabase
 */
const createNewSession = async () => {
  try {
    const sessionId = uuidv4();
    const metadata = getSessionMetadata();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .insert([{
        session_id: sessionId,
        session_start: new Date().toISOString(),
        ...metadata,
        pages_visited: 1,
        total_interactions: 0
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating session in Supabase:', error);
      throw error;
    }
    
    console.log('New session created:', sessionId);
    
    // Store in localStorage
    storeSession(sessionId);
    
    return {
      session_id: sessionId,
      user_profile_id: null,
      is_new_session: true
    };
    
  } catch (error) {
    console.error('Failed to create session:', error);
    // Return a fallback session ID even if DB fails (graceful degradation)
    const fallbackSessionId = uuidv4();
    storeSession(fallbackSessionId);
    return {
      session_id: fallbackSessionId,
      user_profile_id: null,
      is_new_session: true,
      db_failed: true
    };
  }
};

/**
 * Initialize or retrieve session
 * This is the main function to call on app load
 */
export const initializeSession = async () => {
  try {
    // Check if we have a stored session
    const storedSession = getStoredSession();
    
    if (storedSession && storedSession.session_id) {
      console.log('Existing session found:', storedSession.session_id);
      
      // Try to update session in Supabase (increment page visits)
      // Use RPC function or manual increment
      try {
        // First, get current pages_visited value
        const { data: currentSession } = await supabase
          .from('user_sessions')
          .select('pages_visited')
          .eq('session_id', storedSession.session_id)
          .single();
        
        if (currentSession) {
          // Update with incremented value
          await supabase
            .from('user_sessions')
            .update({
              pages_visited: (currentSession.pages_visited || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('session_id', storedSession.session_id);
        }
      } catch (updateError) {
        console.warn('Could not update session, but continuing:', updateError);
      }
      
      return {
        session_id: storedSession.session_id,
        user_profile_id: storedSession.user_profile_id,
        is_new_session: false
      };
    }
    
    // No valid stored session, create new one
    console.log('No valid session found, creating new session');
    return await createNewSession();
    
  } catch (error) {
    console.error('Error initializing session:', error);
    // Graceful fallback
    const fallbackSessionId = uuidv4();
    storeSession(fallbackSessionId);
    return {
      session_id: fallbackSessionId,
      user_profile_id: null,
      is_new_session: true,
      error: true
    };
  }
};

/**
 * Update session with user profile ID after profile modal completion
 */
export const linkUserProfile = async (sessionId, userProfileId) => {
  try {
    // Update in Supabase
    const { error } = await supabase
      .from('user_sessions')
      .update({ user_profile_id: userProfileId })
      .eq('session_id', sessionId);
    
    if (error) {
      console.error('Error linking user profile:', error);
      throw error;
    }
    
    // Update in localStorage
    const stored = getStoredSession();
    if (stored) {
      stored.user_profile_id = userProfileId;
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
    }
    
    console.log('User profile linked to session:', userProfileId);
    return true;
    
  } catch (error) {
    console.error('Failed to link user profile:', error);
    return false;
  }
};

/**
 * End session (call on page unload/close)
 */
export const endSession = async (sessionId) => {
  try {
    // First get session start time
    const { data: sessionData } = await supabase
      .from('user_sessions')
      .select('session_start')
      .eq('session_id', sessionId)
      .single();
    
    if (sessionData && sessionData.session_start) {
      const startTime = new Date(sessionData.session_start);
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime - startTime) / 1000);
      
      const { error } = await supabase
        .from('user_sessions')
        .update({
          session_end: endTime.toISOString(),
          session_duration_seconds: durationSeconds
        })
        .eq('session_id', sessionId);
      
      if (error) {
        console.error('Error ending session:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to end session:', error);
    return false;
  }
};

/**
 * Increment interaction counter for session
 */
export const incrementInteractionCount = async (sessionId) => {
  try {
    // Get current count first
    const { data: currentSession } = await supabase
      .from('user_sessions')
      .select('total_interactions')
      .eq('session_id', sessionId)
      .single();
    
    if (currentSession) {
      await supabase
        .from('user_sessions')
        .update({
          total_interactions: (currentSession.total_interactions || 0) + 1
        })
        .eq('session_id', sessionId);
    }
  } catch (error) {
    // Silent fail - not critical
    console.warn('Could not increment interaction count:', error);
  }
};

/**
 * Track page view
 */
export const trackPageView = async (sessionId, pageUrl, pageTitle = null) => {
  try {
    const { error } = await supabase
      .from('page_views')
      .insert([{
        session_id: sessionId,
        page_url: pageUrl,
        page_title: pageTitle || document.title,
        page_section: pageUrl.split('/')[1] || 'home',
        viewed_at: new Date().toISOString()
      }]);
    
    if (error) {
      console.error('Error tracking page view:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to track page view:', error);
    return false;
  }
};

/**
 * Clear session (logout/reset)
 */
export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    console.log('Session cleared');
    return true;
  } catch (error) {
    console.error('Error clearing session:', error);
    return false;
  }
};

/**
 * Get current session ID from storage (synchronous)
 */
export const getCurrentSessionId = () => {
  const stored = getStoredSession();
  return stored ? stored.session_id : null;
};

/**
 * Check if user has completed profile (synchronous check)
 */
export const hasUserProfile = () => {
  const stored = getStoredSession();
  return stored && stored.user_profile_id !== null;
};

export default {
  initializeSession,
  linkUserProfile,
  endSession,
  incrementInteractionCount,
  trackPageView,
  clearSession,
  getCurrentSessionId,
  hasUserProfile
};