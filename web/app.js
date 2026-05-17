const SUPABASE_URL = "https://ghvzroqgafzwvnoupknc.supabase.co";
const SUPABASE_KEY = "sb_publishable_LSNQ_EqYsZ81ylQZIn-dEw__4mHu0vT";

// Station coordinates for the map
const STATION_COORDS = {
  "CENTAR":     { lat: 41.9981, lng: 21.4254 },
  "KARPOS":     { lat: 42.0041, lng: 21.3891 },
  "LISICE":     { lat: 41.9856, lng: 21.4773 },
  "GAZI BABA":  { lat: 41.9987, lng: 21.4997 },
  "MILADINOVCI":{ lat: 41.9833, lng: 21.5667 },
  "REKTORAT":   { lat: 42.0041, lng: 21.4091 },
  "TETOVO":     { lat: 42.0092, lng: 20.9714 },
};

let map, historyChart;

async function fetchReadings() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/readings?select=*&order=recorded_at.desc&limit=500`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  });
  return await res.json();
}

function getAQI(pollutant, value) {
  const thresholds = {
    "PM10":  { good: 25,  moderate: 50,  bad: 90  },
    "PM2.5": { good: 15,  moderate: 25,  bad: 50  },
    "NO2":   { good: 40,  moderate: 100, bad: 200 },
    "O3":    { good: 60,  moderate: 120, bad: 180 },
    "SO2":   { good: 20,  moderate: 80,  bad: 250 },
  };
  const t = thresholds[pollutant];
  if (!t) return "moderate";
  if (value <= t.good) return "good";
  if (value <= t.moderate) return "moderate";
  if (value <= t.bad) return "bad";
  return "very-bad";
}

function renderCards(readings) {
  const stations = {};
  readings.forEach(r => {
    if (!stations[r.station]) stations[r.station] = [];
    stations[r.station].push(r);
  });

  const grid = document.getElementById("stationCards");
  grid.innerHTML = "";

  const stationSelect = document.getElementById("stationSelect");
  stationSelect.innerHTML = '<option value="">Select a station...</option>';

  Object.entries(stations).forEach(([station, data]) => {
    // Get latest reading per pollutant
    const latest = {};
    data.forEach(r => {
      if (!latest[r.pollutant]) latest[r.pollutant] = r;
    });

    // Determine overall AQI
    let worstAQI = "good";
    const order = ["very-bad", "bad", "moderate", "good"];
    Object.values(latest).forEach(r => {
      const aqi = getAQI(r.pollutant, r.value);
      if (order.indexOf(aqi) < order.indexOf(worstAQI)) worstAQI = aqi;
    });

    const labels = { "good": "Good", "moderate": "Moderate", "bad": "Unhealthy", "very-bad": "Very Unhealthy" };

    const pollutantRows = Object.values(latest).map(r =>
      `<div class="pollutant-row">
        <span class="pollutant-name">${r.pollutant}</span>
        <span class="pollutant-value">${r.value.toFixed(1)} ${r.unit}</span>
      </div>`
    ).join("");

    grid.innerHTML += `
      <div class="station-card ${worstAQI}">
        <div class="station-name">${station}</div>
        ${pollutantRows}
        <span class="aqi-badge badge-${worstAQI}">${labels[worstAQI]}</span>
      </div>`;

    stationSelect.innerHTML += `<option value="${station}">${station}</option>`;
  });
}

function initMap(readings) {
  map = L.map("map").setView([41.9981, 21.4254], 9);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  const stations = {};
  readings.forEach(r => {
    if (!stations[r.station]) stations[r.station] = [];
    stations[r.station].push(r);
  });

  const colors = { "good": "#48bb78", "moderate": "#f6ad55", "bad": "#fc8181", "very-bad": "#9b2c2c" };

  Object.entries(stations).forEach(([station, data]) => {
    const coords = STATION_COORDS[station.toUpperCase()];
    if (!coords) return;

    const latest = {};
    data.forEach(r => { if (!latest[r.pollutant]) latest[r.pollutant] = r; });

    let worstAQI = "good";
    const order = ["very-bad", "bad", "moderate", "good"];
    Object.values(latest).forEach(r => {
      const aqi = getAQI(r.pollutant, r.value);
      if (order.indexOf(aqi) < order.indexOf(worstAQI)) worstAQI = aqi;
    });

    const marker = L.circleMarker([coords.lat, coords.lng], {
      radius: 12,
      fillColor: colors[worstAQI],
      color: "white",
      weight: 2,
      fillOpacity: 0.9
    }).addTo(map);

    const popup = Object.values(latest).map(r =>
      `<b>${r.pollutant}:</b> ${r.value.toFixed(1)} ${r.unit}`
    ).join("<br>");

    marker.bindPopup(`<b>${station}</b><br>${popup}`);
  });
}

function renderChart(readings, station, pollutant) {
  const filtered = readings
    .filter(r => r.station === station && r.pollutant === pollutant)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

  const labels = filtered.map(r => r.recorded_at.split("T")[0]);
  const values = filtered.map(r => r.value);

  if (historyChart) historyChart.destroy();

  const ctx = document.getElementById("historyChart").getContext("2d");
  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${pollutant} (µg/m³)`,
        data: values,
        borderColor: "#2b6cb0",
        backgroundColor: "rgba(43,108,176,0.1)",
        tension: 0.3,
        fill: true,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function subscribeNotifications() {
  if ("Notification" in window) {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        document.getElementById("notifyBtn").textContent = "✅ Notifications Enabled!";
        document.getElementById("notifyBtn").disabled = true;
      }
    });
  } else {
    alert("Your browser doesn't support notifications.");
  }
}

// Event listeners for chart
document.getElementById("stationSelect").addEventListener("change", async () => {
  const station = document.getElementById("stationSelect").value;
  const pollutant = document.getElementById("pollutantSelect").value;
  if (station) {
    const readings = await fetchReadings();
    renderChart(readings, station, pollutant);
  }
});

document.getElementById("pollutantSelect").addEventListener("change", async () => {
  const station = document.getElementById("stationSelect").value;
  const pollutant = document.getElementById("pollutantSelect").value;
  if (station) {
    const readings = await fetchReadings();
    renderChart(readings, station, pollutant);
  }
});

// Init
async function init() {
  const readings = await fetchReadings();
  if (readings && readings.length > 0) {
    renderCards(readings);
    initMap(readings);
    document.getElementById("lastUpdated").textContent =
      `Last updated: ${new Date(readings[0].recorded_at).toLocaleString()}`;
  }
}

init();