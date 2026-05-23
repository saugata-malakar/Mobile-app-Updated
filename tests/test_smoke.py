"""Repository smoke tests — always run in CI."""


def test_repo_imports():
    import cv
    import ml
    import backend

    assert cv.__version__ == "0.1.0"
    assert ml.__version__ == "0.1.0"


def test_python_version():
    import sys

    assert sys.version_info >= (3, 10)
