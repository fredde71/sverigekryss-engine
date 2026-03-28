#!/bin/bash

cat << 'EOPY' > backend/app/agents/layout_agent.py
import fitz
import os
import cv2
import numpy as np

class LayoutAgent:

    def verify(self, pdf_data):
        file_path = pdf_data["file_path"]
        doc = fitz.open(file_path)
        page = doc[0]

        pix = page.get_pixmap(dpi=200)

        image_path = "../data/processed/page.png"
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        pix.save(image_path)

        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        max_area = 0
        best_box = None

        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            area = w * h

            if area > max_area:
                max_area = area
                best_box = (x, y, w, h)

        x, y, w, h = best_box
        grid_img = img[y:y+h, x:x+w]

        # 🔥 dela upp i 25x25
        rows = 25
        cols = 25

        cell_h = h // rows
        cell_w = w // cols

        cells = []

        for r in range(rows):
            for c in range(cols):
                cx = c * cell_w
                cy = r * cell_h

                cell = grid_img[cy:cy+cell_h, cx:cx+cell_w]

                cells.append({
                    "row": r,
                    "col": c,
                    "x": cx,
                    "y": cy
                })

        return {
            "grid_box": best_box,
            "cell_size": {
                "width": cell_w,
                "height": cell_h
            },
            "total_cells": len(cells)
        }
EOPY

echo "Grid split klar!"
