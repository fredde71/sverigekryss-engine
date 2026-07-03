import React from "react";
import PlayCell from "../components/PlayCell";

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
  maxLength
}) {
  if (type === "blocked") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "transparent",
          ...style
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
        ...style
      }}
    />
  );
}

  if (type === "double") {
  return (
    <div
      onClick={onClick}
      style={{
        width: "100%",
        height: "100%",
        ...style,
        backgroundColor: isActive
          ? "rgba(0, 120, 255, 0.2)"
          : style?.backgroundColor || "transparent",
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
      value={value}
      onChange={onChange}
      isActive={isActive}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
      dataIndex={dataIndex}
      maxLength={maxLength}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        cursor: onClick ? "pointer" : "default",
        ...style
      }}
    >
      {children}
    </PlayCell>
  );
}

return (
  <div
    style={{
      width: "100%",
      height: "100%",
      ...style
    }}
  />
);
}
