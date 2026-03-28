import fitz

class PDFIntakeAgent:
    def process(self, file_path):
        doc = fitz.open(file_path)

        return {
            "file_path": file_path,
            "page_count": len(doc)
        }
