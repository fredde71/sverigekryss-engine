import React from "react";

export default function TemplateCanvas({
  template,
  children,
  responsive = false
}) {
  const wrapperRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    if (!responsive || !wrapperRef.current) {
      setScale(1);
      return;
    }

    const updateScale = () => {
      const width = wrapperRef.current?.clientWidth || 1200;
      setScale(width / 1200);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, [responsive]);

  if (responsive) {
    return (
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1200px",
          aspectRatio: "1 / 1",
          margin: "0 auto"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "1200px",
            transform: `scale(${scale})`,
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
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "1200px",
        height: "1200px",
        margin: "0 auto"
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
}
