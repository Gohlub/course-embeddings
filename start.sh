#!/bin/bash

# Course Embedding Visualization Tool Launcher

echo "Starting Course Embedding Visualization Tool..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is required but not found. Please install Python 3."
    exit 1
fi

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    echo "Node.js/npm is required but not found. Please install Node.js."
    exit 1
fi

# Function to check if a process is running on a port
function is_port_in_use() {
    if netstat -tuln | grep ":$1 " > /dev/null; then
        return 0  # Port is in use
    else
        return 1  # Port is not in use
    fi
}

# Check if ports are already in use
if is_port_in_use 8001; then
    echo "Warning: Port 8001 is already in use. Backend may not start properly."
fi

if is_port_in_use 3000; then
    echo "Warning: Port 3000 is already in use. Frontend may not start properly."
fi

# Start the backend server
echo "Starting backend server on port 8001..."
cd backend
python3 main.py &
BACKEND_PID=$!
cd ..

# Give the backend some time to start
echo "Waiting for backend to initialize..."
sleep 5

# Start the frontend development server
echo "Starting frontend development server on port 3000..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo "Both servers are running!"
echo "- Backend API: http://localhost:8001"
echo "- Frontend UI: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap Ctrl+C to kill both processes
trap "kill $BACKEND_PID $FRONTEND_PID; echo 'Servers stopped.'; exit 0" INT

# Wait for both processes
wait 