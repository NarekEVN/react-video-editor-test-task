import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Check, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { dispatch } from "@designcombo/events";
import { DESIGN_LOAD, LAYER_SELECT } from "@designcombo/state";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Segment, useSelectionStore } from "./store/use-selection-store";
import {
  transformSegmentsToDesign,
  mergeDesigns,
} from "./utils/transform-segments-to-design";

interface SelectionGroup {
  id: string;
  name: string;
  description?: string;
  segmentCount: number;
  createdAt: string;
  thumbnail?: string;
}

interface SelectionGroupsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SelectionGroupsModal({
  open,
  onOpenChange,
}: SelectionGroupsModalProps) {
  const [groups, setGroups] = useState<SelectionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const {
    setSegments,
    setSelectedSegmentIds,
    currentGroupId: activeGroupId,
    setCurrentGroup,
  } = useSelectionStore();
  const selectionStore = useSelectionStore();

  const parentRef = useRef<HTMLDivElement>(null);

  const fetchSelectionGroups = async (pageNum: number, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      console.log("[SelectionGroupsModal] Fetching page:", pageNum);

      const response = await fetch(
        `/api/selection-groups?page=${pageNum}&limit=10`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch selection groups");
      }

      const data = await response.json();

      console.log("[SelectionGroupsModal] Loaded:", {
        page: data.pagination.page,
        count: data.groups.length,
        hasMore: data.pagination.hasMore,
      });

      if (append) {
        setGroups((prev) => [...prev, ...data.groups]);
      } else {
        setGroups(data.groups);
      }

      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error("[SelectionGroupsModal] Error fetching groups:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Initial load when modal opens
  useEffect(() => {
    if (open) {
      setGroups([]);
      setPage(1);
      setHasMore(true);
      fetchSelectionGroups(1, false);
    }
  }, [open]);

  // Virtual scroll setup
  const rowVirtualizer = useVirtualizer({
    count: hasMore ? groups.length + 1 : groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, 
    overscan: 5,
  });

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= groups.length - 1 &&
      hasMore &&
      !isLoadingMore &&
      !isLoading
    ) {
      console.log("[SelectionGroupsModal] Loading more...");
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSelectionGroups(nextPage, true);
    }
  }, [
    hasMore,
    isLoadingMore,
    isLoading,
    groups.length,
    rowVirtualizer.getVirtualItems(),
  ]);

  const waitForNextFrame = () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const handleLoadGroup = async (groupId: string) => {
    setIsLoadingGroup(true);
    setSelectedGroupId(groupId);

    try {
      console.log("[SelectionGroupsModal] Loading group:", groupId);

      const response = await fetch(`/api/selection-groups/${groupId}`);
      if (!response.ok) {
        throw new Error("Failed to load selection group");
      }

      const data = await response.json();
      const backendSegments = data.segments;

      if (!Array.isArray(backendSegments) || backendSegments.length === 0) {
        throw new Error("No segments found");
      }

      console.log(
        "[SelectionGroupsModal] Loaded segments:",
        backendSegments.length,
      );

      const backendDesign = transformSegmentsToDesign(backendSegments);

      const baseDesign = {
        tracks: [
          {
            id: groupId,
            type: "video",
            items: [],
            accepts: ["video"],
            magnetic: false,
            static: false,
          },
        ],
        trackItemIds: [],
        trackItemsMap: {},
        transitionsMap: {},
      };

      const mergedDesign = mergeDesigns(backendDesign, baseDesign);

      const segments = backendSegments.map((seg: Segment) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        name: seg.name,
        isSelected: !!seg.isSelected,
        isClone: !!seg.isClone,
        oldId: seg.oldId,
        trackItem: seg.trackItem,
      }));

      let selectedTrackItemIds = segments
        .filter((s) => s.isSelected && s.id)
        .map((s) => s.id);

      if (selectedTrackItemIds.length === 0 && segments.length > 0) {
        selectedTrackItemIds = [segments[0].id];
        segments[0].isSelected = true;
      }

      console.log("selectedTrackItemIds:", selectedTrackItemIds);
      console.log(
        "exists in trackItemsMap:",
        selectedTrackItemIds.map((id) => !!mergedDesign.trackItemsMap[id]),
      );

      mergedDesign.selection = {
        trackItemIds: selectedTrackItemIds,
      };
      console.log(mergedDesign);
      dispatch(DESIGN_LOAD, { payload: mergedDesign });
      (window as any).__design = mergedDesign;

      await waitForNextFrame();

      setSegments(segments);
      setSelectedSegmentIds(
        segments.filter((s) => s.isSelected).map((s) => s.id),
      );

      if (selectedTrackItemIds.length > 0) {
        dispatch(LAYER_SELECT, {
          payload: {
            trackItemIds: selectedTrackItemIds,
          },
        });
        window.dispatchEvent(
          new CustomEvent("resize-frame", {
            detail: {
              previewTime: 0,
            },
          }),
        );

        const selectedSegments = segments.filter((s) => s.isSelected && s.id);
        const timelineEl =
          document.querySelector<HTMLDivElement>(".upper-canvas");
        const timelineWidth = timelineEl?.clientWidth ?? 0;

        const timelineDuration = selectedSegments.reduce(
          (max, item) => Math.max(max, item.end),
          0,
        );

        const selectedSegmentsWithX = segments
          .filter((s) => s.isSelected && s.id)
          .map((seg) => {
            const xStart = (seg.start / timelineDuration) * timelineWidth;
            const xEnd = (seg.end / timelineDuration) * timelineWidth;
            const xMiddle = xStart + (xEnd - xStart) / 2;
            return { ...seg, xStart, xEnd, xMiddle };
          });

        console.log("Selected segments X coords:", selectedSegmentsWithX);
        if (timelineEl) {
          selectedSegmentsWithX.forEach((seg) => {
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              clientX: seg.xMiddle,
              clientY: timelineEl.getBoundingClientRect().top + 10,
            });
            timelineEl.dispatchEvent(clickEvent);
            console.log(
              `Clicked middle of segment ${seg.id} at x=${seg.xMiddle}`,
            );
          });
        }

        requestAnimationFrame(() => {
          dispatch(LAYER_SELECT, {
            payload: { trackItemIds: selectedTrackItemIds },
          });
          selectionStore.setSelectedSegmentIds(selectedTrackItemIds);
        });
      }

      onOpenChange(false);
      setSelectedGroupId(null);

      const loadedGroup = groups.find((g) => g.id === groupId);
      setCurrentGroup(groupId, loadedGroup?.name || "Untitled");

      console.log("[SelectionGroupsModal] ✅ Success");
    } catch (error) {
      console.error("[SelectionGroupsModal] Error:", error);
      alert("Error loading selection group");
    } finally {
      setIsLoadingGroup(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Selection Group</DialogTitle>
          <DialogDescription>
            Choose a saved selection group to load into the editor
          </DialogDescription>
        </DialogHeader>

        {isLoading && groups.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No selection groups found</p>
            <p className="text-sm mt-2">
              Create segments and save them to see groups here
            </p>
          </div>
        ) : (
          <div
            ref={parentRef}
            className="h-[400px] overflow-auto pr-4"
            style={{ contain: "strict" }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const isLoaderRow = virtualRow.index > groups.length - 1;
                const group = groups[virtualRow.index];

                return (
                  <div
                    key={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isLoaderRow ? (
                      hasMore ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">
                            Loading more...
                          </span>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          No more selection groups
                        </div>
                      )
                    ) : (
                      (() => {
                        const isActive = activeGroupId === group.id;
                        return (
                          <Card
                            className={`p-4 mb-3 transition-all ${
                              isActive
                                ? "border-green-500/60 bg-green-500/5"
                                : selectedGroupId === group.id
                                  ? "border-primary bg-primary/5"
                                  : "cursor-pointer hover:border-primary"
                            }`}
                            onClick={() =>
                              !isLoadingGroup &&
                              !isActive &&
                              handleLoadGroup(group.id)
                            }
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium">{group.name}</h3>
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Active
                                    </span>
                                  )}
                                  {selectedGroupId === group.id &&
                                    isLoadingGroup && (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    )}
                                  {selectedGroupId === group.id &&
                                    !isLoadingGroup &&
                                    !isActive && (
                                      <Check className="w-4 h-4 text-green-500" />
                                    )}
                                </div>

                                {group.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {group.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>{group.segmentCount} segments</span>
                                  <span>•</span>
                                  <span>{formatDate(group.createdAt)}</span>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                disabled={isLoadingGroup || isActive}
                                variant={isActive ? "outline" : "default"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isActive) handleLoadGroup(group.id);
                                }}
                              >
                                {isLoadingGroup &&
                                selectedGroupId === group.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    Loading...
                                  </>
                                ) : isActive ? (
                                  "Loaded"
                                ) : (
                                  "Load"
                                )}
                              </Button>
                            </div>
                          </Card>
                        );
                      })()
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoadingGroup}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
