#!/bin/bash

cat << 'EOPY' > backend/app/agents/layout_agent.py
import fitz
import os

class LayoutAgent:

    def verify(self, pdf_data):
        file_path = pdf_data["file_path"]
        doc = fitz.open(file_path)
        page = doc[0]

        # rendera som bild
        pix = page.get_pixmap(dpi=200)

        image_path = "../data/processed/page.png"
        os.makedirs(os.path.dirname(image_path), exist_ok=True)

        pix.save(image_path)

        return {
            "status": "converted_to_image",
            "image_path": image_path
        }
EOPY

echo "PDF -> Image konvertering klar!"
