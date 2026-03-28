import fitz  # pymupdf

def validate_layout(pdf_path: str):
    doc = fitz.open(pdf_path)

    if len(doc) == 0:
        return False, "PDF is empty"

    page = doc[0]

    text = page.get_text()

    # enkla kontroller (första version)
    if "SVERIGEKRYSSET" not in text:
        return False, "Not a Sverigekryss PDF"

    if "Lös korsordet" not in text:
        return False, "Missing expected instruction text"

    return True, "Layout OK"