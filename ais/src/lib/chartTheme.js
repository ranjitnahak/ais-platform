/** Resolve AIS CSS variables for Chart.js (canvas cannot use var() in all code paths). */

export function getChartColor(cssVarName) {
  if (typeof document === 'undefined') return '';
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVarName);
  return value?.trim() || '';
}

export function getDexaChartColors() {
  return {
    lean: getChartColor('--color-primary') || getChartColor('--color-primary-container'),
    fat: getChartColor('--color-outline') || getChartColor('--color-on-surface-variant'),
    grid: getChartColor('--color-outline-variant'),
    text: getChartColor('--color-on-surface-variant'),
    surface: getChartColor('--color-surface-container'),
    trendFat: getChartColor('--color-primary-container'),
    trendLean: getChartColor('--color-secondary'),
  };
}

export function baseChartOptions(colors) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: colors.text, font: { size: 11, weight: 'bold' } },
      },
      tooltip: {
        backgroundColor: colors.surface,
        titleColor: colors.text,
        bodyColor: colors.text,
        borderColor: colors.grid,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: colors.text, font: { size: 10 } },
        grid: { color: colors.grid },
      },
      y: {
        ticks: { color: colors.text, font: { size: 10 } },
        grid: { color: colors.grid },
      },
    },
  };
}

/** Chart.js canvas cannot resolve CSS variables — use established hex constants. */
export const LOAD_MONITORING_CHART_COLORS = {
  orange: '#F97316',
  blue: '#0A84FF',
  green: '#34C759',
  red: '#FF453A',
  purple: '#8B5CF6',
  grey: '#545458',
  surface: '#2C2C2E',
};

export function getLoadMonitoringChartColors() {
  return {
    ...LOAD_MONITORING_CHART_COLORS,
    grid: getChartColor('--color-outline-variant') || LOAD_MONITORING_CHART_COLORS.grey,
    text: getChartColor('--color-on-surface-variant') || '#8E8E93',
    surface: getChartColor('--color-surface-container') || LOAD_MONITORING_CHART_COLORS.surface,
  };
}

export function getLoadMonitoringChartOptions(colors) {
  return {
    ...baseChartOptions(colors),
    plugins: {
      ...baseChartOptions(colors).plugins,
      legend: { display: false },
    },
  };
}

/** Chart.js canvas cannot resolve CSS variables — assessment tier band fallbacks. */
export const ASSESSMENT_TIER_CHART_COLORS = {
  belowAvg: '#93000a',
  avg: '#F97316',
  aboveAvg: '#0A84FF',
  excellent: '#34C759',
  line: '#F97316',
  grid: '#545458',
  text: '#8E8E93',
  surface: '#2C2C2E',
};

export function getAssessmentChartColors() {
  return {
    belowAvg: getChartColor('--color-below-avg') || ASSESSMENT_TIER_CHART_COLORS.belowAvg,
    avg: getChartColor('--color-avg') || ASSESSMENT_TIER_CHART_COLORS.avg,
    aboveAvg: getChartColor('--color-above-avg') || ASSESSMENT_TIER_CHART_COLORS.aboveAvg,
    excellent: getChartColor('--color-excellent') || ASSESSMENT_TIER_CHART_COLORS.excellent,
    line: getChartColor('--color-primary-container') || ASSESSMENT_TIER_CHART_COLORS.line,
    grid: getChartColor('--color-outline-variant') || ASSESSMENT_TIER_CHART_COLORS.grid,
    text: getChartColor('--color-on-surface-variant') || ASSESSMENT_TIER_CHART_COLORS.text,
    surface: getChartColor('--color-surface-container') || ASSESSMENT_TIER_CHART_COLORS.surface,
  };
}

export function tierColorVarToHex(tierColorVar, colors) {
  if (!tierColorVar) return colors.avg;
  const key = tierColorVar.replace('--color-', '').replace(/-/g, '');
  const map = {
    belowavg: colors.belowAvg,
    avg: colors.avg,
    aboveavg: colors.aboveAvg,
    excellent: colors.excellent,
    errorcontainer: colors.belowAvg,
    primarycontainer: colors.avg,
    secondarycontainer: colors.aboveAvg,
    tertiarycontainer: colors.excellent,
  };
  const resolved = getChartColor(tierColorVar);
  return resolved || map[key] || colors.avg;
}

export function getAssessmentChartOptions(colors) {
  return {
    ...baseChartOptions(colors),
    plugins: {
      ...baseChartOptions(colors).plugins,
      legend: { display: true },
    },
  };
}

/** Chart.js plugin — draw horizontal tier band zones on a line chart. */
export function createTierBandPlugin({ bands, yScaleId = 'y' }) {
  return {
    id: 'tierBands',
    beforeDatasetsDraw(chart) {
      if (!bands?.length) return;
      const { ctx, chartArea, scales } = chart;
      const yScale = scales[yScaleId];
      if (!yScale || !chartArea) return;

      ctx.save();
      for (const band of bands) {
        const yTop = yScale.getPixelForValue(band.max);
        const yBottom = yScale.getPixelForValue(band.min);
        ctx.fillStyle = band.color;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBottom - yTop);
      }
      ctx.restore();
    },
  };
}
