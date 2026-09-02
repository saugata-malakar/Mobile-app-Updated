"""
Federated Learning Module for DiabetesCare AI
Week 3 PoC: Flower-based FL with 3 simulated client nodes
"""

from .fl_config import FLConfig
from .client import WoundSeverityClient
from .server import get_fl_server
from .utils import (
    plot_convergence,
    calculate_latency_stats,
    compare_centralized_federated,
    save_fl_results
)

__all__ = [
    'FLConfig',
    'WoundSeverityClient',
    'get_fl_server',
    'plot_convergence',
    'calculate_latency_stats',
    'compare_centralized_federated',
    'save_fl_results'
]