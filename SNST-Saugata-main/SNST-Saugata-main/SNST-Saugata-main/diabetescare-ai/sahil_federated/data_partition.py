"""
Data Partitioning for Federated Learning
Week 3 PoC - Simulated Client Data Slices
"""

import os
import random
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, Subset
from typing import List, Tuple, Dict, Optional
from pathlib import Path
from PIL import Image


class WoundDatasetFL(Dataset):
    """
    Dataset wrapper for federated learning.
    Supports partitioning and weighted sampling.
    """
    
    def __init__(
        self,
        root_dir: str = "../../archive/DFU",
        split: str = "train",
        transform=None,
        seed: int = 42
    ):
        self.root_dir = Path(root_dir)
        self.split = split
        self.transform = transform
        self.seed = seed
        
        # Set random seed for reproducibility
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        
        # Load image paths and labels
        self.data = self._load_data()
        
    def _load_data(self) -> List[Tuple[str, int]]:
        """Load image paths and labels from directory structure."""
        data = []
        
        # Define class mappings
        class_map = {
            "Abnormal(Ulcer)": 0,
            "Normal(Healthy skin)": 1
        }
        
        # Load from Patches directory (already classified)
        patches_dir = self.root_dir / "Patches"
        
        for class_name, label in class_map.items():
            class_dir = patches_dir / class_name
            if class_dir.exists():
                images = list(class_dir.glob("*.jpg"))
                for img_path in images:
                    data.append((str(img_path), label))
        
        # Shuffle data
        random.shuffle(data)
        
        return data
    
    def __len__(self) -> int:
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.data[idx]
        
        # Load and transform image
        image = Image.open(img_path).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
        
        return image, label


class DataPartitioner:
    """
    Partitions dataset among simulated FL clients.
    Supports IID and non-IID partitioning.
    """
    
    def __init__(
        self,
        dataset: Dataset,
        num_clients: int = 3,
        partition_strategy: str = "iid",
        seed: int = 42
    ):
        self.dataset = dataset
        self.num_clients = num_clients
        self.partition_strategy = partition_strategy
        self.seed = seed
        
        # Set random seed
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        
        # Partition the dataset
        self.client_data_indices = self._partition_data()
        
    def _partition_data(self) -> List[List[int]]:
        """
        Partition data among clients.
        
        IID: Randomly distribute data equally
        Non-IID: Sort by label and distribute (simulates real-world heterogeneity)
        """
        num_samples = len(self.dataset)
        indices = list(range(num_samples))
        
        if self.partition_strategy == "iid":
            # IID: Random shuffle and divide
            random.shuffle(indices)
            split_sizes = [num_samples // self.num_clients] * self.num_clients
            
            # Handle remainder
            for i in range(num_samples % self.num_clients):
                split_sizes[i] += 1
            
            # Create partitions
            partitions = []
            start = 0
            for size in split_sizes:
                partitions.append(indices[start:start + size])
                start += size
            
            return partitions
        
        elif self.partition_strategy == "non_iid":
            # Non-IID: Sort by label, then distribute
            # This simulates real-world scenario where clients have different distributions
            
            # Get labels for all samples
            labels = [self.dataset[idx][1] for idx in indices]
            
            # Sort indices by label
            sorted_indices = [idx for _, idx in sorted(zip(labels, indices))]
            
            # Divide into shards (each client gets 2 shards)
            num_shards = self.num_clients * 2
            shard_size = num_samples // num_shards
            
            # Assign shards to clients (each client gets 2 non-adjacent shards)
            partitions = [[] for _ in range(self.num_clients)]
            
            for client_id in range(self.num_clients):
                # Get 2 shards for this client
                shard1_start = client_id * 2 * shard_size
                shard1_end = shard1_start + shard_size
                shard2_start = (client_id * 2 + 1) * shard_size
                shard2_end = shard2_start + shard_size
                
                partitions[client_id].extend(
                    sorted_indices[shard1_start:shard1_end]
                )
                partitions[client_id].extend(
                    sorted_indices[shard2_start:shard2_end]
                )
            
            return partitions
        
        else:
            raise ValueError(f"Unknown partition strategy: {partition_strategy}")
    
    def get_client_dataset(
        self,
        client_id: int,
        transform=None
    ) -> Subset:
        """Get dataset for a specific client."""
        if client_id >= self.num_clients:
            raise ValueError(f"Client ID {client_id} out of range")
        
        indices = self.client_data_indices[client_id]
        return Subset(self.dataset, indices)
    
    def get_client_data_info(self, client_id: int) -> Dict:
        """Get information about a client's data partition."""
        indices = self.client_data_indices[client_id]
        labels = [self.dataset[idx][1] for idx in indices]
        
        unique, counts = np.unique(labels, return_counts=True)
        
        return {
            "client_id": client_id,
            "num_samples": len(indices),
            "class_distribution": dict(zip(unique.tolist(), counts.tolist())),
            "class_percentages": {
                cls: count / len(labels) * 100 
                for cls, count in zip(unique.tolist(), counts.tolist())
            }
        }
    
    def get_all_clients_info(self) -> List[Dict]:
        """Get information about all clients' data."""
        return [self.get_client_data_info(i) for i in range(self.num_clients)]


def create_client_data_loaders(
    config,
    transform=None
) -> Tuple[List[DataLoader], List[Dict]]:
    """
    Create data loaders for all FL clients.
    
    Returns:
        Tuple of (list of DataLoaders, list of client data info)
    """
    # Create full dataset
    dataset = WoundDatasetFL(
        root_dir=config.data_root,
        split="train",
        transform=transform,
        seed=42
    )
    
    # Partition data
    partitioner = DataPartitioner(
        dataset=dataset,
        num_clients=config.num_clients,
        partition_strategy=config.partition_strategy,
        seed=42
    )
    
    # Create data loaders for each client
    client_loaders = []
    client_info = []
    
    for client_id in range(config.num_clients):
        client_dataset = partitioner.get_client_dataset(client_id, transform)
        
        loader = DataLoader(
            client_dataset,
            batch_size=config.batch_size,
            shuffle=True,
            num_workers=0,
            pin_memory=True if config.device.type == "cuda" else False
        )
        
        client_loaders.append(loader)
        client_info.append(partitioner.get_client_data_info(client_id))
    
    return client_loaders, client_info


def create_test_loader(
    root_dir: str = "../../archive/DFU",
    batch_size: int = 32,
    transform=None
) -> DataLoader:
    """Create test/validation data loader."""
    dataset = WoundDatasetFL(
        root_dir=root_dir,
        split="test",
        transform=transform,
        seed=42
    )
    
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0
    )