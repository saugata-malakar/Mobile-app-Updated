"""
Flower Client for Wound Severity Classification
Week 3 PoC - Federated Learning with 3 Simulated Nodes
"""

import os
import sys
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from typing import List, Tuple, Dict, Optional
from pathlib import Path
import flwr as fl
from PIL import Image
import torchvision.transforms as transforms

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sahil_federated.fl_config import FLConfig
from sahil_federated.fl_model import (
    WoundSeverityModelFL, 
    get_criterion, 
    get_optimizer,
    count_parameters
)
from sahil_federated.data_partition import (
    WoundDatasetFL, 
    DataPartitioner
)


class WoundSeverityClient(fl.client.NumPyClient):
    """
    Flower client for wound severity classification.
    
    Each client:
    - Holds a partition of the training data
    - Performs local training (fine-tuning)
    - Reports model updates to the server
    - Never shares raw patient images
    """
    
    def __init__(
        self,
        client_id: int,
        config: FLConfig,
        cid: str = "0"
    ):
        """
        Initialize FL client.
        
        Args:
            client_id: Unique identifier for this client (0, 1, 2)
            config: FL configuration
            cid: Flower client ID
        """
        self.client_id = client_id
        self.config = config
        self.cid = cid
        
        # Track training metrics
        self.training_history = {
            "round": [],
            "loss": [],
            "accuracy": [],
            "local_epochs": 0
        }
        
        # Track latency
        self.latency_history = []
        
        # Initialize model
        self.model = self._initialize_model()
        
        # Load client data
        self.train_loader, self.data_info = self._load_client_data()
        
        # Print client info
        self._print_client_info()
    
    def _initialize_model(self) -> WoundSeverityModelFL:
        """Initialize model and load pretrained weights if available."""
        from sahil_federated.fl_model import create_model
        
        model = create_model(self.config)
        
        # Load pretrained weights if available
        model_path = Path(self.config.model_path)
        if model_path.exists():
            try:
                state_dict = torch.load(
                    model_path, 
                    map_location=self.config.device
                )
                # Remove classifier weights for fresh training
                if 'backbone.classifier.1.weight' in state_dict:
                    del state_dict['backbone.classifier.1.weight']
                    del state_dict['backbone.classifier.1.bias']
                model.load_state_dict(state_dict, strict=False)
                print(f"[Client {self.client_id}] Loaded pretrained weights")
            except Exception as e:
                print(f"[Client {self.client_id}] Could not load pretrained weights: {e}")
        
        return model
    
    def _load_client_data(self) -> Tuple[DataLoader, Dict]:
        """Load and partition data for this client."""
        # Create full dataset
        dataset = WoundDatasetFL(
            root_dir=self.config.data_root,
            split="train",
            transform=self._get_transform(),
            seed=42 + self.client_id  # Different seed per client
        )
        
        # Partition data
        partitioner = DataPartitioner(
            dataset=dataset,
            num_clients=self.config.num_clients,
            partition_strategy=self.config.partition_strategy,
            seed=42 + self.client_id
        )
        
        # Get this client's data
        client_dataset = partitioner.get_client_dataset(self.client_id)
        
        # Create data loader
        train_loader = DataLoader(
            client_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=0,
            pin_memory=True if self.config.device.type == "cuda" else False
        )
        
        # Get data info
        data_info = partitioner.get_client_data_info(self.client_id)
        
        return train_loader, data_info
    
    def _get_transform(self):
        """Get image transformations for training."""
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(degrees=10),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
    
    def _print_client_info(self):
        """Print client information."""
        print(f"\n{'='*60}")
        print(f"[Client {self.client_id}] Initialized")
        print(f"{'='*60}")
        print(f"  CID: {self.cid}")
        print(f"  Data samples: {self.data_info['num_samples']}")
        print(f"  Class distribution: {self.data_info['class_distribution']}")
        print(f"  Batch size: {self.config.batch_size}")
        print(f"  Local epochs: {self.config.local_epochs}")
        print(f"  Model parameters: {count_parameters(self.model):,}")
        print(f"  Device: {self.config.device}")
        print(f"{'='*60}\n")
    
    def get_parameters(self, config: Dict[str, str] = None):
        """
        Get model parameters for federated averaging.
        
        Returns:
            List of numpy arrays representing model weights
        """
        return [val.cpu().numpy() for _, val in self.model.state_dict().items()]
    
    def set_parameters(self, parameters: List):
        """
        Set model parameters from server aggregation.
        
        Args:
            parameters: List of numpy arrays from FedAvg
        """
        # Convert numpy arrays back to tensors
        state_dict = {}
        for key, value in zip(self.model.state_dict().keys(), parameters):
            state_dict[key] = torch.from_numpy(value)
        
        self.model.load_state_dict(state_dict)
    
    def _train_local(self) -> Tuple[float, float]:
        """
        Perform local training on client data.
        
        Returns:
            Tuple of (average_loss, accuracy)
        """
        self.model.train()
        
        criterion = get_criterion()
        optimizer = get_optimizer(self.model, lr=self.config.learning_rate)
        
        total_loss = 0.0
        correct = 0
        total = 0
        
        for epoch in range(self.config.local_epochs):
            epoch_loss = 0.0
            epoch_correct = 0
            epoch_total = 0
            
            for batch_idx, (images, labels) in enumerate(self.train_loader):
                images = images.to(self.config.device)
                labels = labels.to(self.config.device)
                
                # Forward pass
                optimizer.zero_grad()
                outputs = self.model(images)
                loss = criterion(outputs, labels)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                # Statistics
                total_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                
                epoch_loss += loss.item()
                epoch_total += labels.size(0)
                epoch_correct += (predicted == labels).sum().item()
            
            # Log epoch
            avg_epoch_loss = epoch_loss / len(self.train_loader)
            epoch_acc = 100.0 * epoch_correct / epoch_total
            
            print(f"[Client {self.client_id}] Epoch {epoch+1}/{self.config.local_epochs} - "
                  f"Loss: {avg_epoch_loss:.4f}, Accuracy: {epoch_acc:.2f}%")
        
        # Calculate overall metrics
        avg_loss = total_loss / (len(self.train_loader) * self.config.local_epochs)
        accuracy = 100.0 * correct / total
        
        return avg_loss, accuracy
    
    def fit(
        self,
        parameters: List,
        config: Dict[str, str]
    ) -> Tuple[List, int, Dict]:
        """
        Train model on local data.
        
        Args:
            parameters: Global model weights from server
            config: Configuration from server (includes round number)
        
        Returns:
            Tuple of (updated parameters, num_samples, metrics)
        """
        start_time = time.time()
        
        # Set round info
        round_num = int(config.get("round", 0))
        self.training_history["round"].append(round_num)
        
        # Set global parameters
        self.set_parameters(parameters)
        
        # Train locally
        loss, accuracy = self._train_local()
        
        # Get updated parameters
        updated_parameters = self.get_parameters()
        
        # Calculate training time
        training_time = time.time() - start_time
        self.latency_history.append(training_time)
        
        # Update history
        self.training_history["loss"].append(loss)
        self.training_history["accuracy"].append(accuracy)
        self.training_history["local_epochs"] += self.config.local_epochs
        
        # Metrics for server
        metrics = {
            "loss": float(loss),
            "accuracy": float(accuracy),
            "training_time": float(training_time),
            "client_id": self.client_id,
            "num_samples": len(self.train_loader.dataset),
            "data_distribution": self.data_info['class_distribution']
        }
        
        print(f"[Client {self.client_id}] Fit completed - "
              f"Loss: {loss:.4f}, Accuracy: {accuracy:.2f}%, "
              f"Time: {training_time:.2f}s")
        
        return updated_parameters, len(self.train_loader.dataset), metrics
    
    def evaluate(
        self,
        parameters: List,
        config: Dict[str, str]
    ) -> Tuple[float, int, Dict]:
        """
        Evaluate model on local data.
        
        Args:
            parameters: Global model weights from server
            config: Configuration from server
        
        Returns:
            Tuple of (loss, num_samples, metrics)
        """
        # Set parameters
        self.set_parameters(parameters)
        
        # Evaluate
        self.model.eval()
        
        criterion = get_criterion()
        
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels in self.train_loader:
                images = images.to(self.config.device)
                labels = labels.to(self.config.device)
                
                outputs = self.model(images)
                loss = criterion(outputs, labels)
                
                total_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        
        avg_loss = total_loss / len(self.train_loader)
        accuracy = 100.0 * correct / total
        
        metrics = {
            "loss": float(avg_loss),
            "accuracy": float(accuracy),
            "client_id": self.client_id
        }
        
        return float(avg_loss), total, metrics
    
    def get_client_history(self) -> Dict:
        """Get training history for this client."""
        return self.training_history.copy()
    
    def get_latency_stats(self) -> Dict:
        """Get training latency statistics."""
        if not self.latency_history:
            return {"mean": 0, "std": 0, "min": 0, "max": 0}
        
        return {
            "mean": sum(self.latency_history) / len(self.latency_history),
            "std": (sum((x - sum(self.latency_history) / len(self.latency_history))**2 
                   for x in self.latency_history) / len(self.latency_history)) ** 0.5,
            "min": min(self.latency_history),
            "max": max(self.latency_history),
            "all": self.latency_history
        }


def start_client(
    client_id: int,
    server_address: str = "127.0.0.1:8080",
    config: FLConfig = None
):
    """
    Start a Flower client.
    
    Args:
        client_id: Client identifier (0, 1, 2)
        server_address: FL server address
        config: FL configuration
    """
    if config is None:
        config = FLConfig()
    
    # Create client
    client = WoundSeverityClient(
        client_id=client_id,
        config=config,
        cid=str(client_id)
    )
    
    # Start Flower client
    print(f"\n{'='*60}")
    print(f"Starting Client {client_id}")
    print(f"Connecting to: {server_address}")
    print(f"{'='*60}\n")
    
    fl.client.start_client(
        server_address=server_address,
        client=client.to_client(),
    )


class WoundSeverityClientAdapter:
    """
    Adapter to convert WoundSeverityClient to Flower NumPyClient.
    """
    
    def __init__(self, client: WoundSeverityClient):
        self.client = client
    
    def to_client(self) -> fl.client.NumPyClient:
        """Convert to Flower NumPyClient."""
        return fl.client.NumPyClient(
            client=self.client,
            cid=str(self.client.client_id)
        )