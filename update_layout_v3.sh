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
            for item in d["items"]:
                if item[0] == "l":  # line
                    x0, y0, x1, y1 = item[1]

                    # vertikal linje
                    if abs(x0 - x1) < 2:
                        vertical_lines.append(x0)

                    # horisontell linje
                    if abs(y0 - y1) < 2:
                        horizontal_lines.append(y0)

        # unika linjer (avrunda)
        vertical_lines = sorted(set(round(x) for x in vertical_lines))
        horizontal_lines = sorted(set(round(y) for y in horizontal_lines))

        return {
            "vertical_lines": len(vertical_lines),
            "horizontal_lines": len(horizontal_lines),
            "estimated_grid_size": {
                "cols": len(vertical_lines) - 1,
                "rows": len(horizontal_lines) - 1
            }
        }
EOPY

echo "LayoutAgent v3 (linje-detektion) klar!"
