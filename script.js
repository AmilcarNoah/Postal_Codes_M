// Create the map
const map = L.map('map', {
  center: [48.1581, 11.5820],
  zoom: 11.5,
  minZoom: 7,
  maxZoom: 15
});

// Add a tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Variable to store the currently highlighted layer
let highlightedLayer = null;

// Store all layers for reset functionality
let allLayers = [];

// Fetch and process GeoJSON
function loadGeoJSONFromFile(filePath) {
  fetch(filePath)
    .then(response => response.json())
    .then(geojsonData => {
      const cafeValues = [];
      const educationValues = [];

      const geojsonLayer = L.geoJSON(geojsonData, {
        style: feature => ({
          fillColor: getColor(feature.properties.Intersect_),
          weight: 2,
          color: 'white',
          fillOpacity: 0.7
        }),
        onEachFeature: (feature, layer) => {
          if (feature.properties) {
            cafeValues.push(feature.properties.cafe || 0);
            educationValues.push(feature.properties.education || 0);

            layer.on('click', () => {
              highlightShape(layer);
              displayInfographics(feature);
            });

            // Store layer for reset functionality
            allLayers.push(layer);
          }
        }
      }).addTo(map);

      updateCombinedChart(cafeValues, educationValues);
    })
    .catch(error => console.error('Error loading GeoJSON:', error));
}

// Load GeoJSON
loadGeoJSONFromFile('Park_percent.geojson');

// Highlight a shape
function highlightShape(layer) {
  if (highlightedLayer) {
    highlightedLayer.setStyle({
      weight: 2,
      color: 'white',
      fillOpacity: 0.7
    });
  }

  layer.setStyle({
    weight: 4,
    color: '#48ffed',
    fillOpacity: 0.9
  });

  highlightedLayer = layer;
}

// Display infographics
function displayInfographics(feature) {
  document.getElementById('cafe-info').innerText = feature.properties.cafe || 'No data';
  document.getElementById('education-info').innerText = feature.properties.education || 'No data';
  document.getElementById('sidebar').style.display = 'block';
}

// Close sidebar
function closeSidebar() {
  document.getElementById('sidebar').style.display = 'none';
}

// Update combined chart
function updateCombinedChart(cafeValues, educationValues) {
  const ctx = document.getElementById('combined-chart').getContext('2d');

  if (window.combinedChart) {
    window.combinedChart.destroy();
  }

  window.combinedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: cafeValues.length }, (_, i) => `Shape ${i + 1}`),
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
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#f8f9fa'
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#f8f9fa'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#f8f9fa'
          }
        }
      }
    }
  });

  // Add click-to-enlarge functionality
  document.querySelector('.combined-visualization').addEventListener('click', () => {
    showEnlargedChart(cafeValues, educationValues);
  });
}

// Create interactive legend
function createLegend() {
  const legend = L.control({ position: 'bottomright' });

  legend.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'info legend');

    div.innerHTML = `
      <h4>Legend</h4>
      <h5>Percentage of Area<br> covered by Parks(%)</h5> <!-- Line break after "Area" -->
  <div id="legend-content"></div>
      <div id="legend-content"></div>
      <button id="reset-button">Reset</button>
    `;

    return div;
  };

  legend.addTo(map);

  const legendContent = document.getElementById('legend-content');
  const grades = [0, 2.5, 4.3, 7.1, 16, 50];
  grades.forEach((grade, i) => {
    const nextGrade = grades[i + 1] || '+';
    const color = getColor(grade);

    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span style="background:${color}; width: 20px; height: 20px; display: inline-block; border: 1px solid #000;"></span>
      ${grade}–${nextGrade}
    `;

    item.addEventListener('click', () => filterShapesByColor(color));
    legendContent.appendChild(item);
  });

  const resetButton = document.getElementById('reset-button');
  resetButton.addEventListener('click', resetShapes);
}

// Filter shapes by color
function filterShapesByColor(color) {
  allLayers.forEach(layer => {
    const featureColor = getColor(layer.feature.properties.Intersect_);
    if (featureColor === color) {
      map.addLayer(layer);
    } else {
      map.removeLayer(layer);
    }
  });
}

// Reset shapes to original state
function resetShapes() {
  allLayers.forEach(layer => {
    if (!map.hasLayer(layer)) {
      map.addLayer(layer);
    }
  });
}

// Modal functionality for enlarged chart
const chartModal = document.getElementById('chart-modal');
const closeModal = document.getElementById('close-modal');

// Show enlarged chart
function showEnlargedChart(cafeValues, educationValues) {
  chartModal.style.display = 'flex';

  const enlargedCtx = document.getElementById('enlarged-chart').getContext('2d');

  if (window.enlargedChart) {
    window.enlargedChart.destroy();
  }

  window.enlargedChart = new Chart(enlargedCtx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: cafeValues.length }, (_, i) => `Shape ${i + 1}`),
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
        legend: {
          display: true,
          position: 'top'
        }
      }
    }
  });
}

// Close modal
closeModal.addEventListener('click', () => {
  chartModal.style.display = 'none';
});

// Helper function for color scale
function getColor(value) {
  return value > 50 ? '#006d2c' :
         value > 16 ? '#31a354' :
         value > 7.1 ? '#74c476' :
         value > 4.3 ? '#bae4b3' :
         value > 2.5 ? '#edf8e9' :
         value > 0   ? '#FED976' : '#FFEDA0';
}

// Initialize legend
createLegend();
