"""
Extrator de dados de precipitação da missão NASA GPM (IMERG V07B).
Responsável pela abertura, leitura de variáveis, transposição espacial e recorte.
"""

import os
from typing import Dict, Any, Optional
import numpy as np


class GPMExtractor:
    """
    Interface para download, leitura e extração de grânulos IMERG HDF5/NetCDF4.
    """

    def __init__(self, username: Optional[str] = None, password: Optional[str] = None):
        self.username = username or os.getenv("EARTHDATA_USERNAME")
        self.password = password or os.getenv("EARTHDATA_PASSWORD")
        self.base_url = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHHE.07"

    @staticmethod
    def read_imerg_hdf5(filepath: str) -> Dict[str, Any]:
        """
        Lê grânulo oficial IMERG no formato HDF5.
        Identifica a variável Grid/precipitationCal ou Grid/precipitation,
        extrai coordenadas lat/lon e aplica a transposição (.T) para o formato (lat, lon).
        """
        import h5py

        with h5py.File(filepath, "r") as h5:
            if "Grid" not in h5:
                raise ValueError("Grupo '/Grid' não encontrado no grânulo HDF5.")

            grid = h5["Grid"]
            
            # Localizar variável de taxa de precipitação
            var_name = None
            for candidate in ["precipitationCal", "precipitation", "precipitationUncal"]:
                if candidate in grid:
                    var_name = candidate
                    break

            if not var_name:
                raise ValueError("Nenhuma variável de precipitação compatível encontrada em '/Grid'.")

            ds = grid[var_name]
            raw_matrix = ds[:]
            fill_val = float(ds.attrs.get("_FillValue", -9999.9))
            units = ds.attrs.get("units", "mm/hr")
            if isinstance(units, bytes):
                units = units.decode("utf-8")

            lats = grid["lat"][:] if "lat" in grid else None
            lons = grid["lon"][:] if "lon" in grid else None

            # Tratar dimensão temporal unitária se presente (ex: shape (1, 3600, 1800) -> (3600, 1800))
            if raw_matrix.ndim == 3 and raw_matrix.shape[0] == 1:
                raw_matrix = raw_matrix[0]

            # Transposição se a matriz for (lon, lat) para retornar em (lat, lon)
            if raw_matrix.ndim == 2 and lons is not None and lats is not None:
                if raw_matrix.shape == (len(lons), len(lats)):
                    spatial_matrix = raw_matrix.T
                else:
                    spatial_matrix = raw_matrix
            else:
                spatial_matrix = raw_matrix

            return {
                "variable_name": f"/Grid/{var_name}",
                "units": units,
                "units_attribute_present": "units" in ds.attrs,
                "fill_value": fill_val,
                "fill_value_attribute_present": "_FillValue" in ds.attrs,
                "latitudes": lats,
                "longitudes": lons,
                "precipitation_matrix": spatial_matrix
            }

    def clip_bounding_box(
        self,
        grid_lat: np.ndarray,
        grid_lon: np.ndarray,
        data_matrix: np.ndarray,
        bbox: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Recorta a matriz para os limites da bounding box informada.
        Garante que data_matrix esteja indexada como (lat, lon).
        """
        lat_mask = (grid_lat >= bbox["min_latitude"]) & (grid_lat <= bbox["max_latitude"])
        lon_mask = (grid_lon >= bbox["min_longitude"]) & (grid_lon <= bbox["max_longitude"])

        clipped_lat = grid_lat[lat_mask]
        clipped_lon = grid_lon[lon_mask]

        # Recorte bidimensional na ordem (lat, lon)
        clipped_data = data_matrix[np.ix_(lat_mask, lon_mask)]

        return {
            "latitudes": clipped_lat,
            "longitudes": clipped_lon,
            "precipitation_matrix": clipped_data
        }
