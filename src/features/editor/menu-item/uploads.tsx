import { ADD_AUDIO, ADD_IMAGE, ADD_VIDEO } from "@designcombo/state";
import { dispatch } from "@designcombo/events";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Music,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
  UploadIcon,
  FolderOpen,
  PlusIcon,
  Save,
} from "lucide-react";
import { generateId } from "@designcombo/timeline";
import { Button } from "@/components/ui/button";
import useUploadStore from "../store/use-upload-store";
import ModalUpload from "@/components/modal-upload";
import { useState } from "react";
import { SelectionGroupsModal } from "../selection-groups-modal";
import { SaveSelectionGroupModal } from "../save-selection-group-modal";
import { useSelectionStore } from "../store/use-selection-store";

export const Uploads = () => {
  const { setShowUploadModal, uploads, pendingUploads, activeUploads } =
    useUploadStore();

  const [showSelectionGroupsModal, setShowSelectionGroupsModal] =
    useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const { segments, currentGroupName, clearCurrentGroup } =
    useSelectionStore();

  const videos = uploads.filter(
    (upload) => upload.type?.startsWith("video/") || upload.type === "video",
  );
  const images = uploads.filter(
    (upload) => upload.type?.startsWith("image/") || upload.type === "image",
  );
  const audios = uploads.filter(
    (upload) => upload.type?.startsWith("audio/") || upload.type === "audio",
  );

  const handleAddVideo = (video: { metadata: { uploadedUrl: string; }; url: string; }) => {
    const srcVideo = video.metadata?.uploadedUrl || video.url;

    dispatch(ADD_VIDEO, {
      payload: {
        id: generateId(),
        details: {
          src: srcVideo,
        },
        metadata: {
          previewUrl:
            "https://cdn.designcombo.dev/caption_previews/static_preset1.webp",
        },
      },
      options: {
        resourceId: "main",
        scaleMode: "fit",
      },
    });
  };

  const handleAddImage = (image: { metadata: { uploadedUrl: string; }; url: string; }) => {
    const srcImage = image.metadata?.uploadedUrl || image.url;

    dispatch(ADD_IMAGE, {
      payload: {
        id: generateId(),
        type: "image",
        display: {
          from: 0,
          to: 5000,
        },
        details: {
          src: srcImage,
        },
        metadata: {},
      },
      options: {},
    });
  };

  const handleAddAudio = (audio: { metadata: { uploadedUrl: string; }; url: string; }) => {
    const srcAudio = audio.metadata?.uploadedUrl || audio.url;
    dispatch(ADD_AUDIO, {
      payload: {
        id: generateId(),
        type: "audio",
        details: {
          src: srcAudio,
        },
        metadata: {},
      },
      options: {},
    });
  };

  const handleNewSelectionGroup = () => {
    clearCurrentGroup();
    setShowSaveModal(true);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-text-primary flex h-12 flex-none items-center px-4 text-sm font-medium">
        Your uploads
      </div>
      <ModalUpload />

      <div className="flex items-center justify-center px-4">
        <Button
          className="w-full cursor-pointer"
          onClick={() => setShowUploadModal(true)}
        >
          <UploadIcon className="w-4 h-4" />
          <span className="ml-2">Upload</span>
        </Button>
      </div>

      {currentGroupName && (
        <div className="mx-4 mt-3 rounded-md border border-border/80 bg-primary/5 px-3 py-2">
          <div className="text-xs text-muted-foreground">Current group</div>
          <div className="text-sm font-medium truncate">{currentGroupName}</div>
        </div>
      )}

      <div className="flex items-center justify-center px-4 mt-2">
        <Button
          className="w-full cursor-pointer"
          variant="default"
          onClick={() => setShowSaveModal(true)}
          disabled={segments.length === 0}
        >
          <Save className="w-4 h-4" />
          <span className="ml-2">Save Selection</span>
        </Button>
      </div>

      <div className="flex items-center justify-center px-4 mt-2">
        <Button
          className="w-full cursor-pointer"
          variant="outline"
          onClick={handleNewSelectionGroup}
          disabled={segments.length === 0}
        >
          <PlusIcon className="w-4 h-4" />
          <span className="ml-2">New Selection Group</span>
        </Button>
      </div>

      <div className="flex items-center justify-center px-4 mt-2">
        <Button
          className="w-full cursor-pointer"
          variant="outline"
          onClick={() => setShowSelectionGroupsModal(true)}
        >
          <FolderOpen className="w-4 h-4" />
          <span className="ml-2">Load Selection</span>
        </Button>
      </div>

      <SaveSelectionGroupModal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
      />

      <SelectionGroupsModal
        open={showSelectionGroupsModal}
        onOpenChange={setShowSelectionGroupsModal}
      />

      {(pendingUploads.length > 0 || activeUploads.length > 0) && (
        <div className="p-4">
          <div className="font-medium text-sm mb-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            Uploads in Progress
          </div>
          <div className="flex flex-col gap-2">
            {pendingUploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-2">
                <span className="truncate text-xs flex-1">
                  {upload.file?.name || upload.url || "Unknown"}
                </span>
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
            ))}
            {activeUploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-2">
                <span className="truncate text-xs flex-1">
                  {upload.file?.name || upload.url || "Unknown"}
                </span>
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs">{upload.progress ?? 0}%</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {upload.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-10 p-4">
        {videos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <VideoIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Videos</span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-3 gap-2 max-w-full">
                {videos.map((video, idx) => (
                  <div
                    className="flex items-center gap-2 flex-col w-full"
                    key={video.id || idx}
                  >
                    <Card
                      className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => handleAddVideo(video)}
                    >
                      <VideoIcon className="w-8 h-8 text-muted-foreground" />
                    </Card>
                    <div className="text-xs text-muted-foreground truncate w-full text-center">
                      {video.file?.name || video.url || "Video"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {images.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Images</span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-3 gap-2 max-w-full">
                {images.map((image, idx) => (
                  <div
                    className="flex items-center gap-2 flex-col w-full"
                    key={image.id || idx}
                  >
                    <Card
                      className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => handleAddImage(image)}
                    >
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </Card>
                    <div className="text-xs text-muted-foreground truncate w-full text-center">
                      {image.file?.name || image.url || "Image"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {audios.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">Audios</span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="grid grid-cols-3 gap-2 max-w-full">
                {audios.map((audio, idx) => (
                  <div
                    className="flex items-center gap-2 flex-col w-full"
                    key={audio.id || idx}
                  >
                    <Card
                      className="w-16 h-16 flex items-center justify-center overflow-hidden relative cursor-pointer"
                      onClick={() => handleAddAudio(audio)}
                    >
                      <Music className="w-8 h-8 text-muted-foreground" />
                    </Card>
                    <div className="text-xs text-muted-foreground truncate w-full text-center">
                      {audio.file?.name || audio.url || "Audio"}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};
