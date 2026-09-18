import React from "react";

function PlayCell({
  children,
  value,
  onChange,
  style,
  disabled,
  isActive,
  onClick,
  onFocus,
  onKeyDown,
  inputRef,
  dataIndex,
  maxLength,
  presentation = "default",
  isFocusedCell = false,
  isDimmed = false,
  readOnly = false
}) {
  const isMusikkryss = presentation === "musikkryss";
  const backgroundColor = isMusikkryss
    ? musikkryssCellBackground({ isActive, isFocusedCell, isDimmed })
    : isActive
      ? "rgba(0, 120, 255, 0.2)"
      : style?.backgroundColor || "transparent";

  return (
    <div
    data-path-state={isMusikkryss
      ? isFocusedCell
        ? "focused"
        : isActive
          ? "selected"
          : isDimmed
            ? "dimmed"
            : "idle"
      : undefined}
    style={{
  position: "relative",
  width: "100%",
  height: "100%",
  ...style,
  backgroundColor
}}
    >
      {children}
      <input
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={isActive}
        ref={inputRef}
        data-index={dataIndex}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onClick={onClick}
        style={{
          width: "100%",
          height: "100%",
          textAlign: "center",
          fontSize: isMusikkryss ? "30px" : "18px",
          fontWeight: "bold",
          lineHeight: 1,
          border: "none",
          outline: "none",
          backgroundColor: "transparent",
          padding: 0,
          margin: 0,
          boxSizing: "border-box"
        }}
      />
    </div>
  );
}

export default React.memo(PlayCell);

function musikkryssCellBackground({ isActive, isFocusedCell, isDimmed }) {
  if (isFocusedCell) return "rgba(37, 99, 235, 0.58)";
  if (isActive) return "rgba(125, 211, 252, 0.52)";
  if (isDimmed) return "rgba(148, 163, 184, 0.38)";
  return "transparent";
}
