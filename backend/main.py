from fastapi import FastAPI
from fastapi.responses import FileResponse
from app.routes.upload import router
import os

app = FastAPI()

app.include_router(router)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_PATH = os.path.join(BASE_DIR, "../data/processed/grid.png")

@app.get("/")
def root():
    return {"status": "Sverigekryss Engine running"}

# 🔥 NY ENDPOINT
@app.get("/grid-image")
def get_grid_image():
    return FileResponse(IMAGE_PATH)
