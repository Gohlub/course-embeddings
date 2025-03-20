import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn
import gc
import os

app = FastAPI()
os.environ['CUDA_VISIBLE_DEVICES'] = '0' 
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'

# Load model (do this only once at startup)
print("Loading model...")
model = AutoModel.from_pretrained('nvidia/NV-Embed-v2', trust_remote_code=True, torch_dtype="auto")
model.eval()
# model.half()

device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
print(device.type)
model.to(device)
if device.type == 'cuda':
    # gc.collect()
    torch.cuda.empty_cache()
    torch.cuda.memory.empty_cache()
    torch.cuda.max_memory_allocated()


print(f"Model loaded and moved to {device}")

# Define request and response models
class EmbeddingRequest(BaseModel):
    texts: List[str]
    is_query: bool

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    time_taken: float

# Each query needs to be accompanied by an corresponding instruction describing the task.
task_name_to_instruct = {"example": "Given a question, retrieve passages that answer the question",}
query_prefix = "Instruct: " + task_name_to_instruct["example"] + "\nQuery: "

max_length = 32768

@app.post("/embed", response_model=EmbeddingResponse)
async def embed_texts(request: EmbeddingRequest):
    start_time = time.time()
    
    try:
        with torch.no_grad():
            if device.type == 'cuda':
                # gc.collect()
                torch.cuda.empty_cache()
                torch.cuda.memory.empty_cache()
            if request.is_query:
                texts = [query_prefix + text for text in request.texts]
            else:
                texts = request.texts
            
            embeddings = model.encode(texts, max_length=max_length)
            embeddings = F.normalize(embeddings, p=2, dim=1)

            print(f"Embedding size: {embeddings.size()}")
            
            embeddings_list = embeddings.cpu().float().tolist()
            
        time_taken = time.time() - start_time
        return EmbeddingResponse(embeddings=embeddings_list, time_taken=time_taken)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)