#!/bin/bash

cat << 'EOPY' > backend/app/agents/layout_agent.py
import fitz

class LayoutAgent:

    def verify(self, pdf_data):
        file_path = pdf_data["file_path"]
        doc = fitz.open(file_path)
        page = doc[0]

        drawings = page.get_drawings()

        vertical_lines = []
        horizontal_lines = []

        for d in drawings:
            items = d.get("items", [])

            for item in items:
                try:
                    # vi bryr oss bara om linjer
                    if item[0] != "l":
                        continue

                    coords = item[1]

                    # säkerställ att vi har 4 värden
                    if len(coords) != 4:
                        continue

                    x0, y0, x1, y1 = coords

                    # vertikal linje
                    if abs(x0 - x1) < 2:
                        vertical_lines.append(x0)

                    # horisontell linje
                    if abs(y0 - y1) < 2:
                        horizontal_lines.append(y0)

                except Exception:
                    continue

        vertical_lines = sorted(set(round(x) for x in vertical_lines))
        horizontal_lines = sorted(set(round(y) for y in horizontal_lines))

        return {
            "vertical_lines": len(vertical_lines),
            "horizontal_lines": len(horizontal_lines),
            "estimated_grid_size": {
                "cols": max(0, len(vertical_lines) - 1),
                "rows": max(0, len(horizontal_lines) - 1)
            }
        }
EOPY

echo "LayoutAgent v4 (fixad) klar!"
