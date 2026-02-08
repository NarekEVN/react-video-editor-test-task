import { useEffect, useRef, useState } from "react";
import Header from "./header";
import Ruler from "./ruler";
import { timeMsToUnits, unitsToTimeMs } from "@designcombo/timeline";
import CanvasTimeline from "./items/timeline";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { dispatch, filter, subject } from "@designcombo/events";
import {
  TIMELINE_BOUNDING_CHANGED,
  TIMELINE_PREFIX,
} from "@designcombo/timeline";
import { TIMELINE_SCALE_CHANGED } from "@designcombo/state";
import useStore from "../store/use-store";
import { TIMELINE_ZOOM_LEVELS } from "../constants/scale";
import Playhead from "./playhead";
import { useCurrentPlayerFrame } from "../hooks/use-current-frame";
import {
  Audio,
  Image,
  Text,
  Video,
  Caption,
  Helper,
  Track,
  LinealAudioBars,
  RadialAudioBars,
  WaveAudioBars,
  HillAudioBars,
} from "./items";
import StateManager from "@designcombo/state";
import {
  TIMELINE_OFFSET_CANVAS_LEFT,
  TIMELINE_OFFSET_CANVAS_RIGHT,
} from "../constants/constants";
import PreviewTrackItem from "./items/preview-drag-item";
import { useTimelineOffsetX } from "../hooks/use-timeline-offset";
import { useStateManagerEvents } from "../hooks/use-state-manager-events";
import { setupSegmentLockListener } from "@/features/disable-segment-reorder";

CanvasTimeline.registerItems({
  Text,
  Image,
  Audio,
  Video,
  Caption,
  Helper,
  Track,
  PreviewTrackItem,
  LinealAudioBars,
  RadialAudioBars,
  WaveAudioBars,
  HillAudioBars,
});

const EMPTY_SIZE = { width: 0, height: 0 };

const Timeline = ({ stateManager }: { stateManager: StateManager }) => {
  const canScrollRef = useRef(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<CanvasTimeline | null>(null);
  const verticalScrollbarVpRef = useRef<HTMLDivElement>(null);
  const horizontalScrollbarVpRef = useRef<HTMLDivElement>(null);
  const { scale, playerRef, fps, duration, timeline } = useStore();
  const currentFrame = useCurrentPlayerFrame(playerRef);
  const [canvasSize, setCanvasSize] = useState(EMPTY_SIZE);
  const [size, setSize] = useState<{ width: number; height: number }>(
    EMPTY_SIZE,
  );
  const timelineOffsetX = useTimelineOffsetX();
  const { setTimeline } = useStore();

  const [isResizingVideo, setIsResizingVideo] = useState(false);
  const originalPlayheadFrame = useRef<number | null>(null);
  const lastPreviewTime = useRef<number>(0);

  useStateManagerEvents(stateManager);

  const onScroll = (v: { scrollTop: number; scrollLeft: number }) => {
    if (horizontalScrollbarVpRef.current && verticalScrollbarVpRef.current) {
      verticalScrollbarVpRef.current.scrollTop = -v.scrollTop;
      horizontalScrollbarVpRef.current.scrollLeft = -v.scrollLeft;
      setScrollLeft(-v.scrollLeft);
    }
  };

  useEffect(() => {
    if (playerRef?.current) {
      canScrollRef.current = playerRef?.current.isPlaying();
    }
  }, [playerRef?.current?.isPlaying()]);

  useEffect(() => {
    const position = timeMsToUnits((currentFrame / fps) * 1000, scale.zoom);
    const canvasEl = canvasElRef.current;
    const horizontalScrollbar = horizontalScrollbarVpRef.current;

    if (!canvasEl || !horizontalScrollbar) return;

    const canvasBoudingX =
      canvasEl.getBoundingClientRect().x + canvasEl.clientWidth;
    const playHeadPos = position - scrollLeft + 40;
    if (playHeadPos >= canvasBoudingX) {
      const scrollDivWidth = horizontalScrollbar.clientWidth;
      const totalScrollWidth = horizontalScrollbar.scrollWidth;
      const currentPosScroll = horizontalScrollbar.scrollLeft;
      const availableScroll =
        totalScrollWidth - (scrollDivWidth + currentPosScroll);
      const scaleScroll = availableScroll / scrollDivWidth;
      if (scaleScroll >= 0) {
        if (scaleScroll > 1)
          horizontalScrollbar.scrollTo({
            left: currentPosScroll + scrollDivWidth,
          });
        else
          horizontalScrollbar.scrollTo({
            left: totalScrollWidth - scrollDivWidth,
          });
      }
    }
  }, [currentFrame]);

  const onResizeCanvas = (payload: { width: number; height: number }) => {
    setCanvasSize({
      width: payload.width,
      height: payload.height,
    });
  };

  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const timelineContainerEl = timelineContainerRef.current;

    if (!canvasEl || !timelineContainerEl) return;

    const containerWidth = timelineContainerEl.clientWidth - 40;
    const containerHeight = timelineContainerEl.clientHeight - 90;
    const canvas = new CanvasTimeline(canvasEl, {
      width: containerWidth,
      height: containerHeight,
      bounding: {
        width: containerWidth,
        height: 0,
      },
      selectionColor: "rgba(0, 216, 214,0.1)",
      selectionBorderColor: "rgba(0, 216, 214,1.0)",
      guideLineColor: "#fff",
      onScroll,
      onResizeCanvas,
      scale: scale,
      state: stateManager,
      duration,
      spacing: {
        left: TIMELINE_OFFSET_CANVAS_LEFT,
        right: TIMELINE_OFFSET_CANVAS_RIGHT,
      },
      sizesMap: {
        caption: 32,
        text: 32,
        audio: 36,
        video: 60,
        customTrack: 40,
        customTrack2: 40,
        linealAudioBars: 40,
        radialAudioBars: 40,
        waveAudioBars: 40,
        hillAudioBars: 40,
      },
      selection: false,
      itemTypes: ["video"],
      acceptsMap: {
        video: ["video", "image"],
      },
    });

    canvasRef.current = canvas;

    setCanvasSize({ width: containerWidth, height: containerHeight });
    setSize({
      width: containerWidth,
      height: 0,
    });
    setTimeline(canvas);
    // Setup listener to lock segment movements (disable drag-to-reorder)
    setupSegmentLockListener(canvas);

    return () => {
      canvas.purge();
    };
  }, []);

  useEffect(() => {
    const resizeFrame = (e: CustomEvent) => {
      if (typeof e.detail.previewTime !== "number") return;

      const frame = Math.round((e.detail.previewTime / 1000) * fps);

      playerRef?.current.seekTo(frame);
    };

    window.addEventListener("resize-frame", resizeFrame as EventListener);

    return () => {
      window.removeEventListener("resize-frame", resizeFrame as EventListener);
    };
  }, [playerRef, fps]);

  const handleOnScrollH = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (canScrollRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.scrollTo({ scrollLeft });
      }
    }
    setScrollLeft(scrollLeft);
  };

  const handleOnScrollV = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (canScrollRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.scrollTo({ scrollTop });
      }
    }
  };

  useEffect(() => {
    const addEvents = subject.pipe(
      filter(({ key }) => key.startsWith(TIMELINE_PREFIX)),
    );

    const subscription = addEvents.subscribe((obj) => {
      if (obj.key === TIMELINE_BOUNDING_CHANGED) {
        const bounding = obj.value?.payload?.bounding;
        if (bounding) {
          setSize({
            width: bounding.width,
            height: bounding.height,
          });
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isResizingVideo) return;

    const timelineEvents = subject.pipe(
      filter(({ key }) => key.startsWith("timeline:")),
    );

    const subscription = timelineEvents.subscribe((event) => {
      if (
        event.key.includes("item:update") ||
        event.key.includes("item:change")
      ) {
        const item = event.value?.payload?.item || event.value?.payload;
        if (!item || !item.display) return;

        if (!playerRef?.current) return;

        // Throttle preview updates (every 50ms)
        const now = Date.now();
        if (now - lastPreviewTime.current < 50) return;
        lastPreviewTime.current = now;

        try {
          // Show preview of end time (when dragging right edge)
          const previewTimeMs = item.display.to;
          const previewFrame = (previewTimeMs / 1000) * fps;

          playerRef.current.seekTo(previewFrame / fps);

          const timeEl = document.getElementById("video-current-time");
          if (timeEl) {
            timeEl.setAttribute(
              "data-current-time",
              String(previewTimeMs / 1000),
            );
          }

          console.log(
            "[ResizePreview] Preview frame:",
            Math.round(previewFrame),
          );
        } catch (error) {
          console.warn("[ResizePreview] Preview error:", error);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isResizingVideo, playerRef, fps]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isResizingVideo) {
        console.log("[ResizePreview] Mouse up - restoring");

        if (originalPlayheadFrame.current !== null && playerRef?.current) {
          try {
            playerRef.current.seekTo(originalPlayheadFrame.current / fps);
            console.log(
              "[ResizePreview] Restored to:",
              originalPlayheadFrame.current,
            );
          } catch (error) {
            console.warn("[ResizePreview] Restore error:", error);
          }
        }

        setIsResizingVideo(false);
        originalPlayheadFrame.current = null;
      }
    };

    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingVideo, playerRef, fps]);

  // ─── Dwell-to-zoom: zoom to max when user holds handle still for 2s ───
  const preDwellScaleRef = useRef<typeof scale | null>(null);
  const preDwellScrollRef = useRef<number>(0);

  useEffect(() => {
    const MAX_ZOOM = TIMELINE_ZOOM_LEVELS[TIMELINE_ZOOM_LEVELS.length - 1];

    const handleDwellZoom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const previewTimeMs = detail?.previewTimeMs;

      // Save current zoom & scroll before zooming
      preDwellScaleRef.current = { ...scale };
      preDwellScrollRef.current = horizontalScrollbarVpRef.current?.scrollLeft ?? 0;

      console.log("[DwellZoom] Zooming to max. previewTime:", previewTimeMs);

      // Zoom to maximum level
      dispatch(TIMELINE_SCALE_CHANGED, {
        payload: { scale: MAX_ZOOM },
      });

      // After zoom settles, center on the drag point
      setTimeout(() => {
        if (typeof previewTimeMs === "number" && timeline) {
          const positionAtMax = timeMsToUnits(previewTimeMs, MAX_ZOOM.zoom);
          const viewportWidth = canvasElRef.current?.clientWidth ?? 0;
          const targetScroll = Math.max(0, positionAtMax - viewportWidth / 2);

          if (horizontalScrollbarVpRef.current) {
            horizontalScrollbarVpRef.current.scrollLeft = targetScroll;
          }
          timeline.scrollTo({ scrollLeft: targetScroll });
          setScrollLeft(targetScroll);
        }
      }, 100);
    };

    const handleDwellZoomEnd = () => {
      if (!preDwellScaleRef.current) return;

      const savedScale = preDwellScaleRef.current;
      const savedScroll = preDwellScrollRef.current;
      preDwellScaleRef.current = null;

      console.log("[DwellZoom] Restoring zoom. index:", savedScale.index);

      // Restore original zoom level
      dispatch(TIMELINE_SCALE_CHANGED, {
        payload: { scale: savedScale },
      });

      // Restore scroll position after zoom settles
      setTimeout(() => {
        if (horizontalScrollbarVpRef.current) {
          horizontalScrollbarVpRef.current.scrollLeft = savedScroll;
        }
        if (timeline) {
          timeline.scrollTo({ scrollLeft: savedScroll });
        }
        setScrollLeft(savedScroll);
      }, 100);
    };

    window.addEventListener("resize-dwell-zoom", handleDwellZoom);
    window.addEventListener("resize-dwell-zoom-end", handleDwellZoomEnd);

    return () => {
      window.removeEventListener("resize-dwell-zoom", handleDwellZoom);
      window.removeEventListener("resize-dwell-zoom-end", handleDwellZoomEnd);
    };
  }, [scale, timeline, fps]);

  const onClickRuler = (units: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const time = unitsToTimeMs(units, scale.zoom);
    playerRef?.current?.seekTo(Math.round((time * fps) / 1000));
  };

  const onRulerScroll = (newScrollLeft: number) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.scrollTo({ scrollLeft: newScrollLeft });
    }

    if (horizontalScrollbarVpRef.current) {
      horizontalScrollbarVpRef.current.scrollLeft = newScrollLeft;
    }

    setScrollLeft(newScrollLeft);
  };

  useEffect(() => {
    const availableScroll = horizontalScrollbarVpRef.current?.scrollWidth;
    if (!availableScroll || !timeline) return;

    const canvasWidth = timeline.width;
    if (availableScroll < canvasWidth + scrollLeft) {
      timeline.scrollTo({ scrollLeft: availableScroll - canvasWidth });
    }

    if (playerRef?.current) {
      try {
        const currentTime = (currentFrame / fps) * 1000;
        const playheadPosAfterZoom = timeMsToUnits(currentTime, scale.zoom);
        const viewportCenter = canvasWidth / 2;
        const targetScrollLeft = Math.max(
          0,
          playheadPosAfterZoom - viewportCenter,
        );

        console.log("[Zoom] Centering playhead:", {
          currentTime,
          playheadPos: playheadPosAfterZoom,
          targetScroll: targetScrollLeft,
        });

        // Scroll to center playhead
        if (horizontalScrollbarVpRef.current) {
          horizontalScrollbarVpRef.current.scrollLeft = targetScrollLeft;
        }

        if (timeline) {
          timeline.scrollTo({ scrollLeft: targetScrollLeft });
        }

        setScrollLeft(targetScrollLeft);
      } catch (error) {
        console.warn("[Zoom] Centering error:", error);
      }
    }
  }, [scale.zoom, timeline, currentFrame, fps, playerRef]);

  return (
    <div
      ref={timelineContainerRef}
      id={"timeline-container"}
      className="bg-muted relative h-full w-full overflow-hidden"
    >
      <Header />
      <Ruler
        onClick={onClickRuler}
        scrollLeft={scrollLeft}
        onScroll={onRulerScroll}
      />
      <Playhead scrollLeft={scrollLeft} />
      <div className="flex">
        <div
          style={{
            width: timelineOffsetX,
          }}
          className="relative flex-none"
        />
        <div style={{ height: canvasSize.height }} className="relative flex-1">
          <div
            style={{ height: canvasSize.height }}
            ref={containerRef}
            className="absolute top-0 w-full"
          >
            <canvas id="designcombo-timeline-canvas" ref={canvasElRef} />
          </div>
          <ScrollArea.Root
            type="always"
            style={{
              position: "absolute",
              width: "calc(100vw - 40px)",
              height: "10px",
            }}
            className="ScrollAreaRootH"
            onPointerDown={() => {
              canScrollRef.current = true;
            }}
            onPointerUp={() => {
              canScrollRef.current = false;
            }}
          >
            <ScrollArea.Viewport
              onScroll={handleOnScrollH}
              className="ScrollAreaViewport"
              id="viewportH"
              ref={horizontalScrollbarVpRef}
            >
              <div
                style={{
                  width:
                    size.width > canvasSize.width
                      ? size.width + TIMELINE_OFFSET_CANVAS_RIGHT
                      : size.width,
                }}
                className="pointer-events-none h-[10px]"
              />
            </ScrollArea.Viewport>

            <ScrollArea.Scrollbar
              className="ScrollAreaScrollbar"
              orientation="horizontal"
            >
              <ScrollArea.Thumb
                onMouseDown={() => {
                  canScrollRef.current = true;
                }}
                onMouseUp={() => {
                  canScrollRef.current = false;
                }}
                className="ScrollAreaThumb"
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>

          <ScrollArea.Root
            type="always"
            style={{
              position: "absolute",
              height: canvasSize.height,
              width: "10px",
            }}
            className="ScrollAreaRootV"
          >
            <ScrollArea.Viewport
              onScroll={handleOnScrollV}
              className="ScrollAreaViewport"
              ref={verticalScrollbarVpRef}
            >
              <div
                style={{
                  height:
                    size.height > canvasSize.height
                      ? size.height + 40
                      : canvasSize.height,
                }}
                className="pointer-events-none w-[10px]"
              />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              className="ScrollAreaScrollbar"
              orientation="vertical"
            >
              <ScrollArea.Thumb
                onMouseDown={() => {
                  canScrollRef.current = true;
                }}
                onMouseUp={() => {
                  canScrollRef.current = false;
                }}
                className="ScrollAreaThumb"
              />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
