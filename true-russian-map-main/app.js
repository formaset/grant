const metricSelect = document.getElementById("metric-select");
const metricDescription = document.getElementById("metric-description");
const legendMin = document.getElementById("legend-min");
const legendMax = document.getElementById("legend-max");
const legendColor = document.querySelector(".legend__color");
const insights = document.getElementById("metric-insights");
const regionNameEl = document.getElementById("region-name");
const regionMetricValueEl = document.getElementById("region-metric-value");
const regionMetaEl = document.getElementById("region-meta");

const formatter = new Intl.NumberFormat("ru-RU");

const palette = [
  "#f1f5ff",
  "#d6e4ff",
  "#adc8ff",
  "#84a9ff",
  "#6690ff",
  "#5c78ff",
  "#4f60ff",
  "#3d4ad4",
  "#2d36aa",
];

const metrics = [
  {
    id: "vacancies",
    name: "Количество вакансий по видам экономической деятельности",
    unit: "вакансий",
    description:
      "Показывает распределение открытых вакансий и помогает оценить востребованность кадров в разных субъектах.",
    base: 2500,
    spread: 7000,
  },
  {
    id: "employment",
    name: "Количество занятых по видам экономической деятельности",
    unit: "человек",
    description:
      "Отражает численность работников и структуру занятости, позволяя выделить наиболее развитые отрасли регионов.",
    base: 58000,
    spread: 240000,
  },
  {
    id: "population",
    name: "Численность населения",
    unit: "человек",
    description:
      "Уточняет общий масштаб регионов и служит базой для сравнительного анализа других социально-экономических показателей.",
    base: 450000,
    spread: 3500000,
  },
  {
    id: "ict",
    name:
      "Использование информационных и коммуникационных технологий в организациях",
    unit: "организаций",
    description:
      "Характеризует уровень цифровой зрелости бизнеса и распространение современных технологий управления.",
    base: 1200,
    spread: 3000,
  },
  {
    id: "informal",
    name:
      "Численность занятых в неформальном секторе по видам экономической деятельности",
    unit: "человек",
    description:
      "Помогает оценить долю неформальной занятости и возможные риски для рынка труда в каждом субъекте.",
    base: 12000,
    spread: 80000,
  },
  {
    id: "investments",
    name: "Количество инвестиционных проектов по субъектам",
    unit: "проектов",
    description:
      "Отражает динамику инвестиционной активности и поддержку крупных проектов региональными командами.",
    base: 40,
    spread: 160,
  },
  {
    id: "migrants",
    name:
      "Количество мигрантов-инностранных граждан по целям поездок",
    unit: "человек",
    description:
      "Показывает интенсивность миграционных потоков и востребованность регионов для учебы, работы и бизнеса.",
    base: 1800,
    spread: 15000,
  },
  {
    id: "universities",
    name: "Количество высших образовательных учреждений",
    unit: "учреждений",
    description:
      "Позволяет оценить концентрацию вузов и академический потенциал территорий.",
    base: 6,
    spread: 32,
  },
  {
    id: "colleges",
    name: "Количество средних образовательных учреждений",
    unit: "учреждений",
    description:
      "Характеризует доступность среднего профессионального образования и развитие техникумов и колледжей.",
    base: 35,
    spread: 140,
  },
];

let currentMetric = metrics[0];
let geojsonLayer;
const regionByCode = new Map();
let selectedFeature;

const textDecoder = new TextDecoder("utf-8");

const map = L.map("map", {
  zoomControl: false,
  minZoom: 2,
  maxZoom: 8,
  attributionControl: false,
});

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  maxZoom: 18,
  attribution:
    "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors &copy; <a href='https://carto.com/'>CARTO</a>",
}).addTo(map);

fetch("simple_map.geojson")
  .then((response) => response.json())
  .then((geojson) => {
    const projected = projectToLatLng(geojson);
    prepareMetricValues(projected.features);
    initMetricSelector();
    initMap(projected);
    updateMetricUI(currentMetric);
  })
  .catch((error) => {
    console.error("Не удалось загрузить карту", error);
  });

function projectToLatLng(geojson) {
  regionByCode.clear();

  const transformCoords = (coords) => {
    if (typeof coords[0] === "number") {
      return mercatorToLatLng(coords);
    }
    return coords.map(transformCoords);
  };

  const features = [];

  geojson.features.forEach((feature) => {
    const normalized = normalizeProperties(feature.properties);
    const code = normalized["postal-code"];
    if (!code) {
      return;
    }

    const projectedFeature = {
      type: feature.type,
      properties: normalized,
      geometry: {
        type: feature.geometry.type,
        coordinates: transformCoords(cloneGeometry(feature.geometry.coordinates)),
      },
    };

    regionByCode.set(code, projectedFeature.properties);
    features.push(projectedFeature);
  });

  return { ...geojson, features };
}

function normalizeProperties(properties = {}) {
  const normalized = { ...properties };
  if (typeof normalized.name === "string" && normalized.name) {
    normalized.name = decodeCyrillic(normalized.name);
  }
  if (!normalized.name) {
    normalized.name = "Без названия";
  }
  if (!normalized["postal-code"] && typeof normalized["hc-key"] === "string") {
    normalized["postal-code"] = normalized["hc-key"].slice(-2).toUpperCase();
  }
  return normalized;
}

function decodeCyrillic(value) {
  if (!/[ÐÑ]/.test(value)) {
    return value;
  }

  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }

  try {
    return textDecoder.decode(bytes);
  } catch (error) {
    return value;
  }
}

function cloneGeometry(coordinates) {
  return JSON.parse(JSON.stringify(coordinates ?? []));
}

function mercatorToLatLng([x, y]) {
  const lon = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lat, lon];
}

function prepareMetricValues(features) {
  metrics.forEach((metric, index) => {
    metric.values = new Map();
    features.forEach((feature) => {
      const code = feature.properties["postal-code"];
      const raw = pseudoRandom(code + metric.id, index + 1);
      const value = Math.round(metric.base + raw * metric.spread);
      metric.values.set(code, value);
    });
    const valuesArray = Array.from(metric.values.values());
    metric.min = Math.min(...valuesArray);
    metric.max = Math.max(...valuesArray);
    metric.avg = valuesArray.reduce((acc, value) => acc + value, 0) / valuesArray.length;
  });
}

function initMetricSelector() {
  metrics.forEach((metric) => {
    const option = document.createElement("option");
    option.value = metric.id;
    option.textContent = metric.name;
    metricSelect.appendChild(option);
  });

  metricSelect.value = currentMetric.id;
  metricSelect.addEventListener("change", (event) => {
    const selectedId = event.target.value;
    const metric = metrics.find((item) => item.id === selectedId);
    if (metric) {
      currentMetric = metric;
      updateMetricUI(metric);
      refreshLayerStyles();
      if (selectedFeature) {
        updateRegionCard(selectedFeature.feature.properties["postal-code"]);
      }
    }
  });
}

function initMap(geojson) {
  geojsonLayer = L.geoJSON(geojson, {
    style: featureStyle,
    onEachFeature,
  }).addTo(map);

  map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
}

function featureStyle(feature) {
  const code = feature.properties["postal-code"];
  const value = currentMetric.values.get(code);
  return {
    fillColor: getColorForValue(value, currentMetric),
    weight: 1,
    color: "#ffffff",
    fillOpacity: 0.85,
  };
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: (event) => highlightFeature(event, layer),
    mouseout: resetHighlight,
    click: () => selectFeature(layer),
  });
}

function highlightFeature(event, layer) {
  layer.setStyle({
    weight: 2,
    color: "#111827",
  });
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
}

function resetHighlight(event) {
  const layer = event.target;
  if (selectedFeature !== layer) {
    geojsonLayer.resetStyle(layer);
  }
}

function selectFeature(layer) {
  if (selectedFeature) {
    geojsonLayer.resetStyle(selectedFeature);
  }
  selectedFeature = layer;
  layer.setStyle({
    weight: 2.5,
    color: "#111827",
  });
  updateRegionCard(layer.feature.properties["postal-code"]);
}

function getColorForValue(value, metric) {
  const { min, max } = metric;
  if (max === min) {
    return palette[palette.length - 1];
  }
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const index = Math.min(palette.length - 1, Math.floor(ratio * (palette.length - 1)));
  return palette[index];
}

function refreshLayerStyles() {
  geojsonLayer.eachLayer((layer) => {
    const code = layer.feature.properties["postal-code"];
    const value = currentMetric.values.get(code);
    layer.setStyle({
      fillColor: getColorForValue(value, currentMetric),
      weight: selectedFeature === layer ? 2.5 : 1,
      color: selectedFeature === layer ? "#111827" : "#ffffff",
      fillOpacity: 0.85,
    });
  });
  updateLegend(currentMetric);
  updateInsights(currentMetric);
}

function updateLegend(metric) {
  legendColor.style.background = `linear-gradient(90deg, ${palette.join(", ")})`;
  legendMin.textContent = formatValue(metric, metric.min, false);
  legendMax.textContent = formatValue(metric, metric.max, false);
}

function updateInsights(metric) {
  const avgEl = insights.querySelector('[data-role="avg"]');
  const maxEl = insights.querySelector('[data-role="max"]');
  const minEl = insights.querySelector('[data-role="min"]');
  const leaderEl = insights.querySelector('[data-role="leader"]');

  const values = Array.from(metric.values.entries());
  const maxEntry = values.reduce((best, current) => (current[1] > best[1] ? current : best), values[0]);
  const minEntry = values.reduce((best, current) => (current[1] < best[1] ? current : best), values[0]);

  avgEl.textContent = formatValue(metric, metric.avg, true);
  maxEl.textContent = `${formatValue(metric, maxEntry[1], true)} (${regionByCode.get(maxEntry[0]).name})`;
  minEl.textContent = `${formatValue(metric, minEntry[1], true)} (${regionByCode.get(minEntry[0]).name})`;
  leaderEl.textContent = `${regionByCode.get(maxEntry[0]).name}`;
}

function updateMetricUI(metric) {
  metricDescription.textContent = metric.description;
  updateLegend(metric);
  updateInsights(metric);
}

function updateRegionCard(code) {
  const properties = regionByCode.get(code);
  regionNameEl.textContent = properties?.name ?? "Регион не определен";
  const value = currentMetric.values.get(code);
  if (typeof value === "number" && !Number.isNaN(value)) {
    const numeric = formatValue(currentMetric, value, false);
    regionMetricValueEl.innerHTML = `
      <span class="metric-value__number">${numeric}</span>
      <span class="metric-value__label">${currentMetric.name}</span>
    `;
  } else {
    regionMetricValueEl.textContent = "Данные по выбранному показателю отсутствуют.";
  }

  regionMetaEl.innerHTML = "";
  metrics.forEach((metric) => {
    const dt = document.createElement("dt");
    dt.textContent = metric.name;
    const dd = document.createElement("dd");
    dd.textContent = formatValue(metric, metric.values.get(code), true);
    regionMetaEl.append(dt, dd);
  });
}

function formatValue(metric, value, includeUnit = true) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  const rounded = metric.unit === "учреждений" || metric.unit === "проектов" ? Math.round(value) : Math.round(value);
  return includeUnit ? `${formatter.format(rounded)} ${metric.unit}` : formatter.format(rounded);
}

function pseudoRandom(str, seed) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i) + seed) % 2147483647;
  }
  return (hash % 1000) / 1000;
}
