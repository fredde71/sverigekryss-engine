#!/bin/bash

cat << 'EOPY' > backend/app/agents/layout_agent.py
import fitz

class LayoutAgent:

    def verify(self, pdf_data):
        file_path = pdf_data["file_path"]
        doc = fitz.open(file_path)
        page = doc[0]

        blocks = page.get_text("blocks")

        small_blocks = []

        for b in blocks:
            x0, y0, x1, y1, text, *_ = b
            width = x1 - x0
            height = y1 - y0

            if width < 40 and height < 40 and text.strip():
                small_blocks.append({
                    "x": x0,
                    "y": y0
                })

        clusters = self.cluster_blocks(small_blocks)
        main_cluster = max(clusters, key=lambda c: len(c)) if clusters else []

        return {
            "valid": True,
            "total_blocks": len(blocks),
            "grid_cells_detected": len(main_cluster),
            "clusters_found": len(clusters)
        }

    def cluster_blocks(self, blocks):
        clusters = []

        for b in blocks:
            added = False

            for cluster in clusters:
                if any(abs(b["x"] - c["x"]) < 100 and abs(b["y"] - c["y"]) < 100 for c in cluster):
                    cluster.append(b)
                    added = True
                    break

            if not added:
                clusters.append([b])

        return clusters
EOPY

echo "LayoutAgent uppdaterad!"
