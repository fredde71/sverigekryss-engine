import React from "react";

function PlayCell({
  children,
  style,
  ...props
}) {
  return (
    <div
      {...props}
      style={style}
    >
      {children}
    </div>
  );
}

export default React.memo(PlayCell);