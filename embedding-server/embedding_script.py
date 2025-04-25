import csv
import json
import requests
import os
from tqdm import tqdm

# Input and output file paths
input_csv = 'course-embd-data.csv'
output_csv = 'course-embd-data-with-embeddings.csv'

# FastAPI endpoint URL (assuming your service is running on localhost:8000)
embedding_api_url = 'http://localhost:8000/embed'

def get_embedding(text, name="", code=""):
    """
    Call the embedding API to get embeddings for the given text.
    
    Args:
        text: The course description text
        name: Course name to add context
        code: Course code to add context
    """
    if not text or text.strip() == '':
        return []
    
    # Enhance the text with additional context if available
    enhanced_text = text
    if name and code:
        enhanced_text = f"Course {code}: {name}\n\n{text}"
    elif name:
        enhanced_text = f"Course: {name}\n\n{text}"
    
    payload = {
        "texts": [enhanced_text],
        "is_query": False  # Treating course descriptions as passages, not queries
    }
    
    try:
        response = requests.post(embedding_api_url, json=payload)
        response.raise_for_status()  # Raise an exception for 4XX/5XX responses
        result = response.json()
        
        # Return the first (and only) embedding from the list
        if 'embeddings' in result and len(result['embeddings']) > 0:
            return result['embeddings'][0]
        else:
            print(f"Warning: No embedding returned for text: {enhanced_text[:50]}...")
            return []
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return []

def process_csv():
    """
    Process the CSV file, generate embeddings for descriptions, and save to a new CSV.
    """
    # Make sure the input file exists
    if not os.path.exists(input_csv):
        print(f"Error: Input file '{input_csv}' not found.")
        return
    
    # Read the input CSV file
    rows = []
    with open(input_csv, 'r', newline='', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader)  # Get the header row
        rows = list(reader)    # Get all data rows
    
    # Add 'Embedding' to the header
    new_header = header + ['Embedding']
    
    # Process each row and add embeddings
    new_rows = []
    print(f"Processing {len(rows)} course descriptions...")
    
    for row in tqdm(rows):
        if len(row) >= 13:  # Make sure the row has a description column
            # Extract all the necessary fields
            code = row[0]  # Course code
            name = row[1]  # Course name
            description = row[12]  # Course description
            
            # Get embedding with enhanced context
            embedding = get_embedding(description, name, code)
            
            # Add the embedding (as a string representation) to the row
            new_row = row + [json.dumps(embedding)]
            new_rows.append(new_row)
        else:
            print(f"Warning: Row doesn't have enough columns: {row}")
            # Add an empty embedding
            new_row = row + ['[]']
            new_rows.append(new_row)
    
    # Write to the output CSV file
    with open(output_csv, 'w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(new_header)
        writer.writerows(new_rows)
    
    print(f"Completed! Embeddings saved to '{output_csv}'")

if __name__ == "__main__":
    process_csv()