import React from "react";

function PlayCell({
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
  maxLength
}) {
  return (
    <div
    style={{
  width: "100%",
  height: "100%",
  ...style,
  backgroundColor: isActive
    ? "rgba(0, 120, 255, 0.2)"
    : style?.backgroundColor || "transparent"
}}
    >
      <input
        maxLength={maxLength}
        value={value}
        onChange={onChange}
        disabled={disabled}
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
          fontSize: "18px",
          fontWeight: "bold",
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
