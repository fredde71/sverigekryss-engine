from fastapi import APIRouter, UploadFile, File
import os

from app.agents.pdf_intake_agent import PDFIntakeAgent
from app.core.pipeline import Pipeline

router = APIRouter()

UPLOAD_DIR = "../data/uploads"

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    intake_agent = PDFIntakeAgent()
    pipeline = Pipeline()

    pdf = intake_agent.process(file_path)
    result = pipeline.run(pdf)

    return {"message": "Processed", "result": result}
