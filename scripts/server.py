import torch
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn
import os
from sentence_transformers import SentenceTransformer

app = FastAPI()
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'  # This disables CUDA completely

# Set CPU device first
device = torch.device("cpu")
print(f"Using device: {device.type}")

# Then load the model with CPU - using a more recent model that supports asymmetric semantic search
print("Loading model...")
model = SentenceTransformer('nvidia/NV-Embed-v2', trust_remote_code=True, device=device)
model.max_seq_length = 16384
model.tokenizer.padding_side = "right"

print(f"Model loaded on {device}")

# Define request and response models
class EmbeddingRequest(BaseModel):
    texts: List[str]
    is_query: bool

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]
    time_taken: float

# Query instructions for better semantic search
QUERY_INSTRUCTION = "Provide a concise and relevant answer to the question"
PASSAGE_INSTRUCTION = "Provide information that would help answer questions"

@app.post("/embed", response_model=EmbeddingResponse)
async def embed_texts(request: EmbeddingRequest):
    start_time = time.time()
    
    try:
        with torch.no_grad():
            # Add EOS token to input texts
            input_texts = [text + model.tokenizer.eos_token for text in request.texts]
            
            if request.is_query:
                # For queries, use the specific instruction for queries
                embeddings = model.encode(
                    input_texts, 
                    batch_size=1, 
                    normalize_embeddings=True,
                    prompt=QUERY_INSTRUCTION
                )
            else:
                # For passages, use the passage instruction
                embeddings = model.encode(
                    input_texts, 
                    batch_size=1, 
                    normalize_embeddings=True,
                    prompt=PASSAGE_INSTRUCTION
                )
            
            print(f"Embedding size: {embeddings.shape}")
            
            # Convert numpy array to list
            embeddings_list = embeddings.tolist()
            
        time_taken = time.time() - start_time
        return EmbeddingResponse(embeddings=embeddings_list, time_taken=time_taken)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Add a simple test endpoint that doesn't use the model
@app.post("/test")
async def test_endpoint(data: dict):
    return {"received": data, "message": "Test endpoint working!"}

# Add a debugging endpoint for the embed functionality
@app.post("/debug_embed")
async def debug_embed(request: EmbeddingRequest):
    try:
        # Check if model has encode method
        has_encode = hasattr(model, 'encode')
        model_methods = [method for method in dir(model) if not method.startswith('_') and callable(getattr(model, method))]
        
        return {
            "received_request": request.dict(),
            "model_has_encode_method": has_encode,
            "available_model_methods": model_methods[:20],  # Limit to first 20 methods
            "model_type": str(type(model))
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)