import React from "react";
import {
  IAudio,
  ICaption,
  IImage,
  IText,
  ITrackItem,
  ITrackItemAndDetails,
  IVideo,
} from "@designcombo/types";
import { useEffect, useState } from "react";
import BasicText from "./basic-text";
import BasicImage from "./basic-image";
import BasicVideo from "./basic-video";
import BasicAudio from "./basic-audio";
import useStore from "../store/use-store";
import useLayoutStore from "../store/use-layout-store";
import BasicCaption from "./basic-caption";
import { LassoSelect } from "lucide-react";
import { useSelectionStore } from '../store/use-selection-store';

const Container = ({ children }: { children: React.ReactNode }) => {
  const [trackItem, setTrackItem] = useState<ITrackItem | null>(null);
  const { setTrackItem: setLayoutTrackItem } = useLayoutStore();
  
  const { segments } = useSelectionStore();
  const [activeSegment, setActiveSegment] = useState<any>(null);

  return <></>

  return (
    <div className="flex w-[272px] flex-none border-l border-border/80 bg-muted hidden lg:block">
      {React.cloneElement(children as React.ReactElement<any>, {
        trackItem,
        activeSegment 
      })}
    </div>
  );
};

const ActiveControlItem = ({
  trackItem,
}: {
  trackItem?: ITrackItemAndDetails;
}) => {
  if (!trackItem) {
    return (
      <div className="pb-32 flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground h-[calc(100vh-58px)]">
        <LassoSelect />
        <span className="text-zinc-500">No item selected</span>
      </div>
    );
  }
  return (
    <>
      {
        /*{
          text: <BasicText trackItem={trackItem as ITrackItem & IText} />,
          caption: (
            <BasicCaption trackItem={trackItem as ITrackItem & ICaption} />
          ),
          image: <BasicImage trackItem={trackItem as ITrackItem & IImage} />,
          video: <BasicVideo trackItem={trackItem as ITrackItem & IVideo} />,
          audio: <BasicAudio trackItem={trackItem as ITrackItem & IAudio} />,
        }[trackItem.type as "text"]*/
         <BasicVideo trackItem={trackItem as ITrackItem & IVideo} />
      }
    </>
  );
};

export const ControlItem = () => {
  return (
    <Container>
      <ActiveControlItem />
    </Container>
  );
};
