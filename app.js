import { russiaGeoJSON } from './geo.js';

const state = {
  indicator: null,
  unit: '',
  selectedRegions: new Set(),
  selectedActivities: new Set(),
  yearMin: null,
  yearMax: null,
  indicatorYearMin: null,
  indicatorYearMax: null,
};

const datasets = {
  records: [],
  indicators: [],
  indicatorMeta: new Map(),
  regions: [],
  regionsByCode: new Map(),
  activities: [],
  activityMap: new Map(),
  mapFeaturesByNormalizedName: new Map(),
};

let rangeSliderInstance = null;
let mapChartInstance = null;
let seriesChartInstance = null;

const selectors = {
  indicator: document.querySelector('[data-selector="indicator"]'),
  regions: document.querySelector('[data-selector="regions"]'),
  activities: document.querySelector('[data-selector="activities"]'),
  range: document.querySelector('[data-range]'),
  rangeMinLabel: document.querySelector('[data-role="range-min"]'),
  rangeMaxLabel: document.querySelector('[data-role="range-max"]'),
  mapUnit: document.getElementById('map-unit'),
  mapSubtitle: document.getElementById('map-subtitle'),
  chartSubtitle: document.getElementById('chart-subtitle'),
  legend: document.getElementById('map-legend'),
};

const outsideClickTargets = new Set();

document.addEventListener('click', (event) => {
  outsideClickTargets.forEach((selectorEl) => {
    if (!selectorEl.contains(event.target)) {
      selectorEl.classList.remove('open');
    }
  });
});

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/(^|\s)г\.?\s*/g, ' ')
    .replace(/"/g, '')
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');
}

function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const columns = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      columns.push(current);
      rows.push(columns.slice());
      columns.length = 0;
      current = '';
    } else if (char === ',' && !inQuotes) {
      columns.push(current);
      current = '';
    } else if (char !== '\r') {
      current += char;
    }
  }
  if (current || columns.length) {
    columns.push(current);
    rows.push(columns.slice());
  }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((row) => row.length && row.some((cell) => cell.trim().length)).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header.trim()] = (row[index] ?? '').trim();
    });
    return record;
  });
}

async function loadData() {
  const [indicatorCsv, regionsCsv, activityCsv] = await Promise.all([
    fetch('indicators.csv').then((resp) => resp.text()),
    fetch('regions_reference.csv').then((resp) => resp.text()),
    fetch('activity_reference.csv').then((resp) => resp.text()),
  ]);

  const indicatorRows = parseCSV(indicatorCsv);
  const regionRows = parseCSV(regionsCsv);
  const activityRows = parseCSV(activityCsv);

  const mapFeatures = russiaGeoJSON.features || [];
  mapFeatures.forEach((feature) => {
    const props = feature.properties || {};
    const normalized = normalizeName(props.name || '');
    if (normalized) {
      datasets.mapFeaturesByNormalizedName.set(normalized, props);
    }
  });

  datasets.regions = regionRows.map((row) => {
    const code = Number(row['Код']);
    const name = row['Наименование'];
    const normalized = normalizeName(name);
    const feature = datasets.mapFeaturesByNormalizedName.get(normalized) || null;
    const entry = {
      code,
      name,
      normalized,
      mapKey: feature ? feature['hc-key'] : null,
      postal: feature ? feature['postal-code'] : null,
      featureName: feature ? feature.name : name,
    };
    datasets.regionsByCode.set(code, entry);
    return entry;
  });

  const activityByNormalized = new Map();
  activityRows.forEach((row) => {
    const code = row['Код ОКВЭД'];
    const name = row['Наименование'];
    const normalized = normalizeName(name);
    activityByNormalized.set(normalized, { code, name });
  });

  const indicatorSet = new Map();
  indicatorRows.forEach((row) => {
    const year = Number(row['Год']);
    const regionCode = Number(row['Код региона']);
    const regionName = row['Регион'];
    const activityName = (row['Вид экономической деятельности'] || '').trim() || 'Без указания вида';
    const indicatorName = (row['Показатель'] || '').trim();
    if (!indicatorName) {
      return;
    }
    const rawValue = row['Значение'];
    const unit = (row['Единица измерения'] || '').trim();

    const normalizedRegion = normalizeName(regionName);
    const feature = datasets.mapFeaturesByNormalizedName.get(normalizedRegion) || null;
    const regionMeta = datasets.regionsByCode.get(regionCode);

    if (feature && regionMeta && !regionMeta.mapKey) {
      regionMeta.mapKey = feature['hc-key'];
      regionMeta.postal = feature['postal-code'];
      regionMeta.featureName = feature.name;
    }

    const value = Number(String(rawValue).replace(',', '.'));
    const record = {
      year,
      regionCode,
      regionName,
      activityName,
      indicatorName,
      value: Number.isFinite(value) ? value : null,
      unit,
      mapKey: feature ? feature['hc-key'] : (regionMeta ? regionMeta.mapKey : null),
    };
    datasets.records.push(record);

    if (!indicatorSet.has(indicatorName)) {
      indicatorSet.set(indicatorName, {
        name: indicatorName,
        unit,
        minYear: year,
        maxYear: year,
      });
    } else {
      const meta = indicatorSet.get(indicatorName);
      meta.minYear = Math.min(meta.minYear, year);
      meta.maxYear = Math.max(meta.maxYear, year);
      if (!meta.unit && unit) {
        meta.unit = unit;
      }
    }
  });

  datasets.indicators = Array.from(indicatorSet.values()).sort((a, b) => a.name.localeCompare(b.name));
  datasets.indicators.forEach((meta) => {
    datasets.indicatorMeta.set(meta.name, meta);
  });

  const activitySet = new Map();
  indicatorRows.forEach((row) => {
    const activityName = (row['Вид экономической деятельности'] || '').trim() || 'Без указания вида';
    const normalized = normalizeName(activityName);
    if (!activitySet.has(activityName)) {
      const reference = activityByNormalized.get(normalized);
      activitySet.set(activityName, {
        name: activityName,
        code: reference ? reference.code : null,
      });
    }
  });

  datasets.activities = Array.from(activitySet.values()).sort((a, b) => a.name.localeCompare(b.name));
  datasets.activities.forEach((activity) => {
    datasets.activityMap.set(activity.name, activity);
  });
}

function toggleSelector(selectorEl) {
  selectorEl.classList.toggle('open');
}

function closeSelector(selectorEl) {
  selectorEl.classList.remove('open');
}

function formatRegionDisplay(selected) {
  if (!selected.size || selected.size === datasets.regions.length) {
    return 'Все регионы';
  }
  if (selected.size === 1) {
    const code = Array.from(selected)[0];
    const region = datasets.regionsByCode.get(code);
    return region ? region.name : '1 регион';
  }
  const count = selected.size;
  return `${count} ${pluralize(count, ['регион', 'региона', 'регионов'])}`;
}

function formatActivityDisplay(selected) {
  if (!selected.size || selected.size === datasets.activities.length) {
    return 'Все виды деятельности';
  }
  if (selected.size === 1) {
    return Array.from(selected)[0];
  }
  const count = selected.size;
  return `${count} ${pluralize(count, ['направление', 'направления', 'направлений'])}`;
}

function pluralize(count, forms) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function initializeSelectors() {
  [selectors.indicator, selectors.regions, selectors.activities].forEach((selectorEl) => {
    if (selectorEl) outsideClickTargets.add(selectorEl);
    const display = selectorEl.querySelector('[data-role="display"]');
    if (display) {
      display.addEventListener('click', () => toggleSelector(selectorEl));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      [selectors.indicator, selectors.regions, selectors.activities].forEach((selectorEl) => closeSelector(selectorEl));
    }
  });
}

function renderIndicatorOptions() {
  const panel = selectors.indicator.querySelector('[data-role="panel"]');
  panel.innerHTML = '';
  datasets.indicators.forEach((indicator) => {
    const button = document.createElement('button');
    button.className = 'option-button';
    button.type = 'button';
    button.textContent = indicator.name;
    if (indicator.unit) {
      const unitTag = document.createElement('span');
      unitTag.textContent = indicator.unit;
      button.appendChild(unitTag);
    }
    button.addEventListener('click', () => {
      state.indicator = indicator.name;
      state.unit = indicator.unit;
      const meta = datasets.indicatorMeta.get(indicator.name);
      state.indicatorYearMin = meta ? meta.minYear : null;
      state.indicatorYearMax = meta ? meta.maxYear : null;
      updateRangeSlider(meta ? meta.minYear : null, meta ? meta.maxYear : null);
      selectors.indicator.querySelector('[data-role="display"]').textContent = indicator.name;
      closeSelector(selectors.indicator);
      refreshVisuals();
    });
    panel.appendChild(button);
  });
  if (datasets.indicators.length) {
    const first = datasets.indicators[0];
    state.indicator = first.name;
    state.unit = first.unit;
    state.indicatorYearMin = first.minYear;
    state.indicatorYearMax = first.maxYear;
    selectors.indicator.querySelector('[data-role="display"]').textContent = first.name;
  }
}

function renderRegionsOptions() {
  const panel = selectors.regions.querySelector('[data-role="panel"]');
  panel.innerHTML = '';
  datasets.regions
    .slice()
    .sort((a, b) => a.code - b.code)
    .forEach((region) => {
      const button = document.createElement('button');
      button.className = 'option-button';
      button.type = 'button';
      button.dataset.value = String(region.code);
      button.innerHTML = `<strong>${String(region.code).padStart(2, '0')}</strong> ${region.name}`;
      button.addEventListener('click', () => {
        if (state.selectedRegions.has(region.code)) {
          state.selectedRegions.delete(region.code);
          button.classList.remove('active');
        } else {
          state.selectedRegions.add(region.code);
          button.classList.add('active');
        }
        selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
        refreshVisuals();
      });
      panel.appendChild(button);
    });

  syncRegionSelector();

  document.querySelector('[data-action="regions-select-all"]').addEventListener('click', () => {
    datasets.regions.forEach((region) => state.selectedRegions.add(region.code));
    panel.querySelectorAll('.option-button').forEach((btn) => btn.classList.add('active'));
    selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
    refreshVisuals();
  });

  document.querySelector('[data-action="regions-clear"]').addEventListener('click', () => {
    state.selectedRegions.clear();
    panel.querySelectorAll('.option-button').forEach((btn) => btn.classList.remove('active'));
    selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
    refreshVisuals();
  });
}

function renderActivitiesOptions() {
  const panel = selectors.activities.querySelector('[data-role="panel"]');
  panel.innerHTML = '';
  datasets.activities.forEach((activity) => {
    const button = document.createElement('button');
    button.className = 'option-button';
    button.type = 'button';
    button.dataset.value = activity.name;
    button.innerHTML = `<div>${activity.name}</div>` + (activity.code ? `<span>${activity.code}</span>` : '');
    button.addEventListener('click', () => {
      if (state.selectedActivities.has(activity.name)) {
        state.selectedActivities.delete(activity.name);
        button.classList.remove('active');
      } else {
        state.selectedActivities.add(activity.name);
        button.classList.add('active');
      }
      selectors.activities.querySelector('[data-role="display"]').textContent = formatActivityDisplay(state.selectedActivities);
      refreshVisuals();
    });
    panel.appendChild(button);
  });

  syncActivitySelector();

  document.querySelector('[data-action="activity-select-all"]').addEventListener('click', () => {
    datasets.activities.forEach((activity) => state.selectedActivities.add(activity.name));
    panel.querySelectorAll('.option-button').forEach((btn) => btn.classList.add('active'));
    selectors.activities.querySelector('[data-role="display"]').textContent = formatActivityDisplay(state.selectedActivities);
    refreshVisuals();
  });

  document.querySelector('[data-action="activity-clear"]').addEventListener('click', () => {
    state.selectedActivities.clear();
    panel.querySelectorAll('.option-button').forEach((btn) => btn.classList.remove('active'));
    selectors.activities.querySelector('[data-role="display"]').textContent = formatActivityDisplay(state.selectedActivities);
    refreshVisuals();
  });
}

function updateRangeSlider(minYear, maxYear) {
  if (minYear == null || maxYear == null) return;
  if (!rangeSliderInstance) {
    rangeSliderInstance = new DualRangeSlider(selectors.range, (min, max) => {
      state.yearMin = min;
      state.yearMax = max;
      selectors.rangeMinLabel.textContent = min;
      selectors.rangeMaxLabel.textContent = max;
      refreshVisuals();
    });
  }
  rangeSliderInstance.setScale(minYear, maxYear);
  rangeSliderInstance.setValues(minYear, maxYear, false);
  state.yearMin = minYear;
  state.yearMax = maxYear;
  selectors.rangeMinLabel.textContent = minYear;
  selectors.rangeMaxLabel.textContent = maxYear;
}

function buildLegend() {
  selectors.legend.innerHTML = '';
  const sorted = datasets.regions.slice().sort((a, b) => a.code - b.code);
  sorted.forEach((region) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.dataset.code = String(region.code);
    item.innerHTML = `<span class="legend-item-code">${String(region.code).padStart(2, '0')}</span><span class="legend-item-name">${region.featureName}</span>`;
    item.addEventListener('click', () => {
      if (state.selectedRegions.has(region.code)) {
        state.selectedRegions.delete(region.code);
        item.classList.remove('active');
      } else {
        state.selectedRegions.add(region.code);
        item.classList.add('active');
      }
      selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
      refreshVisuals();
    });
    selectors.legend.appendChild(item);
  });
}

function aggregateForMap() {
  const filtered = datasets.records.filter((record) => {
    if (state.indicator && record.indicatorName !== state.indicator) return false;
    if (state.yearMin != null && record.year < state.yearMin) return false;
    if (state.yearMax != null && record.year > state.yearMax) return false;
    if (state.selectedActivities.size && !state.selectedActivities.has(record.activityName)) return false;
    return record.value != null && record.mapKey;
  });

  const grouped = new Map();
  filtered.forEach((record) => {
    const entry = grouped.get(record.regionCode) || { sum: 0, count: 0, mapKey: record.mapKey, regionName: record.regionName, code: record.regionCode };
    entry.sum += record.value;
    entry.count += 1;
    entry.mapKey = record.mapKey;
    entry.regionName = record.regionName;
    grouped.set(record.regionCode, entry);
  });

  const data = [];
  grouped.forEach((entry) => {
    const value = entry.count ? entry.sum / entry.count : null;
    if (value != null) {
      data.push({
        'hc-key': entry.mapKey,
        value,
        code: entry.code,
        regionName: entry.regionName,
      });
    }
  });

  return data;
}

function aggregateForChart() {
  const filtered = datasets.records.filter((record) => {
    if (state.indicator && record.indicatorName !== state.indicator) return false;
    if (state.yearMin != null && record.year < state.yearMin) return false;
    if (state.yearMax != null && record.year > state.yearMax) return false;
    if (state.selectedActivities.size && !state.selectedActivities.has(record.activityName)) return false;
    if (state.selectedRegions.size && !state.selectedRegions.has(record.regionCode)) return false;
    return record.value != null;
  });

  const grouped = new Map();
  filtered.forEach((record) => {
    const key = record.regionCode;
    const region = datasets.regionsByCode.get(record.regionCode);
    const series = grouped.get(key) || new Map();
    const yearBucket = series.get(record.year) || { sum: 0, count: 0 };
    yearBucket.sum += record.value;
    yearBucket.count += 1;
    series.set(record.year, yearBucket);
    grouped.set(key, series);
  });

  const seriesData = [];
  grouped.forEach((yearMap, code) => {
    const region = datasets.regionsByCode.get(code);
    const points = Array.from(yearMap.entries())
      .map(([year, bucket]) => [Number(year), bucket.count ? bucket.sum / bucket.count : null])
      .sort((a, b) => a[0] - b[0]);
    seriesData.push({
      name: region ? region.featureName : `Регион ${code}`,
      data: points,
      code,
    });
  });

  // If no region selected, show aggregate across all regions as a single series
  if (!seriesData.length) {
    const aggregate = new Map();
    datasets.records
      .filter((record) => record.indicatorName === state.indicator)
      .filter((record) => {
        if (state.yearMin != null && record.year < state.yearMin) return false;
        if (state.yearMax != null && record.year > state.yearMax) return false;
        if (state.selectedActivities.size && !state.selectedActivities.has(record.activityName)) return false;
        return record.value != null;
      })
      .forEach((record) => {
        const bucket = aggregate.get(record.year) || { sum: 0, count: 0 };
        bucket.sum += record.value;
        bucket.count += 1;
        aggregate.set(record.year, bucket);
      });
    const points = Array.from(aggregate.entries())
      .map(([year, bucket]) => [Number(year), bucket.count ? bucket.sum / bucket.count : null])
      .sort((a, b) => a[0] - b[0]);
    seriesData.push({
      name: 'Среднее по России',
      data: points,
    });
  }

  return seriesData;
}

function updateLegendSelection() {
  selectors.legend.querySelectorAll('.legend-item').forEach((item) => {
    const code = Number(item.dataset.code);
    if (state.selectedRegions.has(code)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function renderMap() {
  const mapData = aggregateForMap();
  const unitText = state.unit ? state.unit : '';
  const periodText =
    state.yearMin != null && state.yearMax != null ? `${state.yearMin} – ${state.yearMax}` : 'Без диапазона';
  const activityCount = state.selectedActivities.size;
  const activityNote = activityCount
    ? ` · ${activityCount} ${pluralize(activityCount, ['вид', 'вида', 'видов'])} деятельности`
    : '';
  selectors.mapSubtitle.textContent = `Период: ${periodText}${activityNote}`;
  selectors.mapUnit.textContent = unitText;

  if (!mapChartInstance) {
    mapChartInstance = Highcharts.mapChart('map-container', {
      chart: {
        map: russiaGeoJSON,
        backgroundColor: 'transparent',
        spacing: [20, 20, 20, 20],
      },
      title: { text: null },
      legend: { enabled: false },
      mapNavigation: {
        enabled: true,
        buttonOptions: { alignTo: 'spacingBox', align: 'left', verticalAlign: 'bottom' },
      },
      colorAxis: {
        minColor: '#d9e4ff',
        maxColor: '#365adf',
        labels: { style: { color: '#2c3566', fontSize: '12px' } },
      },
      tooltip: {
        useHTML: true,
        formatter() {
          const { point } = this;
          const value = Highcharts.numberFormat(point.value, 2, '.', ' ');
          return `<span style="font-weight:600;color:#2b3a67">${point.name}</span><br/><span style="color:#6b78a5">${value} ${unitText}</span>`;
        },
      },
      series: [
        {
          type: 'map',
          data: mapData,
          joinBy: 'hc-key',
          name: state.indicator,
          states: {
            hover: { color: '#6d88ff' },
            select: { color: '#1f5cff' },
          },
          allowPointSelect: true,
          point: {
            events: {
              click(e) {
                const code = Number(e.point?.options?.code);
                if (!Number.isFinite(code)) return;
                if (state.selectedRegions.has(code)) {
                  state.selectedRegions.delete(code);
                } else {
                  state.selectedRegions.add(code);
                }
                selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
                updateLegendSelection();
                refreshVisuals(true);
              },
            },
          },
        },
      ],
    });
  } else {
    mapChartInstance.series[0].setData(mapData, true, { duration: 300 });
    mapChartInstance.series[0].update({ name: state.indicator }, false);
    mapChartInstance.redraw();
  }

  mapChartInstance.series[0].points.forEach((point) => {
    const code = Number(point.options.code);
    if (state.selectedRegions.has(code)) {
      point.select(true, true);
    } else {
      point.select(false, true);
    }
  });
}

function renderChart() {
  const seriesData = aggregateForChart();
  const yAxisTitle = state.unit ? state.unit : 'Значение';
  const periodText =
    state.yearMin != null && state.yearMax != null ? `${state.yearMin} – ${state.yearMax}` : '';

  if (!seriesChartInstance) {
    seriesChartInstance = Highcharts.chart('chart-container', {
      chart: {
        type: 'areaspline',
        backgroundColor: 'transparent',
        spacing: [20, 20, 20, 20],
      },
      title: { text: null },
      xAxis: {
        type: 'linear',
        tickInterval: 1,
        lineColor: '#cdd6f6',
        labels: { style: { color: '#5b6e93', fontSize: '12px' } },
      },
      yAxis: {
        title: { text: yAxisTitle, style: { color: '#4a5c86', fontSize: '12px' } },
        gridLineColor: 'rgba(93, 122, 200, 0.1)',
        labels: { style: { color: '#5b6e93', fontSize: '12px' } },
      },
      legend: {
        align: 'right',
        verticalAlign: 'top',
        layout: 'vertical',
        itemStyle: { color: '#334066', fontWeight: '500' },
      },
      tooltip: {
        shared: true,
        valueSuffix: state.unit ? ` ${state.unit}` : '',
      },
      plotOptions: {
        series: {
          marker: { enabled: false },
          fillOpacity: 0.32,
          lineWidth: 2,
          states: {
            hover: { lineWidth: 2.5 },
          },
        },
      },
      series: seriesData,
    });
  } else {
    while (seriesChartInstance.series.length) {
      seriesChartInstance.series[0].remove(false);
    }
    seriesData.forEach((series) => {
      seriesChartInstance.addSeries(series, false);
    });
    seriesChartInstance.yAxis[0].setTitle({ text: yAxisTitle });
    seriesChartInstance.redraw();
  }

  selectors.chartSubtitle.textContent = state.selectedActivities.size
    ? `Фильтр: ${Array.from(state.selectedActivities).join(', ')}${periodText ? ` · ${periodText}` : ''}`
    : `Динамика по выбранным регионам${periodText ? ` · ${periodText}` : ''}`;
}

function refreshVisuals(skipMapUpdate = false) {
  if (!skipMapUpdate) {
    renderMap();
  }
  renderChart();
  syncRegionSelector();
  syncActivitySelector();
  updateLegendSelection();
}

function syncRegionSelector() {
  const panel = selectors.regions.querySelector('[data-role="panel"]');
  if (!panel) return;
  panel.querySelectorAll('.option-button').forEach((btn) => {
    const code = Number(btn.dataset.value);
    if (state.selectedRegions.has(code)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
}

function syncActivitySelector() {
  const panel = selectors.activities.querySelector('[data-role="panel"]');
  if (!panel) return;
  panel.querySelectorAll('.option-button').forEach((btn) => {
    const value = btn.dataset.value;
    if (state.selectedActivities.has(value)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  selectors.activities.querySelector('[data-role="display"]').textContent = formatActivityDisplay(state.selectedActivities);
}

class DualRangeSlider {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.rail = root.querySelector('.range-rail');
    this.track = root.querySelector('.range-track');
    this.handleMin = root.querySelector('[data-handle="min"]');
    this.handleMax = root.querySelector('[data-handle="max"]');
    this.scaleMin = 0;
    this.scaleMax = 0;
    this.valueMin = 0;
    this.valueMax = 0;
    this.step = 1;
    this.activeHandle = null;

    this.handleMin.addEventListener('pointerdown', (event) => this.startDrag(event, 'min'));
    this.handleMax.addEventListener('pointerdown', (event) => this.startDrag(event, 'max'));
    window.addEventListener('resize', () => this.render());
    this.render();
  }

  setScale(min, max) {
    this.scaleMin = min;
    this.scaleMax = max;
    if (this.valueMin < min || this.valueMin == null) this.valueMin = min;
    if (this.valueMax > max || this.valueMax == null) this.valueMax = max;
    if (this.valueMin > this.valueMax) this.valueMin = this.valueMax;
    this.render();
  }

  setValues(min, max, trigger = true) {
    this.valueMin = Math.max(this.scaleMin, Math.min(min, this.scaleMax));
    this.valueMax = Math.max(this.valueMin, Math.min(max, this.scaleMax));
    this.render();
    if (trigger && typeof this.onChange === 'function') {
      this.onChange(this.valueMin, this.valueMax);
    }
  }

  startDrag(event, handleKey) {
    event.preventDefault();
    this.activeHandle = handleKey;
    event.target.setPointerCapture(event.pointerId);
    event.target.addEventListener('pointermove', this.handlePointerMove);
    event.target.addEventListener('pointerup', this.handlePointerUp);
    event.target.addEventListener('pointercancel', this.handlePointerUp);
  }

  handlePointerMove = (event) => {
    if (!this.activeHandle) return;
    const rect = this.rail.getBoundingClientRect();
    const position = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const ratio = rect.width ? position / rect.width : 0;
    const value = Math.round(this.scaleMin + ratio * (this.scaleMax - this.scaleMin));
    if (this.activeHandle === 'min') {
      this.valueMin = Math.min(value, this.valueMax);
    } else {
      this.valueMax = Math.max(value, this.valueMin);
    }
    this.render();
    if (typeof this.onChange === 'function') {
      this.onChange(this.valueMin, this.valueMax);
    }
  };

  handlePointerUp = (event) => {
    event.target.removeEventListener('pointermove', this.handlePointerMove);
    event.target.removeEventListener('pointerup', this.handlePointerUp);
    event.target.removeEventListener('pointercancel', this.handlePointerUp);
    this.activeHandle = null;
  };

  render() {
    const rect = this.rail.getBoundingClientRect();
    const width = rect.width;
    const offsetLeft = rect.left - this.root.getBoundingClientRect().left;
    const ratioMin = this.scaleMax === this.scaleMin ? 0 : (this.valueMin - this.scaleMin) / (this.scaleMax - this.scaleMin);
    const ratioMax = this.scaleMax === this.scaleMin ? 0 : (this.valueMax - this.scaleMin) / (this.scaleMax - this.scaleMin);
    const handleSize = this.handleMin.offsetWidth || 20;

    const leftMin = offsetLeft + ratioMin * width - handleSize / 2;
    const leftMax = offsetLeft + ratioMax * width - handleSize / 2;

    this.handleMin.style.left = `${Math.max(0, Math.min(leftMin, this.root.clientWidth - handleSize))}px`;
    this.handleMax.style.left = `${Math.max(0, Math.min(leftMax, this.root.clientWidth - handleSize))}px`;

    const trackLeft = offsetLeft + ratioMin * width;
    const trackRight = offsetLeft + ratioMax * width;
    this.track.style.left = `${Math.min(trackLeft, trackRight)}px`;
    this.track.style.width = `${Math.abs(trackRight - trackLeft)}px`;
  }
}

function initialize() {
  initializeSelectors();
  buildLegend();
  renderIndicatorOptions();
  renderRegionsOptions();
  renderActivitiesOptions();
  const initialMeta = datasets.indicatorMeta.get(state.indicator);
  if (initialMeta) {
    updateRangeSlider(initialMeta.minYear, initialMeta.maxYear);
  }
  selectors.activities.querySelector('[data-role="display"]').textContent = formatActivityDisplay(state.selectedActivities);
  selectors.regions.querySelector('[data-role="display"]').textContent = formatRegionDisplay(state.selectedRegions);
  refreshVisuals();
}

loadData()
  .then(() => {
    initialize();
  })
  .catch((error) => {
    console.error('Ошибка загрузки данных', error);
  });
