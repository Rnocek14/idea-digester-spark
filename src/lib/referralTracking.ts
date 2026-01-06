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

// Get the referral code if one exists (for tracking who referred)
export const getReferralCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  
  if (ref) {
    sessionStorage.setItem('lgb_ref', ref);
    return ref;
  }
  
  return sessionStorage.getItem('lgb_ref');
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

// Reward tiers based on referral count
export const REFERRAL_TIERS = [
  { count: 1, name: 'Supporter', badge: '⭐', benefit: 'Early access to breaking news' },
  { count: 3, name: 'Advocate', badge: '🌟', benefit: 'Name in newsletter credits' },
  { count: 5, name: 'Ambassador', badge: '💫', benefit: 'Exclusive local deals' },
  { count: 10, name: 'Champion', badge: '🏆', benefit: 'VIP event invites' },
] as const;

export const getCurrentTier = (referralCount: number) => {
  // Find the highest tier the user qualifies for
  for (let i = REFERRAL_TIERS.length - 1; i >= 0; i--) {
    if (referralCount >= REFERRAL_TIERS[i].count) {
      return REFERRAL_TIERS[i];
    }
  }
  return null;
};

export const getNextTier = (referralCount: number) => {
  for (const tier of REFERRAL_TIERS) {
    if (referralCount < tier.count) {
      return tier;
    }
  }
  return null;
};
