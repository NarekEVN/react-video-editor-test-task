//@ts-nocheck
import { controlsUtils, Control, resize } from "@designcombo/timeline";
import {
  drawVerticalLeftIcon,
  drawVerticalLine,
  drawVerticalRightIcon,
} from "./draw";
import {
  applySegmentBoundaries,
  getSegmentForTrackItem,
} from "./segment-boundaries";

const { scaleSkewCursorStyleHandler } = controlsUtils;

// ─── Dwell-to-zoom detection ───
// When user holds the drag handle still for 2s, fire an event to trigger max zoom.
let dwellTimer: ReturnType<typeof setTimeout> | null = null;
let lastDragTimeMs: number | null = null;
let dwellFired = false;

const DWELL_THRESHOLD_MS = 2000;

function resetDwell() {
  if (dwellTimer) {
    clearTimeout(dwellTimer);
    dwellTimer = null;
  }
  lastDragTimeMs = null;
  dwellFired = false;
}

function onDragMove(previewTimeMs: number | undefined) {
  if (typeof window === "undefined") return;
  if (dwellFired) return; // already zoomed in, don't restart

  // Restart the dwell timer on every move
  if (dwellTimer) clearTimeout(dwellTimer);
  lastDragTimeMs = previewTimeMs ?? null;

  dwellTimer = setTimeout(() => {
    // 2s passed without any new move → fire dwell event
    dwellFired = true;
    window.dispatchEvent(
      new CustomEvent("resize-dwell-zoom", {
        detail: { previewTimeMs: lastDragTimeMs },
      }),
    );
  }, DWELL_THRESHOLD_MS);
}

function onDragEnd() {
  if (typeof window === "undefined") return;
  const wasDwellZoomed = dwellFired;
  resetDwell();
  if (wasDwellZoomed) {
    window.dispatchEvent(new CustomEvent("resize-dwell-zoom-end"));
  }
}

// Listen for mouseup globally to detect drag end
if (typeof window !== "undefined") {
  window.addEventListener("mouseup", onDragEnd);
}

const updateSegmentAfterResize = (trackItem, side?: "start" | "end") => {
  if (!trackItem?.id || !side) return;

  const segment = getSegmentForTrackItem(trackItem.id);
  if (!segment) return;

  const isMedia = trackItem.type === "video" || trackItem.type === "audio";
  const newFrom = isMedia
    ? (trackItem.trim?.from ?? 0)
    : (trackItem.display?.from ?? 0);
  const newTo = isMedia
    ? (trackItem.trim?.to ?? 0)
    : (trackItem.display?.to ?? 0);

  if (segment.start === newFrom && segment.end === newTo) {
    return;
  }

  const previewTime =
    side === "start" ? newFrom : side === "end" ? newTo : undefined;

  if (typeof window === "undefined") return;

  const store = (window as any).__selectionStore;

  if (!store?.updateSegment) return;

  store.updateSegment(segment.id, {
    start: newFrom,
    end: newTo,
  });

  window.dispatchEvent(
    new CustomEvent("resize-frame", {
      detail: {
        from: newFrom,
        to: newTo,
        previewTime,
        side,
        segment,
      },
    }),
  );

  // Feed the dwell detector with the current drag position
  onDragMove(previewTime);
};

const getSelectionStore = () =>
  typeof window !== "undefined" ? (window as any).__selectionStore : null;

export const getPrevNextSelectedSegments = (segmentId: string) => {
  const store = getSelectionStore();

  if (!store) return { prev: null, next: null };

  const segments = store.segments || [];

  if (segments.length <= 1) return { prev: null, next: null };

  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const index = segments.findIndex((s) => s.id === segmentId);

  return {
    prev: index > 0 ? sorted[index - 1] : null,
    next: index >= 0 ? sorted[index + 1] : null,
  };
};

const resizeMediaWithBoundaries: typeof resize.media = (...args) => {
  const e = args[1];
  const delta = args[2];

  if (!e || !e.target) {
    return resize.media(...args);
  }

  const target = e.target;

  const side =
    e.corner === "ml" ? "start" : e.corner === "mr" ? "end" : undefined;

  if (!side) {
    return resize.media(...args);
  }

  const { prev, next } = getPrevNextSelectedSegments(target.id);

  // Use display values for timeline position, not trim values
  const currentDisplayFrom = target.display?.from ?? 0;
  const currentDisplayTo = target.display?.to ?? 0;

  if (prev) {
    const previewFrom = currentDisplayFrom + delta;

    if (previewFrom <= prev.end) {
      return;
    }
  }

  if (next) {
    const previewTo = currentDisplayTo + delta;
    if (previewTo >= next.start) {
      return;
    }
  }

  const originalTop = target.top;
  const originalTrackId = target.trackId;
  if (target.canvas) {
    target.canvas.requestRenderAll();
  }
  
  const result = resize.media(...args);

  if (result) {
    if (target.top !== originalTop) {
      target.set({ top: originalTop });
    }

    if (target.trackId !== originalTrackId) {
      target.trackId = originalTrackId;
    }
   
    updateSegmentAfterResize(target, side);
  }

  return result;
};

/**
 * Common resize handler with boundaries
 */
const resizeCommonWithBoundaries: typeof resize.common = (...args) => {
  const e = args[1]; // Timeline event

  if (!e || !e.target) {
    return resize.common(...args);
  }

  const target = e.target;

  const originalTop = target.top;
  const originalTrackId = target.trackId;

  const result = resize.common(...args);

  if (result && e.target) {
    if (target.top !== originalTop) {
      target.set({ top: originalTop });
      if (target.canvas) {
        target.canvas.requestRenderAll();
      }
    }

    if (target.trackId !== originalTrackId) {
      target.trackId = originalTrackId;
    }

    const newFrom = target.display?.from ?? 0;
    const newTo = target.display?.to ?? 0;
    const constrained = applySegmentBoundaries(target, newFrom, newTo);

    if (constrained.from !== newFrom || constrained.to !== newTo) {
      target.set("display", {
        from: constrained.from,
        to: constrained.to,
      });

      if (target.canvas) {
        target.canvas.requestRenderAll();
      }
    }

    updateSegmentAfterResize(target);
  }

  return result;
};

/**
 * Audio resize handler with boundaries
 */
const resizeAudioWithBoundaries: typeof resize.audio = (...args) => {
  const e = args[1]; // Timeline event

  if (!e || !e.target) {
    return resize.audio(...args);
  }

  const target = e.target;

  const originalTop = target.top;
  const originalTrackId = target.trackId;

  const result = resize.audio(...args);

  if (result && e.target) {

    if (target.top !== originalTop) {
      target.set({ top: originalTop });
      if (target.canvas) {
        target.canvas.requestRenderAll();
      }
    }

    if (target.trackId !== originalTrackId) {
      target.trackId = originalTrackId;
    }

    const newFrom = target.display?.from ?? 0;
    const newTo = target.display?.to ?? 0;
    const constrained = applySegmentBoundaries(target, newFrom, newTo);

    if (constrained.from !== newFrom || constrained.to !== newTo) {
      target.set("display", {
        from: constrained.from,
        to: constrained.to,
      });

      if (target.canvas) {
        target.canvas.requestRenderAll();
      }
    }

    updateSegmentAfterResize(target);
  }

  return result;
};

export const createResizeControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    render: drawVerticalRightIcon,
    actionHandler: resizeCommonWithBoundaries,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
    offsetX: 10,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    actionHandler: resizeCommonWithBoundaries,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    render: drawVerticalLeftIcon,
    sizeX: 20,
    sizeY: 32,
    offsetX: -10,
  }),
});

export const createAudioControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    render: drawVerticalRightIcon,
    actionHandler: resizeAudioWithBoundaries,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
    offsetX: 10,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    render: drawVerticalLeftIcon,
    actionHandler: resizeAudioWithBoundaries,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
    offsetX: -10,
  }),
});

export const createMediaControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    actionHandler: resizeMediaWithBoundaries,
    render: drawVerticalRightIcon,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
    offsetX: 10,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    render: drawVerticalLeftIcon,
    actionHandler: resizeMediaWithBoundaries,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    sizeX: 20,
    sizeY: 32,
    offsetX: -10,
  }),
});

export const createTransitionControls = () => ({
  mr: new Control({
    x: 0.5,
    y: 0,
    actionHandler: resize.transition,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    render: drawVerticalLine,
  }),
  ml: new Control({
    x: -0.5,
    y: 0,
    actionHandler: resize.transition,
    cursorStyleHandler: scaleSkewCursorStyleHandler,
    actionName: "resizing",
    render: drawVerticalLine,
  }),
});
