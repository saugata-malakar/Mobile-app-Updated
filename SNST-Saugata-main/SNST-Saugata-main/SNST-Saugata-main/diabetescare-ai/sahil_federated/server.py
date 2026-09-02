"""
Flower Server for Federated Learning
Week 3 PoC - FedAvg Aggregation Strategy
"""

import sys
import time
import torch
import numpy as np
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import flwr as fl
from flwr.server.strategy import FedAvg
from flwr.server import ServerConfig
from flwr.common import Metrics

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sahil_federated.fl_config import FLConfig
from sahil_federated.fl_model import create_model


class FLServer:
    """
    Federated Learning Server with FedAvg strategy.
    
    Responsibilities:
    - Manage global model
    - Aggregate client updates using FedAvg
    - Track training metrics
    - Coordinate federated rounds
    """
    
    def __init__(self, config: FLConfig = None):
        """
        Initialize FL server.
        
        Args:
            config: FL configuration
        """
        self.config = config or FLConfig()
        self.start_time = None
        self.round_times = []
        
        # Training history
        self.history = {
            "rounds": [],
            "centralized_accuracy": [],
            "federated_accuracy": [],
            "loss": [],
            "latency": [],
            "client_metrics": []
        }
        
        # Initialize strategy
        self.strategy = self._create_strategy()
        
        # Initialize server
        self.server = self._create_server()
        
        print(f"\n{'='*60}")
        print("Federated Learning Server Initialized")
        print(f"{'='*60}")
        print(f"  Server address: {self.config.server_address}")
        print(f"  Number of rounds: {self.config.num_rounds}")
        print(f"  Min fit clients: {self.config.min_fit_clients}")
        print(f"  Min available clients: {self.config.min_available_clients}")
        print(f"  Aggregation strategy: FedAvg")
        print(f"{'='*60}\n")
    
    def _create_strategy(self) -> FedAvg:
        """Create FedAvg aggregation strategy."""
        
        def evaluate_fn(server_round: int, parameters, config):
            """
            Evaluation function called by strategy.
            
            Returns:
                Tuple of (loss, metrics)
            """
            # Create model and set parameters
            model = create_model(self.config)
            model.set_parameters(parameters)
            model.eval()
            
            # Simple accuracy check on dummy data
            # In production, use proper validation set
            return 0.0, {"accuracy": 0.0}
        
        strategy = FedAvg(
            fraction_fit=1.0,  # Use all available clients for training
            fraction_evaluate=self.config.fraction_evaluate,
            min_fit_clients=self.config.min_fit_clients,
            min_evaluate_clients=self.config.min_evaluate_clients,
            min_available_clients=self.config.min_available_clients,
            evaluate_fn=evaluate_fn,
            on_fit_config_fn=self._get_fit_config,
            on_evaluate_config_fn=self._get_evaluate_config,
            initial_parameters=self._get_initial_parameters(),
        )
        
        return strategy
    
    def _get_fit_config(self, server_round: int) -> Dict:
        """Get configuration for fit (training) round."""
        return {
            "server_round": server_round,
            "local_epochs": self.config.local_epochs,
            "learning_rate": self.config.learning_rate,
            "batch_size": self.config.batch_size
        }
    
    def _get_evaluate_config(self, server_round: int) -> Dict:
        """Get configuration for evaluation."""
        return {
            "server_round": server_round
        }
    
    def _get_initial_parameters(self):
        """Get initial model parameters from pretrained model."""
        try:
            model = create_model(self.config)
            model_path = Path(self.config.model_path)
            
            if model_path.exists():
                state_dict = torch.load(
                    model_path, 
                    map_location=self.config.device
                )
                model.load_state_dict(state_dict)
                print("[Server] Loaded pretrained model weights")
            
            # Get parameters as list of numpy arrays
            parameters = [val.cpu().numpy() for _, val in model.state_dict().items()]
            return parameters
            
        except Exception as e:
            print(f"[Server] Could not load pretrained weights: {e}")
            return None
    
    def _create_server(self) -> fl.server.Server:
        """Create Flower server instance."""
        server = fl.server.Server(
            strategy=self.strategy,
            config=ServerConfig(
                num_rounds=self.config.num_rounds
            )
        )
        return server
    
    def run(self) -> Dict:
        """
        Run federated learning training.
        
        Returns:
            Training history and metrics
        """
        self.start_time = time.time()
        
        print(f"\n{'='*60}")
        print("Starting Federated Learning Training")
        print(f"{'='*60}")
        print(f"Total rounds: {self.config.num_rounds}")
        print(f"Expected clients: {self.config.min_available_clients}")
        print(f"{'='*60}\n")
        
        # Start server (this blocks until training is complete)
        try:
            # Flower 1.x API
            hist = self.server.run()
            
            # Extract metrics from history
            self._extract_history(hist)
            
        except Exception as e:
            print(f"[Server] Error during training: {e}")
            # Try alternative API
            try:
                # Flower 1.8+ API
                hist = fl.simulation.start_simulation(
                    server=self.server,
                    num_clients=self.config.num_clients,
                    client_resources=self.config.client_resources,
                    strategy=self.strategy,
                    config=ServerConfig(num_rounds=self.config.num_rounds)
                )
                self._extract_history(hist)
            except Exception as e2:
                print(f"[Server] Alternative API also failed: {e2}")
                raise
        
        # Calculate total time
        total_time = time.time() - self.start_time
        
        # Print final results
        self._print_final_results(total_time)
        
        return self.history
    
    def _extract_history(self, hist):
        """Extract metrics from Flower history."""
        if hist is None:
            return
        
        # Extract loss and accuracy from history
        if hasattr(hist, 'losses_distributed'):
            losses = hist.losses_distributed
            if losses:
                self.history["loss"].append([l[1] for l in losses])
        
        if hasattr(hist, 'metrics_distributed'):
            acc_data = hist.metrics_distributed
            if 'accuracy' in acc_data:
                accuracies = [m[1] for m in acc_data['accuracy'] if m[1] is not None]
                if accuracies:
                    self.history["federated_accuracy"].extend(accuracies)
    
    def _print_final_results(self, total_time: float):
        """Print final training results."""
        print(f"\n{'='*60}")
        print("Federated Learning Training Complete")
        print(f"{'='*60}")
        print(f"Total training time: {total_time:.2f} seconds")
        print(f"Number of rounds: {self.config.num_rounds}")
        print(f"Number of clients: {self.config.num_clients}")
        
        if self.history["federated_accuracy"]:
            final_acc = self.history["federated_accuracy"][-1]
            best_acc = max(self.history["federated_accuracy"])
            print(f"\nFinal Accuracy: {final_acc:.2f}%")
            print(f"Best Accuracy: {best_acc:.2f}%")
        
        if self.round_times:
            avg_latency = sum(self.round_times) / len(self.round_times)
            print(f"\nRound-trip latency:")
            print(f"  Average: {avg_latency:.2f}s")
            print(f"  Min: {min(self.round_times):.2f}s")
            print(f"  Max: {max(self.round_times):.2f}s")
        
        print(f"{'='*60}\n")
    
    def get_aggregated_model(self) -> torch.nn.Module:
        """Get the final aggregated model."""
        model = create_model(self.config)
        
        # Get final parameters from strategy
        if hasattr(self.strategy, 'latest_model_parameters'):
            parameters = self.strategy.latest_model_parameters
            if parameters is not None:
                model.set_parameters(parameters)
        
        return model


def get_fl_server(config: FLConfig = None) -> FLServer:
    """
    Factory function to create FL server.
    
    Args:
        config: FL configuration
    
    Returns:
        Configured FLServer instance
    """
    return FLServer(config)


class FLServerSimulation:
    """
    Simulation wrapper for running FL without actual network.
    Useful for PoC and testing.
    """
    
    def __init__(self, config: FLConfig = None):
        self.config = config or FLConfig()
        self.server = get_fl_server(self.config)
    
    def run_simulation(self) -> Dict:
        """
        Run FL simulation (local execution).
        
        Returns:
            Training history
        """
        print("\n" + "="*60)
        print("Running FL Simulation (Local)")
        print("="*60 + "\n")
        
        return self.server.run()


# Convenience function for quick testing
def run_quick_fl(num_rounds: int = 2) -> Dict:
    """
    Run quick FL test with minimal configuration.
    
    Args:
        num_rounds: Number of federated rounds
    
    Returns:
        Training history
    """
    config = FLConfig(
        num_rounds=num_rounds,
        local_epochs=1,
        batch_size=16,
        num_clients=2
    )
    
    simulation = FLServerSimulation(config)
    return simulation.run_simulation()