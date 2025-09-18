// preprocess-gtfs.js - Run this script to generate optimized transit data
const fs = require('fs');
const path = require('path');

// Your existing parseGTFSData function (fixed version)
const parseGTFSData = (routesData, tripsData, shapesData, agencyName) => {
  const transitModes = ['0', '1', '2']; // 0=Tram, 1=Subway, 2=Rail
  const transitLines = [];

  console.log(`Processing ${agencyName}...`);
  
  try {
    // Remove BOM (Byte Order Mark) if present
    const cleanRoutesData = routesData.replace(/^\uFEFF/, '');
    const cleanTripsData = tripsData.replace(/^\uFEFF/, '');
    const cleanShapesData = shapesData.replace(/^\uFEFF/, '');
    
    const routes = cleanRoutesData.split(/\r?\n/).slice(1);
    const routeHeaders = cleanRoutesData.split(/\r?\n/)[0].split(',').map(h => h.trim());
    
    const trips = cleanTripsData.split(/\r?\n/).slice(1);
    const tripHeaders = cleanTripsData.split(/\r?\n/)[0].split(',').map(h => h.trim());
    
    const shapes = cleanShapesData.split(/\r?\n/).slice(1);
    const shapeHeaders = cleanShapesData.split(/\r?\n/)[0].split(',').map(h => h.trim());
    
    // Get column indices
    const routeTypeIdx = routeHeaders.indexOf('route_type');
    const routeIdIdx = routeHeaders.indexOf('route_id');
    const routeNameIdx = routeHeaders.indexOf('route_long_name');
    const routeShortNameIdx = routeHeaders.indexOf('route_short_name');
    const routeColorIdx = routeHeaders.indexOf('route_color');
    
    // Debug: check if we can find the route_id column
    if (routeIdIdx === -1) {
      console.error(`${agencyName}: route_id column not found in headers:`, routeHeaders);
      return [];
    }
    
    // Build route lookup with proper color handling
    const transitRoutes = new Map();
    routes.forEach(row => {
      if (!row.trim()) return;
      
      const fields = row.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
      const routeId = fields[routeIdIdx];
      
      // Skip if route_id is undefined or empty
      if (!routeId || routeId === 'undefined') {
        console.warn(`${agencyName}: Skipping route with undefined ID:`, fields);
        return;
      }
      
      if (routeTypeIdx >= 0 && transitModes.includes(fields[routeTypeIdx])) {
        let routeColor = '#000000';
        
        if (routeColorIdx >= 0 && fields[routeColorIdx]) {
          let colorValue = fields[routeColorIdx].trim().replace(/"/g, '');
          routeColor = colorValue.startsWith('#') ? colorValue : `#${colorValue}`;
        }
        
        transitRoutes.set(routeId, {
          name: fields[routeNameIdx] || fields[routeShortNameIdx] || 'Unknown Route',
          shortName: fields[routeShortNameIdx] || '',
          type: fields[routeTypeIdx],
          color: routeColor,
          agency: agencyName
        });
      }
    });
    
    console.log(`${agencyName}: Found ${transitRoutes.size} valid routes`);
    
    // Build shape lookup from trips
    const routeShapes = new Map();
    const routeIdIdx_trips = tripHeaders.indexOf('route_id');
    const shapeIdIdx_trips = tripHeaders.indexOf('shape_id');
    
    if (routeIdIdx_trips === -1 || shapeIdIdx_trips === -1) {
      console.error(`${agencyName}: Missing route_id or shape_id columns in trips.txt`);
      return [];
    }
    
    trips.forEach(row => {
      if (!row.trim()) return;
      
      const fields = row.split(',');
      const routeId = fields[routeIdIdx_trips];
      const shapeId = fields[shapeIdIdx_trips];
      
      if (transitRoutes.has(routeId) && shapeId) {
        if (!routeShapes.has(routeId)) {
          routeShapes.set(routeId, new Set());
        }
        routeShapes.get(routeId).add(shapeId);
      }
    });
    
    // Build coordinates from shapes
    const shapeCoords = new Map();
    const shapeIdIdx = shapeHeaders.indexOf('shape_id');
    const latIdx = shapeHeaders.indexOf('shape_pt_lat');
    const lonIdx = shapeHeaders.indexOf('shape_pt_lon');
    const seqIdx = shapeHeaders.indexOf('shape_pt_sequence');
    
    if (shapeIdIdx === -1 || latIdx === -1 || lonIdx === -1 || seqIdx === -1) {
      console.error(`${agencyName}: Missing required columns in shapes.txt`);
      return [];
    }
    
    shapes.forEach(row => {
      if (!row.trim()) return;
      
      const fields = row.split(',');
      const shapeId = fields[shapeIdIdx];
      const lat = parseFloat(fields[latIdx]);
      const lon = parseFloat(fields[lonIdx]);
      const seq = parseInt(fields[seqIdx]);
      
      if (!isNaN(lat) && !isNaN(lon) && !isNaN(seq)) {
        if (!shapeCoords.has(shapeId)) {
          shapeCoords.set(shapeId, []);
        }
        shapeCoords.get(shapeId).push({ lat, lon, seq });
      }
    });
    
    console.log(`${agencyName}: Found ${shapeCoords.size} shapes with coordinates`);
    
    // Sort coordinates by sequence and build transit lines
    routeShapes.forEach((shapeIds, routeId) => {
      const route = transitRoutes.get(routeId);
      
      const shapeArray = Array.from(shapeIds);
      if (shapeArray.length > 0) {
        const shapeId = shapeArray[0];
        const coords = shapeCoords.get(shapeId);
        
        if (coords && coords.length > 1) {
          coords.sort((a, b) => a.seq - b.seq);
          transitLines.push({
            mode: route.type === '1' ? 'SUBWAY' : route.type === '2' ? 'RAIL' : 'TRAM',
            name: route.name,
            shortName: route.shortName,
            color: route.color,
            agency: route.agency,
            coordinates: coords.map(c => [c.lat, c.lon])
          });
        }
      }
    });
    
    console.log(`Processed ${transitLines.length} transit lines for ${agencyName}`);
    return transitLines;
    
  } catch (error) {
    console.error(`Error processing GTFS data for ${agencyName}:`, error);
    return [];
  }
};

async function preprocessGTFS() {
  try {
    // Read agencies configuration
    console.log('Loading agencies configuration...');
    const agenciesData = fs.readFileSync('./public/gtfs/agencies.json', 'utf8');
    const agenciesConfig = JSON.parse(agenciesData);
    
    const allTransitLines = [];
    
    // Process each agency
    for (const agency of agenciesConfig.agencies) {
      console.log(`\nProcessing ${agency.name}...`);
      
      try {
        const routesPath = `./public/gtfs/${agency.folder}/routes.txt`;
        const tripsPath = `./public/gtfs/${agency.folder}/trips.txt`;
        const shapesPath = `./public/gtfs/${agency.folder}/shapes.txt`;
        
        // Check if files exist
        if (!fs.existsSync(routesPath) || !fs.existsSync(tripsPath) || !fs.existsSync(shapesPath)) {
          console.warn(`Missing files for agency ${agency.name}, skipping...`);
          continue;
        }
        
        // Read files
        const routesData = fs.readFileSync(routesPath, 'utf8');
        const tripsData = fs.readFileSync(tripsPath, 'utf8');
        const shapesData = fs.readFileSync(shapesPath, 'utf8');
        
        // Parse GTFS data for this agency
        const agencyLines = parseGTFSData(routesData, tripsData, shapesData, agency.name);
        allTransitLines.push(...agencyLines);
        
      } catch (error) {
        console.error(`Error processing ${agency.name}:`, error);
      }
    }
    
    // Create output data
    const outputData = {
      lastUpdated: new Date().toISOString(),
      totalLines: allTransitLines.length,
      agencies: agenciesConfig.agencies.length,
      transitLines: allTransitLines
    };
    
    // Write processed data to JSON file
    const outputPath = './public/gtfs/processed-transit-lines.json';
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`\n✅ Successfully preprocessed ${allTransitLines.length} transit lines from ${agenciesConfig.agencies.length} agencies`);
    console.log(`📄 Output saved to: ${outputPath}`);
    console.log(`📊 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error('❌ Preprocessing failed:', error);
    process.exit(1);
  }
}

// Run the preprocessing
preprocessGTFS();