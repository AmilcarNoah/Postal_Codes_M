// Initialize the map
const map = L.map('map', {
  center: [48.1552, 11.5650],
  zoom: 11.60,
  minZoom: 7,
  maxZoom: 19,
  zoomSnap: 0.05
});

// Add a tile layer for the base map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Variables to store layers and other data
let highlightedLayer = null;
let allLayers = [];
let geojsonNames = [];
let trainLayer = null;
let busStopsLayer = null;
let districtLayer = null;
// Color scale function for cluster sizes
const getClusterColor = (count) => {
  return count > 50 ? '#8c2d04' :
         count > 20 ? '#d94801' :
         count > 10 ? '#f16913' :
         count > 5 ? '#fd8d3c' :
         count > 2 ? '#fdae6b' :
         '#feedde';
};

const markerCluster = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: true,
  zoomToBoundsOnClick: true,
  maxClusterRadius: (zoom) => {
    // Adjust cluster radius based on zoom level
    return zoom < 12 ? 80 : 
           zoom < 14 ? 60 : 
           zoom < 16 ? 40 : 30;
  },
  spiderfyDistanceMultiplier: 1.5,
  disableClusteringAtZoom: 16,
  iconCreateFunction: function(cluster) {
    const childMarkers = cluster.getAllChildMarkers();
    const types = new Set(childMarkers.map(marker => marker.feature.properties.fclass));
    const count = cluster.getChildCount();
    
    // Determine cluster icon based on contained stop types
    let iconUrl = 'default_stop.png';
    if (types.has('railway_station')) {
      iconUrl = 'train_station.png';
    } else if (types.has('tram_stop')) {
      iconUrl = 'tram_stop.png';
    } else if (types.has('bus_stop')) {
      iconUrl = 'bus_stop.png';
    }

    const size = Math.min(40 + (count * 2), 60); // Dynamic size based on count
    const color = getClusterColor(count);

    return L.divIcon({
      html: `<div class="cluster-icon" style="
              background-image: url(${iconUrl});
              background-color: ${color};
              border: 2px solid ${count > 10 ? '#333' : '#666'};
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="
                color: ${count > 10 ? '#fff' : '#333'};
                font-weight: bold;
                font-size: ${Math.min(14 + count/2, 18)}px;
                text-shadow: ${count > 10 ? '0 1px 1px rgba(0,0,0,0.3)' : '0 1px 1px rgba(255,255,255,0.5)'};
              ">${count}</span>
            </div>`,
      className: 'marker-cluster',
      iconSize: L.point(size + 10, size + 10), // Increased size
      iconAnchor: [(size + 10)/2, (size + 10)/2]
    });
  }
});

// Fetch and process GeoJSON data
const loadGeoJSON = async (filePath, callback) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load ${filePath}`);
    const data = await response.json();
    callback(data);
  } catch (error) {
    console.error(`Error loading GeoJSON from ${filePath}:`, error);
  }
};

// Load district data
const loadDistrictData = (geojsonData) => {
  const categoryValues = {
    cafe: [],
    education: [],
    healthcare: [],
    stores: [],
    hospitality: [],
    recreation: []
  };

  districtLayer = L.geoJSON(geojsonData, {
    style: feature => ({
      fillColor: getColor(feature.properties.Intersect_),
      weight: 2,
      color: 'white',
      fillOpacity: 0.7
    }),
    onEachFeature: (feature, layer) => {
      Object.keys(categoryValues).forEach(category => {
        categoryValues[category].push(feature.properties[category] || 0);
      });

      geojsonNames.push(feature.properties.name || `Unnamed ${geojsonNames.length + 1}`);

      layer.on('click', () => {
        highlightShape(layer);
        displayInfographics(feature);
        updateBottomPanel(feature);
        updatePostalCodeInput(feature.properties.plz);
      });

      allLayers.push(layer);
    }
  });

  updateCombinedChart(categoryValues.cafe, categoryValues.education);
  districtLayer.addTo(map);
};

// Load train network data
const loadTrainNetworkLayer = (geojsonData) => {
  trainLayer = L.geoJSON(geojsonData, {
    style: () => ({
      color: '#fc2680',
      weight: 2,
      opacity: 0.75,
      lineJoin: 'round'
    })
  });

  if (trainLayer) {
    trainLayer.setZIndex(1);
    createLayerControl();
  } else {
    console.error('Failed to create the train network layer');
  }
};

// Load bus stops data
const loadBusStopsLayer = (geojsonData) => {
  busStopsLayer = L.geoJSON(geojsonData, {
    pointToLayer: (feature, latlng) => {
      const iconUrl = getIconUrl(feature.properties.fclass);
      const marker = L.marker(latlng, {
        icon: L.icon({
          iconUrl: iconUrl,
          iconSize: [20, 20],
          iconAnchor: [10, 20],
          popupAnchor: [0, -20]
        }),
        feature: feature // Store feature data on marker
      });
      
      // Add popup with stop information
      marker.bindPopup(`<b>${feature.properties.name || 'Transport Stop'}</b><br>
                        Type: ${feature.properties.fclass.replace('_', ' ')}`);
      
      // Add marker to the cluster group
      markerCluster.addLayer(marker);
      return marker;
    }
  });

  if (busStopsLayer) {
    busStopsLayer.addTo(markerCluster); // Add the layer to the cluster group
    busStopsLayer.setZIndex(2);
    createLayerControl();
    setBusStopsLayerVisibility(map.getZoom()); // Call setBusStopsLayerVisibility when map is initialized
    map.on('zoomend', () => setBusStopsLayerVisibility(map.getZoom()));
  } else {
    console.error("Bus stops layer could not be created.");
  }
};

// Get icon URL based on stop type
const getIconUrl = (stopType) => {
  switch (stopType) {
    case 'bus_stop': return 'Symbols/bus_stop.png';
    case 'tram_stop': return 'Symbols/tram_stop.png';
    case 'railway_station': return 'Symbols/train_station.png';
    // default: return 'Symbols/default_stop.png';
  }
};
// Global constants for stop types and zoom levels
const STOP_TYPES = {
  TRAIN_STATION: 'railway_station',
  TRAM_STOP: 'tram_stop',
  BUS_STOP: 'bus_stop',
  DEFAULT_STOP: 'default_stop'        //not in use
};

const ZOOM_LEVELS = {
  [STOP_TYPES.TRAIN_STATION]: 11,
  [STOP_TYPES.TRAM_STOP]: 11,     
  [STOP_TYPES.BUS_STOP]: 11,   
  [STOP_TYPES.DEFAULT_STOP]: 16     //not in use
};

// Function to set bus stops layer visibility
const setBusStopsLayerVisibility = (zoomLevel) => {
  if (!busStopsLayer || !map.hasLayer(markerCluster)) {
    console.warn('Bus stops layer is not initialized or visible.');
    return;
  }

  const busStops = busStopsLayer.getLayers();
  if (!busStops || busStops.length === 0) {
    console.warn('No bus stops found in the layer.');
    return;
  }

  // Adjust cluster settings based on zoom level
  if (zoomLevel < 12) {
    markerCluster.options.maxClusterRadius = 100;
    markerCluster.options.disableClusteringAtZoom = 16;
  } else if (zoomLevel < 14) {
    markerCluster.options.maxClusterRadius = 80;
    markerCluster.options.disableClusteringAtZoom = 18;
  } else {
    markerCluster.options.maxClusterRadius = 60;
    markerCluster.options.disableClusteringAtZoom = 20;
  }

  busStops.forEach(stop => {
    const stopType = stop.feature?.properties?.fclass || STOP_TYPES.DEFAULT_STOP;

    let isVisible = true;
    switch (stopType) {
      case STOP_TYPES.TRAIN_STATION:
        isVisible = zoomLevel >= ZOOM_LEVELS[STOP_TYPES.TRAIN_STATION];
        break;
      case STOP_TYPES.TRAM_STOP:
        isVisible = zoomLevel >= ZOOM_LEVELS[STOP_TYPES.TRAM_STOP];
        break;
      case STOP_TYPES.BUS_STOP:
        isVisible = zoomLevel >= ZOOM_LEVELS[STOP_TYPES.BUS_STOP];
        break;
      default:
        isVisible = zoomLevel >= ZOOM_LEVELS[STOP_TYPES.DEFAULT_STOP];
        break;
    }

    if (isVisible) {
      markerCluster.addLayer(stop);
    } else {
      markerCluster.removeLayer(stop);
    }
  });

  // Refresh clusters after visibility changes
  markerCluster.refreshClusters();
  console.debug(`Updated visibility for ${busStops.length} stops at zoom level ${zoomLevel}.`);
};

map.on('zoomend', () => {
  if (busStopsLayer && map.hasLayer(busStopsLayer)) {
    setBusStopsLayerVisibility(map.getZoom());
  }
});

// Enable or disable bus stops toggle
const enableBusStopsToggle = (enable) => {
  const layerControl = map._controlLayers;
  if (layerControl) {
    const busStopsLayerControl = layerControl._layers[Object.keys(layerControl._layers)
      .find(key => layerControl._layers[key].layer === busStopsLayer)];

    if (busStopsLayerControl) {
      if (enable) {
        busStopsLayerControl.enabled = true;
        busStopsLayerControl._layer.addTo(map);
      } else {
        busStopsLayerControl.enabled = false;
        map.removeLayer(busStopsLayer);
      }
    }
  }
};

// Highlight a district shape
const highlightShape = (layer) => {
  if (highlightedLayer) {
    highlightedLayer.setStyle({ weight: 2, color: 'white', fillOpacity: 0.7 });
  }

  layer.setStyle({ weight: 4, color: '#48ffed', fillOpacity: 0.9 });
  highlightedLayer = layer;
};

// Display infographics in the sidebar
const displayInfographics = (feature) => {
  document.getElementById('cafe-info').innerText = feature.properties.cafe || 'No data';
  document.getElementById('education-info').innerText = feature.properties.education || 'No data';
  document.getElementById('sidebar').style.display = 'block';
};

// Update postal code input
const updatePostalCodeInput = (postalCode) => {
  if (postalCode) {
    document.getElementById('postal_code').value = postalCode;
  }
};

// Close the sidebar
const closeSidebar = () => {
  document.getElementById('sidebar').style.display = 'none';
};

// Accordion functionality
const initializeAccordion = () => {
  const acc = document.getElementsByClassName("accordion");
  for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
      this.classList.toggle("active");
      const panel = this.nextElementSibling;
      panel.style.maxHeight = panel.style.maxHeight ? null : panel.scrollHeight + "px";

      // Automatically scroll to the calculator accordion if the first two are expanded
      if (i === 0 || i === 1) {
        const calculatorAccordion = document.querySelector('.accordion.calculator');
        if (calculatorAccordion) {
          calculatorAccordion.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }
};

// Update the bottom panel
const updateBottomPanel = (feature) => {
  const healthcareCount = feature.properties.healthcare_count || 0;
  const storesCount = feature.properties.stores_count || 0;
  const hospitalityCount = feature.properties.hospitality_count || 0;
  const recreationCount = feature.properties.recreation_count || 0;

  document.getElementById('healthcare-info').textContent = healthcareCount;
  document.getElementById('stores-info').textContent = storesCount;
  document.getElementById('hospitality-info').textContent = hospitalityCount;
  document.getElementById('recreation-info').textContent = recreationCount;
};

// Update the combined chart
const updateCombinedChart = (cafeValues, educationValues) => {
  const ctx = document.getElementById('combined-chart').getContext('2d');
  if (window.combinedChart) window.combinedChart.destroy();

  window.combinedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: geojsonNames.map(name => name.length > 15 ? name.substring(0, 15) + '...' : name),
      datasets: [
        {
          label: 'Eateries',
          data: cafeValues,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Education Facilities',
          data: educationValues,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: '#f8f9fa' } }
      },
      scales: {
        x: {
          ticks: {
            color: '#f8f9fa',
            maxRotation: 45,
            minRotation: 30,
            autoSkip: true,
            callback: (value) => value
          }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#f8f9fa'}
        }
      }
    }
  });

  document.querySelector('.combined-visualization').addEventListener('click', () => showEnlargedChart(cafeValues, educationValues));
};

// Show enlarged chart in modal
const showEnlargedChart = (cafeValues, educationValues) => {
  const chartModal = document.getElementById('chart-modal');
  chartModal.style.display = 'flex';

  const enlargedCtx = document.getElementById('enlarged-chart').getContext('2d');
  if (window.enlargedChart) window.enlargedChart.destroy();

  window.enlargedChart = new Chart(enlargedCtx, {
    type: 'bar',
    data: {
      labels: geojsonNames.map(name => name.length > 15 ? name.substring(0, 15) + '...' : name),
      datasets: [
        {
          label: 'Eateries',
          data: cafeValues,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Education Facilities',
          data: educationValues,
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: { responsive: true, plugins: { legend: { display: true, position: 'top' } } }
  });
};

// Close the chart modal
document.getElementById('close-modal').addEventListener('click', () => {
  document.getElementById('chart-modal').style.display = 'none';
});

// Helper function for color scale
const getColor = (value) => {
  return value > 50 ? '#006d2c' :
         value > 16 ? '#31a354' :
         value > 7.1 ? '#74c476' :
         value > 4.3 ? '#bae4b3' :
         value > 2.5 ? '#edf8e9' :
         value > 0   ? '#FED976' : '#FFEDA0';
};

// Create interactive legend
const createLegend = () => {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend');
    div.innerHTML = `
      <h4>Legend</h4>
      <h5 id="percentage-info" style="display: none;">Postal Code Area(Percentage of Area<br> covered by Parks (%))</h5>
      <div id="legend-content" style="display: none;"></div>
      <div class="legend-symbols" style="display: none;">
        <h5 id="train-heading" style="display: none;">Train Network</h5>
        <div id="train-symbol" style="display: none;">
          <span class="train-line"></span>
          <span style="float: right;">Train Network</span>
        </div>
        <h5 id="transport-heading" style="display: none;">Transport Stops/Stations</h5>
        <div class="transport-symbol" data-stop-type="bus_stop" style="display: none;">
          <img src="Symbols/bus_stop.png" alt="Bus Stop" style="width: 20px; height: 20px;">
          <span style="float: right;">Bus Stops</span>
        </div>
        <div class="transport-symbol" data-stop-type="tram_stop" style="display: none;">
          <img src="Symbols/tram_stop.png" alt="Tram Stop" style="width: 20px; height: 20px;">
          <span style="float: right;">Tram Stops</span>
        </div>
        <div class="transport-symbol" data-stop-type="train_station" style="display: none;">
          <img src="Symbols/train_station.png" alt="Train Station" style="width: 20px; height: 20px;">
          <span style="float: right;">Train Stations</span>
        </div>
        
      </div>
      <button id="reset-button" style="display: none;">Reset</button>
      <button id="toggle-legend">Expand</button>
    `;
    return div;
  };

  legend.addTo(map);
  generateLegendContent();
  document.getElementById('reset-button').addEventListener('click', resetLayers);

  // Add functionality to minimize/expand the legend
  document.getElementById('toggle-legend').addEventListener('click', () => {
    const legendContent = document.getElementById('legend-content');
    const button = document.getElementById('toggle-legend');
    const legendSymbols = document.querySelector('.legend-symbols');
    const resetButton = document.getElementById('reset-button');
    const percentageInfo = document.getElementById('percentage-info');
    
    if (legendContent.style.display === 'none') {
      legendContent.style.display = 'block';
      legendSymbols.style.display = 'block';
      resetButton.style.display = 'inline-block';
      percentageInfo.style.display = 'block';
      button.innerText = 'Collapse';
    } else {
      legendContent.style.display = 'none';
      legendSymbols.style.display = 'none';
 resetButton.style.display = 'none';
      percentageInfo.style.display = 'none';
      button.innerText = 'Expand';
    }
  });
};

// Add a style for the train line
const styleTrainLineInLegend = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    .legend-symbols .train-line {
      width: 40px;
      height: 5px;
      display: inline-block;
      background-color: #fc2680;
      margin-right: 10px;
    }
  `;
  document.head.appendChild(style);
};

// Call the style function
styleTrainLineInLegend();

// Generate legend items
const generateLegendContent = () => {
  const legendContent = document.getElementById('legend-content');
  const grades = [0, 2.5, 4.3, 7.1, 16, 50];
  
  grades.forEach((grade, i) => {
    const nextGrade = grades[i + 1] || '+';
    const color = getColor(grade);
    const item = document.createElement('div');
    
    item.className = 'legend-item';
    item.innerHTML = `<span style="background:${color}; width: 20px; height: 20px; display: inline-block; border: 1px solid #000;"></span> ${grade}–${nextGrade}`;
    item.addEventListener('click', () => filterShapesByColor(color));
    legendContent.appendChild(item);
  });
};

// Filter shapes by color
const filterShapesByColor = (color) => {
  allLayers.forEach(layer => {
    const featureColor = getColor(layer.feature.properties.Intersect_);
    if (featureColor === color) {
      map.addLayer(layer);
    } else {
      map.removeLayer(layer);
    }
  });
};

// Reset all layers to their original state, ensuring district layer stays at the bottom
const resetLayers = () => {
  allLayers.forEach(layer => {
    if (!map.hasLayer(layer)) {
      map.addLayer(layer);
    }
  });

  // Remove all transport-related layers
  if (trainLayer && map.hasLayer(trainLayer)) {
    map.removeLayer(trainLayer);
  }
  if (busStopsLayer && map.hasLayer(busStopsLayer)) {
    map.removeLayer(busStopsLayer);
  }
  if (markerCluster && map.hasLayer(markerCluster)) {
    map.removeLayer(markerCluster);
  }

  if (districtLayer) {
    if (!map.hasLayer(districtLayer)) {
      map.addLayer(districtLayer);
    }
    districtLayer.setZIndex(0);
  }

  map.getPanes().overlayPane.appendChild(map.getPanes().overlayPane.firstChild);
  
  // Recenter and reset zoom
  map.setView([48.1552, 11.5650], 11.60);
  
  // Update transport symbols visibility in legend
  toggleTransportSymbolsVisibility(false);
  updateLegendVisibility(false, 'transport');
};
11.565
// Create the layer control
const createLayerControl = () => {
  const overlayMaps = {
    "Train Network": trainLayer,
    // "Transport Stops/Stations": busStopsLayer  // original layer
    "Transport Stops/Stations": markerCluster
  };

  const layerControl = L.control.layers(null, overlayMaps).addTo(map);

  map.on('overlayadd overlayremove', (event) => {
    const isVisible = event.type === 'overlayadd';
    if (event.name === "Transport Stops/Stations") {
      if (isVisible) {
        map.addLayer(markerCluster);
        setBusStopsLayerVisibility(map.getZoom());
      } else {
        map.removeLayer(markerCluster);
      }
      toggleTransportSymbolsVisibility(isVisible);
      updateLegendVisibility(isVisible, 'transport');
    }
    if (event.name === "Train Network") {
      toggleTrainSymbolVisibility(isVisible);
      updateLegendVisibility(isVisible, 'train');
    }
  });
};

// Update Legend with Active Layers
const updateLegendVisibility = (isVisible, type) => {
  const heading = type === 'train' ? document.getElementById('train-heading') : document.getElementById('transport-heading');
  const symbol = type === 'train' ? document.getElementById('train-symbol') : document.querySelector('.transport-symbol[data-stop-type="bus_stop"]');

  if (heading && symbol) {
    heading.style.display = isVisible ? 'block' : 'none';
    symbol.style.display = isVisible ? 'block' : 'none';
  }
};

const toggleTransportSymbolsVisibility = (isVisible) => {
  const transportSymbols = document.querySelectorAll('.transport-symbol');
  const transportHeading = document.querySelector('.legend-symbols h5:nth-of-type(2)'); // Select the second <h5> in the legend-symbols div

  transportSymbols.forEach(symbol => {
    symbol.style.display = isVisible ? 'block' : 'none';
  });
  if (transportHeading) {
    transportHeading.style.display = isVisible ? 'block' : 'none';
  }
};

const toggleTrainSymbolVisibility = (isVisible) => {
  const trainSymbol = document.querySelector('.train-line');
  const trainHeading = document.querySelector('.legend-symbols h5:first-of-type'); // Select the first <h5> in the legend-symbols div

  if (trainSymbol) {
    trainSymbol.style.display = isVisible ? 'inline-block' : 'none';
  }
  if (trainHeading) {
    trainHeading.style.display = isVisible ? 'block' : 'none';
  }
};

// Load all GeoJSON data
const loadData = () => {
  loadGeoJSON('postal_codes_final.geojson', loadDistrictData);
  loadGeoJSON('Train_network.geojson', loadTrainNetworkLayer);
  loadGeoJSON('Transport.geojson.geojson', loadBusStopsLayer);
};

// Initialize
loadData();
createLegend();
initializeAccordion();
// Hide the train network symbol initially if the layer is not visible
if (trainLayer && !map.hasLayer(trainLayer)) {
  toggleTrainSymbolVisibility(false);
}
if (busStopsLayer && !map.hasLayer(busStopsLayer)) {
  toggleTransportSymbolsVisibility(false);
}

// Calculator Set
let dataset = [];

// Fetch and load the CSV file directly from the server
function loadCSV() {
  fetch('df_calculator.csv')
    .then(response => response.text())
    .then(csvData => {
      dataset = Papa.parse(csvData, { header: true, skipEmptyLines: true }).data;
      populateDropdowns();
    })
    .catch(error => {
      console.error('Error loading CSV file:', error);
    });
}

// Populate dropdowns with unique values from the dataset
function populateDropdowns() {
  if (dataset.length === 0) return;

  const uniqueValues = {
    newlyConst: new Set(),
    balcony: new Set(),
    lift: new Set(),
    garden: new Set(),
    serviceCharge: new Set(),
    livingSpace: new Set(),
    noRooms: new Set(),
    postal_code: new Set()
  };

  dataset.forEach(row => {
    uniqueValues.newlyConst.add(row.newlyConst == 1 ? "Yes" : "No");
    uniqueValues.balcony.add(row.balcony == 1 ? "Yes" : "No");
    uniqueValues.lift.add(row.lift == 1 ? "Yes" : "No");
    uniqueValues.garden.add(row.garden == 1 ? "Yes" : "No");
    uniqueValues.serviceCharge.add(row.serviceCharge);
    uniqueValues.livingSpace.add(row.livingSpace);
    uniqueValues.noRooms.add(row.noRooms);
    uniqueValues.postal_code.add(row.postal_code);
  });

  for (const [key, values] of Object.entries(uniqueValues)) {
    const selectElement = document.getElementById(key);
    Array.from(values).sort().forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });
  }
}

function calculateBaseRent(inputs) {
  const { newlyConst, balcony, lift, garden, serviceCharge, livingSpace, noRooms, postal_code } = inputs;

  const matchingRows = dataset.filter(row =>
    row.newlyConst == newlyConst &&
    row.balcony == balcony &&
    row.lift == lift &&
    row.garden == garden &&
    row.serviceCharge == serviceCharge &&
    row.livingSpace == livingSpace &&
    row.noRooms == noRooms &&
    row.postal_code == postal_code
  );

  if (matchingRows.length === 0) {
    return "No matches found.";
  }

  const totalBaseRent = matchingRows.reduce((sum, row) => sum + parseFloat(row.baseRent), 0);
  const averageBaseRent = totalBaseRent / matchingRows.length;

  return `Average Base Rent: ${averageBaseRent.toFixed(2)}`;
}

function handleCalculate(event) {
  event.preventDefault();

  const inputs = {
    newlyConst: document.getElementById('newlyConst').value === "Yes" ? 1 : 0,
    balcony: document.getElementById('balcony').value === "Yes" ? 1 : 0,
    lift: document.getElementById('lift').value === "Yes" ? 1 : 0,
    garden: document.getElementById('garden').value === "Yes" ? 1 : 0,
    serviceCharge: document.getElementById('serviceCharge').value,
    livingSpace: document.getElementById('livingSpace').value,
    noRooms: document.getElementById('noRooms').value,
    postal_code: document.getElementById('postal_code').value
  };

  const result = calculateBaseRent(inputs);
  document.getElementById('result').textContent = result;
}

window.onload = loadCSV;

// Cache postal code input element
const postalCodeInput = document.getElementById('postal_code');

// Add event listener to postal code input
postalCodeInput.addEventListener('change', () => {
  const postalCode = postalCodeInput.value;
  highlightShapeByPostalCode(postalCode);
});

// Function to highlight shape by postal code
const highlightShapeByPostalCode = (postalCode) => {
  if (!allLayers || allLayers.length === 0) {
    console.warn('No layers available to search.');
    return;
  }

  const matchingLayer = allLayers.find(layer => {
    const feature = layer.feature;
    return feature && feature.properties && String(feature.properties.plz).trim() === String(postalCode).trim();
  });

  if (matchingLayer) {
    highlightShape(matchingLayer);
  } else {
    console.warn(`No district found with postal code: ${postalCode}`);
  }
};

function populateBottomPanel(data) {
  document.getElementById('healthcare-info').textContent = data.healthcare_count || 'No data';
  document.getElementById('stores-info').textContent = data.stores_count || 'No data';
  document.getElementById('hospitality-info').textContent = data.hospitality_count || 'No data';
  document.getElementById('recreation-info').textContent = data.recreation_count || 'No data';
}
