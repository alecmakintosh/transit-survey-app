import { useState } from 'react';

export const useCompareMode = () => {
  const [compareMode, setCompareMode] = useState('default'); // 'default', 'selecting', 'comparing'
  const [showTravelModeModal, setShowTravelModeModal] = useState(false);
  const [selectedTravelMode, setSelectedTravelMode] = useState(null);
  const [lastPlannedOrigin, setLastPlannedOrigin] = useState(null);
  const [lastPlannedDestination, setLastPlannedDestination] = useState(null);
  const [showUnaffectedModal, setShowUnaffectedModal] = useState(false);
  const [showChangedODModal, setShowChangedODModal] = useState(false);

  const handleBackFromCompare = (setCurrentRouteOptions, setSelectedCurrentRouteIndex) => {
    if (compareMode === "comparing") {
      setCompareMode("selecting");
      setShowTravelModeModal(true);
      if (setCurrentRouteOptions) setCurrentRouteOptions([]);
      if (setSelectedCurrentRouteIndex) setSelectedCurrentRouteIndex(0);
    } else {
      setCompareMode("default");
      if (setCurrentRouteOptions) setCurrentRouteOptions([]);
      if (setSelectedCurrentRouteIndex) setSelectedCurrentRouteIndex(0);
    }
  };

  const resetCompareMode = () => {
    setCompareMode('default');
    setShowTravelModeModal(false);
    setSelectedTravelMode(null);
    setLastPlannedOrigin(null);
    setLastPlannedDestination(null);
    setShowUnaffectedModal(false);
    setShowChangedODModal(false);
  };

  return {
    compareMode,
    setCompareMode,
    showTravelModeModal,
    setShowTravelModeModal,
    selectedTravelMode,
    setSelectedTravelMode,
    lastPlannedOrigin,
    setLastPlannedOrigin,
    lastPlannedDestination,
    setLastPlannedDestination,
    showUnaffectedModal,
    setShowUnaffectedModal,
    showChangedODModal,
    setShowChangedODModal,
    handleBackFromCompare,
    resetCompareMode
  };
};