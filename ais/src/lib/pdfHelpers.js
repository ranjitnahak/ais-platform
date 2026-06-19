/**
 * Shared PDF asset loading and low-level jsPDF drawing primitives.
 * Used by buildPeriodisationPDF, buildAssessmentPDF, and export orchestrators.
 */

/** Convert a remote URL to a base64 data URL. Returns null on any error. */
export async function urlToBase64(url) {
  try {
    const res = await fetch(url, {
      mode: 'cors',
      cache: 'no-cache',
    });
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

/** Crop a base64 image into a circle and return a PNG base64. Falls back to original on error. */
export async function cropToCircle(base64) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        ctx.drawImage(img, -offsetX, -offsetY);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    } catch {
      resolve(base64);
    }
  });
}

/** Return the natural pixel dimensions of a base64 image. Returns null on error. */
export async function getBase64Dims(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

function imageFormat(base64) {
  if (base64?.startsWith('data:image/png')) return 'PNG';
  if (base64?.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

export function pdfFillRect(pdf, x, y, w, h, hex) {
  pdf.setFillColor(hex);
  pdf.rect(x, y, w, h, 'F');
}

export function pdfLine(pdf, x1, y1, x2, y2, hex = '#e5e7eb', lw = 0.2) {
  pdf.setLineWidth(lw);
  pdf.setDrawColor(hex);
  pdf.line(x1, y1, x2, y2);
}

export function pdfText(pdf, str, x, y, size, hex, fontStyle = 'normal', opts = {}) {
  if (str == null || str === '') return;
  pdf.setFont('helvetica', fontStyle);
  pdf.setFontSize(size);
  pdf.setTextColor(hex);
  pdf.text(String(str), x, y, { baseline: 'middle', ...opts });
}

/**
 * Draw a circular athlete photo with an optional coloured border ring.
 * @param {import('jspdf').jsPDF} pdf
 * @param {{ base64: string|null, x: number, y: number, sizeMm: number, borderHex?: string, initials?: string, initialsColor?: string, initialsBg?: string }} opts
 */
export function drawCircularPhoto(pdf, {
  base64,
  x,
  y,
  sizeMm,
  borderHex = '#f97316',
  initials = '',
  initialsColor = '#3730a3',
  initialsBg = '#e0e7ff',
}) {
  const cx = x + sizeMm / 2;
  const cy = y + sizeMm / 2;
  const circleR = sizeMm / 2 + 0.5;

  if (base64) {
    try {
      pdf.addImage(base64, imageFormat(base64), x, y, sizeMm, sizeMm);
    } catch {
      try {
        pdf.addImage(base64, 'PNG', x, y, sizeMm, sizeMm);
      } catch { /* fall through to initials */ }
    }
  }

  if (!base64 && initials) {
    pdf.setFillColor(initialsBg);
    pdf.circle(cx, cy, circleR - 0.5, 'F');
    pdfText(pdf, initials, cx, cy, sizeMm * 0.55, initialsColor, 'bold', { align: 'center' });
  }

  pdf.setDrawColor(borderHex);
  pdf.setLineWidth(0.5);
  pdf.circle(cx, cy, circleR, 'S');
}
