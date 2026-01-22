import React, { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

type ScrollableContainerProps = {
  children: React.ReactNode;
  className?: string;
  fadeHeight?: string;
};

export function ScrollableContainer({ 
  children, 
  className,
  fadeHeight = 'h-8'
}: ScrollableContainerProps) {
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const hasOverflow = el.scrollHeight > el.clientHeight;
    setShowTopFade(el.scrollTop > 10);
    setShowBottomFade(hasOverflow && el.scrollTop < el.scrollHeight - el.clientHeight - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  // Re-check when children change
  useEffect(() => {
    checkScroll();
  }, [children, checkScroll]);

  return (
    <div className="relative">
      {/* Top fade gradient */}
      <div 
        className={cn(
          "absolute top-0 left-0 right-0 bg-gradient-to-b from-background to-transparent pointer-events-none z-10 transition-opacity duration-200",
          fadeHeight,
          showTopFade ? "opacity-100" : "opacity-0"
        )} 
      />
      
      <div 
        ref={containerRef}
        onScroll={checkScroll}
        className={className}
      >
        {children}
      </div>
      
      {/* Bottom fade gradient */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent pointer-events-none z-10 transition-opacity duration-200",
          fadeHeight,
          showBottomFade ? "opacity-100" : "opacity-0"
        )} 
      />
    </div>
  );
}
