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
