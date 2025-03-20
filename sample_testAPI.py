from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.post("/test")
def test_post(data: dict):
    return {"received": data}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)