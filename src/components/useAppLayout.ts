import { useCallback, useEffect, useState } from 'react';
import type { TutorialStep } from './GuidedTutorial';
import type { DeviceLayoutMode, MobilePrimaryView } from '../types';

function getLayoutMode(width: number): DeviceLayoutMode {
  if (width <= 760) return 'phone';
  if (width < 900) return 'tablet';
  return 'desktop';
}

export function useAppLayout(showTutorial: boolean, tutorialStep: TutorialStep) {
  const [layoutMode, setLayoutMode] = useState<DeviceLayoutMode>(() =>
    typeof window === 'undefined' ? 'desktop' : getLayoutMode(window.innerWidth),
  );
  const [mobileView, setMobileView] = useState<MobilePrimaryView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<'todo' | 'map' | null>(null);
  const [isMapInfoOpen, setIsMapInfoOpen] = useState(false);
  const [infoPortalTarget, setInfoPortalTargetState] = useState<HTMLElement | null>(null);
  const [expandedInfoPortalTarget, setExpandedInfoPortalTargetState] = useState<HTMLElement | null>(
    null,
  );
  const isMobile = layoutMode === 'phone';

  useEffect(() => {
    const handleResize = () => setLayoutMode(getLayoutMode(window.innerWidth));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (mobileView === 'spaces' && !isMobile) setMobileView('map');
  }, [isMobile, mobileView]);

  useEffect(() => {
    if (showTutorial && isMobile) setMobileView(tutorialStep >= 6 ? 'todo' : 'map');
  }, [isMobile, showTutorial, tutorialStep]);

  const toggleExpandedPanel = useCallback((panel: 'todo' | 'map') => {
    setExpandedPanel((current) => (current === panel ? null : panel));
    setIsMapInfoOpen(false);
  }, []);
  const setInfoPortalTarget = useCallback((target: HTMLElement | null) => {
    setInfoPortalTargetState(target);
  }, []);
  const setExpandedInfoPortalTarget = useCallback((target: HTMLElement | null) => {
    setExpandedInfoPortalTargetState(target);
  }, []);

  return {
    expandedInfoPortalTarget,
    expandedPanel,
    infoPortalTarget,
    isMapInfoOpen,
    isMobile,
    isSidebarOpen,
    layoutMode,
    mobileView,
    setExpandedInfoPortalTarget,
    setExpandedPanel,
    setInfoPortalTarget,
    setIsMapInfoOpen,
    setIsSidebarOpen,
    setMobileView,
    toggleExpandedPanel,
  };
}
