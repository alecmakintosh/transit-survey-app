/**
 * UserProfileService.js
 * Handles user profile creation, retrieval, and updates
 * Works with SessionManager to persist user data
 */

import { supabase } from '../supabaseClient';
import { sanitizeText } from './validationService';

/**
 * Create user profile in database
 */
export const createUserProfile = async (sessionId, profileData) => {
  try {
    // Validate and sanitize inputs
    const sanitizedData = {
      session_id: sessionId,
      has_vehicle: Boolean(profileData.has_vehicle),
      is_regular_transit_user: Boolean(profileData.is_regular_transit_user),
      transit_frequency: profileData.transit_frequency || null,
      
      // Optional demographic fields (for future)
      age_range: sanitizeText(profileData.age_range, 50),
      employment_status: sanitizeText(profileData.employment_status, 100),
      household_size: profileData.household_size ? parseInt(profileData.household_size, 10) : null,
      
      // Consent
      consent_for_research: Boolean(profileData.consent_for_research),
      consent_for_email_followup: Boolean(profileData.consent_for_email_followup || false),
      consent_timestamp: new Date().toISOString(),
      privacy_policy_version: '1.0',  // Update this when policy changes
      
      profile_completed_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([sanitizedData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
    
    console.log('User profile created:', data.id);
    return data;
    
  } catch (error) {
    console.error('Failed to create user profile:', error);
    throw error;
  }
};

/**
 * Get user profile by session ID
 */
export const getUserProfile = async (sessionId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found - this is expected for new users
        return null;
      }
      console.error('Error fetching user profile:', error);
      throw error;
    }
    
    return data;
    
  } catch (error) {
    console.error('Failed to get user profile:', error);
    return null;
  }
};

/**
 * Update existing user profile
 */
export const updateUserProfile = async (sessionId, updates) => {
  try {
    // Sanitize updates
    const sanitizedUpdates = {};
    
    if (updates.has_vehicle !== undefined) {
      sanitizedUpdates.has_vehicle = Boolean(updates.has_vehicle);
    }
    if (updates.is_regular_transit_user !== undefined) {
      sanitizedUpdates.is_regular_transit_user = Boolean(updates.is_regular_transit_user);
    }
    if (updates.transit_frequency) {
      sanitizedUpdates.transit_frequency = updates.transit_frequency;
    }
    if (updates.age_range) {
      sanitizedUpdates.age_range = sanitizeText(updates.age_range, 50);
    }
    if (updates.employment_status) {
      sanitizedUpdates.employment_status = sanitizeText(updates.employment_status, 100);
    }
    if (updates.household_size) {
      sanitizedUpdates.household_size = parseInt(updates.household_size, 10);
    }
    
    sanitizedUpdates.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('user_profiles')
      .update(sanitizedUpdates)
      .eq('session_id', sessionId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
    
    console.log('User profile updated');
    return data;
    
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw error;
  }
};

/**
 * Check if profile exists for session
 */
export const profileExists = async (sessionId) => {
  try {
    const profile = await getUserProfile(sessionId);
    return profile !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Delete user profile (for GDPR compliance)
 */
export const deleteUserProfile = async (sessionId) => {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('session_id', sessionId);
    
    if (error) {
      console.error('Error deleting user profile:', error);
      throw error;
    }
    
    console.log('User profile deleted');
    return true;
    
  } catch (error) {
    console.error('Failed to delete user profile:', error);
    throw error;
  }
};

export default {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  profileExists,
  deleteUserProfile
};