import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-screen image viewer with zoom + pan — used wherever a member's profile
 * photo is shown too small to identify a face (Members list, member profile,
 * payment cards). Opening it is the only way an admin can confirm the person
 * in front of them is the person on the card, so every interaction an admin
 * would reach for is supported:
 *
 *   - wheel / trackpad pinch  → zoom around the cursor
 *   - two-finger pinch        → zoom around the midpoint of the two fingers
 *   - drag (mouse or touch)   → pan, once zoomed in
 *   - double click / tap      → toggle between fit and 2.5x
 *   - + / - / 0 / Escape      → zoom in, zoom out, reset, close
 *
 * Panning is only enabled above 1x, so a tap on the backdrop still closes the
 * viewer at rest instead of being swallowed by an invisible drag surface.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const ImageZoomModal = ({ src, alt = "", caption = "", onClose }) => {
  // Scale and pan live in ONE state object. They are updated together on every
  // zoom (the pixel under the cursor has to stay put, which moves the offset
  // as the scale changes), and two separate setStates cannot do that without
  // nesting one inside the other's updater — a side effect React re-runs under
  // StrictMode, which would apply the pan twice.
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  // True while a finger or the mouse button is down: kills the CSS transition
  // so panning tracks the pointer instead of easing behind it.
  const [interacting, setInteracting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);
  // Active pointers, keyed by pointerId — one entry is a drag, two are a pinch.
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const dragRef = useRef(null);

  const { scale } = view;

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  // Zoom around a fixed point (cursor or pinch midpoint) so the pixel under
  // the pointer stays under the pointer — anything else feels like the image
  // is sliding away from the face you are trying to look at.
  const zoomAround = useCallback((nextScale, clientX, clientY) => {
    setView((prev) => {
      const target = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      if (target === prev.scale) return prev;
      if (target === MIN_SCALE) return { scale: MIN_SCALE, x: 0, y: 0 };

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...prev, scale: target };

      const originX = clientX - rect.left - rect.width / 2;
      const originY = clientY - rect.top - rect.height / 2;
      const ratio = target / prev.scale;
      return {
        scale: target,
        x: originX - (originX - prev.x) * ratio,
        y: originY - (originY - prev.y) * ratio,
      };
    });
  }, []);

  const zoomBy = useCallback(
    (factor) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : 0;
      const cy = rect ? rect.top + rect.height / 2 : 0;
      zoomAround(scale * factor, cx, cy);
    },
    [scale, zoomAround],
  );

  // Keyboard + body scroll lock while the viewer owns the screen.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "+" || e.key === "=") zoomBy(1.4);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.4);
      else if (e.key === "0") reset();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, zoomBy, reset]);

  // Wheel has to be bound natively: React's onWheel is passive, so it cannot
  // preventDefault and the page (or the browser) would zoom instead.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoomAround(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [scale, zoomAround]);

  const pointerDistance = (points) => {
    const [a, b] = points;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const handlePointerDown = (e) => {
    const pointers = pointersRef.current;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setInteracting(true);

    if (pointers.size === 2) {
      const points = [...pointers.values()];
      pinchRef.current = { distance: pointerDistance(points), scale };
      dragRef.current = null;
    } else if (pointers.size === 1 && scale > MIN_SCALE) {
      dragRef.current = { x: e.clientX - view.x, y: e.clientY - view.y };
    }
  };

  const handlePointerMove = (e) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2 && pinchRef.current) {
      const points = [...pointers.values()].slice(0, 2);
      const distance = pointerDistance(points);
      if (pinchRef.current.distance > 0) {
        const midX = (points[0].x + points[1].x) / 2;
        const midY = (points[0].y + points[1].y) / 2;
        zoomAround(
          pinchRef.current.scale * (distance / pinchRef.current.distance),
          midX,
          midY,
        );
      }
      return;
    }

    if (dragRef.current) {
      const { x: startX, y: startY } = dragRef.current;
      setView((prev) => ({
        ...prev,
        x: e.clientX - startX,
        y: e.clientY - startY,
      }));
    }
  };

  const endPointer = (e) => {
    const pointers = pointersRef.current;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchRef.current = null;
    if (pointers.size === 0) {
      dragRef.current = null;
      setInteracting(false);
    }
  };

  const handleDoubleClick = (e) => {
    if (scale > MIN_SCALE) reset();
    else zoomAround(DOUBLE_TAP_SCALE, e.clientX, e.clientY);
  };

  const zoomed = scale > MIN_SCALE;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Member photo"}
    >
      {/* Top bar: who this is, and the way out */}
      <div className="flex items-start justify-between gap-3 p-4 text-white flex-shrink-0">
        <div className="min-w-0">
          {caption && <p className="font-semibold truncate">{caption}</p>}
          <p className="text-xs text-gray-400 mt-0.5">
            Scroll or pinch to zoom · drag to move · double-click to reset
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="p-2 -mr-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition flex-shrink-0"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stage. A click on the empty area closes; a click on the photo does not. */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => {
          if (e.target === e.currentTarget && !zoomed) onClose?.();
        }}
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center touch-none select-none"
        style={{ cursor: zoomed ? (interacting ? "grabbing" : "grab") : "zoom-in" }}
      >
        {!loaded && (
          <div className="absolute animate-spin rounded-full h-10 w-10 border-b-2 border-white/70" />
        )}
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          className="max-w-[92vw] max-h-full object-contain rounded-lg shadow-2xl"
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${scale})`,
            transition: interacting ? "none" : "transform 150ms ease-out",
            opacity: loaded ? 1 : 0,
          }}
        />
      </div>

      {/* Zoom controls — a phone has no scroll wheel, so they are not optional */}
      <div className="flex-shrink-0 flex items-center justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-full p-1 backdrop-blur">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.4)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="w-10 h-10 rounded-full text-white hover:bg-white/15 transition disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0zM8 11h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-3 h-10 rounded-full text-white text-sm font-medium tabular-nums hover:bg-white/15 transition"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.4)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="w-10 h-10 rounded-full text-white hover:bg-white/15 transition disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0zM11 8v6M8 11h6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageZoomModal;
