"""
Módulo de extração e ingestão de dados da missão NASA GPM / IMERG.
"""

from .gpm_extractor import GPMExtractor
from .nasa_data_ingestion import (
    IMERGTimeResolver,
    HDF5IntegrityChecker,
    NASAGranuleDownloader,
    NASADataIngestionError,
    NASAAuthenticationError,
    NASAGranuleNotFoundError,
    NASAConnectionError,
    NASAServerError,
    HDF5IntegrityError
)

__all__ = [
    "GPMExtractor",
    "IMERGTimeResolver",
    "HDF5IntegrityChecker",
    "NASAGranuleDownloader",
    "NASADataIngestionError",
    "NASAAuthenticationError",
    "NASAGranuleNotFoundError",
    "NASAConnectionError",
    "NASAServerError",
    "HDF5IntegrityError"
]
