// Capture referral source from URL parameter
export const getReferralSource = (): string => {
  if (typeof window === 'undefined') return 'direct';
  
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  
  if (ref) {
    // Store in sessionStorage so it persists across page navigation
    sessionStorage.setItem('lgb_ref', ref);
    return ref;
  }
  
  // Check sessionStorage for previously captured ref
  const storedRef = sessionStorage.getItem('lgb_ref');
  if (storedRef) return storedRef;
  
  return 'direct';
};

// Get source for signup, with fallback context
export const getSubscribeSource = (context?: string): string => {
  const ref = getReferralSource();
  
  // If we have a ref param, use it
  if (ref !== 'direct') {
    return `ref_${ref}`;
  }
  
  // Otherwise use the context (e.g., 'welcome_modal', 'footer', 'incident_page')
  return context || 'direct';
};

