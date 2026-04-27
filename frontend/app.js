const EARTH_RADIUS_KM = 6371;

const debrisCatalog = [
  {
    id: "NORAD-25544",
    name: "ISS Fragment Cluster A",
    tle: [
      "1 25544U 98067A   26096.51234567  .00007852  00000-0  14421-3 0  9997",
      "2 25544  51.6438 250.1219 0005380  67.2032  22.4421 15.49812376490122"
    ],
    elements: {
      inclinationDeg: 51.64,
      eccentricity: 0.000538,
      meanMotion: 15.49,
      argPerigee: 67.2,
      raan: 250.1
    },
    seed: 1.2
  },
  {
    id: "NORAD-33591",
    name: "Cosmos Debris C",
    tle: [
      "1 33591U 09005A   26096.23985186  .00000247  00000-0  12673-3 0  9993",
      "2 33591  98.7742 122.9940 0020731 256.3296 103.5564 14.24024577894356"
    ],
    elements: {
      inclinationDeg: 98.77,
      eccentricity: 0.002073,
      meanMotion: 14.24,
      argPerigee: 256.3,
      raan: 122.9
    },
    seed: 2.6
  },
  {
    id: "NORAD-43013",
    name: "Fengyun Fragment K",
    tle: [
      "1 43013U 17073AF  26095.90223152  .00001132  00000-0  78544-4 0  9992",
      "2 43013  97.3495  51.1238 0013017 221.6071 138.3782 15.22461925398195"
    ],
    elements: {
      inclinationDeg: 97.34,
      eccentricity: 0.001302,
      meanMotion: 15.22,
      argPerigee: 221.6,
      raan: 51.1
    },
    seed: 4.1
  }
];

const state = {
  selectedId: debrisCatalog[0].id,
  horizonMins: 180,
  showRaw: true,
  showCorrected: true
};

const rawColor = "#e76f51";
const correctedColor = "#2a9d8f";
const truthColor = "#f4a261";

const elements = {
  select: document.getElementById("debris-select"),
  horizonSlider: document.getElementById("horizon-slider"),
  horizonOutput: document.getElementById("horizon-output"),
  rawToggle: document.getElementById("show-uncorrected"),
  correctedToggle: document.getElementById("show-corrected"),
  tleText: document.getElementById("tle-text"),
  rmseRaw: document.getElementById("rmse-raw"),
  rmseCorrected: document.getElementById("rmse-corrected"),
  maeRaw: document.getElementById("mae-raw"),
  maeCorrected: document.getElementById("mae-corrected")
};

const globeContainer = document.getElementById("globe");

const globe = Globe()(globeContainer)
  .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
  .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
  .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
  .showAtmosphere(true)
  .atmosphereColor("#9ad1ff")
  .atmosphereAltitude(0.14)
  .lineHoverPrecision(0)
  .pointAltitude("alt")
  .pointRadius("size")
  .pointColor("color")
  .pointLabel((d) => d.label)
  .pathPointLat("lat")
  .pathPointLng("lng")
  .pathPointAlt("alt")
  .pathTransitionDuration(0)
  .pathStroke(0.85)
  .pathColor((d) => d.color)
  .pathDashLength((d) => d.dashLength)
  .pathDashGap((d) => d.dashGap)
  .pathDashAnimateTime((d) => d.dashAnimateMs);

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.55;
globe.controls().minDistance = 180;
globe.controls().maxDistance = 450;
globe.pointOfView({ lat: 18, lng: 15, altitude: 2.3 }, 1000);

function syncGlobeSize() {
  globe.width(globeContainer.clientWidth);
  globe.height(globeContainer.clientHeight);
}

syncGlobeSize();

function seededNoise(seed, t, scale = 1) {
  return (
    Math.sin(t * 0.017 + seed * 1.13) * 0.58 +
    Math.cos(t * 0.013 + seed * 0.73) * 0.42
  ) * scale;
}

function generateTrajectory(debris, horizonMins) {
  const stepMins = 3;
  const points = [];

  const baseAlt = 380 + (debris.elements.meanMotion - 14) * 25;
  const periodFactor = 180 / debris.elements.meanMotion;

  for (let t = 0; t <= horizonMins; t += stepMins) {
    const phase = (t / periodFactor) * (Math.PI / 180) * 120;
    const inc = (debris.elements.inclinationDeg * Math.PI) / 180;

    const rawLat = Math.sin(phase + debris.seed) * (inc * 57.2) * 0.98;
    const rawLng = ((((phase * 75 + debris.elements.raan + debris.seed * 60) % 360) + 540) % 360) - 180;
    const rawAlt = baseAlt + seededNoise(debris.seed, t, 14);

    const driftLat = seededNoise(debris.seed + 1.5, t, 1.6) * Math.min(1.7, t / 140);
    const driftLng = seededNoise(debris.seed + 0.8, t, 2.2) * Math.min(1.7, t / 120);
    const driftAlt = seededNoise(debris.seed + 2.7, t, 8) * Math.min(1.9, t / 110);

    const observedLat = rawLat - driftLat;
    const observedLng = rawLng - driftLng;
    const observedAlt = rawAlt - driftAlt;

    const correctionStrength = 0.76;
    const correctedLat = rawLat - driftLat * correctionStrength;
    const correctedLng = rawLng - driftLng * correctionStrength;
    const correctedAlt = rawAlt - driftAlt * correctionStrength;

    points.push({
      minute: t,
      raw: { lat: rawLat, lng: rawLng, altKm: rawAlt },
      corrected: { lat: correctedLat, lng: correctedLng, altKm: correctedAlt },
      observed: { lat: observedLat, lng: observedLng, altKm: observedAlt }
    });
  }

  return points;
}

function toGlobeAlt(altKm) {
  return altKm / EARTH_RADIUS_KM;
}

function approxKmError(a, b) {
  const latKm = (a.lat - b.lat) * 111;
  const lngKm = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  const altKm = a.altKm - b.altKm;
  return Math.sqrt(latKm ** 2 + lngKm ** 2 + altKm ** 2);
}

function evaluateTrajectory(rows) {
  const rawErrors = [];
  const correctedErrors = [];

  for (const row of rows) {
    rawErrors.push(approxKmError(row.raw, row.observed));
    correctedErrors.push(approxKmError(row.corrected, row.observed));
  }

  return {
    rawErrors,
    correctedErrors,
    rmseRaw: Math.sqrt(rawErrors.reduce((s, v) => s + v ** 2, 0) / rawErrors.length),
    rmseCorrected: Math.sqrt(correctedErrors.reduce((s, v) => s + v ** 2, 0) / correctedErrors.length),
    maeRaw: rawErrors.reduce((s, v) => s + Math.abs(v), 0) / rawErrors.length,
    maeCorrected: correctedErrors.reduce((s, v) => s + Math.abs(v), 0) / correctedErrors.length
  };
}

function formatKm(value) {
  return `${value.toFixed(2)} km`;
}

function buildGlobeData(rows) {
  const paths = [];
  const points = [];

  if (state.showRaw) {
    paths.push({
      id: "path-raw",
      points: rows.map((r) => ({ lat: r.raw.lat, lng: r.raw.lng, alt: toGlobeAlt(r.raw.altKm) })),
      color: rawColor,
      dashLength: 0.58,
      dashGap: 0.22,
      dashAnimateMs: 1700
    });
  }

  if (state.showCorrected) {
    paths.push({
      id: "path-corrected",
      points: rows.map((r) => ({ lat: r.corrected.lat, lng: r.corrected.lng, alt: toGlobeAlt(r.corrected.altKm) })),
      color: correctedColor,
      dashLength: 0.72,
      dashGap: 0.16,
      dashAnimateMs: 1250
    });
  }

  paths.push({
    id: "path-truth",
    points: rows.map((r) => ({ lat: r.observed.lat, lng: r.observed.lng, alt: toGlobeAlt(r.observed.altKm) })),
    color: truthColor,
    dashLength: 0.92,
    dashGap: 0.09,
    dashAnimateMs: 0
  });

  const latest = rows[rows.length - 1];

  if (state.showRaw) {
    points.push({
      lat: latest.raw.lat,
      lng: latest.raw.lng,
      alt: toGlobeAlt(latest.raw.altKm),
      size: 0.18,
      color: rawColor,
      label: "Raw SGP4"
    });
  }

  if (state.showCorrected) {
    points.push({
      lat: latest.corrected.lat,
      lng: latest.corrected.lng,
      alt: toGlobeAlt(latest.corrected.altKm),
      size: 0.18,
      color: correctedColor,
      label: "Corrected"
    });
  }

  points.push({
    lat: latest.observed.lat,
    lng: latest.observed.lng,
    alt: toGlobeAlt(latest.observed.altKm),
    size: 0.18,
    color: truthColor,
    label: "Observed truth"
  });

  return { paths, points };
}

function renderChart(rows, metrics) {
  const minutes = rows.map((r) => r.minute);

  Plotly.newPlot(
    "error-chart",
    [
      {
        x: minutes,
        y: metrics.rawErrors,
        type: "scatter",
        mode: "lines",
        name: "Raw SGP4 Error",
        line: { color: rawColor, width: 2.2 }
      },
      {
        x: minutes,
        y: metrics.correctedErrors,
        type: "scatter",
        mode: "lines",
        name: "Corrected Error",
        line: { color: correctedColor, width: 2.4 }
      }
    ],
    {
      margin: { t: 12, r: 20, b: 44, l: 52 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(4, 14, 25, 0.38)",
      xaxis: {
        title: "Time Since Epoch (min)",
        gridcolor: "rgba(255,255,255,0.08)",
        color: "#ccdae9"
      },
      yaxis: {
        title: "Position Error (km)",
        gridcolor: "rgba(255,255,255,0.08)",
        color: "#ccdae9"
      },
      legend: {
        orientation: "h",
        x: 0,
        y: 1.13,
        font: { color: "#dce7f2", size: 11 }
      }
    },
    { responsive: true, displayModeBar: false }
  );
}

function updateMetrics(metrics) {
  elements.rmseRaw.textContent = formatKm(metrics.rmseRaw);
  elements.rmseCorrected.textContent = formatKm(metrics.rmseCorrected);
  elements.maeRaw.textContent = formatKm(metrics.maeRaw);
  elements.maeCorrected.textContent = formatKm(metrics.maeCorrected);
}

function updateView() {
  const debris = debrisCatalog.find((d) => d.id === state.selectedId);
  const rows = generateTrajectory(debris, state.horizonMins);
  const metrics = evaluateTrajectory(rows);

  const globeData = buildGlobeData(rows);
  globe.pathsData(globeData.paths).pointsData(globeData.points);

  updateMetrics(metrics);
  renderChart(rows, metrics);

  elements.tleText.textContent = `${debris.tle[0]}\n${debris.tle[1]}`;
}

function initializeControls() {
  for (const debris of debrisCatalog) {
    const option = document.createElement("option");
    option.value = debris.id;
    option.textContent = `${debris.name} (${debris.id})`;
    elements.select.appendChild(option);
  }

  elements.select.value = state.selectedId;

  elements.select.addEventListener("change", (event) => {
    state.selectedId = event.target.value;
    updateView();
  });

  elements.horizonSlider.addEventListener("input", (event) => {
    state.horizonMins = Number(event.target.value);
    elements.horizonOutput.textContent = String(state.horizonMins);
    updateView();
  });

  elements.rawToggle.addEventListener("change", (event) => {
    state.showRaw = event.target.checked;
    updateView();
  });

  elements.correctedToggle.addEventListener("change", (event) => {
    state.showCorrected = event.target.checked;
    updateView();
  });
}

initializeControls();
updateView();

window.addEventListener("resize", syncGlobeSize);

if (typeof ResizeObserver !== "undefined") {
  const resizeObserver = new ResizeObserver(syncGlobeSize);
  resizeObserver.observe(globeContainer);
}
