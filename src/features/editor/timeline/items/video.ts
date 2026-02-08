import {
  Control,
  Pattern,
  Trimmable,
  TrimmableProps,
  timeMsToUnits,
  unitsToTimeMs,
} from "@designcombo/timeline";
import { Filmstrip, FilmstripBacklogOptions } from "../types";
import ThumbnailCache from "../../utils/thumbnail-cache";
import { IDisplay, IMetadata, ITrim } from "@designcombo/types";
import {
  calculateOffscreenSegments,
  calculateThumbnailSegmentLayout,
} from "../../utils/filmstrip";
import { getFileFromUrl } from "../../utils/file";
import { createMediaControls } from "../controls";
import { SECONDARY_FONT } from "../../constants/constants";
import { Segment } from "../../store/use-selection-store";

type MP4ClipType = any;

const EMPTY_FILMSTRIP: Filmstrip = {
  offset: 0,
  startTime: 0,
  thumbnailsCount: 0,
  widthOnScreen: 0,
};

interface VideoProps extends TrimmableProps {
  aspectRatio: number;
  trim: ITrim;
  duration: number;
  src: string;
  metadata: Partial<IMetadata> & {
    previewUrl: string;
  };
}

class Video extends Trimmable {
  static type = "Video";
  public clip?: MP4ClipType | null;
  declare id: string;
  public resourceId = "";
  declare tScale: number;
  public isSelected = false;
  declare display: IDisplay;
  declare trim: ITrim;
  declare playbackRate: number;
  public hasSrc = true;
  declare duration: number;
  public prevDuration: number;
  public itemType = "video";
  public metadata?: Partial<IMetadata>;
  declare src: string;

  public aspectRatio = 1;
  public scrollLeft = 0;
  public filmstripBacklogOptions?: FilmstripBacklogOptions;
  public thumbnailsPerSegment = 0;
  public segmentSize = 0;

  public offscreenSegments = 0;
  public thumbnailWidth = 0;
  public thumbnailHeight = 60;
  public thumbnailsList: { url: string; ts: number }[] = [];
  public isFetchingThumbnails = false;
  public thumbnailCache = new ThumbnailCache();

  public currentFilmstrip: Filmstrip = EMPTY_FILMSTRIP;
  public nextFilmstrip: Filmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
  public loadingFilmstrip: Filmstrip = EMPTY_FILMSTRIP;

  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  private isDirty = true;

  private fallbackSegmentIndex = 0;
  private fallbackSegmentsCount = 0;
  private previewUrl = "";
  public isInSelectionGroup: boolean = false;

  private _eventHandler: ((e: CustomEvent) => void) | null = null;

  static createControls(): { controls: Record<string, Control> } {
    return { controls: createMediaControls() };
  }

  constructor(props: VideoProps) {
    super(props);
    this.id = props.id;
    this.tScale = props.tScale;
    this.objectCaching = false;
    this.rx = 4;
    this.ry = 4;
    this.display = props.display;
    this.trim = props.trim;
    this.duration = props.duration;
    this.prevDuration = props.duration;
    this.fill = "#27272a";
    this.borderOpacityWhenMoving = 1;
    this.metadata = props.metadata;

    this.aspectRatio = props.aspectRatio;
    this.src = props.src;
    this.strokeWidth = 0;
    this.transparentCorners = false;
    this.hasBorders = false;

    this.previewUrl = props.metadata.previewUrl;
    this.initOffscreenCanvas();
    this.initialize();

    if (typeof window !== "undefined") {
      this.setupPlayheadListener();
    }

    if (typeof window !== "undefined") {
      this.setupEventListener();
    }
  }

  private lastKnownTime = 0;
  private playheadInterval: number | null = null;

  private setupPlayheadListener() {
    this.playheadInterval = window.setInterval(() => {
      const currentTimeEl = document.getElementById("video-current-time");
      if (currentTimeEl) {
        const currentTime =
          parseFloat(currentTimeEl.getAttribute("data-current-time") || "0") *
          1000;

        if (Math.abs(currentTime - this.lastKnownTime) > 100) {
          this.lastKnownTime = currentTime;
          this.canvas?.requestRenderAll();
        }
      }
    }, 100);
  }

  private setupEventListener() {
    const handler = (e: CustomEvent) => {
      console.log("[Video] Segments changed:", e.detail);

      if (this.canvas) {
        // Immediate
        this.canvas.requestRenderAll();
        this.canvas.renderAll();

        // Also set dirty flag
        this.set({ dirty: true });

        // Force on next frame
        requestAnimationFrame(() => {
          if (this.canvas) {
            this.canvas.requestRenderAll();
            this.canvas.renderAll();
          }
        });

        // And after a tiny delay
        setTimeout(() => {
          if (this.canvas) {
            this.canvas.requestRenderAll();
            this.canvas.renderAll();
          }
        }, 0);
      }
    };

    window.addEventListener("segments-changed", handler as EventListener);
    this._eventHandler = handler;
  }

  public dispose() {
    if (this.playheadInterval !== null) {
      clearInterval(this.playheadInterval);
      this.playheadInterval = null;
    }

    if (this._eventHandler) {
      window.removeEventListener(
        "segments-changed",
        this._eventHandler as EventListener,
      );
      this._eventHandler = null;
    }

    super.dispose?.();
  }

  private initOffscreenCanvas() {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = new OffscreenCanvas(this.width, this.height);
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }

    if (
      this.offscreenCanvas.width !== this.width ||
      this.offscreenCanvas.height !== this.height
    ) {
      this.offscreenCanvas.width = this.width;
      this.offscreenCanvas.height = this.height;
      this.isDirty = true;
    }
  }

  public initDimensions() {
    this.thumbnailWidth = this.thumbnailHeight * this.aspectRatio;
    const segmentOptions = calculateThumbnailSegmentLayout(this.thumbnailWidth);
    this.thumbnailsPerSegment = segmentOptions.thumbnailsPerSegment;
    this.segmentSize = segmentOptions.segmentSize;
  }

  public async initialize() {
    await this.loadFallbackThumbnail();
    this.initDimensions();
    this.onScrollChange({ scrollLeft: 0 });
    this.canvas?.requestRenderAll();
    this.createFallbackPattern();
    await this.prepareAssets();
    this.onScrollChange({ scrollLeft: 0 });
  }

  public async prepareAssets() {
    const file = await getFileFromUrl(this.src);
    const stream = file.stream();

    if (typeof window !== "undefined") {
      try {
        const { MP4Clip } = await import("@designcombo/frames");
        this.clip = new MP4Clip(stream);
      } catch (error) {
        console.warn("Failed to load MP4Clip:", error);
        this.clip = null;
      }
    } else {
      this.clip = null;
    }
  }

  private calculateFilmstripDimensions({
    segmentIndex,
    widthOnScreen,
  }: {
    segmentIndex: number;
    widthOnScreen: number;
  }) {
    const filmstripOffset = segmentIndex * this.segmentSize;
    const shouldUseLeftBacklog = segmentIndex > 0;
    const leftBacklogSize = shouldUseLeftBacklog ? this.segmentSize : 0;

    const totalWidth = timeMsToUnits(
      this.duration,
      this.tScale,
      this.playbackRate,
    );

    const rightRemainingSize =
      totalWidth - widthOnScreen - leftBacklogSize - filmstripOffset;
    const rightBacklogSize = Math.min(this.segmentSize, rightRemainingSize);

    const filmstripStartTime = unitsToTimeMs(filmstripOffset, this.tScale);
    const filmstrimpThumbnailsCount =
      1 +
      Math.round(
        (widthOnScreen + leftBacklogSize + rightBacklogSize) /
          this.thumbnailWidth,
      );

    return {
      filmstripOffset,
      leftBacklogSize,
      rightBacklogSize,
      filmstripStartTime,
      filmstrimpThumbnailsCount,
    };
  }

  private async loadFallbackThumbnail() {
    const fallbackThumbnail = this.previewUrl;
    if (!fallbackThumbnail) return;

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `${fallbackThumbnail}?t=${Date.now()}`;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const aspectRatio = img.width / img.height;
        const targetHeight = 40;
        const targetWidth = Math.round(targetHeight * aspectRatio);
        canvas.height = targetHeight;
        canvas.width = targetWidth;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const resizedImg = new Image();

        resizedImg.src = canvas.toDataURL();
        this.aspectRatio = aspectRatio;
        this.thumbnailWidth = targetWidth;
        this.thumbnailCache.setThumbnail("fallback", resizedImg);
        resolve();
      };
    });
  }

  private generateTimestamps(startTime: number, count: number): number[] {
    const timePerThumbnail = unitsToTimeMs(
      this.thumbnailWidth,
      this.tScale,
      this.playbackRate,
    );

    return Array.from({ length: count }, (_, i) => {
      const timeInFilmstripe = startTime + i * timePerThumbnail;
      return Math.ceil(timeInFilmstripe / 1000);
    });
  }

  private createFallbackPattern() {
    const canvas = this.canvas;
    if (!canvas) return;

    const canvasWidth = canvas.width;
    const maxPatternSize = 12000;
    const fallbackSource = this.thumbnailCache.getThumbnail("fallback");
    if (!fallbackSource) return;

    const totalWidthNeeded = Math.min(canvasWidth * 20, maxPatternSize);
    const segmentsRequired = Math.ceil(totalWidthNeeded / this.segmentSize);
    this.fallbackSegmentsCount = segmentsRequired;
    const patternWidth = segmentsRequired * this.segmentSize;

    const offCanvas = document.createElement("canvas");
    offCanvas.height = this.thumbnailHeight;
    offCanvas.width = patternWidth;

    const context = offCanvas.getContext("2d");
    if (!context) return;
    const thumbnailsTotal = segmentsRequired * this.thumbnailsPerSegment;

    for (let i = 0; i < thumbnailsTotal; i++) {
      const x = i * this.thumbnailWidth;
      context.drawImage(
        fallbackSource,
        x,
        0,
        this.thumbnailWidth,
        this.thumbnailHeight,
      );
    }

    const fillPattern = new Pattern({
      source: offCanvas,
      repeat: "no-repeat",
      offsetX: 0,
    });

    this.set("fill", fillPattern);
    this.canvas?.requestRenderAll();
  }

  public async loadAndRenderThumbnails() {
    if (this.isFetchingThumbnails || !this.clip) return;
    this.loadingFilmstrip = { ...this.nextFilmstrip };
    this.isFetchingThumbnails = true;

    const { startTime, thumbnailsCount } = this.loadingFilmstrip;
    const timestamps = this.generateTimestamps(startTime, thumbnailsCount);

    const thumbnailsArr = await this.clip.thumbnailsList(this.thumbnailWidth, {
      timestamps: timestamps.map((timestamp) => timestamp * 1e6),
    });

    const updatedThumbnails = thumbnailsArr.map(
      (thumbnail: { ts: number; img: Blob }) => {
        return {
          ts: Math.round(thumbnail.ts / 1e6),
          img: thumbnail.img,
        };
      },
    );

    await this.loadThumbnailBatch(updatedThumbnails);
    this.isDirty = true;
    this.isFetchingThumbnails = false;
    this.currentFilmstrip = { ...this.loadingFilmstrip };

    requestAnimationFrame(() => {
      this.canvas?.requestRenderAll();
    });
  }

  private async loadThumbnailBatch(thumbnails: { ts: number; img: Blob }[]) {
    const loadPromises = thumbnails.map(async (thumbnail) => {
      if (this.thumbnailCache.getThumbnail(thumbnail.ts)) return;

      return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(thumbnail.img);
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          this.thumbnailCache.setThumbnail(thumbnail.ts, img);
          resolve();
        };
      });
    });

    await Promise.all(loadPromises);
  }

  public _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);

    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);

    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();

    this.renderToOffscreen();
    if (Math.floor(this.width) === 0) return;
    if (!this.offscreenCanvas) return;
    ctx.drawImage(this.offscreenCanvas, 0, 0);

    this.drawSelectionOverlay(ctx);

    ctx.restore();
    this.updateSelected(ctx);
  }

  private drawSelectionOverlay(ctx: CanvasRenderingContext2D) {
    if (typeof window === "undefined") return;

    const store = (window as any).__selectionStore;
    if (!store?.segments?.length) return;

    const selectedSegmentIds = [...store.selectedSegmentIds];

    // No selection - everything grayscale
    if (!selectedSegmentIds?.length) {
      ctx.save();
      ctx.filter = "grayscale(100%) brightness(70%)";
      if (this.offscreenCanvas) {
        ctx.drawImage(this.offscreenCanvas, 0, 0);
      }
      ctx.restore();
      return;
    }

    const matchingSegments = store.segments.filter((s: Segment) => {
      // Check if segment is selected
      if (!selectedSegmentIds.includes(s.id)) return false;
      // Check if this video belongs to this segment
      return s.trackItem?.id === this.id;
    });

    // No matching segments - draw grayscale
    if (matchingSegments.length === 0) {
      ctx.save();
      ctx.filter = "grayscale(100%) brightness(70%)";
      if (this.offscreenCanvas) {
        ctx.drawImage(this.offscreenCanvas, 0, 0);
      }
      ctx.restore();
      return;
    }

    if (!this.offscreenCanvas) return;

    // Video display bounds
    const videoDisplayStart = this.display.from;
    const videoDisplayEnd = this.display.to;

    // Draw grayscale base first
    ctx.save();
    ctx.filter = "grayscale(100%) brightness(70%)";
    ctx.drawImage(this.offscreenCanvas, 0, 0);
    ctx.restore();

    matchingSegments.forEach((segment: Segment) => {
      const segmentStart = segment.start;
      const segmentEnd = segment.end;

      // Find overlap between video display and segment
      const overlapStart = !segment.isClone
        ? segmentStart
        : Math.max(videoDisplayStart, segmentStart);
      const overlapEnd = !segment.isClone
        ? segmentEnd
        : Math.min(videoDisplayEnd, segmentEnd);

      // No overlap - skip this segment
      if (overlapStart >= overlapEnd) return;

      // Calculate position within this video item
      const startOffset = overlapStart - videoDisplayStart;
      const endOffset = overlapEnd - videoDisplayStart;

      // Convert to pixel positions
      const startX = Math.round(
        timeMsToUnits(startOffset, this.tScale, this.playbackRate),
      );

      const width = Math.round(
        timeMsToUnits(endOffset - startOffset, this.tScale, this.playbackRate),
      );

      // Draw color overlay for this segment
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, this.width, this.height);
      ctx.clip();
      if (!this.offscreenCanvas) return;
      ctx.drawImage(
        this.offscreenCanvas,
        startX,
        0,
        width,
        this.height,
        startX,
        0,
        width,
        this.height,
      );

      ctx.restore();
    });
  }

  public setDuration(duration: number) {
    this.duration = duration;
    this.prevDuration = duration;
  }

  public async setSrc(src: string) {
    super.setSrc(src);
    this.clip = null;
    await this.initialize();
    await this.prepareAssets();
    this.thumbnailCache.clearCacheButFallback();
    this.onScale();
  }

  public onResizeSnap() {
    this.renderToOffscreen(true);
  }

  public onResize() {
    this.renderToOffscreen(true);
  }

  public renderToOffscreen(force?: boolean) {
    if (!this.offscreenCtx) return;
    if (!this.isDirty && !force) return;
    if (!this.offscreenCanvas) return;

    this.offscreenCanvas.width = this.width;
    const ctx = this.offscreenCtx;
    const { startTime, offset, thumbnailsCount } = this.currentFilmstrip;
    const thumbnailWidth = this.thumbnailWidth;
    const thumbnailHeight = this.thumbnailHeight;

    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate,
    );

    let timeInFilmstripe = startTime;
    const timePerThumbnail = unitsToTimeMs(
      thumbnailWidth,
      this.tScale,
      this.playbackRate || 1,
    );

    ctx.clearRect(0, 0, this.width, this.height);

    ctx.beginPath();
    ctx.roundRect(0, 0, this.width, this.height, this.rx);
    ctx.clip();

    for (let i = 0; i < thumbnailsCount; i++) {
      let img = this.thumbnailCache.getThumbnail(
        Math.ceil(timeInFilmstripe / 1000),
      );

      if (!img) {
        img = this.thumbnailCache.getThumbnail("fallback");
      }

      if (img?.complete) {
        const xPosition = Math.round(
          i * thumbnailWidth + offset - trimFromSize,
        );
        ctx.drawImage(img, xPosition, 0, thumbnailWidth, thumbnailHeight);
        timeInFilmstripe += timePerThumbnail;
      }
    }

    this.isDirty = false;
  }

  public drawTextIdentity(ctx: CanvasRenderingContext2D) {
    const iconPath = new Path2D(
      "M16.5625 0.925L12.5 3.275V0.625L11.875 0H0.625L0 0.625V9.375L0.625 10H11.875L12.5 9.375V6.875L16.5625 9.2125L17.5 8.625V1.475L16.5625 0.925ZM11.25 8.75H1.25V1.25H11.25V8.75ZM16.25 7.5L12.5 5.375V4.725L16.25 2.5V7.5Z",
    );
    ctx.save();
    ctx.translate(-this.width / 2, -this.height / 2);
    ctx.translate(0, 14);
    ctx.font = `400 12px ${SECONDARY_FONT}`;
    ctx.fillStyle = "#f4f4f5";
    ctx.textAlign = "left";
    ctx.clip();
    ctx.fillText("Video", 36, 10);

    ctx.translate(8, 1);
    ctx.fillStyle = "#f4f4f5";
    ctx.fill(iconPath);
    ctx.restore();
  }

  public setSelected(selected: boolean) {
    this.isSelected = selected;
    this.set({ dirty: true });
  }

  public updateSelected(ctx: CanvasRenderingContext2D) {
    const borderColor = this.isSelected
      ? "rgba(255, 255, 255,1.0)"
      : "rgba(255, 255, 255,0.05)";
    const borderWidth = 2;
    const innerRadius = 4;

    ctx.save();
    ctx.fillStyle = borderColor;

    ctx.beginPath();
    ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);

    ctx.roundRect(
      -this.width / 2 + borderWidth,
      -this.height / 2 + borderWidth,
      this.width - borderWidth * 2,
      this.height - borderWidth * 2,
      innerRadius,
    );

    ctx.fill("evenodd");
    ctx.restore();
  }

  public calulateWidthOnScreen() {
    const canvasEl = document.getElementById("designcombo-timeline-canvas");
    const canvasWidth = canvasEl?.clientWidth;
    const scrollLeft = this.scrollLeft;
    if (!canvasWidth) return 0;
    const timelineWidth = canvasWidth;
    const cutFromBottomEdge = Math.max(
      timelineWidth - (this.width + this.left + scrollLeft),
      0,
    );
    const visibleHeight = Math.min(
      timelineWidth - this.left - scrollLeft,
      timelineWidth,
    );

    return Math.max(visibleHeight - cutFromBottomEdge, 0);
  }

  public calculateOffscreenWidth({ scrollLeft }: { scrollLeft: number }) {
    const offscreenWidth = Math.min(this.left + scrollLeft, 0);
    return Math.abs(offscreenWidth);
  }

  public onScrollChange({
    scrollLeft,
    force,
  }: {
    scrollLeft: number;
    force?: boolean;
  }) {
    const offscreenWidth = this.calculateOffscreenWidth({ scrollLeft });
    const trimFromSize = timeMsToUnits(
      this.trim.from,
      this.tScale,
      this.playbackRate,
    );

    const offscreenSegments = calculateOffscreenSegments(
      offscreenWidth,
      trimFromSize,
      this.segmentSize,
    );

    this.offscreenSegments = offscreenSegments;
    const segmentToDraw = offscreenSegments;

    if (this.currentFilmstrip.segmentIndex === segmentToDraw) {
      return false;
    }

    if (segmentToDraw !== this.fallbackSegmentIndex) {
      const fillPattern = this.fill as Pattern;
      if (fillPattern instanceof Pattern) {
        fillPattern.offsetX =
          this.segmentSize *
          (segmentToDraw - Math.floor(this.fallbackSegmentsCount / 2));
      }
      this.fallbackSegmentIndex = segmentToDraw;
    }

    if (!this.isFetchingThumbnails || force) {
      this.scrollLeft = scrollLeft;
      const widthOnScreen = this.calulateWidthOnScreen();
      const { filmstripOffset, filmstripStartTime, filmstrimpThumbnailsCount } =
        this.calculateFilmstripDimensions({
          widthOnScreen: this.calulateWidthOnScreen(),
          segmentIndex: segmentToDraw,
        });

      this.nextFilmstrip = {
        segmentIndex: segmentToDraw,
        offset: filmstripOffset,
        startTime: filmstripStartTime,
        thumbnailsCount: filmstrimpThumbnailsCount,
        widthOnScreen,
      };

      this.loadAndRenderThumbnails();
    }
  }

  public onScale() {
    const playerRef = (window as any).__playerRef;
    let targetScrollLeft = this.scrollLeft; // Default to current scroll

    if (playerRef?.current) {
      try {
        const currentFrame = playerRef.current.getCurrentFrame();
        const fps = 30;
        const currentTimeMs = (currentFrame / fps) * 1000;

        const timelineContainer = document.getElementById("timeline-container");
        const viewportWidth = timelineContainer?.clientWidth || 0;
        const viewportCenter = viewportWidth / 2;

        const playheadPosAfterZoom = timeMsToUnits(
          currentTimeMs,
          this.tScale,
          this.playbackRate,
        );

        targetScrollLeft = Math.max(0, playheadPosAfterZoom - viewportCenter);

        console.log("[Video.onScale] Centering:", {
          currentTimeMs,
          tScale: this.tScale,
          playheadPos: playheadPosAfterZoom,
          viewportCenter,
          targetScroll: targetScrollLeft,
        });
      } catch (error) {
        console.warn("[Video.onScale] Failed to get playhead:", error);
      }
    }

    this.currentFilmstrip = { ...EMPTY_FILMSTRIP };
    this.nextFilmstrip = { ...EMPTY_FILMSTRIP, segmentIndex: 0 };
    this.loadingFilmstrip = { ...EMPTY_FILMSTRIP };

    this.scrollLeft = targetScrollLeft;

    requestAnimationFrame(() => {
      // Try Radix scroll area
      const scrollbar = document.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement;
      if (scrollbar) {
        scrollbar.scrollLeft = targetScrollLeft;
        console.log("[Video.onScale] ✅ Scrolled via radix");
      } else {
        const timelineScroll = document.querySelector(
          ".horizontal-scrollbar-viewport",
        ) as HTMLElement;
        if (timelineScroll) {
          timelineScroll.scrollLeft = targetScrollLeft;
          console.log("[Video.onScale] ✅ Scrolled via class");
        }
      }
    });

    this.onScrollChange({ scrollLeft: targetScrollLeft, force: true });

    this.isDirty = true;
    this.renderToOffscreen(true);

    // Synchronous render
    if (this.canvas) {
      this.canvas.renderAll();
    }

    // Next frame
    requestAnimationFrame(() => {
      if (this.canvas) {
        this.canvas.renderAll();
      }
    });

    // Double next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.canvas) {
          this.canvas.renderAll();
        }
      });
    });

    // After stack clear
    setTimeout(() => {
      if (this.canvas) {
        this.canvas.renderAll();
      }
    }, 0);

    // Slight delay
    setTimeout(() => {
      if (this.canvas) {
        this.canvas.renderAll();
      }
    }, 10);
  }
}

export default Video;
