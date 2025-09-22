import { useState } from 'react';

export const useRouteCalculation = () => {
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [otpTravelTime, setOtpTravelTime] = useState(null);
  const [currentRouteOptions, setCurrentRouteOptions] = useState([]);
  const [selectedCurrentRouteIndex, setSelectedCurrentRouteIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [readyToCalculate, setReadyToCalculate] = useState(false);
  const [isLoadingCurrentRoutes, setIsLoadingCurrentRoutes] = useState(false);

  const resetRoutes = () => {
    setRouteOptions([]);
    setSelectedRouteIndex(0);
    setOtpTravelTime(null);
    setCurrentRouteOptions([]);
    setSelectedCurrentRouteIndex(0);
    setIsCalculating(false);
    setReadyToCalculate(false);
    setIsLoadingCurrentRoutes(false);
  };

  return {
    routeOptions,
    setRouteOptions,
    selectedRouteIndex,
    setSelectedRouteIndex,
    otpTravelTime,
    setOtpTravelTime,
    currentRouteOptions,
    setCurrentRouteOptions,
    selectedCurrentRouteIndex,
    setSelectedCurrentRouteIndex,
    isCalculating,
    setIsCalculating,
    readyToCalculate,
    setReadyToCalculate,
    isLoadingCurrentRoutes,
    setIsLoadingCurrentRoutes,
    resetRoutes
  };
};