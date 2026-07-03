export function moveGridArea(gridArea, dx, dy) {

  return {
    ...gridArea,
    top: gridArea.top + dy,
    left: gridArea.left + dx
  };

}