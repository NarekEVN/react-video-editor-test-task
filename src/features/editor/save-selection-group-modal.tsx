import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSelectionStore } from "./store/use-selection-store";
import { toast } from "sonner";

interface SaveSelectionGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveSelectionGroupModal({
  open,
  onOpenChange,
}: SaveSelectionGroupModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const {
    segments,
    selectedSegmentIds,
    currentGroupId,
    currentGroupName,
    setCurrentGroup,
  } = useSelectionStore();

  const selectedCount = useMemo(
    () => selectedSegmentIds.size,
    [selectedSegmentIds]
  );

  useEffect(() => {
    if (open) {
      setName(currentGroupName || `Selection ${new Date().toLocaleString()}`);

      const timer = setTimeout(() => inputRef.current?.select(), 100);
      return () => clearTimeout(timer);
    }
  }, [open, currentGroupName]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a name for the selection group");
      inputRef.current?.focus();
      return;
    }

    if (!segments || segments.length === 0) {
      toast.error("No segments to save", {
        description: "Please create some segments first",
        icon: <AlertCircle className="w-4 h-4" />,
      });
      return;
    }

    try {
      setIsSaving(true);

      const loadingToast = toast.loading("Saving selection group...", {
        description: "Please wait while we save your changes",
      });

      const selectedSegments = segments.filter((seg) =>
        selectedSegmentIds.has(seg.id)
      );

      const groupData = {
        name: trimmedName,
        description: `${segments.length} segments, ${selectedSegments.length} selected`,
        videoUrl: "/nature.mp4",
        thumbnail: "/nature.png",
        segments,
        duration: segments[segments.length - 1]?.end || 0,
      };

      const response = await fetch(
        currentGroupId
          ? `/api/selection-groups/${currentGroupId}`
          : "/api/selection-groups",
        {
          method: currentGroupId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(groupData),
        }
      );

      const result = await response.json();
      toast.dismiss(loadingToast);

      if (!response.ok) throw new Error(result.error || "Failed to save");

      const savedGroupId = result.group?.id || result.group?.groupId || currentGroupId;
      setCurrentGroup(savedGroupId, trimmedName);

      toast.success(
        currentGroupId ? "Selection group updated!" : "Selection group saved!",
        {
          description: `${trimmedName} - ${result?.group?.segmentCount || segments.length} segments`,
          icon: <CheckCircle2 className="w-4 h-4" />,
          duration: 3000,
        }
      );

      onOpenChange(false);
    } catch (error) {
      console.error("[Save] Error:", error);
      toast.error("Failed to save selection group", {
        description:
          error instanceof Error ? error.message : "Please try again",
        icon: <AlertCircle className="w-4 h-4" />,
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentGroupId, segments, name, selectedSegmentIds, setCurrentGroup, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) handleSave();
    },
    [handleSave, isSaving]
  );

  const buttonLabel = useMemo(() => {
    if (isSaving) return "Saving...";
    if (!currentGroupId) return "Save";
    return name.trim() !== currentGroupName?.trim() ? "Update" : "Save";
  }, [isSaving, currentGroupId, name, currentGroupName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentGroupId ? "Update Selection Group" : "Save Selection Group"}
          </DialogTitle>
          <DialogDescription>
            {currentGroupId
              ? "Update the name and save changes to the existing selection group."
              : "Give your selection group a name and save it to the database."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter selection group name..."
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="text-xs text-muted-foreground">
            {segments.length} segment{segments.length !== 1 ? "s" : ""},{" "}
            {selectedCount} selected
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || segments.length === 0}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
