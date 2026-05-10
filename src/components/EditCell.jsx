import React from "react";

function EditCell({
  isEdit,
  className,
  ...props
}) {

  const style = isEdit
    ? {
        border: "1px solid rgba(0,0,0,0.15)"
      }
    : {};

  return (
    <div
      {...props}
      className={className}
      style={style}
    />
  );
}

export default React.memo(EditCell);