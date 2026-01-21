/**
 * Recent Venue Persistence
 * 
 * Tracks recently featured venues in the "Pick" slot to ensure diversity.
 * Uses localStorage to persist across sessions.
 * 
 * RULES (locked):
 * - Tracks last 10 venues (roughly 7-10 days of picks)
 * - Venues in this list get a -4 score penalty
 * - Clears venues older than 10 entries
 */

const STORAGE_KEY = 'lakegeneva_recent_pick_venues';
const MAX_VENUES = 10;

interface RecentVenueEntry {
  venue: string;
  pickedAt: string; // ISO date string
}

const TTL_DAYS = 7;

/**
 * Get the list of recently picked venues (normalized, lowercase)
 * Filters out entries older than 7 days
 */
export function getRecentPickVenues(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const entries: RecentVenueEntry[] = JSON.parse(stored);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TTL_DAYS);
    
    // Filter to entries within TTL and return venue names
    return entries
      .filter(e => new Date(e.pickedAt) >= cutoff)
      .map(e => e.venue);
  } catch (error) {
    console.warn('[RecentVenues] Error reading from localStorage:', error);
    return [];
  }
}

/**
 * Record a venue as recently picked
 * @param venueName The venue name (will be normalized to lowercase)
 */
export function recordPickedVenue(venueName: string): void {
  if (!venueName || venueName.trim() === '') return;
  
  const normalized = venueName.toLowerCase().trim();
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let entries: RecentVenueEntry[] = stored ? JSON.parse(stored) : [];
    
    // Remove if already exists (to move it to the front)
    entries = entries.filter(e => e.venue !== normalized);
    
    // Add to front
    entries.unshift({
      venue: normalized,
      pickedAt: new Date().toISOString()
    });
    
    // Trim to max size
    if (entries.length > MAX_VENUES) {
      entries = entries.slice(0, MAX_VENUES);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[RecentVenues] Error writing to localStorage:', error);
  }
}

/**
 * Clear all recent venue history (for testing/reset)
 */
export function clearRecentVenues(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[RecentVenues] Error clearing localStorage:', error);
  }
}

/**
 * Get venue history with timestamps (for debugging)
 */
export function getRecentVenueHistory(): RecentVenueEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.warn('[RecentVenues] Error reading history:', error);
    return [];
  }
}
