/**
 * Shared PDF page chrome — logos, footer, asset loading.
 */
export const AIS_LOGO_URL = '/icons/icon.svg';
export const AIS_SITE_FOOTER = 'app.athleteintelligencesystem.in';

export const PDF_PAGE = {
  W: 210,
  H: 297,
  MARGIN: 15,
  HEADER_H: 18,
  FOOTER_H: 10,
  GAP: 8,
};

export function pdfContentTop() {
  return PDF_PAGE.MARGIN + PDF_PAGE.HEADER_H + PDF_PAGE.GAP;
}

export function pdfContentBottom() {
  return PDF_PAGE.H - PDF_PAGE.MARGIN - PDF_PAGE.FOOTER_H - 4;
}

export function pdfContentWidth() {
  return PDF_PAGE.W - PDF_PAGE.MARGIN * 2;
}

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

export async function loadLogoData(url) {
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

export function drawPdfPageHeader(pdf, { teamLogo, aisLogo }) {
  const { MARGIN, W, HEADER_H } = PDF_PAGE;
  const y = MARGIN;
  const logoH = 12;
  const logoY = y + (HEADER_H - logoH) / 2;

  if (teamLogo?.base64 && teamLogo.dims?.w > 0) {
    const lw = Math.min((teamLogo.dims.w / teamLogo.dims.h) * logoH, 40);
    try {
      pdf.addImage(teamLogo.base64, imageFormat(teamLogo.base64), MARGIN, logoY, lw, logoH);
    } catch { /* skip */ }
  }

  if (aisLogo?.base64 && aisLogo.dims?.w > 0) {
    const lw = Math.min((aisLogo.dims.w / aisLogo.dims.h) * logoH, 40);
    try {
      pdf.addImage(aisLogo.base64, imageFormat(aisLogo.base64), W - MARGIN - lw, logoY, lw, logoH);
    } catch { /* skip */ }
  }

  pdf.setDrawColor('#dddddd');
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y + HEADER_H, W - MARGIN, y + HEADER_H);
}

export function drawPdfPageFooters(pdf, footerText = AIS_SITE_FOOTER) {
  const { MARGIN, W, H, FOOTER_H } = PDF_PAGE;
  const n = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= n; i += 1) {
    pdf.setPage(i);
    const y = H - MARGIN;
    pdf.setDrawColor('#dddddd');
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, y - FOOTER_H + 2, W - MARGIN, y - FOOTER_H + 2);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor('#666666');
    pdf.text(footerText, MARGIN, y - 3);
    pdf.text(`Page ${i} of ${n}`, W - MARGIN, y - 3, { align: 'right' });
  }
}

export function pdfText(pdf, str, x, y, size, style = 'normal', color = '#111111') {
  if (!str) return;
  pdf.setFont('helvetica', style);
  pdf.setFontSize(size);
  pdf.setTextColor(color);
  pdf.text(String(str), x, y);
}

export function pdfWrappedText(pdf, text, x, y, maxW, lineH, size = 10, color = '#333333') {
  if (!text) return y;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(size);
  pdf.setTextColor(color);
  const lines = pdf.splitTextToSize(String(text), maxW);
  lines.forEach((line, i) => pdf.text(line, x, y + i * lineH));
  return y + lines.length * lineH;
}
