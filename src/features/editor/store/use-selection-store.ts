import { create } from "zustand";
import { ITrackItem } from "@designcombo/types";

interface Segment {
  id: string;
  start: number;
  end: number;
  name: string;
  isSelected?: boolean;
  oldId?: string;
  isClone?: boolean;
  trackItem?: ITrackItem;
}

export interface SelectionStore {
  segments: Segment[];
  selectedSegmentIds: Set<string>;
  currentGroupId: string | null;
  currentGroupName: string | null;

  setSegments: (segments: Segment[]) => void;
  setSelectedSegmentIds: (ids: string[]) => void;
  setCurrentGroup: (id: string | null, name: string | null) => void;
  clearCurrentGroup: () => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSegmentSelection: (id: string) => void;
  clearSelection: () => void;
  updateSegment: (id: string, updates: Partial<Segment>) => void;
  getSelectedSegmentIds: () => string[];
  isSegmentSelected: (id: string) => boolean;
}

export const useSelectionStore = create<SelectionStore>((set, get) => ({
  segments: [],
  selectedSegmentIds: new Set<string>(),
  currentGroupId: null,
  currentGroupName: null,

  setCurrentGroup: (id, name) => {
    set({ currentGroupId: id, currentGroupName: name });
    if (typeof window !== "undefined") {
      (window as any).__currentSelectionGroupId = id;
      (window as any).__currentSelectionGroupName = name;
    }
  },

  clearCurrentGroup: () => {
    set({ currentGroupId: null, currentGroupName: null });
    if (typeof window !== "undefined") {
      (window as any).__currentSelectionGroupId = null;
      (window as any).__currentSelectionGroupName = null;
    }
  },

  setSegments: (segments) => {
    set({ segments });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("segments-changed", {
          detail: { action: "load", segments },
        }),
      );
    }
  },

  setSelectedSegmentIds: (ids) => {
    set({ selectedSegmentIds: new Set(ids) });
  },

  addToSelection: (id) => {
    const { selectedSegmentIds } = get();
    const newSelected = new Set(selectedSegmentIds);
    newSelected.add(id);
    set({ selectedSegmentIds: newSelected });
  },

  removeFromSelection: (id) => {
    const { selectedSegmentIds } = get();
    const newSelected = new Set(selectedSegmentIds);
    newSelected.delete(id);
    set({ selectedSegmentIds: newSelected });
  },

  toggleSegmentSelection: (id) => {
    const { selectedSegmentIds } = get();
    const newSelected = new Set(selectedSegmentIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    set({ selectedSegmentIds: newSelected });
  },

  clearSelection: () => set({ selectedSegmentIds: new Set() }),

  updateSegment: (id, updates) => {
    set((state) => ({
      segments: state.segments.map((seg) =>
        seg.id === id ? { ...seg, ...updates } : seg,
      ),
    }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("segments-changed", {
          detail: { action: "update", segmentId: id, updates },
        }),
      );
    }
  },

  getSelectedSegmentIds: () => {
    const { selectedSegmentIds } = get();
    return Array.from(selectedSegmentIds);
  },

  isSegmentSelected: (id) => {
    const { selectedSegmentIds } = get();
    return selectedSegmentIds.has(id);
  },
}));

export type { Segment };