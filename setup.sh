#!/bin/bash

echo "Skapar projektstruktur..."

mkdir -p backend/app/agents
mkdir -p backend/app/core
mkdir -p backend/app/routes

mkdir -p data/uploads
mkdir -p data/processed
mkdir -p data/templates
mkdir -p data/learning

touch backend/app/__init__.py
touch backend/app/agents/__init__.py
touch backend/app/routes/__init__.py
touch backend/app/core/__init__.py

echo "Skapar backend-filer..."

cat << 'EOPY' > backend/main.py
from fastapi import FastAPI
from app.routes.upload import router

app = FastAPI()

app.include_router(router)

@app.get("/")
def root():
    return {"status": "Sverigekryss Engine running"}
EOPY

cat << 'EOPY' > backend/app/routes/upload.py
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
EOPY

cat << 'EOPY' > backend/app/agents/pdf_intake_agent.py
import fitz

class PDFIntakeAgent:
    def process(self, file_path):
        doc = fitz.open(file_path)

        return {
            "file_path": file_path,
            "page_count": len(doc)
        }
EOPY

cat << 'EOPY' > backend/app/agents/layout_agent.py
class LayoutAgent:
    def verify(self, pdf_data):
        return True
EOPY

cat << 'EOPY' > backend/app/agents/learning_agent.py
import json
import os

LEARNING_FILE = "../data/learning/corrections.json"

class LearningAgent:
    def __init__(self):
        os.makedirs(os.path.dirname(LEARNING_FILE), exist_ok=True)
        if not os.path.exists(LEARNING_FILE):
            with open(LEARNING_FILE, "w") as f:
                json.dump([], f)

    def save_correction(self, correction):
        with open(LEARNING_FILE, "r") as f:
            data = json.load(f)

        data.append(correction)

        with open(LEARNING_FILE, "w") as f:
            json.dump(data, f, indent=2)
EOPY

cat << 'EOPY' > backend/app/core/pipeline.py
from app.agents.layout_agent import LayoutAgent

class Pipeline:
    def __init__(self):
        self.layout_agent = LayoutAgent()

    def run(self, pdf):
        is_valid = self.layout_agent.verify(pdf)

        return {
            "layout_valid": is_valid,
            "message": "Pipeline executed"
        }
EOPY

cat << 'EOPY' > backend/requirements.txt
fastapi
uvicorn
pymupdf
python-multipart
EOPY

echo "KLART!"
