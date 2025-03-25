import csv
import json
import torch
import os
import time
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# Input and output file paths
input_csv = '../course-embd-data.csv'  # Assuming it's in parent directory
output_csv = '../course-embd-data-with-embeddings.csv'

# Passage instruction for better encoding of course descriptions
PASSAGE_INSTRUCTION = "Provide information that would help answer questions"

def generate_embeddings():
    # Check if input file exists
    if not os.path.exists(input_csv):
        print(f"Error: Input file '{input_csv}' not found.")
        return False
        
    # Load the model
    print(f"Loading model...")
    model = SentenceTransformer('nvidia/NV-Embed-v2', trust_remote_code=True, device="cpu")
    model.max_seq_length = 16384
    model.tokenizer.padding_side = "right"
    print(f"Model loaded")
    
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
            
            # Skip empty descriptions
            if not description or description.strip() == '':
                embedding = []
            else:
                # Enhanced text with course context
                enhanced_text = f"Course {code}: {name}\n\n{description}"
                
                # Add EOS token to input text
                input_text = enhanced_text + model.tokenizer.eos_token
                
                # Generate embedding with passage instruction
                with torch.no_grad():
                    embedding = model.encode(
                        [input_text], 
                        batch_size=1, 
                        normalize_embeddings=True,
                        prompt=PASSAGE_INSTRUCTION
                    )[0].tolist()
            
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
    return True

if __name__ == "__main__":
    start_time = time.time()
    success = generate_embeddings()
    elapsed = time.time() - start_time
    
    if success:
        print(f"Processing completed in {elapsed:.2f} seconds")
    else:
        print("Processing failed") 