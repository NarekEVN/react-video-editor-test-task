/**
 * Disable drag-to-reorder functionality for selection group segments
 * 
 * This file provides utilities to prevent segments from being dragged
 * to reorder them in the timeline when working with selection groups.
 */

import { Video } from "./editor/timeline/items";

/**
 * Lock horizontal movement for a track item
 * This prevents dragging to change order while still allowing resize
 */
export function lockTrackItemMovement(trackItem: any) {
  if (!trackItem) return;
  
  // Lock horizontal movement (X axis)
  // This prevents dragging left/right to reorder
  trackItem.lockMovementX = true;
  
  // Keep vertical movement locked (already default)
  //trackItem.lockMovementY = true;
  
  // Allow resizing (controls still work)
  trackItem.lockScalingX = false;
  trackItem.lockScalingY = false;
  
  // Mark as non-movable
  trackItem.movable = false;
  
  console.log('[DisableReorder] Locked movement for:', trackItem.id);
}

/**
 * Unlock horizontal movement for a track item
 */
export function unlockTrackItemMovement(trackItem: any) {
  if (!trackItem) return;
  
  trackItem.lockMovementX = false;
  trackItem.movable = true;
  
  console.log('[DisableReorder] Unlocked movement for:', trackItem.id);
}

/**
 * Lock all segments in timeline from being reordered
 */
export function lockAllSegments(timeline: any) {
  if (!timeline) return;
  
  const objects = timeline.getObjects();
  
  for (const obj of objects) {
    if (obj instanceof Video || obj instanceof Audio) {
      // Check if this track item is part of a selection group
      const segment = getSegmentForTrackItem(obj.id);
      if (segment) {
        lockTrackItemMovement(obj);
      }
    }
  }
  
  console.log('[DisableReorder] Locked all segment movements');
}

/**
 * Unlock all segments
 */
export function unlockAllSegments(timeline: any) {
  if (!timeline) return;
  
  const objects = timeline.getObjects();
  
  for (const obj of objects) {
    if (obj instanceof Video || obj instanceof Audio) {
      unlockTrackItemMovement(obj);
    }
  }
  
  console.log('[DisableReorder] Unlocked all segment movements');
}

/**
 * Get segment for a track item
 */
function getSegmentForTrackItem(trackItemId: string): any | null {
  if (typeof window === "undefined") return null;
  
  const store = (window as any).__selectionStore;
  if (!store?.segments) return null;
  
  return store.segments.find((seg: any) => seg.trackItem?.id === trackItemId) || null;
}

/**
 * Setup event listener to lock segments when they're added to timeline
 */
export function setupSegmentLockListener(timeline: any) {
  if (!timeline) return;
  
  // Listen for object:added events
  timeline.on('object:added', (e: any) => {
    const obj = e.target;
    
    if (obj instanceof Video || obj instanceof Audio) {
      // Check if this is a segment
      const segment = getSegmentForTrackItem(obj.id);
      if (segment) {
        lockTrackItemMovement(obj);
      }
    }
  });
  
  // Also lock on segments-changed event
  if (typeof window !== "undefined") {
    window.addEventListener('segments-changed', () => {
      lockAllSegments(timeline);
    });
  }
  
  console.log('[DisableReorder] Setup segment lock listener');
}