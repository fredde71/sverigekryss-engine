import React from "react";
import PlayCell from "../components/PlayCell";
import { CELL_TYPE_BLACK } from "../template/cellTypes";

const cellLabelStyle = {
  position: "absolute",
  top: "2px",
  left: "3px",
  zIndex: 2,
  color: "rgb(15, 23, 42)",
  fontSize: "10px",
  fontWeight: 700,
  lineHeight: 1,
  pointerEvents: "none"
};

function renderCellLabel(cellLabel) {
  if (cellLabel == null || cellLabel === "") return null;

  return (
    <span
      data-testid={`runtime-cell-label-${cellLabel}`}
      aria-hidden="true"
      style={cellLabelStyle}
    >
      {cellLabel}
    </span>
  );
}

export default function RuntimeCell({
  type,
  children,
  style,
  onClick,
  value,
  onChange,
  isActive,
  onFocus,
  onKeyDown,
  inputRef,
  dataIndex,
  cellLabel,
  maxLength,
  presentation = "default",
  isFocusedCell = false,
  isDimmed = false,
  readOnly = false
}) {
  const isMusikkryss = presentation === "musikkryss";
  const dimmedBackground = isMusikkryss && isDimmed
    ? "rgba(255, 255, 255, 0.42)"
    : undefined;

  if (type === CELL_TYPE_BLACK) {
    return (
      <div
        data-testid="runtime-black-cell"
        data-index={dataIndex}
        style={{
          width: "100%",
          height: "100%",
          ...style,
          backgroundColor: "rgb(0, 0, 0)"
        }}
      />
    );
  }

  if (type === "image") {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: dimmedBackground,
        ...style
      }}
    />
);
}

  if (type === "double" || type === "blocked") {
  return (
    <div
      data-testid="runtime-clue-cell"
      onClick={onClick}
      style={{
        width: "100%",
        height: "100%",
        ...style,
        backgroundColor: isActive
          ? "rgba(0, 120, 255, 0.2)"
          : dimmedBackground || style?.backgroundColor || "transparent",
        cursor: onClick ? "pointer" : "default"
      }}
    >
      {children}
    </div>
  );
}

  if (type === "write") {
  return (
    <PlayCell
      disabled={false}
      readOnly={readOnly}
      value={value}
      onChange={onChange}
      isActive={isActive}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
      dataIndex={dataIndex}
      maxLength={maxLength}
      presentation={presentation}
      isFocusedCell={isFocusedCell}
      isDimmed={isDimmed}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        cursor: onClick ? "pointer" : "default",
        ...style
      }}
    >
      {renderCellLabel(cellLabel)}
      {children}
    </PlayCell>
  );
}

return (
  <div
    style={{
      width: "100%",
      height: "100%",
      backgroundColor: dimmedBackground,
      ...style
    }}
  />
);
}
