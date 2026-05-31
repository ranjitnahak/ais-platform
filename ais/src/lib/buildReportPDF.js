/**
 * Branded multi-page PDF export via paginated html2canvas + jsPDF.
 * Lazy-loads heavy deps on first use. Logos and footer are drawn per page in jsPDF
 * so browser print headers (URL, date/time) never appear.
 */

export const AIS_LOGO_URL = '/favicon.svg';
export const AIS_SITE_FOOTER = 'app.athleteintelligencesystem.in';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const HEADER_H = 18;
const FOOTER_H = 10;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2 - HEADER_H - FOOTER_H;

const CAPTURE_WIDTH = 680;
const SCALE = 1.5;
const JPEG_QUALITY = 0.92;

const MUTED = '#666666';
const BORDER = '#dddddd';
const TEXT = '#111111';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function urlToBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function rasterizeSvg(url, size = 128) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const svgText = await res.text();
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(blobUrl);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function loadLogoData(url) {
  if (!url) return { base64: null, dims: null };
  const isSvg = /\.svg($|\?)/i.test(url);
  const base64 = isSvg ? await rasterizeSvg(url) : await urlToBase64(url);
  if (!base64) return { base64: null, dims: null };
  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = base64;
  });
  return { base64, dims };
}

function imageFormat(base64) {
  if (base64?.startsWith('data:image/png')) return 'PNG';
  if (base64?.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function applyPrintStyles(root) {
  const nodes = [root, ...root.querySelectorAll('*')];
  nodes.forEach((el) => {
    if (el.tagName === 'IMG') return;
    el.style.color = TEXT;
    el.style.backgroundColor = '#ffffff';
    el.style.borderColor = BORDER;
  });
  root.querySelectorAll('[data-pdf-exclude]').forEach((el) => el.remove());
}

function prepareCaptureRoot(contentEl) {
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:0',
    'height:0',
    'overflow:hidden',
    'pointer-events:none',
  ].join(';');

  const clone = contentEl.cloneNode(true);
  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.background = '#ffffff';
  applyPrintStyles(clone);

  const viewport = document.createElement('div');
  viewport.style.width = `${CAPTURE_WIDTH}px`;
  viewport.style.overflow = 'hidden';
  viewport.style.background = '#ffffff';

  viewport.appendChild(clone);
  container.appendChild(viewport);
  document.body.appendChild(container);

  return { container, viewport, clone };
}

function drawPageHeader(pdf, { teamLogo, aisLogo }) {
  const y = MARGIN;
  const logoH = 12;
  const logoY = y + (HEADER_H - logoH) / 2;

  if (teamLogo.base64 && teamLogo.dims?.w > 0 && teamLogo.dims?.h > 0) {
    const lw = Math.min((teamLogo.dims.w / teamLogo.dims.h) * logoH, 40);
    try {
      pdf.addImage(teamLogo.base64, imageFormat(teamLogo.base64), MARGIN, logoY, lw, logoH);
    } catch { /* skip broken logo */ }
  }

  if (aisLogo.base64 && aisLogo.dims?.w > 0 && aisLogo.dims?.h > 0) {
    const lw = Math.min((aisLogo.dims.w / aisLogo.dims.h) * logoH, 40);
    try {
      pdf.addImage(
        aisLogo.base64,
        imageFormat(aisLogo.base64),
        PAGE_W - MARGIN - lw,
        logoY,
        lw,
        logoH,
      );
    } catch { /* skip broken logo */ }
  }

  pdf.setDrawColor(BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y + HEADER_H, PAGE_W - MARGIN, y + HEADER_H);
}

function drawPageFooter(pdf, pageNum, totalPages, footerText) {
  const y = PAGE_H - MARGIN;
  pdf.setDrawColor(BORDER);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y - FOOTER_H + 2, PAGE_W - MARGIN, y - FOOTER_H + 2);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED);
  pdf.text(footerText, MARGIN, y - 3);
  pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, y - 3, { align: 'right' });
}

async function captureSlice(html2canvas, viewport, clone, offsetY, sliceHeight) {
  clone.style.marginTop = `-${offsetY}px`;
  viewport.style.height = `${sliceHeight}px`;

  return html2canvas(viewport, {
    scale: SCALE,
    width: CAPTURE_WIDTH,
    height: sliceHeight,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
  });
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.contentEl — report DOM to capture (cloned off-screen)
 * @param {string} [opts.teamLogoUrl]
 * @param {string} [opts.aisLogoUrl='/favicon.svg']
 * @param {string} [opts.footerText='app.athleteintelligencesystem.in']
 * @param {string} opts.filename — saved PDF filename
 */
export async function buildReportPDF({
  contentEl,
  teamLogoUrl,
  aisLogoUrl = AIS_LOGO_URL,
  footerText = AIS_SITE_FOOTER,
  filename,
}) {
  if (!contentEl) throw new Error('No report content to export.');

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const [teamLogo, aisLogo] = await Promise.all([
    loadLogoData(teamLogoUrl),
    loadLogoData(aisLogoUrl),
  ]);

  const { container, viewport, clone } = prepareCaptureRoot(contentEl);

  try {
    const totalHeight = clone.scrollHeight;
    const chunkHeight = Math.max(1, Math.floor((CONTENT_H / CONTENT_W) * CAPTURE_WIDTH));

    const slices = [];
    for (let offsetY = 0; offsetY < totalHeight; offsetY += chunkHeight) {
      const sliceHeight = Math.min(chunkHeight, totalHeight - offsetY);
      const canvas = await captureSlice(html2canvas, viewport, clone, offsetY, sliceHeight);
      slices.push(canvas);
    }

    if (slices.length === 0) {
      const canvas = await captureSlice(html2canvas, viewport, clone, 0, Math.max(clone.scrollHeight, 1));
      slices.push(canvas);
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const totalPages = slices.length;
    const contentTop = MARGIN + HEADER_H + 2;

    slices.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();

      drawPageHeader(pdf, { teamLogo, aisLogo });

      const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const imgH = (canvas.height / canvas.width) * CONTENT_W;
      pdf.addImage(imgData, 'JPEG', MARGIN, contentTop, CONTENT_W, imgH);

      drawPageFooter(pdf, index + 1, totalPages, footerText);
    });

    pdf.save(filename);
  } finally {
    container.remove();
  }
}
