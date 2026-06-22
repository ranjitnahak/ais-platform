/**
 * Dark-theme WYSIWYG dashboard PDF export via html2canvas + jsPDF.
 * Clones panel content off-screen — no white print-theme override.
 */

const SURFACE_BG = '#131315';
const CAPTURE_WIDTH = 1104;
const SCALE = 2;
const PNG_QUALITY = 0.92;

const PDF_W = 210;
const PDF_H = 297;
const MARGIN = 5;
const CONTENT_W = PDF_W - MARGIN * 2;
const CONTENT_H = PDF_H - MARGIN * 2;

const UNSUPPORTED_COLOR_RE = /color-mix|color\s*\(/i;

const RESOLVED_COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
];

const SIZE_PRESERVE_TAGS = new Set(['CANVAS', 'IMG', 'SVG', 'VIDEO']);
const TEXT_FLOW_TAGS = new Set(['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'LABEL', 'A']);
const SHORTHAND_PROPS_SKIP = new Set([
  'font', 'background', 'border', 'margin', 'padding', 'outline', 'flex-flow',
]);

function shouldSkipMirroredWidth(sourceNode, cs) {
  const tag = sourceNode.tagName;
  if (SIZE_PRESERVE_TAGS.has(tag)) return false;
  if (TEXT_FLOW_TAGS.has(tag)) return true;
  const flexGrow = cs.getPropertyValue('flex-grow');
  return flexGrow !== '' && flexGrow !== '0';
}

function hasUnsupportedColorFn(value) {
  return Boolean(value && UNSUPPORTED_COLOR_RE.test(value));
}

function stripColorMixClasses(el) {
  if (!el.classList?.length) return;
  for (const cls of [...el.classList]) {
    if (cls.includes('color-mix') || cls.includes('color(')) {
      el.classList.remove(cls);
    }
  }
}

function inlineComputedStylesSafe(sourceNode, cloneNode) {
  if (!sourceNode || !cloneNode) return;
  const cs = getComputedStyle(sourceNode);

  stripColorMixClasses(cloneNode);
  cloneNode.removeAttribute('style');

  const skipWidth = shouldSkipMirroredWidth(sourceNode, cs);

  for (const prop of cs) {
    if (skipWidth && (prop === 'width' || prop === 'max-width')) continue;
    if (SHORTHAND_PROPS_SKIP.has(prop)) continue;
    const val = cs.getPropertyValue(prop);
    if (!val || hasUnsupportedColorFn(val)) continue;
    cloneNode.style.setProperty(prop, val, cs.getPropertyPriority(prop));
  }

  for (const prop of RESOLVED_COLOR_PROPS) {
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const resolved = cs[camel] || cs.getPropertyValue(prop);
    if (resolved && !hasUnsupportedColorFn(resolved)) {
      cloneNode.style.setProperty(prop, resolved);
    }
  }
}

function mirrorStylesSkippingExcluded(sourceNode, cloneNode) {
  inlineComputedStylesSafe(sourceNode, cloneNode);

  const cloneChildren = [...cloneNode.children];
  let cloneIdx = 0;

  for (const sourceChild of sourceNode.children) {
    if (sourceChild.hasAttribute('data-pdf-exclude')) continue;
    if (cloneIdx >= cloneChildren.length) break;
    mirrorStylesSkippingExcluded(sourceChild, cloneChildren[cloneIdx]);
    cloneIdx += 1;
  }
}

function expandCollapsedElements(root) {
  const nodes = [root, ...root.querySelectorAll('*')];
  for (const el of nodes) {
    const scrollH = el.scrollHeight;
    const offsetH = el.offsetHeight;
    if (scrollH > offsetH + 4) {
      el.style.overflow = 'visible';
      el.style.minHeight = `${scrollH}px`;
    }
  }
}

function scrubUnsupportedColorFunctions(root) {
  const nodes = [root, ...root.querySelectorAll('*')];
  for (const el of nodes) {
    if (!el.style) continue;
    for (let i = el.style.length - 1; i >= 0; i -= 1) {
      const prop = el.style[i];
      const val = el.style.getPropertyValue(prop);
      if (hasUnsupportedColorFn(val)) {
        el.style.removeProperty(prop);
      }
    }
  }
}

const SPIKE_BANNER_SPLIT = '. High spike risk';

function fixSpikeWarningBannerForCapture(clone) {
  const el = clone.querySelector('[data-pdf-spike-banner-text]');
  if (!el) return;

  const container = el.closest('[data-pdf-spike-banner]') ?? el.parentElement;
  const text = el.textContent ?? '';
  const splitAt = text.indexOf(SPIKE_BANNER_SPLIT);

  el.style.removeProperty('font');
  el.style.removeProperty('width');
  el.style.removeProperty('max-width');
  el.style.removeProperty('height');
  el.style.removeProperty('min-height');
  el.style.setProperty('min-width', '0');
  el.style.setProperty('flex', '1 1 0%');
  el.style.setProperty('display', 'block');
  el.style.setProperty('height', 'auto');
  el.style.setProperty('line-height', '1.5');
  el.style.setProperty('white-space', 'normal');
  el.style.setProperty('overflow', 'visible');

  el.textContent = '';
  if (splitAt > 0) {
    el.appendChild(document.createTextNode(text.slice(0, splitAt + 1)));
    el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(text.slice(splitAt + 2)));
  } else {
    el.textContent = text;
  }

  if (container) {
    container.style.removeProperty('height');
    container.style.setProperty('height', 'auto');
    container.style.setProperty('overflow', 'visible');
    container.style.setProperty('align-items', 'flex-start');
    const containerScrollH = container.scrollHeight;
    if (containerScrollH > container.offsetHeight) {
      container.style.setProperty('min-height', `${containerScrollH}px`);
    }
  }

  const textScrollH = el.scrollHeight;
  if (textScrollH > el.offsetHeight) {
    el.style.setProperty('min-height', `${textScrollH}px`);
  }
}

function fixRpeComplianceSubtitleForCapture(clone) {
  const el = clone.querySelector('[data-pdf-rpe-compliance-subtitle]');
  if (!el) return;

  const text = el.textContent ?? '';
  const parts = text.split(' · ');

  el.style.removeProperty('font');
  el.style.removeProperty('width');
  el.style.removeProperty('height');
  el.style.setProperty('font-style', 'normal');
  el.style.setProperty('white-space', 'normal');
  el.style.setProperty('letter-spacing', 'normal');
  el.style.setProperty('height', 'auto');
  el.style.setProperty('overflow', 'visible');

  el.textContent = '';
  if (parts.length === 2) {
    el.appendChild(document.createTextNode(parts[0].trim()));
    el.appendChild(document.createTextNode(' · '));
    el.appendChild(document.createTextNode(parts[1].trim()));
  } else {
    el.textContent = text;
  }
}

function prepareClone(contentEl) {
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position:fixed', 'left:-10000px', 'top:0',
    `width:${CAPTURE_WIDTH}px`, 'height:auto',
    'overflow:visible', 'pointer-events:none',
  ].join(';');

  const clone = contentEl.cloneNode(true);

  clone.querySelectorAll('[data-pdf-exclude]').forEach((el) => el.remove());
  clone.querySelectorAll('[data-pdf-export-only]').forEach((el) => {
    el.classList.remove('hidden');
    el.style.display = '';
    el.style.visibility = 'visible';
  });

  copyCanvases(contentEl, clone);
  mirrorStylesSkippingExcluded(contentEl, clone);
  scrubUnsupportedColorFunctions(clone);
  expandCollapsedElements(clone);

  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.backgroundColor = SURFACE_BG;
  clone.style.padding = '0';

  container.appendChild(clone);
  document.body.appendChild(container);

  fixSpikeWarningBannerForCapture(clone);
  fixRpeComplianceSubtitleForCapture(clone);

  return { container, clone };
}

function copyCanvases(source, clone) {
  const sourceCanvases = source.querySelectorAll('canvas');
  const cloneCanvases = clone.querySelectorAll('canvas');
  cloneCanvases.forEach((cloneCanvas, index) => {
    const srcCanvas = sourceCanvases[index];
    if (!srcCanvas) return;
    try {
      cloneCanvas.width = srcCanvas.width;
      cloneCanvas.height = srcCanvas.height;
      const ctx = cloneCanvas.getContext('2d');
      if (ctx) ctx.drawImage(srcCanvas, 0, 0);
    } catch (err) {
      console.error('[buildDashboardPDF] canvas copy failed:', err);
    }
  });
}

async function waitForPaint() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function captureFullDashboard(html2canvas, clone) {
  const captureHeight = Math.max(clone.scrollHeight, 1);

  return html2canvas(clone, {
    scale: SCALE,
    width: CAPTURE_WIDTH,
    height: captureHeight,
    windowWidth: CAPTURE_WIDTH,
    windowHeight: captureHeight,
    useCORS: true,
    allowTaint: true,
    backgroundColor: SURFACE_BG,
    logging: false,
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());
      if (clonedDoc.body) scrubUnsupportedColorFunctions(clonedDoc.body);
    },
  });
}

function appendTiledPages(pdf, canvas) {
  const imgData = canvas.toDataURL('image/png', PNG_QUALITY);
  const imgW = CONTENT_W;
  const imgH = (canvas.height / canvas.width) * imgW;

  if (imgH <= CONTENT_H) {
    pdf.addImage(imgData, 'PNG', MARGIN, MARGIN, imgW, imgH);
    return 1;
  }

  let offset = 0;
  let pages = 0;
  while (offset < imgH) {
    if (pages > 0) pdf.addPage();
    pdf.addImage(imgData, 'PNG', MARGIN, MARGIN - offset, imgW, imgH);
    offset += CONTENT_H;
    pages += 1;
  }
  return pages;
}

export function slugifyFilename(text) {
  return String(text ?? 'export')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'export';
}

export function dashboardPdfFilename({ orgName, dashboardSlug }) {
  const date = new Date().toISOString().split('T')[0];
  return `${slugifyFilename(orgName)}-${dashboardSlug}-${date}.pdf`;
}

export async function buildDashboardPDF({ contentEl, filename }) {
  if (!contentEl) throw new Error('No dashboard content to export.');

  try {
    await waitForPaint();

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const { container, clone } = prepareClone(contentEl);

    try {
      const canvas = await captureFullDashboard(html2canvas, clone);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      appendTiledPages(pdf, canvas);
      pdf.save(filename);
    } finally {
      container.remove();
    }
  } catch (err) {
    console.error('[buildDashboardPDF]', err);
    throw err;
  }
}
