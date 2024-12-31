// Initialize the map
const map = L.map('map', {
  center: [48.1581, 11.5820],
  zoom: 11,
  minZoom: 7,
  maxZoom: 18
});

// Add a tile layer for the base map (background map)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Variables to store layers and other data
let highlightedLayer = null;
let allLayers = [];
let geojsonNames = [];
let trainLayer = null;
let busStopsLayer = null;
let districtLayer = null; // New variable to hold the district layer

// Fetch and process GeoJSON data for districts, train network, and bus stops
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
  const cafeValues = [];
  const educationValues = [];
  const healthcareValues = [];
  const storesValues = [];
  const hospitalityValues = [];
  const recreationValues = [];

  districtLayer = L.geoJSON(geojsonData, {
    style: feature => ({
      fillColor: getColor(feature.properties.Intersect_),
      weight: 2,
      color: 'white',
      fillOpacity: 0.7
    }),
    onEachFeature: (feature, layer) => {
      // Push values for each category
      cafeValues.push(feature.properties.cafe || 0);
      educationValues.push(feature.properties.education || 0);
      healthcareValues.push(feature.properties.healthcare_count || 0);
      storesValues.push(feature.properties.stores_count || 0);
      hospitalityValues.push(feature.properties.hospitality_count || 0);
      recreationValues.push(feature.properties.recreation_count || 0);

      geojsonNames.push(feature.properties.name || `Unnamed ${geojsonNames.length + 1}`);

      layer.on('click', () => {
        highlightShape(layer);
        displayInfographics(feature);

        // Capture the postal code from the clicked feature
        const postalCode = feature.properties.plz;
        if (postalCode) {
          // Set the postal code in the calculator form
          document.getElementById('postal_code').value = postalCode;
        }

        // Update the bottom panel with the clicked feature's values
        updateBottomPanel(feature);
      });

      allLayers.push(layer);
    }
  });
  updateCombinedChart(cafeValues, educationValues);

  // Add the district layer to the map
  districtLayer.addTo(map);
};
  



// Load train network data
const loadTrainNetworkLayer = (geojsonData) => {
  // Create the train layer
  trainLayer = L.geoJSON(geojsonData, {
    style: () => ({
      color: '#fc2680',
      weight: 2,
      opacity: 0.75,
      lineJoin: 'round'
    })
  });

  // Check if the trainLayer was successfully created
  if (trainLayer) {
    // Set the zIndex after the layer is created
    trainLayer.setZIndex(1); // Ensure the train network is above district layer

    // Do not add the layer to the map here
    // trainLayer.addTo(map); // This line is removed
  } else {
    console.error('Failed to create the train network layer');
  }

  createLayerControl(); // Create the layer control after the layer is created
};


// Load bus stops data
const loadBusStopsLayer = (geojsonData) => {
  busStopsLayer = L.geoJSON(geojsonData, {
    style: { weight: 1, opacity: 0.8 },
    pointToLayer: (feature, latlng) => L.marker(latlng, {
      icon: L.icon({
        iconUrl: 'Symbols/bus_stop.png',
        iconSize: [25, 25],
        iconAnchor: [12, 25],
        popupAnchor: [0, -25]
      })
    })
  });

  // Check if busStopsLayer is created successfully
  if (busStopsLayer) {
    // Set zIndex for bus stops layer to be above district layer
    busStopsLayer.setZIndex(2); // Ensure bus stops are above district layer

    createLayerControl();
    setBusStopsLayerVisibility(map.getZoom());
    map.on('zoomend', () => setBusStopsLayerVisibility(map.getZoom()));
  } else {
    console.error("Bus stops layer could not be created.");
  }
};

// Set visibility of bus stops layer based on zoom level
const setBusStopsLayerVisibility = (zoomLevel) => {
  const isVisible = zoomLevel >= 17 && zoomLevel <= 18;
  enableBusStopsToggle(isVisible);
};

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

let selectedLayer = null;


// Display infographics in the sidebar
const displayInfographics = (feature) => {
  document.getElementById('cafe-info').innerText = feature.properties.cafe || 'No data';
  document.getElementById('education-info').innerText = feature.properties.education || 'No data';
  document.getElementById('sidebar').style.display = 'block';
};


// Close the sidebar
const closeSidebar = () => {
  document.getElementById('sidebar').style.display = 'none';
};


//////Accordion

var acc = document.getElementsByClassName("accordion");
var i;

for (i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function() {
    this.classList.toggle("active");

    var panel = this.nextElementSibling;
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null; // Collapse the panel
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px"; // Expand the panel
    }
  });
}

const updateBottomPanel = (feature) => {
  // Extract values from the feature properties
  const healthcareCount = feature.properties.healthcare_count || 0;
  const storesCount = feature.properties.stores_count || 0;
  const hospitalityCount = feature.properties.hospitality_count || 0;
  const recreationCount = feature.properties.recreation_count || 0;

  // Update the bottom panel with the extracted values
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
          ticks: { color: '#f8f9fa' }
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
      <h5 id="percentage-info" style="display: none;">Percentage of District<br> covered by Parks (%)</h5>
      <div id="legend-content" style="display: none;"></div>
      <div class="legend-symbols" style="display: none;">
      
        <div><span class="train-line" style="background-color: #fc2680;"></span><span style="float: right;">Train Network</span></div>
        <div><img src="Symbols/bus_stop.png" alt="Bus Stop" style="width: 20px; height: 20px;">  <span style="float: right;">Bus Stops</span></div>
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
      resetButton.style.display = 'inline-block'; // Show reset button when expanded
      percentageInfo.style.display = 'block'; // Show percentage info when expanded
      button.innerText = 'Collapse';
    } else {
      legendContent.style.display = 'none';
      legendSymbols.style.display = 'none';
      resetButton.style.display = 'none'; // Hide reset button when collapsed
      percentageInfo.style.display = 'none'; // Hide percentage info when collapsed
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

  // Remove bus stops and train layers if they are currently on the map
  if (trainLayer && map.hasLayer(trainLayer)) {
    map.removeLayer(trainLayer);
  }
  if (busStopsLayer && map.hasLayer(busStopsLayer)) {
    map.removeLayer(busStopsLayer);
  }

  // Ensure the district layer is always on the map and below others
  if (districtLayer) {
    if (!map.hasLayer(districtLayer)) {
      map.addLayer(districtLayer);
    }
    districtLayer.setZIndex(0); // Ensure it's below other layers
  }

  // Reapply the correct layer stack after reset
  map.getPanes().overlayPane.appendChild(map.getPanes().overlayPane.firstChild);
};

// Create the layer control
const createLayerControl = () => {
  const overlayMaps = { "Train Network": trainLayer, "Bus Stops": busStopsLayer };
  L.control.layers(null, overlayMaps).addTo(map);
};

// Load all GeoJSON data
const loadData = () => {
  loadGeoJSON('postal_codes_final.geojson', loadDistrictData);
  loadGeoJSON('Train_network.geojson', loadTrainNetworkLayer);
  loadGeoJSON('Munich_Bus_Stops.geojson', loadBusStopsLayer);
};

// Initialize
loadData();
createLegend();

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
// Function to highlight shape by postal code
const highlightShapeByPostalCode = (postalCode) => {
  // Check if allLayers is populated
  if (!allLayers || allLayers.length === 0) {
    console.warn('No layers available to search.');
    return;
  }

  // Find the matching layer by postal code
  const matchingLayer = allLayers.find(layer => {
    const feature = layer.feature;
    return feature && feature.properties && String(feature.properties.plz).trim() === String(postalCode).trim();
  });

  // Highlight the matching layer if found
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
