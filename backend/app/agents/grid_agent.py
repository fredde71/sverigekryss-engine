import fitz  # PyMuPDF

class GridAgent:
    def extract_cells(self, pdf):

        if isinstance(pdf, fitz.Document):
            page = pdf.load_page(0)
        else:
            page = pdf

        grid_box = fitz.Rect(115, 258, 1976, 2117)

        rows = 25
        cols = 25

        cell_width = grid_box.width / cols
        cell_height = grid_box.height / rows

        cells = []

        for r in range(rows):
            for c in range(cols):
                x0 = grid_box.x0 + c * cell_width
                y0 = grid_box.y0 + r * cell_height
                x1 = x0 + cell_width
                y1 = y0 + cell_height

                rect = fitz.Rect(x0, y0, x1, y1)

                text = page.get_textbox(rect).strip()

                cells.append({
                    "row": r,
                    "col": c,
                    "text": text
                })

        return cells
