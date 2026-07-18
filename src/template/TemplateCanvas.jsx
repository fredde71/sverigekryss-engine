import React from "react";
import { normalizeDocumentSize } from "./documentGeometry";

export default function TemplateCanvas({
  template,
  children,
  responsive = false,
  cropped = responsive
}) {
  const wrapperRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const documentSize = normalizeDocumentSize(template.documentSize);
  const cropArea = template.cropArea || {
    top: 0,
    left: 0,
    width: documentSize.width,
    height: documentSize.height
  };
  const viewportArea = cropped ? cropArea : {
    top: 0,
    left: 0,
    width: documentSize.width,
    height: documentSize.height
  };

  React.useEffect(() => {
    if (!responsive || !wrapperRef.current) {
      setScale(1);
      return;
    }

    const updateScale = () => {
      const width = wrapperRef.current?.clientWidth || viewportArea.width;
      setScale(width / viewportArea.width);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, [responsive, viewportArea.width]);

  const sourceSurface = (
    <div
      data-testid="template-canvas-source"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${documentSize.width}px`,
        height: `${documentSize.height}px`,
        transform: `translate(${-viewportArea.left}px, ${-viewportArea.top}px)`,
        transformOrigin: "top left"
      }}
    >
      <img
        src={template.imageSrc}
        alt="grid"
        style={{
          width: `${documentSize.width}px`,
          height: `${documentSize.height}px`,
          display: "block"
        }}
      />

      {children}
    </div>
  );

  if (responsive) {
    return (
      <div
        ref={wrapperRef}
        data-testid="template-canvas-responsive-wrapper"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: `${viewportArea.width}px`,
          aspectRatio: `${viewportArea.width} / ${viewportArea.height}`,
          margin: "0 auto"
        }}
      >
        <div
          data-testid="template-canvas-viewport"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${viewportArea.width}px`,
            height: `${viewportArea.height}px`,
            overflow: "hidden",
            transform: `scale(${scale})`,
            transformOrigin: "top left"
          }}
        >
          {sourceSurface}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="template-canvas-viewport"
      style={{
        position: "relative",
        width: `${viewportArea.width}px`,
        height: `${viewportArea.height}px`,
        overflow: "hidden",
        margin: "0 auto"
      }}
    >
      {sourceSurface}
    </div>
  );
}
