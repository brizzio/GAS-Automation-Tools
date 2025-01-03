import pandas as pd
import numpy as np
from rapidfuzz import fuzz
from collections import defaultdict
from itertools import combinations
import time
from typing import Set, Dict, List
import networkx as nx

def preprocess_data(df, columns):
    """Preprocess strings to reduce comparison overhead"""
    for col in columns:
        df[f"{col}_processed"] = df[col].astype(str).str.lower().str.strip()
    return df

def create_blocking_key(row, columns):
    """Create a blocking key for preliminary grouping"""
    key = ""
    for col in columns:
        val = str(row[f"{col}_processed"])
        key += val[:2] if len(val) >= 2 else val
    return key

def calculate_similarity(row1, row2, columns, weights):
    """Calculate weighted similarity between two rows"""
    score = 0
    for col in columns:
        col_processed = f"{col}_processed"
        score += fuzz.ratio(row1[col_processed], row2[col_processed]) * weights[col]
    return score / 100

def find_duplicate_groups(potential_duplicates: List[dict]) -> List[Set[int]]:
    """
    Find groups of related duplicates using a graph-based approach.
    Returns list of sets, where each set contains indices of related records.
    """
    # Create graph where edges represent duplicate relationships
    G = nx.Graph()
    
    # Add edges between duplicate pairs
    for dup in potential_duplicates:
        idx1, idx2 = int(dup["Index1"]), int(dup["Index2"])
        G.add_edge(idx1, idx2, weight=dup["Similarity Score"])
    
    # Find connected components (groups of related records)
    duplicate_groups = list(nx.connected_components(G))
    
    return duplicate_groups

def find_duplicates(file_path, threshold=0.7):
    # Configuration
    columns_to_compare = ["First Name", "Last Name", "Email", "Phone Number"]
    weights = {
        "First Name": 0.2,
        "Last Name": 0.2,
        "Email": 0.35,
        "Phone Number": 0.25
    }
    
    # Load and preprocess data
    print("Loading and preprocessing data...")
    df = pd.read_excel(file_path)
    df = preprocess_data(df, columns_to_compare)
    
    # Create blocks for comparison
    print("Creating blocking structure...")
    blocks = defaultdict(list)
    for idx, row in df.iterrows():
        blocking_key = create_blocking_key(row, columns_to_compare)
        blocks[blocking_key].append(idx)
    
    # Find duplicates using blocking
    print("Finding duplicates...")
    potential_duplicates = []
    processed_pairs = set()
    
    start_time = time.time()
    total_blocks = len(blocks)
    processed_blocks = 0
    
    for block_indices in blocks.values():
        if len(block_indices) > 1:  # Only process blocks with potential duplicates
            for idx1, idx2 in combinations(block_indices, 2):
                if (idx1, idx2) not in processed_pairs:
                    row1 = df.iloc[idx1]
                    row2 = df.iloc[idx2]
                    
                    similarity_score = calculate_similarity(row1, row2, columns_to_compare, weights)
                    
                    if similarity_score > threshold:
                        potential_duplicates.append({
                            "Index1": idx1,
                            "Index2": idx2,
                            "Similarity Score": similarity_score,
                            "Record ID 1": row1.get("Record ID", "N/A"),
                            "Record ID 2": row2.get("Record ID", "N/A")
                        })
                    
                    processed_pairs.add((idx1, idx2))
                    processed_pairs.add((idx2, idx1))
        
        processed_blocks += 1
        if processed_blocks % 100 == 0:
            progress = (processed_blocks / total_blocks) * 100
            elapsed_time = time.time() - start_time
            print(f"Progress: {progress:.1f}% | Time elapsed: {elapsed_time:.1f}s")
    
    if potential_duplicates:
        print("\nProcessing duplicate groups...")
        # Find groups of related duplicates
        duplicate_groups = find_duplicate_groups(potential_duplicates)
        
        # Create detailed duplicate records with grouped IDs
        duplicate_details = []
        duplicates_summary = []
        
        for group_id, indices in enumerate(duplicate_groups, 1):
            # Calculate average similarity score for the group
            group_scores = []
            record_ids = set()
            
            # Get all pairwise similarity scores for the group
            for dup in potential_duplicates:
                idx1, idx2 = int(dup["Index1"]), int(dup["Index2"])
                if idx1 in indices and idx2 in indices:
                    group_scores.append(dup["Similarity Score"])
                    record_ids.add(dup["Record ID 1"])
                    record_ids.add(dup["Record ID 2"])
            
            avg_similarity = sum(group_scores) / len(group_scores) if group_scores else 0
            
            # Add each record in the group to detailed results
            for idx in indices:
                record = df.iloc[idx].to_dict()
                record_with_meta = {
                    "Duplicate_Group_ID": group_id,
                    "Similarity_Score": avg_similarity,
                    "Record_ID": record.get("Record ID", "N/A"),
                    **record
                }
                duplicate_details.append(record_with_meta)
            
            # Add summary record
            duplicates_summary.append({
                "Duplicate_Group_ID": group_id,
                "Number_of_Records": len(indices),
                "Average_Similarity": avg_similarity,
                "Record_IDs": ", ".join(str(id) for id in record_ids if id != "N/A")
            })
        
        # Convert to DataFrames and save
        print("Saving results...")
        
        # Save summary of duplicate groups
        summary_df = pd.DataFrame(duplicates_summary)
        summary_df.to_csv("Duplicate_Groups_Summary.csv", index=False)
        
        # Save detailed results with specific column order
        details_df = pd.DataFrame(duplicate_details)
        # Reorder columns to put key fields first
        cols = ["Duplicate_Group_ID", "Similarity_Score", "Record_ID"]
        remaining_cols = [col for col in details_df.columns if col not in cols]
        details_df = details_df[cols + remaining_cols]
        details_df.to_csv("Duplicate_Details.csv", index=False)
        
        print(f"Found {len(duplicate_groups)} duplicate groups")
        print(f"Total records with duplicates: {len(duplicate_details)}")
        print("Results saved to 'Duplicate_Groups_Summary.csv' and 'Duplicate_Details.csv'")
    else:

if __name__ == "__main__":
    file_path = "data.xlsx"
    find_duplicates(file_path, threshold=0.7)