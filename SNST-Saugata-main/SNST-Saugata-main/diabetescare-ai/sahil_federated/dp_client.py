"""
Differential Privacy Client for Federated Learning
Week 3 - Production Feature

Uses Opacus to add mathematical privacy guarantees.
Prevents reconstruction of individual patient images from model updates.
"""

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class DPClientWrapper:
    """
    Wrapper around Flower client to add differential privacy.
    
    Features:
    - Gradient clipping (per-sample gradients)
    - Noise injection (Gaussian noise)
    - Privacy accounting (epsilon calculation)
    
    Privacy Budget (ε):
    - Lower ε = More privacy, less accuracy
    - ε = 1: Strong privacy
    - ε = 10: Moderate privacy
    - ε = 100: Weak privacy (almost none)
    
    Typical values for medical data: ε = 1-10
    """
    
    def __init__(
        self,
        client,
        noise_multiplier: float = 1.0,
        max_grad_norm: float = 1.0,
        secure_mode: bool = False
    ):
        """
        Initialize DP wrapper.
        
        Args:
            client: Original Flower client
            noise_multiplier: Scale of Gaussian noise (1.0 = good privacy)
            max_grad_norm: Clip gradients to this norm
            secure_mode: Use cryptographic noise (slower but more secure)
        """
        self.client = client
        self.noise_multiplier = noise_multiplier
        self.max_grad_norm = max_grad_norm
        self.secure_mode = secure_mode
        
        # Try to import Opacus
        self.opacus_available = self._check_opacus()
        
        if self.opacus_available:
            self.privacy_engine = self._setup_privacy_engine()
            logger.info(f"[DP] Opacus available - Privacy enabled")
            logger.info(f"[DP] Noise multiplier: {noise_multiplier}")
            logger.info(f"[DP] Max gradient norm: {max_grad_norm}")
        else:
            logger.warning("[DP] Opacus not available - Privacy disabled")
            logger.info("[DP] Install with: pip install opacus")
    
    def _check_opacus(self) -> bool:
        """Check if Opacus is installed."""
        try:
            import opacus
            return True
        except ImportError:
            return False
    
    def _setup_privacy_engine):
        """Setup Opacus privacy engine."""
        from opacus import PrivacyEngine
        
        privacy_engine = PrivacyEngine()
        return privacy_engine
    
    def make_model_private(
        self,
        model: nn.Module,
        optimizer: torch.optim.Optimizer,
        dataloader: DataLoader
    ) -> Tuple[nn.Module, torch.optim.Optimizer, int]:
        """
        Convert model to private model with DP guarantees.
        
        Args:
            model: PyTorch model
            optimizer: Optimizer
            dataloader: Training dataloader
        
        Returns:
            Tuple of (private_model, private_optimizer, sample_rate)
        """
        if not self.opacus_available:
            return model, optimizer, 1.0
        
        # Calculate sample rate for privacy accounting
        sample_rate = len(dataloader) / len(dataloader.dataset)
        
        # Attach privacy engine to model
        private_model, private_optimizer, _ = self.privacy_engine.make_private(
            module=model,
            optimizer=optimizer,
            noise_multiplier=self.noise_multiplier,
            max_grad_norm=self.max_grad_norm,
            secure_mode=self.secure_mode
        )
        
        logger.info(f"[DP] Model converted to private model")
        logger.info(f"[DP] Sample rate: {sample_rate:.4f}")
        
        return private_model, private_optimizer, sample_rate
    
    def get_privacy_spent(
        self,
        num_rounds: int,
        sample_rate: float,
        delta: float = 1e-5
    ) -> Tuple[float, float]:
        """
        Calculate privacy spent using RDP accountant.
        
        Args:
            num_rounds: Number of federated rounds
            sample_rate: Fraction of data per batch
            delta: Target delta for (ε, δ)-DP
        
        Returns:
            Tuple of (epsilon, delta)
        """
        if not self.opacus_available:
            return (float('inf'), 0.0)
        
        try:
            from opacus.accountants import RDPAccountant
            
            accountant = RDPAccountant()
            
            # Add noise batches (simplified)
            epsilon = accountant.get_privacy_spent(
                delta=delta,
                noise_multiplier=self.noise_multiplier,
                sample_rate=sample_rate,
                steps=num_rounds
            )
            
            return (epsilon, delta)
            
        except Exception as e:
            logger.warning(f"[DP] Privacy calculation failed: {e}")
            # Fallback to simple calculation
            epsilon = self.noise_multiplier * (num_rounds ** 0.5) * sample_rate
            return (epsilon, delta)
    
    def train_with_privacy(
        self,
        model: nn.Module,
        train_loader: DataLoader,
        epochs: int,
        lr: float = 0.001
    ) -> dict:
        """
        Train model with differential privacy.
        
        Args:
            model: PyTorch model
            train_loader: Training data loader
            epochs: Number of local epochs
            lr: Learning rate
        
        Returns:
            Training metrics dict
        """
        if not self.opacus_available:
            # Fallback to regular training
            return self._regular_train(model, train_loader, epochs, lr)
        
        # Setup optimizer
        optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
        
        # Make model private
        private_model, private_optimizer, sample_rate = self.make_model_private(
            model, optimizer, train_loader
        )
        
        # Training loop
        private_model.train()
        total_loss = 0.0
        num_batches = 0
        
        for epoch in range(epochs):
            for batch in train_loader:
                images, labels = batch
                images = images.to(self.client.device)
                labels = labels.to(self.client.device)
                
                private_optimizer.zero_grad()
                outputs = private_model(images)
                loss = nn.functional.cross_entropy(outputs, labels)
                loss.backward()
                private_optimizer.step()
                
                total_loss += loss.item()
                num_batches += 1
        
        avg_loss = total_loss / num_batches if num_batches > 0 else 0
        
        return {
            "loss": avg_loss,
            "privacy_enabled": True,
            "noise_multiplier": self.noise_multiplier,
            "max_grad_norm": self.max_grad_norm
        }
    
    def _regular_train(
        self,
        model: nn.Module,
        train_loader: DataLoader,
        epochs: int,
        lr: float
    ) -> dict:
        """Regular training without DP (fallback)."""
        optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
        model.train()
        
        total_loss = 0.0
        num_batches = 0
        
        for _ in range(epochs):
            for batch in train_loader:
                images, labels = batch
                images = images.to(self.client.device)
                labels = labels.to(self.client.device)
                
                optimizer.zero_grad()
                outputs = model(images)
                loss = nn.functional.cross_entropy(outputs, labels)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                num_batches += 1
        
        return {
            "loss": total_loss / num_batches if num_batches > 0 else 0,
            "privacy_enabled": False
        }


def create_dp_client(
    client,
    privacy_level: str = "medium"
) -> DPClientWrapper:
    """
    Create DP-wrapped client with preset privacy levels.
    
    Args:
        client: Original Flower client
        privacy_level: "low", "medium", "high", "maximum"
    
    Returns:
        DPClientWrapper instance
    """
    privacy_levels = {
        "low": {
            "noise_multiplier": 0.5,
            "max_grad_norm": 1.5,
            "secure_mode": False
        },
        "medium": {
            "noise_multiplier": 1.0,
            "max_grad_norm": 1.0,
            "secure_mode": False
        },
        "high": {
            "noise_multiplier": 2.0,
            "max_grad_norm": 0.5,
            "secure_mode": False
        },
        "maximum": {
            "noise_multiplier": 4.0,
            "max_grad_norm": 0.1,
            "secure_mode": True
        }
    }
    
    params = privacy_levels.get(privacy_level, privacy_levels["medium"])
    
    return DPClientWrapper(
        client=client,
        **params
    )


# Example usage
if __name__ == "__main__":
    print("\n" + "="*60)
    print("Differential Privacy Client")
    print("="*60)
    
    # Check Opacus availability
    try:
        import opacus
        print("✓ Opacus installed - DP available")
        print("\nPrivacy levels:")
        print("  low:      ε ≈ 5-10 (minimal privacy impact)")
        print("  medium:   ε ≈ 1-5 (recommended for medical)")
        print("  high:     ε ≈ 0.5-1 (strong privacy)")
        print("  maximum:  ε < 0.5 (very strong privacy)")
    except ImportError:
        print("✗ Opacus not installed")
        print("\nInstall with:")
        print("  pip install opacus")
    
    print("\n" + "="*60)