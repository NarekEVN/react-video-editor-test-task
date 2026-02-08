import { ITrackItem } from "@designcombo/types";

interface BackendSegment {
  id: string;
  start: number;
  end: number;
  name: string;
  isSelected: boolean;
  isClone: boolean;
  oldId?: string;
  trackItem: ITrackItem;
}

interface DesignFormat {
  tracks: any[];
  trackItemIds: string[];
  trackItemsMap: Record<string, any>;
  transitionsMap: Record<string, any>;
}

/**
 * Transform backend segments to StateManager design format
 */
export function transformSegmentsToDesign(
  backendSegments: BackendSegment[],
  existingDesign?: any
): DesignFormat {
  
  console.log('[transformSegmentsToDesign] Input:', {
    segmentsCount: backendSegments.length,
    existingDesign: !!existingDesign
  });

  const trackItemIds: string[] = [];
  const trackItemsMap: Record<string, any> = {};
  
  const videoSegments: BackendSegment[] = [];
  const audioSegments: BackendSegment[] = [];
  
  backendSegments.forEach(segment => {
    if (!segment.trackItem) {
      console.warn('[transformSegmentsToDesign] Missing trackItem:', segment.id);
      return;
    }
    
    const trackItem = segment.trackItem;
    
    // Add to map
    trackItemsMap[trackItem.id] = trackItem;
    trackItemIds.push(trackItem.id);
    
    // Group by type
    if (trackItem.type === 'video') {
      videoSegments.push(segment);
    } else if (trackItem.type === 'audio') {
      audioSegments.push(segment);
    }
  });
  
  // Create tracks structure
  const tracks = [];
  
  // Video track
  if (videoSegments.length > 0) {
    tracks.push({
      id: existingDesign?.tracks?.[0]?.id || 'video-track-1',
      type: 'video',
      items: videoSegments.map(s => s.trackItem.id),
      accepts: ['video'],
      magnetic: false,
      static: false
    });
  }
  
  // Audio track (if needed)
  if (audioSegments.length > 0) {
    tracks.push({
      id: existingDesign?.tracks?.[1]?.id || 'audio-track-1',
      type: 'audio',
      items: audioSegments.map(s => s.trackItem.id),
      accepts: ['audio'],
      magnetic: false,
      static: false
    });
  }
  
  console.log('[transformSegmentsToDesign] Output:', {
    tracks: tracks.length,
    trackItemIds: trackItemIds.length,
    trackItemsMap: Object.keys(trackItemsMap).length
  });
  
  return {
    tracks,
    trackItemIds,
    trackItemsMap,
    transitionsMap: existingDesign?.transitionsMap || {}
  };
}

/**
 * Merge backend design with existing design
 * Preserves non-video tracks and other settings
 */
export function mergeDesigns(
  backendDesign: Partial<DesignFormat>,
  existingDesign: any
): any {
  
  // Find video track index
  const videoTrackIndex = existingDesign.tracks?.findIndex(
    (t: any) => t.type === 'video'
  ) ?? 0;
  
  // Replace video track items
  const updatedTracks = [...(existingDesign.tracks || [])];
  
  if (backendDesign.tracks && backendDesign.tracks.length > 0) {
    if (updatedTracks[videoTrackIndex]) {
      updatedTracks[videoTrackIndex] = {
        ...updatedTracks[videoTrackIndex],
        items: backendDesign.tracks[0].items
      };
    } else {
      updatedTracks.push(backendDesign.tracks[0]);
    }
  }
  
  // Get non-video trackItemIds from existing design
  const videoTrackItemIds = new Set(backendDesign.trackItemIds || []);
  const nonVideoTrackItemIds = (existingDesign.trackItemIds || []).filter(
    (id: string) => !videoTrackItemIds.has(id)
  );
  
  return {
    ...existingDesign,
    tracks: updatedTracks,
    trackItemIds: [
      ...(backendDesign.trackItemIds || []),
      ...nonVideoTrackItemIds
    ],
    trackItemsMap: {
      ...existingDesign.trackItemsMap,
      ...backendDesign.trackItemsMap
    },
    transitionsMap: {
      ...existingDesign.transitionsMap,
      ...backendDesign.transitionsMap
    }
  };
}