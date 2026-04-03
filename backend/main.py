from fastapi import FastAPI
from backend.api.routes import router

app = FastAPI()

app.include_router(router)

@app.get("/")
def root():
    return {"status": "Sverigekryss Engine Running"}