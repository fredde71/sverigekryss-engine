#!/bin/bash

cat << 'EOPY' > backend/app/agents/layout_agent.py
import fitz
from collections import defaultdict

class LayoutAgent:

    def verify(self, pdf_data):
        file_path = pdf_data["file_path"]
        doc = fitz.open(file_path)
        page = doc[0]

        blocks = page.get_text("blocks")

        candidates = []

        for b in blocks:
            x0, y0, x1, y1, text, *_ = b
            w = x1 - x0
            h = y1 - y0

            # 🔥 striktare filter
            if 15 < w < 35 and 15 < h < 35 and len(text.strip()) <= 2:
                candidates.append((round(x0), round(y0)))

        # gruppera i rader
        rows = defaultdict(list)

        for x, y in candidates:
            row_key = round(y / 20)  # gruppera vertikalt
            rows[row_key].append((x, y))

        # hitta rader med många celler
        valid_rows = [r for r in rows.values() if len(r) > 10]

        # välj största sammanhängande grupp
        grid_cells = []
        for r in valid_rows:
            grid_cells.extend(r)

        return {
            "valid": True,
            "total_blocks": len(blocks),
            "candidate_cells": len(candidates),
            "grid_cells_detected": len(grid_cells),
            "rows_detected": len(valid_rows)
        }
EOPY

echo "LayoutAgent v2 uppdaterad!"
