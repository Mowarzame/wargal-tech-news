import React from "react";
import Paper from "@mui/material/Paper";
import Draggable from "react-draggable";

export const  DraggablePaper = React.forwardRef<HTMLDivElement, any>(function DraggablePaper(props, ref) {
  const nodeRef = React.useRef<HTMLDivElement | null>(null);

  return (
    <Draggable
      nodeRef={nodeRef}
      handle="#ai-summary-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper
        {...props}
        ref={(instance: HTMLDivElement | null) => {
          nodeRef.current = instance;

          // forward the ref MUI Dialog passes in
          if (typeof ref === "function") ref(instance);
          else if (ref) (ref as any).current = instance;
        }}
      />
    </Draggable>
  );
});