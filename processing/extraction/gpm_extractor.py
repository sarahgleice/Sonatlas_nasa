"""
Extrator de dados de precipitação da missão NASA GPM (IMERG V07).
Responsável pela conexão com GES DISC e recorte espacial.
"""

import os
from typing import Dict, Any, Optional
import numpy as np


class GPMExtractor:
    """
    Interface para download e extração de grânulos IMERG HDF5/NetCDF4.
    """

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or os.getenv("EARTHDATA_USERNAME")
        self.password = password or os.getenv("EARTHDATA_PASSWORD")
        self.base_url = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHHE.07"

    def clip_bounding_box(
        self,
        grid_lat: np.ndarray,
        grid_lon: np.ndarray,
        data_matrix: np.ndarray,
        bbox: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Recorta a matriz global para os limites da bounding box informada.
        """
        lat_mask = (grid_lat >= bbox["min_latitude"]) & (grid_lat <= bbox["max_latitude"])
        lon_mask = (grid_lon >= bbox["min_longitude"]) & (grid_lon <= bbox["max_longitude"])

        clipped_lat = grid_lat[lat_mask]
        clipped_lon = grid_lon[lon_mask]

        # Aplicar máscaras bidimensionais
        clipped_data = data_matrix[np.ix_(lat_mask, lon_mask)]

        return {
            "latitudes": clipped_lat,
            "longitudes": clipped_lon,
            "precipitation_matrix": clipped_data
        }
