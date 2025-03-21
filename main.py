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
            
            # The nvidia/NV-Embed-v2 model might not have a direct encode method
            # Let's check if the method exists and use it correctly
            if hasattr(model, 'encode'):
                embeddings = model.encode(texts, max_length=max_length)
            else:
                # Try using the forward method or embedding generation approach
                # This is a common pattern for transformer models
                from transformers import AutoTokenizer
                
                tokenizer = AutoTokenizer.from_pretrained('nvidia/NV-Embed-v2', trust_remote_code=True)
                inputs = tokenizer(texts, padding=True, truncation=True, return_tensors="pt", max_length=max_length)
                
                # Move inputs to the same device as model
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                # Get embeddings from model
                outputs = model(**inputs)
                
                # The output format depends on the specific model architecture
                # This is a common way to get sentence embeddings
                # Try different options based on model output
                if hasattr(outputs, 'pooler_output'):
                    embeddings = outputs.pooler_output
                elif hasattr(outputs, 'last_hidden_state'):
                    # Use mean pooling of last hidden state
                    attention_mask = inputs['attention_mask']
                    last_hidden = outputs.last_hidden_state
                    embeddings = torch.sum(last_hidden * attention_mask.unsqueeze(-1), dim=1) / torch.sum(attention_mask, dim=1, keepdim=True)
                else:
                    # If we can't find a standard pattern, raise an error
                    raise ValueError("Could not determine how to extract embeddings from this model")
            
            # Normalize the embeddings
            embeddings = F.normalize(embeddings, p=2, dim=1)

            print(f"Embedding size: {embeddings.size()}")
            
            embeddings_list = embeddings.cpu().float().tolist()
            
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