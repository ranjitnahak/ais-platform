import { useState, useEffect, useRef } from 'react';

const PREVIEW_SIZE = 300;
const EXPORT_SIZE  = 600; // higher-res export for quality

/**
 * Props:
 *   file     — raw File object selected by the user
 *   onCancel — () => void
 *   onCrop   — (blob: Blob) => void  (JPEG blob of the cropped circle)
 */
export default function ImageCropModal({ file, onCancel, onCrop }) {
  const canvasRef  = useRef(null);
  const imgRef     = useRef(null);
  const moveRef    = useRef(null);
  const upRef      = useRef(null);
  const dragRef    = useRef(null); // touch state

  const [loaded, setLoaded] = useState(false);
  const [zoom,   setZoom]   = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // ── Load image ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.src = url;
    return () => {
      URL.revokeObjectURL(url);
      // clean up any lingering listeners
      if (upRef.current) upRef.current();
    };
  }, [file]);

  // ── Redraw canvas ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const R = PREVIEW_SIZE / 2;
    const baseScale = Math.max(PREVIEW_SIZE / img.naturalWidth, PREVIEW_SIZE / img.naturalHeight);
    const scale = baseScale * zoom;
    const dx = R - (img.naturalWidth  * scale) / 2 + offset.x;
    const dy = R - (img.naturalHeight * scale) / 2 + offset.y;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.restore();
  }, [loaded, zoom, offset]);

  // ── Mouse drag ──────────────────────────────────────────────────────────────
  function onMouseDown(e) {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startOX = offset.x, startOY = offset.y;

    moveRef.current = (ev) => {
      setOffset({ x: startOX + ev.clientX - startX, y: startOY + ev.clientY - startY });
    };
    upRef.current = () => {
      window.removeEventListener('mousemove', moveRef.current);
      window.removeEventListener('mouseup',   upRef.current);
    };
    window.addEventListener('mousemove', moveRef.current);
    window.addEventListener('mouseup',   upRef.current);
  }

  // ── Touch drag ──────────────────────────────────────────────────────────────
  function onTouchStart(e) {
    const t = e.touches[0];
    dragRef.current = { startX: t.clientX, startY: t.clientY, startOX: offset.x, startOY: offset.y };
  }
  function onTouchMove(e) {
    if (!dragRef.current) return;
    const t = e.touches[0];
    const { startX, startY, startOX, startOY } = dragRef.current;
    setOffset({ x: startOX + t.clientX - startX, y: startOY + t.clientY - startY });
  }
  function onTouchEnd() { dragRef.current = null; }

  // ── Crop & export ───────────────────────────────────────────────────────────
  function handleCrop() {
    const img = imgRef.current;
    if (!img) return;
    const offscreen = document.createElement('canvas');
    offscreen.width  = EXPORT_SIZE;
    offscreen.height = EXPORT_SIZE;
    const ctx   = offscreen.getContext('2d');
    const R     = EXPORT_SIZE / 2;
    const ratio = EXPORT_SIZE / PREVIEW_SIZE;
    const baseScale = Math.max(PREVIEW_SIZE / img.naturalWidth, PREVIEW_SIZE / img.naturalHeight);
    const scale = baseScale * zoom * ratio;
    const dx = R - (img.naturalWidth  * scale) / 2 + offset.x * ratio;
    const dy = R - (img.naturalHeight * scale) / 2 + offset.y * ratio;

    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.restore();

    offscreen.toBlob((blob) => onCrop(blob), 'image/jpeg', 0.92);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        backgroundColor: '#1b1b1d',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Header */}
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#a78b7d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Photo
          </div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', textTransform: 'uppercase' }}>
            Adjust Photo
          </div>
        </div>

        {/* Preview canvas / loader */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {!loaded ? (
            <div style={{
              width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: '50%',
              backgroundColor: '#2a2a2c', border: '3px solid #F97316',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ color: '#F97316', fontSize: '32px', animation: 'spin 1s linear infinite' }}>refresh</span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              style={{
                borderRadius: '50%',
                border: '3px solid #F97316',
                cursor: 'grab',
                userSelect: 'none',
                touchAction: 'none',
              }}
              onMouseDown={onMouseDown}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Zoom</span>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#a78b7d' }}>{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min="50" max="200" step="1"
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#F97316', cursor: 'pointer' }}
          />
        </div>

        {/* Hint */}
        <p style={{ fontSize: '10px', color: '#6b7280', textAlign: 'center', margin: '-8px 0' }}>
          Drag to reposition · Slide to zoom
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px',
              backgroundColor: '#353437',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: '#e4e2e4',
              fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
              cursor: 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCrop}
            disabled={!loaded}
            style={{
              flex: 2, padding: '12px',
              background: loaded ? 'linear-gradient(135deg, #FFB690, #F97316)' : '#555',
              border: 'none',
              borderRadius: '8px',
              color: '#552100',
              fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
              cursor: loaded ? 'pointer' : 'not-allowed',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Crop & Save
          </button>
        </div>
      </div>
    </div>
  );
}
