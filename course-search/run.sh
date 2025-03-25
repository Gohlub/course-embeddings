#!/bin/bash

# Change to the script directory
cd "$(dirname "$0")"

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

# Check if the embedding server is running
# Try to ping the server's test endpoint
server_running=false
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/test && server_running=true || server_running=false

if [ "$server_running" = false ]; then
    echo "Embedding server is not running. Starting it..."
    echo "Please open a new terminal and run the following command:"
    echo "cd $(pwd)/.. && python server.py"
    read -p "Press Enter when the embedding server is running..."
fi

# Check if we have the CSV with embeddings
if [ ! -f "../course-embd-data-with-embeddings.csv" ]; then
    echo "CSV file with embeddings not found. Generating embeddings..."
    
    # Check if we can reach the embedding server
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/test)
    
    if [ "$response" != "200" ]; then
        echo "Can't connect to the embedding server. Please make sure it's running."
        echo "Run 'python ../server.py' in a separate terminal."
        exit 1
    fi
    
    # Generate embeddings
    python generate_embeddings.py
    
    # Check if generation was successful
    if [ ! -f "../course-embd-data-with-embeddings.csv" ]; then
        echo "Failed to generate embeddings. Please check the error messages."
        exit 1
    fi
fi

# Run the FastAPI application
echo "Starting the course search application..."
python main.py 