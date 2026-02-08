// src/features/editor/timeline/controls/segment-boundaries.ts
// ✅ Segment boundary validation for drag operations

import { Segment } from "../../store/use-selection-store";

interface BoundaryConstraints {
  minStart: number;
  maxEnd: number;
}

/**
 * Get boundary constraints for a segment
 * Returns min/max values that the segment can be resized to
 */
export const getSegmentBoundaries = (
  segmentId: string,
  segments: Segment[]
): BoundaryConstraints | null => {
  const currentSegment = segments.find((s) => s.id === segmentId);
  if (!currentSegment) return null;

  // Sort segments by start time
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);

  // Find current segment index
  const currentIndex = sortedSegments.findIndex((s) => s.id === segmentId);
  if (currentIndex === -1) return null;

  // Previous segment (if exists)
  const prevSegment = currentIndex > 0 ? sortedSegments[currentIndex - 1] : null;

  // Next segment (if exists)
  const nextSegment =
    currentIndex < sortedSegments.length - 1
      ? sortedSegments[currentIndex + 1]
      : null;

  return {
    // Can't start before previous segment ends
    minStart: prevSegment ? prevSegment.end : 0,

    // Can't end after next segment starts
    maxEnd: nextSegment ? nextSegment.start : Infinity,
  };
};

/**
 * Validate and constrain segment resize
 * Returns the constrained start/end values
 */
export const constrainSegmentResize = (
  segmentId: string,
  newStart: number,
  newEnd: number,
  segments: Segment[]
): { start: number; end: number } => {
  const boundaries = getSegmentBoundaries(segmentId, segments);

  if (!boundaries) {
    // No boundaries found, return as-is
    return { start: newStart, end: newEnd };
  }

  // Constrain start
  let constrainedStart = Math.max(newStart, boundaries.minStart);

  // Constrain end
  let constrainedEnd = Math.min(newEnd, boundaries.maxEnd);

  // Ensure start < end (minimum 100ms gap)
  const MIN_SEGMENT_DURATION = 100;
  if (constrainedEnd - constrainedStart < MIN_SEGMENT_DURATION) {
    // If we're hitting the boundary, adjust the other side
    if (newEnd >= boundaries.maxEnd) {
      // Hit max boundary, adjust start
      constrainedStart = constrainedEnd - MIN_SEGMENT_DURATION;
    } else if (newStart <= boundaries.minStart) {
      // Hit min boundary, adjust end
      constrainedEnd = constrainedStart + MIN_SEGMENT_DURATION;
    }
  }

  return {
    start: constrainedStart,
    end: constrainedEnd,
  };
};

/**
 * Check if a trackItem belongs to a segment
 */
export const getSegmentForTrackItem = (
  trackItemId: string
): Segment | null => {
  if (typeof window === "undefined") return null;

  const store = (window as any).__selectionStore;
  if (!store?.segments) return null;

  return (
    store.segments.find(
      (seg: Segment) => seg.trackItem?.id === trackItemId
    ) || null
  );
};

/**
 * Apply boundaries during resize
 * Call this from resize handlers
 */
export const applySegmentBoundaries = (
  trackItem: any,
  newDisplayFrom: number,
  newDisplayTo: number
) => {
  const segment = getSegmentForTrackItem(trackItem.id);
 
  if (!segment) {
    // Not a segment-controlled item, no constraints
    return { from: newDisplayFrom, to: newDisplayTo };
  }

  const store = (window as any).__selectionStore;
  if (!store?.segments) {
    return { from: newDisplayFrom, to: newDisplayTo };
  }

  // Get constrained values
  const constrained = constrainSegmentResize(
    segment.id,
    newDisplayFrom,
    newDisplayTo,
    store.segments
  );

  console.log("[Boundaries] Applied:", {
    original: { from: newDisplayFrom, to: newDisplayTo },
    constrained: constrained,
    segment: segment.name,
  });

  return constrained;
};