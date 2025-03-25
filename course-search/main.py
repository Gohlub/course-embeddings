import json
import csv
import numpy as np
import torch
import time
import os
import re
import string
import requests
from collections import Counter
from math import log
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional

# Initialize FastAPI app
app = FastAPI(title="Course Search API")

# Set up templates and static files
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

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

# Constants for embedding service
EMBEDDING_SERVICE_URL = "http://localhost:8000/embed"
QUERY_INSTRUCTION = "Provide a concise and relevant answer to the question"

# Function to get query embedding from the embedding service
def get_query_embedding(query_text):
    """Call the embedding service to get a query embedding"""
    if not query_text or query_text.strip() == '':
        return None
    
    payload = {
        "texts": [query_text],
        "is_query": True  # This is a query, not a passage
    }
    
    try:
        response = requests.post(EMBEDDING_SERVICE_URL, json=payload)
        response.raise_for_status()
        result = response.json()
        
        if 'embeddings' in result and len(result['embeddings']) > 0:
            return result['embeddings'][0]
        else:
            print(f"Warning: No embedding returned for query: {query_text[:50]}...")
            return None
    except Exception as e:
        print(f"Error getting query embedding: {e}")
        return None

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
            
            for row in reader:
                # Make sure the row has enough columns
                if len(row) > embedding_index:
                    # Try to parse the embedding JSON
                    try:
                        embedding = json.loads(row[embedding_index])
                        
                        # Skip rows with empty embeddings or wrong embedding size
                        if len(embedding) == 0:
                            courses_without_embeddings += 1
                            continue
                        
                        faculty_first = row[7] if len(row) > 7 else ""
                        faculty_last = row[8] if len(row) > 8 else ""
                        
                        course_data = {
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

# Text preprocessing
def preprocess_text(text):
    """Clean and tokenize text for better matching"""
    if not text:
        return []
    
    # Convert to lowercase
    text = text.lower()
    
    # Remove punctuation
    text = re.sub(f'[{re.escape(string.punctuation)}]', ' ', text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Tokenize
    tokens = text.split()
    
    # Remove common stop words
    stop_words = {'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 
                 'when', 'where', 'how', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
                 'have', 'has', 'had', 'do', 'does', 'did', 'to', 'at', 'by', 'for', 'with',
                 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after',
                 'above', 'below', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
                 'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each',
                 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
                 'same', 'so', 'than', 'too', 'very', 'will', 'just', 'should', 'now'}
    
    return [token for token in tokens if token not in stop_words]

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

# Function to search courses - using proper query/document asymmetric search
def search_courses(query_text, top_k=5, department=None):
    start_time = time.time()
    
    # Filter courses by department if specified
    filtered_courses = courses
    if department:
        filtered_courses = [c for c in courses if c['department'].lower() == department.lower()]
    
    # If no courses match the filter criteria
    if len(filtered_courses) == 0:
        return [], time.time() - start_time
    
    # Get a query embedding using the embedding service
    query_embedding = get_query_embedding(query_text)
    
    # If we couldn't get a query embedding, use fallback methods
    if query_embedding is None:
        # Preprocess query
        query_tokens = preprocess_text(query_text)
        
        # Create a map of course tokens
        all_course_tokens = {}
        for i, course in enumerate(filtered_courses):
            course_text = f"{course['name']} {course['description']}"
            all_course_tokens[i] = preprocess_text(course_text)
        
        # Calculate TF-IDF scores
        tfidf_scores = {}
        for course_id, course_tokens in all_course_tokens.items():
            # Calculate term frequency for each token in the course
            course_tf = Counter(course_tokens)
            
            # Calculate document frequency across all courses
            doc_freq = {}
            for token in set(course_tokens):
                doc_freq[token] = sum(1 for tokens in all_course_tokens.values() if token in tokens)
            
            # Calculate TF-IDF score for each course
            score = 0
            for token in query_tokens:
                if token in course_tf and token in doc_freq and doc_freq[token] > 0:
                    # TF * IDF calculation
                    tf = course_tf[token] / len(course_tokens) if len(course_tokens) > 0 else 0
                    idf = log(len(all_course_tokens) / doc_freq[token]) if doc_freq[token] > 0 else 0
                    score += tf * idf
            
            tfidf_scores[course_id] = score
        
        # Sort courses by TF-IDF score
        similarity_scores = [(i, tfidf_scores[i]) for i in range(len(filtered_courses))]
        similarity_scores.sort(key=lambda x: x[1], reverse=True)
    else:
        # If we have a query embedding, use cosine similarity
        similarity_scores = []
        for i, course in enumerate(filtered_courses):
            # Get course embedding
            course_embedding = course['embedding']
            
            # Calculate cosine similarity
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
@app.get("/")
async def get_search_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/search_courses", response_model=CourseSearchResponse)
async def course_search(request: CourseSearchRequest):
    results, query_time = search_courses(
        request.query, 
        top_k=request.top_k, 
        department=request.department
    )
    return {"results": results, "query_time": query_time}

# Global variables to store course data
courses = []

# Data initialization
def initialize():
    global courses
    
    # Load course data (look for the CSV in current directory and parent directory)
    csv_files = ['course-embd-data-with-embeddings.csv', '../course-embd-data-with-embeddings.csv']
    
    for csv_file in csv_files:
        if os.path.exists(csv_file):
            courses = load_course_data(csv_file)
            break
    
    if not courses:
        print("Warning: No course data loaded!")
        return False
    
    print(f"Successfully loaded {len(courses)} courses")
    return len(courses) > 0

if __name__ == "__main__":
    import uvicorn
    
    # Initialize on startup
    if initialize():
        print(f"Server initialized with {len(courses)} courses")
        uvicorn.run(app, host="0.0.0.0", port=8001)
    else:
        print("Failed to initialize the server. Check if the course data CSV exists.") 