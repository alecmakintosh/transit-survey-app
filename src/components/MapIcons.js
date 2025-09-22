import L from 'leaflet';

// Custom marker icons
export const createCustomIcon = (color, isDestination = false) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 25px;
        height: 25px;
        border-radius: 50% 50% 50% 0;
        border: 3px solid white;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-weight: bold;
          font-size: 12px;
          transform: rotate(45deg);
        ">${isDestination ? 'B' : 'A'}</span>
      </div>
    `,
    iconSize: [25, 25],
    iconAnchor: [12, 25],
    popupAnchor: [0, -25],
    zIndexOffset: 1000
  });
};

export const createTransferIcon = () => {
  return L.divIcon({
    className: 'transfer-marker',
    html: `
      <div style="
        background-color: #ffc107;
        width: 20px;
        height: 20px;
        border-radius: 50% 50% 50% 0;
        border: 2px solid white;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="
          color: white;
          font-weight: bold;
          font-size: 10px;
          transform: rotate(45deg);
        ">T</span>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 20],
    popupAnchor: [0, -20],
    zIndexOffset: -5000
  });
};

export const createRoutePillIcon = (routeName, duration, color, textColor = 'white', mode = null, isNewRoute = false) => {
  const shouldShowIcon = ['TRAM', 'SUBWAY', 'RAIL'].includes(mode);

  let iconHTML = '';
  if (shouldShowIcon) {
    const modeIcons = {
      SUBWAY: 'fas fa-subway',
      TRAM: 'fas fa-tram',
      RAIL: 'fas fa-train'
    };

    const iconClass = modeIcons[mode] || '';
    iconHTML = `<i class="${iconClass}" style="margin-right: 6px; font-size: 10px;"></i>`;
  }

  const textContent = `${routeName} • ${duration}min`;
  const approxWidth = Math.max(80, textContent.length * 7 + 16 + (shouldShowIcon ? 20 : 0) + (isNewRoute ? 20 : 0));

  const sparkleHTML = isNewRoute ? `
    <img src="/stars.png"
         style="
           position: absolute;
           top: -3px;
           right: -3px;
           width: 16px;
           height: 16px;
           z-index: 10;
         "
         alt="New route" />
  ` : '';

  return L.divIcon({
    className: 'route-pill',
    html: `
      <div style="
        background-color: ${color};
        color: ${textColor || 'white'};
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        border: 2px solid white;
        text-align: center;
        line-height: 1.1;
        min-width: 80px;
        position: relative;
        z-index: 500;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${iconHTML}${routeName} • ${duration}min
        ${sparkleHTML}
      </div>
    `,
    iconSize: [approxWidth, 26],
    iconAnchor: [approxWidth / 2, 13],
    className: 'route-pill-marker'
  });
};

// Pre-created icon instances
export const originIcon = createCustomIcon('#28a745', false);
export const destinationIcon = createCustomIcon('#dc3545', true);
export const transferIcon = createTransferIcon();