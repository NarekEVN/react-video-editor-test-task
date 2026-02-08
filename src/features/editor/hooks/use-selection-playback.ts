import { useCallback, useRef } from "react";
import { useSelectionStore, Segment } from "../store/use-selection-store";
import useStore from "../store/use-store";

const PAUSE_DURATION_MS = 500;

export function useSelectionPlayback() {
  const { playerRef, fps } = useStore();
  const isActiveRef = useRef(false);
  const currentSegmentIndexRef = useRef(0);
  const frameListenerRef = useRef<(() => void) | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const msToFrame = useCallback(
    (ms: number) => Math.round((ms / 1000) * fps),
    [fps],
  );

  const frameToMs = useCallback(
    (frame: number) => (frame / fps) * 1000,
    [fps],
  );

  const getSelectedSegmentsSorted = useCallback((): Segment[] => {
    const { segments, selectedSegmentIds } = useSelectionStore.getState();
    return segments
      .filter((s) => selectedSegmentIds.has(s.id))
      .sort((a, b) => a.start - b.start);
  }, []);

  const cleanup = useCallback(() => {
    const player = playerRef?.current;
    if (player && frameListenerRef.current) {
      player.removeEventListener("frameupdate", frameListenerRef.current as any);
      frameListenerRef.current = null;
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    isActiveRef.current = false;
  }, [playerRef]);

  const stop = useCallback(() => {
    const player = playerRef?.current;
    if (player?.isPlaying()) {
      player.pause();
    }
    cleanup();
  }, [playerRef, cleanup]);

  const startFrameMonitor = useCallback(
    (selectedSegments: Segment[], startIndex: number) => {
      const player = playerRef?.current;
      if (!player) return;

      if (frameListenerRef.current) {
        player.removeEventListener("frameupdate", frameListenerRef.current);
      }

      currentSegmentIndexRef.current = startIndex;

      const onFrame = () => {
        if (!isActiveRef.current) return;

        const currentFrame = player.getCurrentFrame();
        const currentTimeMs = frameToMs(currentFrame);
        const segIndex = currentSegmentIndexRef.current;
        const seg = selectedSegments[segIndex];

        if (!seg) {
          stop();
          return;
        }

        if (currentTimeMs >= seg.end - 1) {
          // Pause at the last frame of this segment
          player.pause();
          const lastFrame = msToFrame(seg.end);
          player.seekTo(lastFrame);

          const nextIndex = segIndex + 1;

          if (nextIndex < selectedSegments.length) {
            // Pause for 0.5s, then jump to next selected segment
            pauseTimeoutRef.current = setTimeout(() => {
              if (!isActiveRef.current) return;

              const nextSeg = selectedSegments[nextIndex];
              currentSegmentIndexRef.current = nextIndex;
              player.seekTo(msToFrame(nextSeg.start));

              // Small delay to let seek settle, then play
              requestAnimationFrame(() => {
                if (isActiveRef.current) {
                  player.play();
                }
              });
            }, PAUSE_DURATION_MS);
          } else {
            // Last segment finished — pause 0.5s then stop
            pauseTimeoutRef.current = setTimeout(() => {
              stop();
            }, PAUSE_DURATION_MS);
          }
        }
      };

      frameListenerRef.current = onFrame;
      player.addEventListener("frameupdate", onFrame);
    },
    [playerRef, frameToMs, msToFrame, stop],
  );

  /**
   * Main entry point: start playing selected segments.
   */
  const playSelectedSegments = useCallback(() => {
    const player = playerRef?.current;
    if (!player) return;

    // If already active, stop first
    if (isActiveRef.current) {
      stop();
      return;
    }

    const selectedSegments = getSelectedSegmentsSorted();
    if (selectedSegments.length === 0) return;

    isActiveRef.current = true;

    const currentFrame = player.getCurrentFrame();
    const currentTimeMs = frameToMs(currentFrame);

    // Find which selected segment to start from
    let startIndex = -1;

    // Check if playhead is inside a selected segment
    for (let i = 0; i < selectedSegments.length; i++) {
      const seg = selectedSegments[i];
      if (currentTimeMs >= seg.start && currentTimeMs < seg.end) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) {
      // Playhead is NOT inside any selected segment.
      // Find the next selected segment after the current position.
      for (let i = 0; i < selectedSegments.length; i++) {
        if (selectedSegments[i].start > currentTimeMs) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        // All selected segments are before current position — wrap to first
        startIndex = 0;
      }

      // Jump to the start of that segment
      const targetSeg = selectedSegments[startIndex];
      player.seekTo(msToFrame(targetSeg.start));
    }

    // Start frame monitoring and play
    startFrameMonitor(selectedSegments, startIndex);

    // Small delay after seek to let it settle
    requestAnimationFrame(() => {
      if (isActiveRef.current) {
        player.play();
      }
    });
  }, [playerRef, frameToMs, msToFrame, getSelectedSegmentsSorted, startFrameMonitor, stop]);

  return {
    playSelectedSegments,
    stopSelectionPlayback: stop,
    isSelectionPlaying: () => isActiveRef.current,
  };
}
