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
