"""
Testes unitários para o módulo de extração e recorte de grânulos IMERG.
"""

import os
import pytest
import numpy as np
from extraction.gpm_extractor import GPMExtractor


def test_clip_bounding_box():
    extractor = GPMExtractor()

    # Grade regular de latitudes e longitudes
    lats = np.array([-5.0, -3.0, -2.0, 0.0, 2.0])
    lons = np.array([-65.0, -60.0, -59.0, -55.0])

    # Matriz com forma (5, 4) indexada como (lat, lon)
    data = np.arange(20).reshape(5, 4)

    # Bounding box cobrindo latitudes [-4.0, -1.0] e longitudes [-61.5, -58.5]
    bbox = {
        "min_latitude": -4.0,
        "max_latitude": -1.0,
        "min_longitude": -61.5,
        "max_longitude": -58.5
    }

    result = extractor.clip_bounding_box(lats, lons, data, bbox)

    # Deve selecionar lats [-3.0, -2.0] e lons [-60.0, -59.0]
    assert np.array_equal(result["latitudes"], np.array([-3.0, -2.0]))
    assert np.array_equal(result["longitudes"], np.array([-60.0, -59.0]))
    assert result["precipitation_matrix"].shape == (2, 2)
