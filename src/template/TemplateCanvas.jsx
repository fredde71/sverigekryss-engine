import React from "react";

export default function TemplateCanvas({
  template,
  children,
  responsive = false
}) {
  const wrapperRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const cropArea = template.cropArea || {
    top: 0,
    left: 0,
    width: 1200,
    height: 1200
  };

  React.useEffect(() => {
    if (!responsive || !wrapperRef.current) {
      setScale(1);
      return;
    }

    const updateScale = () => {
      const width = wrapperRef.current?.clientWidth || cropArea.width;
      setScale(width / cropArea.width);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, [responsive, cropArea.width]);

  const sourceSurface = (
    <div
      data-testid="template-canvas-source"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "1200px",
        height: "1200px",
        transform: `translate(${-cropArea.left}px, ${-cropArea.top}px)`,
        transformOrigin: "top left"
      }}
    >
      <img
        src={template.imageSrc}
        alt="grid"
        style={{
          width: "1200px",
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
          maxWidth: `${cropArea.width}px`,
          aspectRatio: `${cropArea.width} / ${cropArea.height}`,
          margin: "0 auto"
        }}
      >
        <div
          data-testid="template-canvas-viewport"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${cropArea.width}px`,
            height: `${cropArea.height}px`,
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
        width: `${cropArea.width}px`,
        height: `${cropArea.height}px`,
        overflow: "hidden",
        margin: "0 auto"
      }}
    >
      {sourceSurface}
    </div>
  );
}
