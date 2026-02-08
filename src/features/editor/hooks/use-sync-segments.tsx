import { useEffect } from "react";
import useStore from "../store/use-store";
import { useSelectionStore } from "../store/use-selection-store";

export function useSyncSegments() {
  const { trackItemIds, trackItemsMap } = useStore();
  const { segments: currentSegments, setSegments, selectedSegmentIds } = useSelectionStore();

  useEffect(() => {
    // Filter only video items from trackItemsMap
    const videoTrackItems = trackItemIds
      .map((id) => trackItemsMap[id])
      .filter((item) => item?.type === "video");

    if (videoTrackItems.length === 0) {
      if (currentSegments.length > 0) {
        setSegments([]);
      }
      return;
    }

    // Convert trackItems to segments
    const newSegments = videoTrackItems.map((item: any, index) => {
      const existingSegment = currentSegments.find((s) => s.id === item.id);

      // Detect if this is a clone
      const isClone = Math.abs(item.display.from - item.trim.from) > 0.1;

      let oldId: string | undefined;
      if (isClone) {
        const original = videoTrackItems.find((other: any) => {
          const sameTrim =
            Math.abs(other.trim.from - item.trim.from) < 0.1 &&
            Math.abs(other.trim.to - item.trim.to) < 0.1;
          const isOriginal =
            Math.abs(other.display.from - other.trim.from) < 0.1;
          return other.id !== item.id && sameTrim && isOriginal;
        });
        oldId = original?.id || existingSegment?.oldId;
      }



      return {
        id: item.id,
        start: item.display.from,
        end: item.display.to,
        trackItem: item,
        isClone: oldId ? isClone : false,
        oldId,
        // Preserve existing name
        name: existingSegment?.name || `E${index + 1}`,
        // ✅ isSelected based on activeSegmentId (set by SceneInteractions)
        isSelected: selectedSegmentIds.has(item.id),
      };
    });

    // Sort by start time
    newSegments.sort((a, b) => a.start - b.start);

    console.log("[useSyncSegments] Syncing segments:", {
      count: newSegments.length,
      selectedSegmentIds,
      selected: newSegments.filter((s) => s.isSelected).map((s) => s.name),
    });

    setSegments(newSegments);
  }, [
    trackItemsMap,
    trackItemIds,
    selectedSegmentIds, // ✅ Listen to activeSegmentId changes from SceneInteractions
    setSegments,
  ]);
}
