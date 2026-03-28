#!/bin/bash

cat << 'EOPY' > backend/app/agents/layout_agent.py
import fitz

class LayoutAgent:

    def verify(self, pdf_data):
        file_path = pdf_data["file_path"]
        doc = fitz.open(file_path)
        page = doc[0]

        blocks = page.get_text("blocks")

        debug = []

        for b in blocks[:100]:  # begränsa output
            x0, y0, x1, y1, text, *_ = b
            w = x1 - x0
            h = y1 - y0

            debug.append({
                "w": round(w, 1),
                "h": round(h, 1),
                "text": text.strip()[:10]
            })

        return {
            "total_blocks": len(blocks),
            "sample_blocks": debug
        }
EOPY

echo "DEBUG MODE aktiverad!"
