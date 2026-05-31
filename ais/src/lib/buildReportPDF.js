/**
 * Branded multi-page PDF export via paginated html2canvas + jsPDF.
 * Used for Team Reports. Staff Logs uses native-text buildStaffLogsPDF instead.
 */
import {
  AIS_LOGO_URL,
  AIS_SITE_FOOTER,
  drawPdfPageFooters,
  drawPdfPageHeader,
  loadLogoData,
  pdfContentTop,
  pdfContentWidth,
  PDF_PAGE,
} from './pdfPageChrome';

export { AIS_LOGO_URL, AIS_SITE_FOOTER };

const CONTENT_W = pdfContentWidth();
const CAPTURE_WIDTH = 680;
const SCALE = 1.5;
const JPEG_QUALITY = 0.92;
const TEXT = '#111111';
const BORDER = '#dddddd';

function maxContentImgH() {
  const top = pdfContentTop();
  return PDF_PAGE.H - PDF_PAGE.MARGIN - PDF_PAGE.FOOTER_H - 4 - top;
}

function domSliceHeightLimit() {
  return Math.floor((maxContentImgH() / CONTENT_W) * CAPTURE_WIDTH);
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
    'position:fixed', 'left:-10000px', 'top:0', 'width:0', 'height:0',
    'overflow:hidden', 'pointer-events:none',
  ].join(';');

  const clone = contentEl.cloneNode(true);
  clone.style.width = `${CAPTURE_WIDTH}px`;
  clone.style.boxSizing = 'border-box';
  clone.style.background = '#ffffff';
  clone.style.paddingTop = '8px';
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

function collectBreakBlocks(clone) {
  const blocks = [];
  function addEl(el) {
    if (!el) return;
    blocks.push({ top: el.offsetTop, height: el.offsetHeight, bottom: el.offsetTop + el.offsetHeight });
  }
  addEl(clone.querySelector(':scope > header'));
  clone.querySelectorAll(':scope > section').forEach((section) => {
    const articles = section.querySelectorAll(':scope > article');
    if (articles.length > 0) {
      addEl(section.querySelector(':scope > h2, :scope > h3'));
      articles.forEach((article) => addEl(article));
    } else {
      addEl(section);
    }
  });
  return blocks.filter((b) => b.height > 0);
}

function computeSliceRanges(clone, maxSliceHeight) {
  const blocks = collectBreakBlocks(clone);
  if (blocks.length === 0) {
    return [{ offsetY: 0, sliceHeight: Math.max(clone.scrollHeight, 1) }];
  }

  const ranges = [];
  let pageStart = blocks[0].top;
  let pageEnd = blocks[0].bottom;

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    const nextEnd = block.bottom;
    const nextHeight = nextEnd - pageStart;
    if (nextHeight > maxSliceHeight && pageEnd > pageStart) {
      ranges.push({ offsetY: pageStart, sliceHeight: pageEnd - pageStart });
      pageStart = block.top;
      pageEnd = block.bottom;
    } else {
      pageEnd = nextEnd;
    }
  }
  if (pageEnd > pageStart) {
    ranges.push({ offsetY: pageStart, sliceHeight: pageEnd - pageStart });
  }

  if (ranges[0]?.offsetY > 0 && ranges[0].offsetY < 8) {
    ranges[0].sliceHeight += ranges[0].offsetY;
    ranges[0].offsetY = 0;
  }

  return ranges;
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
    const maxImgH = maxContentImgH();
    const maxSliceHeight = domSliceHeightLimit();
    const sliceRanges = computeSliceRanges(clone, maxSliceHeight);

    const slices = [];
    for (const { offsetY, sliceHeight } of sliceRanges) {
      slices.push(await captureSlice(html2canvas, viewport, clone, offsetY, sliceHeight));
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const top = pdfContentTop();

    slices.forEach((canvas, index) => {
      if (index > 0) pdf.addPage();
      drawPdfPageHeader(pdf, { teamLogo, aisLogo });
      const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const rawImgH = (canvas.height / canvas.width) * CONTENT_W;
      const imgH = Math.min(rawImgH, maxImgH);
      pdf.addImage(imgData, 'JPEG', PDF_PAGE.MARGIN, top, CONTENT_W, imgH);
    });

    drawPdfPageFooters(pdf, footerText);
    pdf.save(filename);
  } finally {
    container.remove();
  }
}
