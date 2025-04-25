# Course Embeddings Visualization Tool

This project provides a visualization tool for exploring course relationships based on semantic similarity. Using NV-Embed-v2 embeddings and graph visualization, it allows users to explore courses, their semantic relationships, and perform semantic search.

## Project Structure

The project has a consolidated structure with clear separation of concerns:

- `backend/`: FastAPI server that provides course data and pre-calculated similarities
  - `main.py`: Server that calculates similarities and provides APIs

- `frontend/`: React application for visualization
  - `src/`: React source code
  - `public/`: Static assets

- `data/`: Course data files
  - `course-embd-data.csv`: Original course data
  - `course-embd-data-with-embeddings.csv`: Course data with pre-calculated embeddings

- `scripts/`: Utility scripts
  - `embedding_script.py`: Script to generate embeddings for all courses
  - `server.py`: Standalone embedding service (used by generate_embeddings.py)
  - `generate_embeddings.py`: Script to generate embeddings from within the search app

- `start.sh`: Launcher script to start both backend and frontend

## Requirements

- Python 3.8+
- PyTorch 2.0+
- Node.js 14+
- npm 7+
- FastAPI
- Sentence-Transformers
- React
- Sigma.js 2.0+

## Setup and Running

1. **Set up Python Environment**:
   ```
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Setup Node.js Environment**:
   ```
   cd frontend
   npm install
   ```

3. **Start the Application**:
   ```
   ./start.sh
   ```

This script will:
1. Start the backend server on port 8001 
2. Start the frontend development server on port 3000
3. Open your browser to http://localhost:3000

## How it Works

1. The backend pre-calculates pairwise cosine similarities between course embeddings during initialization
2. The graph visualization places courses with higher similarity closer together
3. Departments are still visually distinguishable by color
4. Users can search for courses, filter by department, and explore the semantic space

## Features

- Semantic search for courses based on natural language queries
- Interactive graph visualization of course relationships
- Department filtering and navigation
- Course detail view when selecting a course
- Fast navigation with pre-calculated similarities

## Technical Implementation

- Backend uses FastAPI and Sentence-Transformers to handle embeddings and similarity calculations
- Frontend uses React with Sigma.js for graph visualization
- Cosine similarity is used to measure semantic relatedness between courses
- Force-directed layout with ForceAtlas2 algorithm positions similar courses closer together

## License

Open source for educational purposes.
