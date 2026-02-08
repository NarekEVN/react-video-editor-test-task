import { generateId } from "@designcombo/timeline";

/**
 * Creates an initial design with ONE video segment (matching backend format exactly)
 * This is the starting state when editor loads
 */

export function createInitialDesign() {
  const totalDuration = 7445; // Nature video duration (matches backend)
  const segmentId = generateId();
  
  // Single segment covering full video duration
  const segment = {
    id: segmentId,
    start: 0,
    end: totalDuration,
    name: "E1",
    isSelected: false,
    isClone: false,
    trackItem: {
      id: segmentId,
      type: "video",
      name: "video",
      details: {
        src: "/nature.mp4",
        width: 1920,
        height: 1080,
        opacity: 100,
        volume: 100,
        top: "0px",
        left: "0px",
        transform: "none",
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "#000000",
        boxShadow: { 
          color: "#000000", 
          x: 0, 
          y: 0, 
          blur: 0 
        },
        blur: 0,
        brightness: 100,
        flipX: false,
        flipY: false,
        rotate: "0deg",
        visibility: "visible",
      },
      metadata: { 
        previewUrl: "/nature.png"
      },
      trim: { 
        from: 0, 
        to: totalDuration 
      },
      display: { 
        from: 0, 
        to: totalDuration 
      },
      duration: totalDuration,
      playbackRate: 1,
      isMain: false,
    },
  };

  // Return design format matching backend structure
  return {
    id: generateId(),
    fps: 30,
    tracks: [
      {
        id: generateId(),
        type: "video",
        items: [segmentId],
        accepts: [
          "video",
        ],
        magnetic: false,
        static: false,
      },
    ],
    size: {
      width: 1920,
      height: 1080,
    },
    trackItemIds: [segmentId],
    transitionsMap: {},
    selection: {},
    trackItemsMap: {
      [segmentId]: segment.trackItem,
    },
  };
}

/**
 * Helper to generate multiple segments (for testing)
 * Same logic as backend generateSegments
 */
export function generateTestSegments(count: number) {
  const totalDuration = 7445;
  const segmentDuration = totalDuration / count;
  
  const segments = [];
  const trackItemIds: string[] = [];
  const trackItemsMap: Record<string, any> = {};
  
  for (let i = 0; i < count; i++) {
    const start = Math.round(i * segmentDuration);
    const end = Math.round((i + 1) * segmentDuration);
    const id = generateId();
    
    const trackItem = {
      id,
      type: "video",
      name: "video",
      details: {
        src: "/nature.mp4",
        width: 1920,
        height: 1080,
        opacity: 100,
        volume: 100,
        top: "0px",
        left: "0px",
        transform: "none",
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "#000000",
        boxShadow: { color: "#000000", x: 0, y: 0, blur: 0 },
        blur: 0,
        brightness: 100,
        flipX: false,
        flipY: false,
        rotate: "0deg",
        visibility: "visible",
      },
      metadata: { previewUrl: "/nature.png" },
      trim: { from: start, to: end },
      display: { from: start, to: end },
      duration: totalDuration,
      playbackRate: 1,
      isMain: false,
    };
    
    segments.push({
      id,
      start,
      end,
      name: `E${i + 1}`,
      isSelected: i === Math.floor(count / 2),
      isClone: false,
      trackItem,
    });
    
    trackItemIds.push(id);
    trackItemsMap[id] = trackItem;
  }
  
  return {
    segments,
    design: {
      id: generateId(),
      fps: 30,
      tracks: [
        {
          id: generateId(),
          type: "video",
          items: trackItemIds,
          accepts: ["video"],
          magnetic: false,
          static: false,
        },
      ],
      size: { width: 1920, height: 1080 },
      trackItemIds,
      transitionsMap: {},
      trackItemsMap,
    },
  };
}