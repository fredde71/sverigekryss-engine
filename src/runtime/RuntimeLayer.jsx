import React, { useRef, useState } from "react";

import RuntimeGrid from "./RuntimeGrid";
import RuntimeCell from "./RuntimeCell";

import { getActiveCells } from "../engine/activeLine";
import { resolveClueSelection } from "../engine/clueSelection";

import {
  getNextCell,
  getArrowNextIndex,
  focusNextInput,
  getDirection
} from "../engine/navigation";

import { normalizeInputValue } from "../engine/input";

export default function RuntimeLayer({
  data,
  onAnswersChange,
  externalAnswerSelection = null,
  presentation = "default"
}) {

  console.log("RuntimeLayer rendered");

  const [answers, setAnswers] = useState({});
  const [activeCell, setActiveCell] = useState(null);
  const [direction, setDirection] = useState("across");
  const [clueSelection, setClueSelection] = useState(null);

React.useEffect(() => {
  console.log("RuntimeLayer activeCell changed", activeCell);
}, [activeCell]);

const inputRefs = useRef([]);

React.useEffect(() => {
  if (!externalAnswerSelection) return undefined;

  const answerCellIndexes = externalAnswerSelection.answerCellIndexes;
  const firstCellIndex = answerCellIndexes[0];
  const resolution = Object.freeze({
    clueIndex: firstCellIndex,
    clueType: "musikkryss-answer",
    direction: externalAnswerSelection.direction,
    answerStartIndex: firstCellIndex,
    answerLength: answerCellIndexes.length,
    answerCellIndexes
  });

  setDirection(externalAnswerSelection.direction);
  setClueSelection(resolution);
  setActiveCell(firstCellIndex);

  const focusTimer = setTimeout(() => {
    focusNextInput({
      nextIndex: firstCellIndex,
      inputRefs
    });
  }, 0);

  return () => clearTimeout(focusTimer);
}, [externalAnswerSelection]);

const handleCellChange = (index, rawValue) => {

  console.log("RuntimeLayer handleCellChange called", {
    index,
    rawValue
  });
    
  const value = normalizeInputValue(rawValue);

  setAnswers(prev => {
    const next = {
      ...prev,
      [index]: value
    };

    onAnswersChange?.(next);

    return next;
  });
  if (value) {

  setTimeout(() => {

    const nextIndex = getNextCell({
      currentIndex: index,
      direction,
      cols,
      rows,
      cellTypes,
      clueSelection
    });

    focusNextInput({
      nextIndex,
      inputRefs
    });

  }, 0);

}
};

const handleCellClick = (index) => {

  console.log("RuntimeLayer handleCellClick called", index);

  setActiveCell(index);

  if (cellTypes[index] === "blocked" || cellTypes[index] === "double") {
    const resolution = resolveClueSelection({
      currentIndex: index,
      currentDirection: direction,
      cols,
      rows,
      cellTypes,
      answerPaths
    });

    setClueSelection(resolution);
    if (resolution) {
      setDirection(resolution.direction);
    }
    return;
  }

  setClueSelection(null);

  const directionResult = getDirection({
    currentIndex: index,
    cols,
    rows,
    cellTypes
  });

  if (directionResult === "toggle") {

    setDirection(prev =>
      prev === "across"
        ? "down"
        : "across"
    );

  } else if (directionResult) {

    setDirection(directionResult);

  }

};

  if (!data) {
    return <div>Loading...</div>;
  }

  const {
    cellTypes,
    rows,
    cols,
    gridArea,
    answerPaths = []
  } = data;

  console.log(
    "RuntimeLayer write cells found",
    Array.from({ length: rows * cols }).filter((_, i) => cellTypes[i] === "write").length
  );

  const activeCells = getActiveCells({
  activeCell,
  direction,
  cellTypes,
  cols,
  rows,
  clueSelection
});

  console.log("RuntimeLayer activeCells size", activeCells.size);

  return (
    <div
      style={{
        position: "absolute",
        top: gridArea.top,
        left: gridArea.left,
        width: gridArea.width,
        height: gridArea.height,
        zIndex: 30
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%"
          }}
        >
        <RuntimeGrid
  rows={rows}
  cols={cols}
  gridArea={gridArea}
  horizontalLinePositions={data.horizontalLinePositions}
  verticalLinePositions={data.verticalLinePositions}
>
  {Array.from({ length: rows * cols }).map((_, i) => {
   
   const type = cellTypes[i];

if (type === "image") {
  return (
    <RuntimeCell
      key={i}
      type={type}
      presentation={presentation}
      isDimmed={presentation === "musikkryss"
        && Boolean(clueSelection)
        && !activeCells.has(i)}
    />
  );
}

if (type === "blocked") {
  return (
    <RuntimeCell
      key={i}
      type={type}
      dataIndex={i}
      isActive={false}
      presentation={presentation}
      isDimmed={presentation === "musikkryss"
        && Boolean(clueSelection)
        && !activeCells.has(i)}
      onClick={() => handleCellClick(i)}
    />
  );
}

return (
  <RuntimeCell
  key={i}
  type={cellTypes[i]}
  value={answers[i] || ""}
  inputRef={(el) => (inputRefs.current[i] = el)}
  dataIndex={i}
  isActive={activeCells.has(i)}
  isFocusedCell={presentation === "musikkryss"
    && activeCells.has(i)
    && activeCell === i}
  isDimmed={presentation === "musikkryss"
    && Boolean(clueSelection)
    && !activeCells.has(i)}
  presentation={presentation}
  onClick={() => handleCellClick(i)}
  onFocus={(e) => {
  e.target.select();
  setActiveCell(i);
}}
  onChange={(e) => {
    handleCellChange(i, e.target.value);
  }}
  onKeyDown={(e) => {

  if (
    ![
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp"
    ].includes(e.key)
  ) return;

  e.preventDefault();

  const nextIndex = getArrowNextIndex({
    currentIndex: i,
    key: e.key,
    cols
  });

  focusNextInput({
    nextIndex,
    inputRefs
  });

}}
/>
  );
  })}
</RuntimeGrid>
        </div>
      </div>
    </div>
  );
}
