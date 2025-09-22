import { useState } from 'react';

export const useMapState = () => {
  const [mapMode, setMapMode] = useState('none');
  const [inputMode, setInputMode] = useState('text');
  const [shouldFitMap, setShouldFitMap] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [currentMapInstance, setCurrentMapInstance] = useState(null);
  const [parsedTransitLines, setParsedTransitLines] = useState([]);
  const [fitTriggerType, setFitTriggerType] = useState(null);

  const resetMapState = () => {
    setMapMode('none');
    setInputMode('text');
    setShouldFitMap(false);
    setParsedTransitLines([]);
    setFitTriggerType(null);
  };

  return {
    mapMode,
    setMapMode,
    inputMode,
    setInputMode,
    shouldFitMap,
    setShouldFitMap,
    mapInstance,
    setMapInstance,
    currentMapInstance,
    setCurrentMapInstance,
    parsedTransitLines,
    setParsedTransitLines,
    fitTriggerType,
    setFitTriggerType,
    resetMapState
  };
};