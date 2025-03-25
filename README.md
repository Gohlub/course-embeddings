# Course Search with Sentence-BERT

This project implements a semantic search application for courses using Sentence-BERT embeddings. The application allows users to find relevant courses based on natural language queries.

## Project Structure

- `server.py`: Embedding service that generates embeddings using Sentence-BERT
- `embedding_script.py`: Script to generate embeddings for all courses
- `course-search/`: Search application that uses the embeddings for semantic search
  - `main.py`: FastAPI application for course search
  - `generate_embeddings.py`: Script to generate embeddings from within the search app
  - `templates/`: HTML templates for the search interface
  - `static/`: Static assets for the web interface
  - `run.sh`: Script to run the course search application

## Requirements

- Python 3.8+
- PyTorch 2.0+
- FastAPI
- Sentence-Transformers
- Other dependencies in requirements.txt

## Setup and Running

1. **Set up the Environment**:
   ```
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Start the Embedding Server**:
   ```
   python server.py
   ```

3. **Run the Course Search Application** (in a separate terminal):
   ```
   cd course-search
   bash run.sh
   ```

The run script will:
1. Check if the embedding server is running
2. Generate embeddings if they don't exist
3. Start the search application on http://localhost:8000

## How it Works

1. The Sentence-BERT model (`nvidia/NV-Embed-v2`) is used to generate embeddings for course descriptions.
2. Course descriptions are enhanced with course code and name for better context.
3. Different instructions are used for queries and passages to improve semantic matching.
4. The search application compares the query embedding with course embeddings to find the most relevant matches.

## Features

- Semantic search for courses based on natural language queries
- Department filtering
- Adjustable number of results
- Example queries to help users get started
- Fast response times with pre-computed embeddings

## License

Open source for educational purposes.
