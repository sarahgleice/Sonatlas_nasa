"""Módulo de Geometria e Operações Geoespaciais do SONATLAS."""
from .geospatial_engine import (
    load_geojson,
    validate_geometry,
    repair_geometry_if_safe,
    densify_geometry,
    calculate_bounding_box,
    compute_authalic_area,
    compute_cell_coverage_fractions,
    extract_grid_cells_for_geometry,
    generate_spatial_mask,
    calculate_spatial_indicators_with_geometry,
)

__all__ = [
    "load_geojson",
    "validate_geometry",
    "repair_geometry_if_safe",
    "densify_geometry",
    "calculate_bounding_box",
    "compute_authalic_area",
    "compute_cell_coverage_fractions",
    "extract_grid_cells_for_geometry",
    "generate_spatial_mask",
    "calculate_spatial_indicators_with_geometry",
]
