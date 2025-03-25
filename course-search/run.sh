#!/bin/bash

# Change to the script directory
cd "$(dirname "$0")"

# Check if we have the CSV with embeddings
if [ ! -f "../course-embd-data-with-embeddings.csv" ]; then
    echo "CSV file with embeddings not found. Generating embeddings..."
    
    # Check if we have tqdm for the progress bar
    pip install tqdm
    
    # Generate embeddings
    python generate_embeddings.py
    
    # Check if generation was successful
    if [ ! -f "../course-embd-data-with-embeddings.csv" ]; then
        echo "Failed to generate embeddings. Please check the error messages."
        exit 1
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run the FastAPI application
echo "Starting the course search application..."
python main.py 