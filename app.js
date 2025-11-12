import { RUSSIA_GEOJSON } from './geoData.js';

const state = {
  indicator: null,
  regions: [],
  activities: [],
  period: [null, null],
  unit: '',
  lastChanged: 'regions'
};

const datasets = {
  indicators: [],
  regions: [],
  activities: []
};

const nameMappings = {
  'Республика Адыгея (Адыгея)': 'Республика Адыгея',
  'Республика Северная Осетия - Алания': 'Республика Северная Осетия',
  'Республика Татарстан (Татарстан)': 'Республика Татарстан',
  'Чувашская Республика - Чувашия': 'Чувашская Республика',
  'Кемеровская область - Кузбасс': 'Кемеровская область',
  'г. Москва': 'Москва',
  'г. Санкт-Петербург': 'Санкт-Петербург',
  'Ханты-Мансийский автономный округ - Югра': 'Ханты-Мансийский автономный округ',
  'г. Севастополь': 'г.Севастополь'
};

class CustomSelect {
  constructor(root, { multiple = false, placeholder = 'Выберите' } = {}) {
    this.root = root;
    this.multiple = multiple;
    this.placeholder = placeholder;
    this.trigger = document.createElement('button');
    this.trigger.className = 'custom-select__trigger';
    this.trigger.type = 'button';
    this.trigger.innerHTML = `<span>${placeholder}</span><svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" stroke="#6366f1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'custom-select__dropdown';
    this.options = [];
    this.value = multiple ? [] : null;
    this.changeListeners = [];

    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    document.addEventListener('click', (event) => {
      if (!this.root.contains(event.target)) {
        this.close();
      }
    });

    this.root.classList.add('custom-select-component');
    this.root.append(this.trigger, this.dropdown);
  }

  setOptions(options) {
    this.dropdown.innerHTML = '';
    this.options = options;
    const fragment = document.createDocumentFragment();

    if (this.multiple) {
      fragment.appendChild(this.createActionOption('selectAll', 'Выбрать все'));
      fragment.appendChild(this.createActionOption('clearAll', 'Очистить все'));
    }

    options.forEach((option) => {
      fragment.appendChild(this.createOption(option));
    });
    this.dropdown.appendChild(fragment);
    this.resetValue();
  }

  createActionOption(action, label) {
    const actionOption = document.createElement('button');
    actionOption.type = 'button';
    actionOption.className = 'select-option select-option__action';
    actionOption.textContent = label;
    actionOption.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (action === 'selectAll') {
        this.value = this.options.map((option) => option.value);
        this.dropdown.querySelectorAll('input[type=checkbox]').forEach((input) => {
          input.checked = true;
        });
      } else {
        this.value = [];
        this.dropdown.querySelectorAll('input[type=checkbox]').forEach((input) => {
          input.checked = false;
        });
      }
      this.updateTrigger();
      this.notify();
    });
    return actionOption;
  }

  createOption(option) {
    const label = document.createElement('label');
    label.className = 'select-option';
    const input = document.createElement('input');
    input.type = this.multiple ? 'checkbox' : 'radio';
    input.name = `${this.root.id}-option`;
    input.value = option.value;
    input.dataset.label = option.label;

    input.addEventListener('change', (event) => {
      event.stopPropagation();
      if (this.multiple) {
        const values = new Set(this.value);
        if (input.checked) {
          values.add(option.value);
        } else {
          values.delete(option.value);
        }
        this.value = Array.from(values);
      } else {
        this.value = option.value;
        this.close();
      }
      this.updateTrigger();
      this.notify();
    });

    label.appendChild(input);
    const text = document.createElement('span');
    text.textContent = option.label;
    label.appendChild(text);
    return label;
  }

  resetValue() {
    if (this.multiple) {
      this.value = [];
    } else {
      this.value = this.options.length ? this.options[0].value : null;
      const firstInput = this.dropdown.querySelector('input');
      if (firstInput) {
        firstInput.checked = true;
      }
    }
    this.updateTrigger();
    this.notify();
  }

  setValue(values) {
    if (this.multiple) {
      this.value = Array.from(values);
      this.dropdown.querySelectorAll('input[type=checkbox]').forEach((input) => {
        input.checked = this.value.includes(input.value);
      });
    } else {
      this.value = values;
      this.dropdown.querySelectorAll('input[type=radio]').forEach((input) => {
        input.checked = input.value === values;
      });
    }
    this.updateTrigger();
  }

  getValue() {
    return this.multiple ? [...this.value] : this.value;
  }

  updateTrigger() {
    if (this.multiple) {
      const count = this.value.length;
      if (!count) {
        this.trigger.querySelector('span').textContent = this.placeholder;
      } else if (count === 1) {
        const option = this.options.find((item) => item.value === this.value[0]);
        this.trigger.querySelector('span').textContent = option ? option.label : this.placeholder;
      } else {
        this.trigger.querySelector('span').textContent = `Выбрано ${count}`;
      }
    } else {
      const option = this.options.find((item) => item.value === this.value);
      this.trigger.querySelector('span').textContent = option ? option.label : this.placeholder;
    }
  }

  onChange(callback) {
    this.changeListeners.push(callback);
  }

  notify() {
    this.changeListeners.forEach((callback) => callback(this.getValue()));
  }

  toggle() {
    this.root.classList.toggle('open');
  }

  close() {
    this.root.classList.remove('open');
  }
}

const indicatorSelect = new CustomSelect(document.getElementById('indicator-select'), {
  multiple: false,
  placeholder: 'Все показатели'
});
const regionSelect = new CustomSelect(document.getElementById('region-select'), {
  multiple: true,
  placeholder: 'Все регионы'
});
const activitySelect = new CustomSelect(document.getElementById('activity-select'), {
  multiple: true,
  placeholder: 'Все виды деятельности'
});

const sliderStart = document.getElementById('period-start');
const sliderEnd = document.getElementById('period-end');
const sliderTrack = document.querySelector('.slider-track');
const periodLabel = document.getElementById('period-label');
const startValueLabel = document.getElementById('period-start-value');
const endValueLabel = document.getElementById('period-end-value');

let mapChart = null;
let trendsChart = null;

function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) {
    lines.push(current);
  }

  const headers = lines[0].split(',');
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = [];
    let value = '';
    let quote = false;
    for (let j = 0; j < line.length; j += 1) {
      const c = line[j];
      if (c === '"') {
        if (quote && line[j + 1] === '"') {
          value += '"';
          j += 1;
        } else {
          quote = !quote;
        }
      } else if (c === ',' && !quote) {
        values.push(value);
        value = '';
      } else {
        value += c;
      }
    }
    values.push(value);
    const record = {};
    headers.forEach((header, idx) => {
      record[header.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(record);
  }
  return rows;
}

async function loadData() {
  const [indicatorCsv, regionsCsv, activityCsv] = await Promise.all([
    fetch('./indicators.csv').then((res) => res.text()),
    fetch('./regions_reference.csv').then((res) => res.text()),
    fetch('./activity_reference.csv').then((res) => res.text())
  ]);

  datasets.indicators = parseCSV(indicatorCsv).map((row) => {
    const rawValue = (row['Значение'] || '').replace(',', '.');
    const numericValue = rawValue ? Number(rawValue) : null;
    return {
      year: Number(row['Год']),
      regionCode: row['Код региона'],
      regionName: row['Регион'],
      activity: row['Вид экономической деятельности'],
      indicator: row['Показатель'],
      value: Number.isFinite(numericValue) ? numericValue : null,
      unit: row['Единица измерения']
    };
  });

  datasets.regions = parseCSV(regionsCsv).map((row) => ({
    code: row['Код'],
    name: row['Наименование']
  }));

  datasets.activities = parseCSV(activityCsv).map((row) => ({
    code: row['Код ОКВЭД'],
    name: row['Наименование']
  }));

  const activityNames = new Set(datasets.activities.map((item) => item.name));
  const extras = new Set();
  datasets.indicators.forEach((row) => {
    if (!activityNames.has(row.activity)) {
      extras.add(row.activity);
    }
  });
  extras.forEach((name) => {
    datasets.activities.push({ code: '—', name });
  });
}

function enrichRegions() {
  const geoFeatures = RUSSIA_GEOJSON.features;
  const geoByName = new Map();
  geoFeatures.forEach((feature) => {
    geoByName.set(feature.properties.name, feature);
  });

  datasets.regions = datasets.regions
    .filter((region) => region.code !== '0')
    .map((region) => {
      const normalizedName = nameMappings[region.name] || region.name;
      const feature = geoByName.get(normalizedName);
      return {
        ...region,
        normalizedName,
        hcKey: feature ? feature.properties['hc-key'] : null,
        postalCode: feature ? feature.properties['postal-code'] : null
      };
    });
}

function initializeControls() {
  const indicatorOptions = Array.from(
    new Set(datasets.indicators.map((item) => item.indicator))
  )
    .sort((a, b) => a.localeCompare(b, 'ru'))
    .map((indicator) => ({ value: indicator, label: indicator }));
  indicatorSelect.setOptions(indicatorOptions);
  indicatorSelect.onChange((value) => {
    state.indicator = value;
    const indicatorRecords = datasets.indicators.filter((row) => row.indicator === value);
    const years = Array.from(new Set(indicatorRecords.map((row) => row.year))).sort((a, b) => a - b);
    if (years.length) {
      updateSliderRange(years[0], years[years.length - 1]);
    }
    state.unit = indicatorRecords[0]?.unit || '';
    updateMap();
    updateChart();
    updateMeta();
  });
  state.indicator = indicatorOptions[0]?.value || null;

  const regionOptions = datasets.regions
    .filter((region) => region.hcKey)
    .sort((a, b) => Number(a.code) - Number(b.code))
    .map((region) => ({ value: region.code, label: `${region.code}. ${region.name}` }));
  regionSelect.setOptions(regionOptions);
  regionSelect.onChange((values) => {
    state.regions = values;
    state.lastChanged = 'regions';
    enforceSelectionRules();
    updateMapSelection();
    updateChart();
    updateLegendSelection();
  });

  const activityOptions = datasets.activities
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    .map((activity) => ({
      value: activity.name,
      label: `${activity.code} · ${activity.name}`
    }));
  activitySelect.setOptions(activityOptions);
  activitySelect.onChange((values) => {
    state.activities = values;
    state.lastChanged = 'activities';
    enforceSelectionRules();
    updateMap();
    updateChart();
    updateMeta();
  });
}

function enforceSelectionRules() {
  const multipleRegions = state.regions.length > 1;
  const multipleActivities = state.activities.length > 1;

  if (multipleRegions && multipleActivities) {
    if (state.lastChanged === 'regions') {
      state.activities = state.activities.slice(0, 1);
      activitySelect.setValue(state.activities);
      updateMap();
      updateMeta();
    } else {
      state.regions = state.regions.slice(0, 1);
      regionSelect.setValue(state.regions);
      updateMapSelection();
      updateLegendSelection();
    }
  }
  updateChart();
}

function updateSliderRange(minYear, maxYear) {
  sliderStart.min = minYear;
  sliderStart.max = maxYear;
  sliderEnd.min = minYear;
  sliderEnd.max = maxYear;
  sliderStart.step = 1;
  sliderEnd.step = 1;
  sliderStart.value = minYear;
  sliderEnd.value = maxYear;
  state.period = [minYear, maxYear];
  updateSliderVisuals();
}

function updateSliderVisuals() {
  const min = Number(sliderStart.min);
  const max = Number(sliderStart.max);
  let start = Number(sliderStart.value);
  let end = Number(sliderEnd.value);

  if (start > end) {
    [start, end] = [end, start];
  }
  sliderStart.value = start;
  sliderEnd.value = end;
  state.period = [start, end];

  const denominator = max - min || 1;
  const startPercent = ((start - min) / denominator) * 100;
  const endPercent = ((end - min) / denominator) * 100;
  sliderTrack.style.setProperty('--start', `${startPercent}%`);
  sliderTrack.style.setProperty('--end', `${endPercent}%`);
  periodLabel.textContent = `${start} – ${end}`;
  startValueLabel.textContent = start;
  endValueLabel.textContent = end;

  updateMap();
  updateChart();
}

sliderStart.addEventListener('input', updateSliderVisuals);
sliderEnd.addEventListener('input', updateSliderVisuals);

function computeAggregatedValues() {
  const [startYear, endYear] = state.period;
  const activityFilter = state.activities.length ? state.activities : null;
  const indicator = state.indicator;

  const mapValues = new Map();

  datasets.indicators.forEach((row) => {
    if (row.indicator !== indicator) return;
    if (row.year < startYear || row.year > endYear) return;
    if (activityFilter && !activityFilter.includes(row.activity)) return;
    if (!Number.isFinite(row.value)) return;
    const key = row.regionCode;
    const current = mapValues.get(key) || { total: 0, count: 0 };
    mapValues.set(key, {
      total: current.total + row.value,
      count: current.count + 1
    });
  });

  return Array.from(mapValues.entries()).map(([regionCode, stats]) => ({
    regionCode,
    value: stats.count ? stats.total / stats.count : null
  }));
}

function buildMapSeries() {
  const aggregates = computeAggregatedValues();
  const data = datasets.regions
    .filter((region) => region.hcKey)
    .map((region) => {
      const match = aggregates.find((item) => item.regionCode === region.code);
      return {
        'hc-key': region.hcKey,
        value: match ? match.value : null,
        regionCode: region.code,
        name: region.name
      };
    });
  return data;
}

function updateMapSelection() {
  if (!mapChart) return;
  const selected = new Set(state.regions);
  mapChart.series[0].points.forEach((point) => {
    const code = point.regionCode || point.options.regionCode;
    if (selected.has(code)) {
      point.select(true, true);
    } else if (point.selected) {
      point.select(false, true);
    }
  });
}

function initializeMap() {
  const seriesData = buildMapSeries();
  mapChart = Highcharts.mapChart('map-container', {
    chart: {
      map: RUSSIA_GEOJSON,
      backgroundColor: 'rgba(255,255,255,0)'
    },
    title: { text: null },
    legend: { enabled: false },
    colorAxis: {
      minColor: '#ede9fe',
      maxColor: '#5b21b6',
      nullColor: 'rgba(226, 232, 240, 0.6)'
    },
    tooltip: {
      useHTML: true,
      headerFormat: '<span style="font-size:13px">{point.name}</span><br/>',
      pointFormatter() {
        const value = typeof this.value === 'number' ? Highcharts.numberFormat(this.value, 2, ',', ' ') : 'нет данных';
        const unit = state.unit ? ` ${state.unit}` : '';
        return `<span style="color:#4f46e5;font-weight:600">Код ${this.options.regionCode}</span><br/><span style="font-size:12px;color:#475569">${value}${unit}</span>`;
      }
    },
    mapNavigation: {
      enabled: true,
      buttonOptions: {
        align: 'right'
      }
    },
    plotOptions: {
      series: {
        states: {
          select: {
            color: '#7c3aed'
          }
        },
        allowPointSelect: true,
        cursor: 'pointer',
        point: {
          events: {
            click() {
              toggleRegionSelection(this.regionCode || this.options.regionCode);
            }
          }
        }
      }
    },
    series: [
      {
        data: seriesData,
        joinBy: 'hc-key',
        name: 'Регион',
        dataLabels: {
          enabled: true,
          format: '{point.options.regionCode}',
          style: {
            fontSize: '10px',
            textOutline: 'none',
            fontWeight: '600',
            color: '#1e1b4b'
          },
          allowOverlap: true
        }
      }
    ]
  });
}

function updateMap() {
  if (!mapChart) {
    initializeMap();
    return;
  }
  const seriesData = buildMapSeries();
  mapChart.series[0].setData(seriesData, true, { duration: 300 });
  updateMapSelection();
  updateMapSubtitle();
}

function updateMapSubtitle() {
  const subtitle = document.getElementById('map-subtitle');
  const indicator = state.indicator || '';
  const activity = state.activities.length ? state.activities.join(', ') : 'Все виды деятельности';
  subtitle.textContent = `${indicator} · ${activity}`;
}

function toggleRegionSelection(regionCode) {
  const selected = new Set(state.regions);
  if (selected.has(regionCode)) {
    selected.delete(regionCode);
  } else {
    selected.add(regionCode);
  }
  state.lastChanged = 'regions';
  state.regions = Array.from(selected).sort((a, b) => Number(a) - Number(b));
  regionSelect.setValue(state.regions);
  enforceSelectionRules();
  updateMapSelection();
  updateLegendSelection();
  updateChart();
}

function initializeLegend() {
  const legendContainer = document.getElementById('region-legend');
  const template = document.getElementById('legend-item-template');
  datasets.regions
    .filter((region) => region.hcKey)
    .sort((a, b) => Number(a.code) - Number(b.code))
    .forEach((region) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.code = region.code;
      node.textContent = region.name;
      node.addEventListener('click', () => {
        toggleRegionSelection(region.code);
      });
      legendContainer.appendChild(node);
    });
}

function updateLegendSelection() {
  const legendContainer = document.getElementById('region-legend');
  const selected = new Set(state.regions);
  legendContainer.querySelectorAll('.legend-item').forEach((item) => {
    if (selected.has(item.dataset.code)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

function prepareChartSeries() {
  const [startYear, endYear] = state.period;
  const indicator = state.indicator;
  const years = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  if (!indicator) {
    return { series: [], categories: years };
  }

  const filtered = datasets.indicators.filter((row) => {
    if (row.indicator !== indicator) return false;
    if (row.year < startYear || row.year > endYear) return false;
    if (state.activities.length && !state.activities.includes(row.activity)) return false;
    if (state.regions.length && !state.regions.includes(row.regionCode)) return false;
    if (!Number.isFinite(row.value)) return false;
    return true;
  });

  const groupBy = state.regions.length > 1 ? 'region' : state.activities.length > 1 ? 'activity' : 'region';

  const groups = new Map();
  filtered.forEach((row) => {
    const key = groupBy === 'region' ? row.regionCode : row.activity;
    if (!groups.has(key)) {
      groups.set(key, {
        name:
          groupBy === 'region'
            ? `${row.regionCode}. ${datasets.regions.find((region) => region.code === row.regionCode)?.name ?? row.regionName}`
            : row.activity,
        data: new Map()
      });
    }
    groups.get(key).data.set(row.year, row.value);
  });

  const series = [];
  groups.forEach((group) => {
    const data = years.map((year) => (group.data.has(year) ? group.data.get(year) : null));
    series.push({ name: group.name, data });
  });
  return { series, categories: years };
}

function initializeChart() {
  const prepared = prepareChartSeries();
  trendsChart = Highcharts.chart('chart-container', {
    chart: {
      type: 'spline',
      spacing: [20, 20, 20, 20],
      backgroundColor: 'rgba(255,255,255,0)'
    },
    title: { text: null },
    xAxis: {
      categories: prepared.categories,
      tickmarkPlacement: 'on',
      lineColor: 'rgba(148, 163, 184, 0.5)',
      labels: {
        style: { fontSize: '12px', color: '#1f2937' }
      }
    },
    yAxis: {
      title: {
        text: state.unit || 'Значение',
        style: { fontSize: '13px', color: '#312e81' }
      },
      gridLineColor: 'rgba(148, 163, 184, 0.3)',
      labels: {
        style: { fontSize: '12px', color: '#1f2937' }
      }
    },
    tooltip: {
      shared: true,
      borderColor: '#7c3aed',
      backgroundColor: '#f8f5ff',
      formatter() {
        const header = `<div style="margin-bottom:8px;font-weight:600;color:#4f46e5">${this.x} год</div>`;
        const rows = this.points
          .filter((point) => typeof point.y === 'number')
          .map((point) => {
            const value = Highcharts.numberFormat(point.y, 2, ',', ' ');
            return `<div style="display:flex;justify-content:space-between;gap:12px;color:#1f2937"><span>${point.series.name}</span><span style="font-weight:600;color:#4338ca">${value}</span></div>`;
          })
          .join('');
        return `${header}${rows}`;
      }
    },
    legend: {
      align: 'left',
      layout: 'horizontal',
      itemStyle: { fontWeight: '600', color: '#312e81' }
    },
    credits: { enabled: false },
    series: prepared.series
  });
}

function updateChart() {
  if (!trendsChart) {
    initializeChart();
    return;
  }
  const prepared = prepareChartSeries();
  trendsChart.update(
    {
      xAxis: { categories: prepared.categories },
      yAxis: { title: { text: state.unit || 'Значение' } },
      series: prepared.series
    },
    true,
    true,
    false
  );
  updateChartSubtitle();
}

function updateMeta() {
  const meta = document.getElementById('chart-indicator-meta');
  meta.innerHTML = '';
  if (state.unit) {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = state.unit;
    meta.appendChild(pill);
  }
  if (state.activities.length) {
    const label = document.createElement('span');
    label.textContent = state.activities.join(' · ');
    meta.appendChild(label);
  }
}

function updateChartSubtitle() {
  const subtitle = document.getElementById('chart-subtitle');
  const regionPart = state.regions.length
    ? `Регионы: ${state.regions
        .map((code) => datasets.regions.find((region) => region.code === code)?.name || code)
        .join(', ')}`
    : 'Все регионы';
  const activityPart = state.activities.length ? state.activities.join(', ') : 'Все виды деятельности';
  subtitle.textContent = `${regionPart} · ${activityPart}`;
}

async function bootstrap() {
  await loadData();
  enrichRegions();
  initializeControls();
  initializeLegend();
  updateMap();
  updateLegendSelection();
  updateChart();
  updateMeta();
  updateMapSubtitle();
  updateChartSubtitle();
}

bootstrap();
