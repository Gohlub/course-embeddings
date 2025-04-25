import json
import csv
import numpy as np
import torch
import time
import os
from tqdm import tqdm
import re
import string
import requests
from collections import Counter
from math import log
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from sentence_transformers import SentenceTransformer

# Initialize FastAPI app
app = FastAPI(title="Course Graph API")

# Enable CORS (Cross-Origin Resource Sharing) to allow the frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request and response models
class CourseSearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 5
    department: Optional[str] = None

class CourseMatch(BaseModel):
    score: float
    code: str
    name: str
    description: str
    department: str
    faculty: str

class CourseSearchResponse(BaseModel):
    results: List[CourseMatch]
    query_time: float

class GraphDataResponse(BaseModel):
    nodes: List[Dict]
    similarities: Dict[str, float]
    departments: List[str]

# Instructions for transformer model
QUERY_INSTRUCTION = "Provide a concise and relevant answer to the question"
PASSAGE_INSTRUCTION = "Provide information that would help answer questions"

# Initialize global variables
courses = []
pairwise_similarities = {}  # Will store pre-calculated similarities
model = None  # Will hold the SentenceTransformer model for query embedding

# Load courses with embeddings
def load_course_data(csv_file):
    courses = []
    courses_without_embeddings = 0
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)  # Skip header
            
            # Find the embedding column index (it should be the last column)
            embedding_index = len(headers) - 1
            if 'Embedding' in headers:
                embedding_index = headers.index('Embedding')
            
            for i, row in enumerate(reader):
                # Make sure the row has enough columns
                if len(row) > embedding_index:
                    # Try to parse the embedding JSON
                    try:
                        embedding = json.loads(row[embedding_index])
                        
                        # Skip rows with empty embeddings
                        if len(embedding) == 0:
                            courses_without_embeddings += 1
                            continue
                        
                        faculty_first = row[7] if len(row) > 7 else ""
                        faculty_last = row[8] if len(row) > 8 else ""
                        
                        # Add course with a unique ID
                        course_data = {
                            'id': f"course-{i}",  # Unique ID for references
                            'code': row[0],
                            'name': row[1],
                            'start_date': row[2] if len(row) > 2 else "",
                            'end_date': row[3] if len(row) > 3 else "",
                            'section': row[6] if len(row) > 6 else "",
                            'faculty': f"{faculty_first} {faculty_last}".strip(),
                            'department': row[10] if len(row) > 10 else "",
                            'delivery': row[11] if len(row) > 11 else "",
                            'description': row[12] if len(row) > 12 else "",
                            'embedding': embedding
                        }
                        courses.append(course_data)
                    except json.JSONDecodeError:
                        print(f"Warning: Could not parse embedding for course {row[0]}")
                        courses_without_embeddings += 1
        
        print(f"Loaded {len(courses)} courses from {csv_file}")
        if courses_without_embeddings > 0:
            print(f"Skipped {courses_without_embeddings} courses with missing or invalid embeddings")
    except Exception as e:
        print(f"Error loading course data: {e}")
    return courses

# Calculate cosine similarity between two vectors
def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors"""
    if not vec1 or not vec2:
        return 0
    
    # Convert to numpy arrays for easier calculation
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    
    # Calculate dot product
    dot_product = np.dot(vec1, vec2)
    
    # Calculate magnitudes
    magnitude1 = np.linalg.norm(vec1)
    magnitude2 = np.linalg.norm(vec2)
    
    # Prevent division by zero
    if magnitude1 == 0 or magnitude2 == 0:
        return 0
    
    # Calculate cosine similarity
    return dot_product / (magnitude1 * magnitude2)

# Pre-calculate all pairwise similarities between courses
def calculate_pairwise_similarities():
    """Pre-calculate similarities between all pairs of courses"""
    global pairwise_similarities
    pairwise_similarities = {}
    
    print("Pre-calculating pairwise similarities...")
    total_pairs = (len(courses) * (len(courses) - 1)) // 2
    
    # Use a progress bar for better visibility during initialization
    with tqdm(total=total_pairs) as pbar:
        for i in range(len(courses)):
            for j in range(i+1, len(courses)):  # Only calculate each pair once
                course1 = courses[i]
                course2 = courses[j]
                
                # Calculate similarity
                similarity = cosine_similarity(course1['embedding'], course2['embedding'])
                
                # Store similarity (as a string key for JSON compatibility)
                key = f"{course1['id']},{course2['id']}"
                pairwise_similarities[key] = similarity
                
                # Also store the reverse direction with the same value
                key_reverse = f"{course2['id']},{course1['id']}"
                pairwise_similarities[key_reverse] = similarity
                
                pbar.update(1)
    
    print(f"Calculated {len(pairwise_similarities) // 2} unique pairwise similarities")

# Extract all departments from courses
def extract_departments():
    """Get unique departments from all courses"""
    departments = set()
    for course in courses:
        if course['department']:
            departments.add(course['department'])
    return sorted(list(departments))

# Function to search courses using embeddings
def search_courses(query_text, top_k=5, department=None):
    """Search for courses semantically similar to the query"""
    global model
    start_time = time.time()
    
    # Filter courses by department if specified
    filtered_courses = courses
    if department:
        filtered_courses = [c for c in courses if c['department'].lower() == department.lower()]
    
    # If no courses match the filter criteria
    if len(filtered_courses) == 0:
        return [], time.time() - start_time
    
    # Generate query embedding
    if model is None:
        print("Loading SentenceTransformer model for query embedding...")
        model = SentenceTransformer('nvidia/NV-Embed-v2', trust_remote_code=True, device="cpu")
        model.max_seq_length = 16384
        model.tokenizer.padding_side = "right"
    
    # Generate embedding for the query
    try:
        # Add EOS token to input text
        input_text = query_text + model.tokenizer.eos_token
        
        # Generate embedding with query instruction
        with torch.no_grad():
            query_embedding = model.encode(
                [input_text],
                batch_size=1,
                normalize_embeddings=True,
                prompt=QUERY_INSTRUCTION
            )[0].tolist()
    except Exception as e:
        print(f"Error generating query embedding: {e}")
        return [], time.time() - start_time
    
    # Calculate similarity between query and all courses
    similarity_scores = []
    for i, course in enumerate(filtered_courses):
        course_embedding = course['embedding']
        similarity = cosine_similarity(query_embedding, course_embedding)
        similarity_scores.append((i, similarity))
    
    # Sort by similarity score (descending)
    similarity_scores.sort(key=lambda x: x[1], reverse=True)
    
    # Get top-k matches
    matches = []
    for i, similarity in similarity_scores[:top_k]:
        course = filtered_courses[i]
        matches.append({
            'score': similarity,
            'code': course['code'],
            'name': course['name'],
            'description': course['description'],
            'department': course['department'],
            'faculty': course['faculty']
        })
    
    query_time = time.time() - start_time
    return matches, query_time

# API endpoints
@app.post("/search_courses", response_model=CourseSearchResponse)
async def course_search(request: CourseSearchRequest):
    """API endpoint for searching courses by query"""
    results, query_time = search_courses(
        request.query, 
        top_k=request.top_k, 
        department=request.department
    )
    return {"results": results, "query_time": query_time}

@app.get("/api/graph-data", response_model=GraphDataResponse)
async def get_graph_data():
    """API endpoint to get all course data and similarities for the graph visualization"""
    # Create a copy of courses without the large embedding arrays to reduce payload size
    nodes = []
    for course in courses:
        # Only include necessary fields for the frontend
        node = {
            'id': course['id'],
            'code': course['code'],
            'name': course['name'],
            'department': course['department'],
            'faculty': course['faculty'],
            'description': course['description']
        }
        nodes.append(node)
    
    # Get unique departments
    departments = extract_departments()
    
    return {
        "nodes": nodes,
        "similarities": pairwise_similarities,
        "departments": departments
    }

# Add a proxy endpoint for search that passes the query to the embedding server
@app.post("/api/search", response_model=CourseSearchResponse)
async def search_proxy(request: CourseSearchRequest):
    """API endpoint for searching courses that embeds queries on-the-fly"""
    results, query_time = search_courses(
        request.query, 
        top_k=request.top_k, 
        department=request.department
    )
    return {"results": results, "query_time": query_time}

# Data initialization
def initialize():
    """Initialize the application by loading data and pre-calculating similarities"""
    global courses
    
    # Load course data
    csv_file = '../data/course-embd-data-with-embeddings.csv'
    if not os.path.exists(csv_file):
        print(f"Warning: {csv_file} not found, looking in alternate locations")
        
        # Try alternate locations
        alternate_paths = [
            'data/course-embd-data-with-embeddings.csv',
            'course-embd-data-with-embeddings.csv'
        ]
        
        for alt_path in alternate_paths:
            if os.path.exists(alt_path):
                csv_file = alt_path
                print(f"Found CSV at {csv_file}")
                break
    
    if not os.path.exists(csv_file):
        print("Error: Could not find course data CSV file")
        return False
    
    # Load courses
    courses = load_course_data(csv_file)
    
    if not courses:
        print("Warning: No course data loaded!")
        return False
    
    # Calculate pairwise similarities
    calculate_pairwise_similarities()
    
    print(f"Successfully loaded {len(courses)} courses and calculated similarities")
    return len(courses) > 0

if __name__ == "__main__":
    import uvicorn
    
    # Initialize on startup
    if initialize():
        print(f"Server initialized with {len(courses)} courses")
        uvicorn.run(app, host="0.0.0.0", port=8001)
    else:
        print("Failed to initialize the server. Check if the course data CSV exists.") 