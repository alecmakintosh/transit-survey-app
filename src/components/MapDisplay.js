import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

const MapDisplay = ({
  children,
  center = [43.7, -79.4],
  zoom = 11.8
}) => {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {children}
    </MapContainer>
  );
};

export default MapDisplay;