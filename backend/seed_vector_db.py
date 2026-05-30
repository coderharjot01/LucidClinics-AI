# backend/seed_vector_db.py
import os
import json
import chromadb
from chromadb.utils import embedding_functions

# Set directories
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
GUIDELINES_PATH = os.path.join(BACKEND_DIR, "guidelines.json")
CHROMA_PATH = os.path.join(BACKEND_DIR, "chroma_db")

def seed_database():
    print("Initializing Seeding Pipeline...")
    
    # 1. Load the structured clinical guidelines JSON
    if not os.path.exists(GUIDELINES_PATH):
        print(f"Error: Guidelines file not found at {GUIDELINES_PATH}")
        return
        
    with open(GUIDELINES_PATH, "r") as f:
        guidelines_db = json.load(f)
    print(f"Loaded guidelines dataset. Found {len(guidelines_db)} categories.")

    # 2. Setup Persistent ChromaDB Client & Embedding model
    # We use the standard, lightweight all-MiniLM-L6-v2 sentence transformer
    print("Setting up local Chroma persistent storage and SentenceTransformer embedding function...")
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    
    emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    
    # Create or replace the collection
    # If it already exists, we delete it to ensure a clean seed run
    collection_name = "medical_guidelines"
    try:
        chroma_client.delete_collection(name=collection_name)
        print(f"Cleared existing '{collection_name}' collection.")
    except Exception:
        pass
        
    collection = chroma_client.create_collection(
        name=collection_name, 
        embedding_function=emb_fn
    )

    # 3. Parse recommendations into document chunks and metadata
    documents = []
    metadatas = []
    ids = []
    
    chunk_counter = 0
    for category, content in guidelines_db.items():
        title = content["title"]
        recommendations = content["recommendations"]
        
        for idx, rec in enumerate(recommendations):
            documents.append(rec)
            metadatas.append({
                "category": category,
                "title": title,
                "recommendation_index": idx
            })
            ids.append(f"guideline_{category.lower()}_{idx}")
            chunk_counter += 1

    # 4. Ingest and embed guidelines in ChromaDB
    print(f"Ingesting {chunk_counter} guideline chunks into vector store...")
    collection.add(
        documents=documents,
        metadatas=metadatas,
        ids=ids
    )
    print("Ingestion completed successfully.")

    # 5. Verify the Vector Store with a similarity search test query
    test_query = "weight management and physical activity"
    print(f"\n--- Running Verification Test Query: '{test_query}' ---")
    results = collection.query(
        query_texts=[test_query],
        n_results=2
    )
    
    for idx, (doc, meta, dist) in enumerate(zip(results['documents'][0], results['metadatas'][0], results['distances'][0])):
        print(f"\nMatch #{idx+1} [Category: {meta['category']}] (Cosine Distance: {dist:.4f})")
        print(f"Title: {meta['title']}")
        print(f"Content: {doc}")

if __name__ == "__main__":
    seed_database()
