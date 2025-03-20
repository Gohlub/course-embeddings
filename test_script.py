import requests

url = "http://localhost:8000/embed"
data = {
    "texts": ["What is machine learning?"],
    "is_query": True
}

response = requests.post(url, json=data)
print(f"Status code: {response.status_code}")
if response.status_code == 200:
    print(f"Embedding length: {len(response.json()['embeddings'][0])}")
    print(f"Time taken: {response.json()['time_taken']}")
else:
    print(f"Error: {response.text}")