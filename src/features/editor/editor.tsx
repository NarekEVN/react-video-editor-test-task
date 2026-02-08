"use client";
import Timeline from "./timeline";
import useStore from "./store/use-store";
import Navbar from "./navbar";
import useTimelineEvents from "./hooks/use-timeline-events";
import Scene from "./scene";
import { SceneRef } from "./scene/scene.types";
import StateManager, { DESIGN_LOAD, LAYER_SELECT } from "@designcombo/state";
import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { getCompactFontData, loadFonts } from "./utils/fonts";
import { SECONDARY_FONT, SECONDARY_FONT_URL } from "./constants/constants";
import MenuList from "./menu-list";
import { MenuItem } from "./menu-item";
import { ControlItem } from "./control-item";
import CropModal from "./crop-modal/crop-modal";
import useDataState from "./store/use-data-state";
import { FONTS } from "./data/fonts";
import FloatingControl from "./control-item/floating-controls/floating-control";
import { dispatch } from "@designcombo/events";
import MenuListHorizontal from "./menu-list-horizontal";
import { useIsLargeScreen } from "@/hooks/use-media-query";
import { ITrackItem } from "@designcombo/types";
import useLayoutStore from "./store/use-layout-store";
import ControlItemHorizontal from "./control-item-horizontal";
import { useSelectionStore } from "./store/use-selection-store";
import { useSyncSegments } from "./hooks/use-sync-segments";
import { createInitialDesign } from "./utils/create-initial-design";

export const stateManager = new StateManager({
  size: {
    width: 1080,
    height: 1920,
  },
});

const Editor = ({ tempId, id }: { tempId?: string; id?: string }) => {
  const [projectName, setProjectName] = useState<string>("Untitled video");
  const timelinePanelRef = useRef<ImperativePanelHandle>(null);
  const sceneRef = useRef<SceneRef>(null);
  const { timeline, playerRef } = useStore();
  const [loaded, setLoaded] = useState(false);
  const [trackItem] = useState<ITrackItem | null>(null);
  const selectionStore = useSelectionStore();
  const {
    setFloatingControl,
    setLabelControlItem,
    setTypeControlItem,
  } = useLayoutStore();
  const isLargeScreen = useIsLargeScreen();
  useSyncSegments();
  useTimelineEvents();

  const { setCompactFonts, setFonts } = useDataState();

  useEffect(() => {
    const initialDesign = createInitialDesign();

    dispatch(DESIGN_LOAD, { payload: initialDesign });

    (window as any).__design = initialDesign;

    const firstTrackItemId = initialDesign.trackItemIds[0];
    if (firstTrackItemId) {
      requestAnimationFrame(() => {
        dispatch(LAYER_SELECT, {
          payload: { trackItemIds: [firstTrackItemId] },
        });
        selectionStore.setSelectedSegmentIds([firstTrackItemId]);
      });
    }

    console.log("[Editor] Loaded initial design with 1 segment, selected first layer");
  }, []);

  useEffect(() => {
    setCompactFonts(getCompactFontData(FONTS));
    setFonts(FONTS);
  }, []);

  useEffect(() => {
    loadFonts([
      {
        name: SECONDARY_FONT,
        url: SECONDARY_FONT_URL,
      },
    ]);
  }, []);

  useEffect(() => {
    const screenHeight = window.innerHeight;
    const desiredHeight = 400;
    const percentage = (desiredHeight / screenHeight) * 100;
    timelinePanelRef.current?.resize(percentage);
  }, []);

  const handleTimelineResize = () => {
    const timelineContainer = document.getElementById("timeline-container");
    if (!timelineContainer) return;

    timeline?.resize(
      {
        height: timelineContainer.clientHeight - 90,
        width: timelineContainer.clientWidth - 40,
      },
      {
        force: true,
      },
    );

    setTimeout(() => {
      sceneRef.current?.recalculateZoom();
    }, 100);
  };

  useEffect(() => {
    const onResize = () => handleTimelineResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [timeline]);

  useEffect(() => {
    setFloatingControl("");
    setLabelControlItem("");
    setTypeControlItem("");
  }, [isLargeScreen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateWindowStore = () => {
        const currentState = useSelectionStore.getState();
        (window as any).__selectionStore = currentState;
      };

      updateWindowStore();

      const unsubscribe = useSelectionStore.subscribe(updateWindowStore);

      (window as any).__playerRef = playerRef;


      const handleSave = async () => {
        const segments = selectionStore.segments;
        const selectedIds = selectionStore.getSelectedSegmentIds();

        console.log("Saving segments:", segments);
        console.log("Selected IDs:", selectedIds);

        alert(
          `Saved ${segments.length} segments! (${selectedIds.length} selected)`,
        );
      };

      const handleClear = async () => {
        if (confirm("Are you sure you want to clear all selections?")) {
          selectionStore.clearSelection();
          selectionStore.setSegments([]);
        }
      };

      window.addEventListener("save-selections", handleSave);
      window.addEventListener("clear-selections", handleClear);

      return () => {
        unsubscribe(); // Clean up store subscription
        window.removeEventListener("save-selections", handleSave);
        window.removeEventListener("clear-selections", handleClear);
      };
    }
  }, [selectionStore, playerRef, id, tempId]);

  useEffect(() => {
    if (timeline) {
      timeline.requestRenderAll();
    }
  }, [selectionStore.segments, selectionStore.selectedSegmentIds, timeline]);

  useEffect(() => {
    if (typeof window !== "undefined" && playerRef?.current) {
      (window as any).__currentFrame = playerRef.current.getCurrentFrame();
    }
  }, [playerRef?.current?.getCurrentFrame()]);

  useEffect(() => {
    setLoaded(true);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Navbar
        projectName={projectName}
        user={null}
        stateManager={stateManager}
        setProjectName={setProjectName}
      />
      <div className="flex flex-1">
        {isLargeScreen && (
          <div className="bg-muted  flex flex-none border-r border-border/80 h-[calc(100vh-44px)]">
            <MenuList />
            <MenuItem />
          </div>
        )}
        <ResizablePanelGroup style={{ flex: 1 }} direction="vertical">
          <ResizablePanel className="relative" defaultSize={70}>
            <FloatingControl />
            <div className="flex h-full flex-1">
    
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <CropModal />
                <Scene ref={sceneRef} stateManager={stateManager} />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            className="min-h-[50px]"
            ref={timelinePanelRef}
            defaultSize={30}
            onResize={handleTimelineResize}
          >
            {playerRef && <Timeline stateManager={stateManager} />}
          </ResizablePanel>
          {!isLargeScreen && !trackItem && loaded && <MenuListHorizontal />}
          {!isLargeScreen && trackItem && <ControlItemHorizontal />}
        </ResizablePanelGroup>
        <ControlItem />
      </div>
    </div>
  );
};

export default Editor;
