/* ═══════════════════════════════════════════════════════
   PROJECT D.R.O.P. — app.js
   All logic: Firebase, TTD engine, charts, UI updates
   ═══════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────
// PLANT PRESETS
// Each plant has: a display name, a critical soil moisture threshold,
// and a short tip for the farmer.
// ─────────────────────────────────────────────
const PLANTS = {
  maize:   { name: 'Maize / Corn',  criticalMoisture: 30, tip: '🌽 Maize needs watering when soil drops below 30%.' },
  wheat:   { name: 'Wheat',         criticalMoisture: 25, tip: '🌾 Wheat is drought-tolerant — can wait until soil drops to 25%.' },
  tomato:  { name: 'Tomato',        criticalMoisture: 35, tip: '🍅 Tomatoes are sensitive — water before soil drops below 35%.' },
  beans:   { name: 'Beans',         criticalMoisture: 30, tip: '🫘 Beans need consistent moisture — water when soil hits 30%.' },
  cassava: { name: 'Cassava',       criticalMoisture: 20, tip: '🍠 Cassava is very tough — can survive until soil drops to 20%.' },
  rice:    { name: 'Rice',          criticalMoisture: 55, tip: '🌾 Rice needs lots of water — never let soil drop below 55%.' },
  custom:  { name: 'Custom',        criticalMoisture: 25, tip: '⚙️ Set your own critical soil moisture level below.' },
};

// ─────────────────────────────────────────────
// MATH ENGINE
// ─────────────────────────────────────────────

/**
 * Predict Time-to-Drought (hours) — exact port of Python formula.
 * @param {number} temperature  °C (15–45)
 * @param {number} moisture     % (0–100)
 * @returns {number} TTD in hours (clamped 0.1–72, rounded to 2dp)
 */
function predictTTD(temperature, moisture) {
  const tempNorm     = (temperature - 15) / (45 - 15);   // 0=cool, 1=hot
  const moistureNorm = moisture / 100;                    // 0=dry, 1=saturated

  // Regression-style formula: TTD rises with moisture, falls with temperature
  const baseTTD = 72 * Math.pow(moistureNorm, 1.4) * Math.exp(-2.2 * tempNorm);

  // Penalty: very hot + very dry = rapid drought
  const penalty = 8 * tempNorm * Math.pow(1 - moistureNorm, 2);

  const raw = baseTTD - penalty;
  return Math.round(Math.max(0.1, Math.min(72.0, raw)) * 100) / 100;
}

/**
 * Build 24-hour moisture decay curve, modified by humidity.
 * High humidity slows drying; low humidity speeds it up.
 * @param {number} moisture   current soil moisture %
 * @param {number} temperature °C
 * @param {number} humidity    air humidity % (0–100)
 * @returns {number[]} 25-point array (hour 0 → 24)
 */
function buildDecayCurve(moisture, temperature, humidity = 60) {
  // Humidity modifier: dry air (low humidity) accelerates soil drying
  const humFactor  = 1 - 0.3 * ((humidity - 50) / 50);
  const lambda     = (0.015 + 0.0045 * (temperature - 15)) * humFactor;

  return Array.from({ length: 25 }, (_, h) =>
    Math.max(5.0, moisture * Math.exp(-lambda * h))
  );
}

/**
 * Find how many hours until soil drops to plant's critical threshold.
 * Uses the decay curve for accuracy. Returns up to 72h.
 * @param {number} moisture   current soil moisture %
 * @param {number} temperature °C
 * @param {number} humidity    air humidity %
 * @param {number} threshold  plant critical moisture %
 * @returns {number} hours until critical (rounded to 1dp)
 */
function ttdForPlant(moisture, temperature, humidity, threshold) {
  if (moisture <= threshold) return 0; // already critical

  const curve = buildDecayCurve(moisture, temperature, humidity);

  for (let i = 1; i < curve.length; i++) {
    if (curve[i] <= threshold) {
      // Interpolate for fractional hour precision
      const frac = (curve[i - 1] - threshold) / (curve[i - 1] - curve[i]);
      return Math.round((i - 1 + frac) * 10) / 10;
    }
  }

  // Moisture stays above threshold for 24h — use original formula
  return Math.min(72, predictTTD(temperature, moisture));
}

/**
 * Compute derived KPIs from raw sensor values + TTD.
 */
function computeKPIs(temperature, moisture, ttd) {
  const evapRate  = Math.round((0.08 + 0.005 * (temperature - 15)) * 1000) / 1000;
  const riskScore = Math.round(Math.max(0, Math.min(100, 100 - (ttd / 72) * 100)) * 10) / 10;
  const waterSaved = Math.round(Math.max(0, (moisture / 100) * 3.5) * 100) / 100;
  return { evapRate, riskScore, waterSaved };
}

/**
 * Return status info based on TTD value.
 */
function getStatus(ttd) {
  if (ttd < 2)  return { label: 'CRITICAL', emoji: '🚨', cls: 'status-critical', color: '#ff1744' };
  if (ttd < 12) return { label: 'CAUTION',  emoji: '⚠️', cls: 'status-caution',  color: '#ff9800' };
  return               { label: 'STABLE',   emoji: '✅', cls: 'status-stable',   color: '#00e676' };
}

// ─────────────────────────────────────────────
// CHART MANAGEMENT
// ─────────────────────────────────────────────
let dashChart = null;
let calcChart = null;

function renderChart(canvasId, decayCurve, criticalMoisture, existingChart) {
  const hours = Array.from({ length: 25 }, (_, i) => `${i}h`);

  const config = {
    type: 'line',
    data: {
      labels: hours,
      datasets: [{
        label: 'Soil Moisture',
        data: decayCurve,
        borderColor: '#00b4d8',
        borderWidth: 3,
        backgroundColor: 'rgba(0, 180, 216, 0.10)',
        fill: true,
        pointBackgroundColor: '#00e5ff',
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(7, 14, 26, 0.9)',
          titleColor: '#90caf9',
          bodyColor: '#cde9f9',
          borderColor: 'rgba(0,180,216,0.3)',
          borderWidth: 1,
          callbacks: {
            label: ctx => `Moisture: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
        annotation: {
          annotations: {
            thresholdLine: {
              type: 'line',
              yMin: criticalMoisture,
              yMax: criticalMoisture,
              borderColor: '#ff1744',
              borderWidth: 2,
              borderDash: [6, 4],
              label: {
                display: true,
                content: `⚠ Danger Level (${criticalMoisture}%)`,
                color: '#ff6d6d',
                backgroundColor: 'rgba(61,0,0,0.6)',
                borderRadius: 6,
                padding: { x: 8, y: 4 },
                position: 'start',
                font: { size: 11 },
              },
            },
            dangerZone: {
              type: 'box',
              yMin: 0,
              yMax: criticalMoisture,
              backgroundColor: 'rgba(255, 23, 68, 0.06)',
              borderWidth: 0,
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Hours from now', color: '#90caf9', font: { size: 11 } },
          grid: { color: 'rgba(30, 58, 95, 0.6)' },
          ticks: { color: '#90caf9', font: { size: 10 }, maxTicksLimit: 13 },
        },
        y: {
          min: 0, max: 105,
          title: { display: true, text: 'Soil Moisture (%)', color: '#90caf9', font: { size: 11 } },
          grid: { color: 'rgba(30, 58, 95, 0.6)' },
          ticks: { color: '#90caf9', font: { size: 10 } },
        },
      },
    },
  };

  if (existingChart) {
    existingChart.data.datasets[0].data = decayCurve;
    existingChart.options.plugins.annotation.annotations.thresholdLine.yMin = criticalMoisture;
    existingChart.options.plugins.annotation.annotations.thresholdLine.yMax = criticalMoisture;
    existingChart.options.plugins.annotation.annotations.thresholdLine.label.content = `⚠ Danger Level (${criticalMoisture}%)`;
    existingChart.options.plugins.annotation.annotations.dangerZone.yMax = criticalMoisture;
    existingChart.update('active');
    return existingChart;
  }

  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, config);
}

// ─────────────────────────────────────────────
// UI UPDATERS — Dashboard
// ─────────────────────────────────────────────
let lastUpdatedTime = null;
let lastUpdatedInterval = null;

function flashCard(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('updated');
  void el.offsetWidth; // reflow
  el.classList.add('updated');
  setTimeout(() => el.classList.remove('updated'), 800);
}

function updateSensorCards(temp, humidity, moisture) {
  const setVal = (id, val, unit) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = val !== null ? val : '--'; el.classList.remove('loading'); }
  };
  setVal('temp-value',     temp     !== null ? temp.toFixed(1)     : '--');
  setVal('humidity-value', humidity !== null ? humidity.toFixed(0) : '--');
  setVal('moisture-value', moisture !== null ? moisture.toFixed(0) : '--');
  ['card-temp', 'card-humidity', 'card-moisture'].forEach(flashCard);
}

function updateTTDCard(ttd) {
  const s = getStatus(ttd);
  const ttdEl     = document.getElementById('ttd-value');
  const emojiEl   = document.getElementById('ttd-emoji');
  const statusEl  = document.getElementById('ttd-status-text');
  const statusBox = document.getElementById('ttd-status');
  const etaEl     = document.getElementById('ttd-eta');

  if (ttdEl)    { ttdEl.textContent = ttd; ttdEl.style.color = s.color; }
  if (emojiEl)  emojiEl.textContent  = s.emoji;
  if (statusEl) statusEl.textContent = s.label;
  if (statusBox) {
    statusBox.className = `ttd-status ${s.cls}`;
  }

  // ETA — when does the farmer need to water?
  if (etaEl && ttd < 72) {
    const waterAt = new Date(Date.now() + ttd * 3600000);
    const timeStr = waterAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dayStr  = isToday(waterAt) ? 'today' : 'tomorrow';
    etaEl.textContent = `Water by ${timeStr} ${dayStr}`;
  } else if (etaEl) {
    etaEl.textContent = 'No watering needed for 3+ days';
  }
}

function isToday(date) {
  const now = new Date();
  return date.getDate() === now.getDate() &&
         date.getMonth() === now.getMonth() &&
         date.getFullYear() === now.getFullYear();
}

function updateKPIs(temp, moisture, ttd, pumpOn = false, waterPct = 0) {
  const { evapRate, riskScore, waterSaved } = computeKPIs(temp, moisture, ttd);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('kpi-evap',  `${evapRate} %/hr`);
  set('kpi-risk',  `${riskScore} / 100`);
  set('kpi-risk-label', riskScore > 70 ? 'HIGH ⬆' : riskScore > 40 ? 'MODERATE' : 'LOW ✓');
  const pumpActive = pumpOn || ttd < 2;
  set('kpi-pump',  pumpActive ? 'ACTIVE 🔴' : 'STANDBY 🟢');
  set('kpi-water', `${waterPct}%`);
}

function updateAlert(ttd) {
  const banner = document.getElementById('alert-banner');
  const icon   = document.getElementById('alert-icon');
  const text   = document.getElementById('alert-text');
  if (!banner) return;

  if (ttd < 2) {
    banner.className = 'alert-critical';
    icon.textContent = '🚨';
    text.textContent = `WATER NOW! Your crops are in danger — only ${ttd} hours left before serious stress. Start your pump immediately!`;
  } else if (ttd < 12) {
    banner.className = 'alert-caution';
    icon.textContent = '⚠️';
    text.textContent = `Plan to water soon — you have about ${ttd} hours before your crops start to suffer.`;
  } else {
    banner.className = 'alert-stable';
    icon.textContent = '✅';
    text.textContent = `All good! Your soil has enough moisture for at least ${ttd} hours. No action needed right now.`;
  }
}

function startLastUpdatedTimer() {
  lastUpdatedTime = Date.now();
  const el = document.getElementById('last-updated');
  if (el) el.style.display = 'block';
  if (lastUpdatedInterval) clearInterval(lastUpdatedInterval);
  lastUpdatedInterval = setInterval(() => {
    const secs = Math.round((Date.now() - lastUpdatedTime) / 1000);
    const el   = document.getElementById('last-updated');
    if (!el) return;
    if (secs < 10)  el.textContent = 'Updated just now';
    else if (secs < 60) el.textContent = `Updated ${secs}s ago`;
    else el.textContent = `Updated ${Math.round(secs / 60)}m ago`;
  }, 5000);
}

// ─────────────────────────────────────────────
// MAIN DATA HANDLER — called whenever Firebase sends new data
// ─────────────────────────────────────────────
function onSensorData(temp, humidity, moisture, pumpOn = false, waterPct = 0) {
  temp     = Math.max(15, Math.min(45, temp));
  moisture = Math.max(0,  Math.min(100, moisture));
  humidity = Math.max(10, Math.min(100, humidity));

  const ttd   = predictTTD(temp, moisture);
  const curve = buildDecayCurve(moisture, temp, humidity);

  updateSensorCards(temp, humidity, moisture);
  updateTTDCard(ttd);
  updateKPIs(temp, moisture, ttd, pumpOn, waterPct);
  updateAlert(ttd);
  dashChart = renderChart('dashboard-chart', curve, 20, dashChart);
  startLastUpdatedTimer();
}

// ─────────────────────────────────────────────
// FIREBASE INTEGRATION
// ─────────────────────────────────────────────
function initFirebase() {
  // If config is still placeholder, switch to demo mode
  if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
    console.warn('D.R.O.P.: Firebase not configured. Starting demo mode.');
    startDemoMode();
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    const db       = firebase.database();
    const sensorRef = db.ref(DB_PATH);

    // Watch connection status
    db.ref('.info/connected').on('value', snap => {
      setConnectionBadge(snap.val() ? 'online' : 'offline');
    });

    // Listen for real-time sensor updates
    sensorRef.on('value', snapshot => {
      const data = snapshot.val();
      if (!data) {
        console.warn('D.R.O.P.: No data at', DB_PATH);
        return;
      }
      const temp      = Number(data[FIELD_NAMES.temperature])  || 28;
      const humidity  = Number(data[FIELD_NAMES.humidity])     || 60;
      const moisture  = Number(data[FIELD_NAMES.soilMoisture]) || 0;  // already 0-100%
      const pumpOn    = data[FIELD_NAMES.pumpOn] === true;
      const waterPct  = Number(data[FIELD_NAMES.waterLevelPct]) || 0;
      onSensorData(temp, humidity, moisture, pumpOn, waterPct);
    }, error => {
      console.error('D.R.O.P. Firebase error:', error);
      setConnectionBadge('offline');
    });

  } catch (err) {
    console.error('D.R.O.P. Firebase init error:', err);
    startDemoMode();
  }
}

function setConnectionBadge(state) {
  const badge = document.getElementById('connection-badge');
  const text  = document.getElementById('connection-text');
  if (!badge || !text) return;
  badge.className = `badge badge-${state}`;
  text.textContent = state === 'online' ? 'LIVE' : state === 'demo' ? 'DEMO MODE' : 'OFFLINE';
}

// ─────────────────────────────────────────────
// DEMO MODE — simulates live sensor data
// ─────────────────────────────────────────────
let demoTemp     = 28;
let demoHumidity = 62;
let demMoisture  = 45;

function startDemoMode() {
  const banner = document.getElementById('demo-banner');
  if (banner) banner.style.display = 'block';
  setConnectionBadge('demo');

  // Initial reading
  onSensorData(demoTemp, demoHumidity, demMoisture);

  // Simulate gradual changes every 5 seconds
  setInterval(() => {
    demoTemp     = clampDemo(demoTemp     + (Math.random() - 0.45) * 1.5, 18, 42);
    demoHumidity = clampDemo(demoHumidity + (Math.random() - 0.5)  * 3,   20, 95);
    demMoisture  = clampDemo(demMoisture  - (Math.random() * 1.2),         5, 90);
    onSensorData(
      Math.round(demoTemp * 10) / 10,
      Math.round(demoHumidity),
      Math.round(demMoisture)
    );
  }, 5000);
}

function clampDemo(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });
}

// ─────────────────────────────────────────────
// MANUAL CALCULATOR
// ─────────────────────────────────────────────
function initCalculator() {
  // Slider live-value display
  const sliders = [
    { slider: 'calc-temp',          display: 'calc-temp-val',          format: v => `${v}°C`  },
    { slider: 'calc-humidity',      display: 'calc-humidity-val',      format: v => `${v}%`   },
    { slider: 'calc-moisture',      display: 'calc-moisture-val',      format: v => `${v}%`   },
    { slider: 'custom-threshold',   display: 'custom-threshold-val',   format: v => `${v}%`   },
  ];

  sliders.forEach(({ slider, display, format }) => {
    const sliderEl  = document.getElementById(slider);
    const displayEl = document.getElementById(display);
    if (!sliderEl || !displayEl) return;
    sliderEl.addEventListener('input', () => {
      displayEl.textContent = format(sliderEl.value);
    });
  });

  // Plant selector — update tip + show/hide custom threshold
  const plantSelect = document.getElementById('plant-select');
  const plantTip    = document.getElementById('plant-tip');
  const customGroup = document.getElementById('custom-threshold-group');

  plantSelect.addEventListener('change', () => {
    const plant = PLANTS[plantSelect.value];
    if (plantTip) plantTip.textContent = plant.tip;
    if (customGroup) customGroup.style.display = plantSelect.value === 'custom' ? 'block' : 'none';
  });

  // Calculate button
  document.getElementById('calc-btn').addEventListener('click', runCalculation);
}

function runCalculation() {
  const plantKey    = document.getElementById('plant-select').value;
  const plant       = PLANTS[plantKey];
  const temp        = Number(document.getElementById('calc-temp').value);
  const humidity    = Number(document.getElementById('calc-humidity').value);
  const moisture    = Number(document.getElementById('calc-moisture').value);

  // Threshold: use plant preset or custom slider
  const threshold = plantKey === 'custom'
    ? Number(document.getElementById('custom-threshold').value)
    : plant.criticalMoisture;

  const ttd   = ttdForPlant(moisture, temp, humidity, threshold);
  const curve = buildDecayCurve(moisture, temp, humidity);
  const s     = getStatus(ttd);

  // Show results panel
  const results = document.getElementById('calc-results');
  if (results) results.style.display = 'block';
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // TTD value
  const ttdEl = document.getElementById('calc-ttd-value');
  if (ttdEl) { ttdEl.textContent = ttd; ttdEl.style.color = s.color; }

  const statusEl = document.getElementById('calc-ttd-status');
  if (statusEl) {
    statusEl.textContent = `${s.emoji} ${s.label}`;
    statusEl.className = `result-status ${s.cls}`;
  }

  // Advice text — plain English for farmers
  const adviceEl = document.getElementById('calc-advice');
  if (adviceEl) adviceEl.innerHTML = buildAdviceText(plant, plantKey, ttd, threshold, s);

  // ETA
  const etaEl = document.getElementById('calc-eta');
  if (etaEl) {
    if (ttd === 0) {
      etaEl.textContent = '⚠️ Your soil is already below the danger level. Water immediately!';
    } else if (ttd < 72) {
      const waterAt = new Date(Date.now() + ttd * 3600000);
      const timeStr = waterAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dayStr  = isToday(waterAt) ? 'today' : 'tomorrow';
      etaEl.innerHTML = `⏰ <strong>Water by ${timeStr} ${dayStr}</strong> to keep your ${plant.name} healthy.`;
    } else {
      etaEl.textContent = `✅ No watering needed for the next 3 days based on current conditions.`;
    }
  }

  // Render calculator chart
  calcChart = renderChart('calculator-chart', curve, threshold, calcChart);
}

function buildAdviceText(plant, plantKey, ttd, threshold, s) {
  const name = plant.name;
  if (ttd === 0) {
    return `🚨 <strong>WATER IMMEDIATELY!</strong> Your ${name} soil is already at or below the danger level (${threshold}%). Prolonged stress will damage your crop.`;
  }
  if (s.label === 'CRITICAL') {
    return `🚨 <strong>Water right now!</strong> Your ${name} has less than ${ttd} hours before the soil becomes dangerously dry. Don't wait!`;
  }
  if (s.label === 'CAUTION') {
    return `⚠️ <strong>Plan to water within ${ttd} hours.</strong> Your ${name} is not in immediate danger, but the soil is drying out. Water before the soil drops below ${threshold}%.`;
  }
  return `✅ <strong>Your ${name} is doing well!</strong> The soil has enough moisture for the next ${ttd} hours. You can relax for now, but check again later.`;
}

// ─────────────────────────────────────────────
// STARTUP
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCalculator();
  initFirebase();
});
