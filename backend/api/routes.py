from backend.agents.layout_validator import validate_layout

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    from datetime import datetime
    import os

    UPLOAD_FOLDER = "storage/pdf"
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    with open(filepath, "wb") as buffer:
        buffer.write(await file.read())

    # 🔥 VALIDATOR
    is_valid, message = validate_layout(filepath)

    if not is_valid:
        os.remove(filepath)
        return {
            "status": "error",
            "message": message
        }

    return {
        "status": "uploaded",
        "filename": filename,
        "path": filepath,
        "validation": message
    }