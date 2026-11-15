"""
Suíte de testes automatizados para o Motor Geoespacial Universal do SONATLAS.
Valida:
- Retângulo alinhado à grade
- Polígono irregular com corte diagonal
- MultiPolygon (ilhas disjuntas)
- Polígono com buraco (anel/donut)
- Células totalmente internas, parcialmente intersectadas e externas
- Validação e correção segura de geometrias inválidas
- Coordenadas fora dos limites WGS84
- Ausência de células intersectadas
- Tratamento ético de dados ausentes (sem converter para zero)
- Testes de regressão com os recortes reais da Amazônia Central e Kisangani
"""

import os
import json
import pytest
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, box

from geometry.geospatial_engine import (
    load_geojson,
    validate_geometry,
    repair_geometry_if_safe,
    calculate_bounding_box,
    compute_authalic_area,
    compute_cell_coverage_fractions,
    extract_grid_cells_for_geometry,
    generate_spatial_mask,
    calculate_spatial_indicators_with_geometry
)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AMAZON_GEOJSON = os.path.join(REPO_ROOT, "processing", "geometry", "amazon", "central_amazon_bbox.geojson")
CONGO_GEOJSON = os.path.join(REPO_ROOT, "processing", "geometry", "international", "congo_basin_kisangani_bbox.geojson")


def test_rectangle_coinciding_with_grid():
    """Retângulo cujas bordas coincidem com as fronteiras das células de 0.1°."""
    # Retângulo de 0.2° x 0.2° abrangendo 2x2 células
    # Centros das células: lat [0.05, 0.15], lon [10.05, 10.15]
    # Limites das células: lat [0.0, 0.2], lon [10.0, 10.2]
    rect = box(10.0, 0.0, 10.2, 0.2)
    lats = np.array([0.05, 0.15])
    lons = np.array([10.05, 10.15])

    fractions = compute_cell_coverage_fractions(lats, lons, rect, grid_resolution=0.1)

    assert fractions.shape == (2, 2)
    # Todas as 4 células estão 100% contidas no retângulo
    np.testing.assert_allclose(fractions, 1.0, atol=1e-5)


def test_irregular_polygon_fractional_coverage():
    """Polígono irregular (triângulo) cortando células diagonalmente."""
    # Triângulo cortando uma célula unitária de [0.0, 0.0] a [0.1, 0.1]
    # Corta a célula ao meio ao longo da diagonal: vértices (0, 0), (0.1, 0), (0.1, 0.1)
    triangle = Polygon([(0.0, 0.0), (0.1, 0.0), (0.1, 0.1), (0.0, 0.0)])
    lats = np.array([0.05])
    lons = np.array([0.05])

    fractions = compute_cell_coverage_fractions(lats, lons, triangle, grid_resolution=0.1)

    assert fractions.shape == (1, 1)
    # A área do triângulo retângulo é exatamente metade da célula
    assert 0.49 <= fractions[0, 0] <= 0.51


def test_multipolygon_disjoint_islands():
    """MultiPolygon com duas ilhas separadas por um vão."""
    island1 = box(0.0, 0.0, 0.1, 0.1)  # Célula (0, 0)
    island2 = box(0.2, 0.0, 0.3, 0.1)  # Célula (0, 2)
    multi = MultiPolygon([island1, island2])

    lats = np.array([0.05])
    lons = np.array([0.05, 0.15, 0.25])  # Colunas 0, 1 (vão), 2

    fractions = compute_cell_coverage_fractions(lats, lons, multi, grid_resolution=0.1)

    assert fractions.shape == (1, 3)
    assert fractions[0, 0] == 1.0  # Island 1
    assert fractions[0, 1] == 0.0  # Vão entre as ilhas
    assert fractions[0, 2] == 1.0  # Island 2


def test_polygon_with_hole():
    """Polígono com buraco (donut): exterior 0.3x0.3, interior 0.1x0.1."""
    ext = [(0.0, 0.0), (0.3, 0.0), (0.3, 0.3), (0.0, 0.3), (0.0, 0.0)]
    hole = [(0.1, 0.1), (0.2, 0.1), (0.2, 0.2), (0.1, 0.2), (0.1, 0.1)]
    donut = Polygon(ext, [hole])

    lats = np.array([0.05, 0.15, 0.25])
    lons = np.array([0.05, 0.15, 0.25])

    fractions = compute_cell_coverage_fractions(lats, lons, donut, grid_resolution=0.1)

    assert fractions.shape == (3, 3)
    # A célula central (índices 1, 1) coincide exatamente com o buraco
    assert fractions[1, 1] == 0.0
    # As células perimétricas estão completamente preenchidas
    assert fractions[0, 0] == 1.0
    assert fractions[0, 1] == 1.0
    assert fractions[0, 2] == 1.0
    assert fractions[1, 0] == 1.0
    assert fractions[1, 2] == 1.0
    assert fractions[2, 0] == 1.0
    assert fractions[2, 1] == 1.0
    assert fractions[2, 2] == 1.0


def test_fully_internal_partially_intersected_and_external_cells():
    """Verifica simultaneamente células internas, parcialmente intersectadas e externas."""
    # Polígono cobrindo linha 0 inteira e metade da linha 1
    poly = box(0.0, 0.0, 0.2, 0.15)
    lats = np.array([0.05, 0.15, 0.25])
    lons = np.array([0.05, 0.15])

    fractions = compute_cell_coverage_fractions(lats, lons, poly, grid_resolution=0.1)

    # Linha 0 (lat 0.05): totalmente interna
    assert fractions[0, 0] == 1.0
    assert fractions[0, 1] == 1.0

    # Linha 1 (lat 0.15): cortada na metade superior (lat de 0.10 a 0.15 de 0.10-0.20)
    assert 0.48 <= fractions[1, 0] <= 0.52
    assert 0.48 <= fractions[1, 1] <= 0.52

    # Linha 2 (lat 0.25): totalmente externa
    assert fractions[2, 0] == 0.0
    assert fractions[2, 1] == 0.0


def test_invalid_geometry_identification_and_safe_repair():
    """Identifica auto-interseção (bow-tie) e corrige com conservação de área."""
    # Polígono auto-intersectante em formato gravata-borboleta
    bowtie = Polygon([(0.0, 0.0), (2.0, 2.0), (2.0, 0.0), (0.0, 2.0), (0.0, 0.0)])
    
    is_valid, errors = validate_geometry(bowtie)
    assert is_valid is False
    assert any("Self-intersection" in err for err in errors)

    repaired, was_repaired, reason = repair_geometry_if_safe(bowtie)
    assert was_repaired is True
    assert repaired.is_valid is True
    assert repaired.geom_type in ["Polygon", "MultiPolygon"]
    # Área total da borboleta (dois triângulos de base 2 e altura 1 = 1 + 1 = 2)
    assert np.isclose(repaired.area, 2.0)


def test_degenerate_geometry_repair_refusal():
    """Recusa correção de geometria colapsada em linha (área zero)."""
    line_poly = Polygon([(0.0, 0.0), (1.0, 1.0), (2.0, 2.0), (0.0, 0.0)])
    is_valid, errors = validate_geometry(line_poly)
    assert is_valid is False

    repaired, was_repaired, reason = repair_geometry_if_safe(line_poly)
    assert was_repaired is False
    assert "Inseguro" in reason


def test_coordinates_out_of_bounds():
    """Valida rejeição de coordenadas fora do domínio WGS84."""
    out_poly = box(-190.0, 0.0, 10.0, 95.0)
    is_valid, errors = validate_geometry(out_poly)

    assert is_valid is False
    assert any("Longitude fora dos limites" in e for e in errors)
    assert any("Latitude fora dos limites" in e for e in errors)

    _, was_repaired, reason = repair_geometry_if_safe(out_poly)
    assert was_repaired is False
    assert "Inseguro" in reason


def test_no_intersected_cells():
    """Quando o polígono está completamente fora da grade fornecida."""
    poly_far = box(50.0, 50.0, 51.0, 51.0)
    lats = np.array([-10.0, -9.9])
    lons = np.array([-60.0, -59.9])
    matrix = np.array([[1.0, 2.0], [3.0, 4.0]])

    result = calculate_spatial_indicators_with_geometry(matrix, lats, lons, poly_far)

    assert result["mean_precipitation_rate"] is None
    assert result["rain_area_fraction"] is None
    assert result["availability_status"] == "missing"
    assert result["mask_info"]["intersected_cells_count"] == 0


def test_missing_data_treatment_without_zero_conversion():
    """Valida que valores -9999.9 e NaN são ignorados nos pesos sem serem convertidos para 0."""
    poly = box(0.0, 0.0, 0.2, 0.2)
    lats = np.array([0.05, 0.15])
    lons = np.array([0.05, 0.15])

    # 4 células: 3 válidas (0.0, 2.0, 4.0) e 1 ausente (-9999.9)
    matrix = np.array([
        [0.0, 2.0],
        [-9999.9, 4.0]
    ])

    result = calculate_spatial_indicators_with_geometry(matrix, lats, lons, poly)

    # 3 de 4 células válidas = 75% disponibilidade -> status 'partial'
    assert result["availability_status"] == "partial"
    assert result["mask_info"]["valid_intersected_count"] == 3
    assert result["mask_info"]["missing_intersected_count"] == 1

    # A média deve ser calculada apenas sobre as 3 células válidas
    # cos(0.05) ~= cos(0.15) no equador, média esperada ~= (0.0 + 2.0 + 4.0)/3 = 2.0
    assert 1.99 <= result["mean_precipitation_rate"] <= 2.01

    # O zero não foi descartado: choveram 2 células das 3 válidas -> fração de chuva = 2/3 = 66.7%
    assert 0.66 <= result["rain_area_fraction"] <= 0.67


def test_regression_amazon_central_geometry():
    """Teste de regressão estrito para o recorte oficial da Amazônia Central."""
    assert os.path.exists(AMAZON_GEOJSON), f"GeoJSON da Amazônia não encontrado: {AMAZON_GEOJSON}"
    geom, props = load_geojson(AMAZON_GEOJSON)

    is_valid, errors = validate_geometry(geom)
    assert is_valid is True, f"Geometria da Amazônia inválida: {errors}"
    assert props["region_id"] == "amazon_central"

    bbox = calculate_bounding_box(geom)
    assert bbox["min_latitude"] == -4.0
    assert bbox["max_latitude"] == -1.5
    assert bbox["min_longitude"] == -61.5
    assert bbox["max_longitude"] == -58.5

    # Grade padrão IMERG no recorte da Amazônia (25 lats x 30 lons = 750 células)
    lats = np.round(np.arange(-3.95, -1.45, 0.1), 2)
    lons = np.round(np.arange(-61.45, -58.45, 0.1), 2)

    assert len(lats) == 25
    assert len(lons) == 30

    fractions = compute_cell_coverage_fractions(lats, lons, geom, grid_resolution=0.1)
    assert fractions.shape == (25, 30)

    # Todas as 750 células devem ser 100% cobertas (fração 1.0)
    assert np.all(fractions >= 0.9999)
    assert np.allclose(fractions, 1.0)






def test_regression_congo_kisangani_geometry():
    """Teste de regressão estrito para a Janela de Kisangani (Bacia do Congo)."""
    assert os.path.exists(CONGO_GEOJSON), f"GeoJSON de Kisangani não encontrado: {CONGO_GEOJSON}"
    geom, props = load_geojson(CONGO_GEOJSON)

    is_valid, errors = validate_geometry(geom)
    assert is_valid is True, f"Geometria de Kisangani inválida: {errors}"
    assert props["region_id"] == "congo_basin_kisangani"

    bbox = calculate_bounding_box(geom)
    assert bbox["min_latitude"] == -0.8
    assert bbox["max_latitude"] == 1.7
    assert bbox["min_longitude"] == 23.7
    assert bbox["max_longitude"] == 26.7

    # Grade padrão IMERG no recorte de Kisangani (25 lats x 30 lons = 750 células)
    lats = np.round(np.arange(-0.75, 1.75, 0.1), 2)
    lons = np.round(np.arange(23.75, 26.75, 0.1), 2)

    assert len(lats) == 25
    assert len(lons) == 30

    fractions = compute_cell_coverage_fractions(lats, lons, geom, grid_resolution=0.1)
    assert fractions.shape == (25, 30)

    # Todas as 750 células devem ser 100% cobertas (fração 1.0)
    assert np.all(fractions >= 0.9999)
    assert np.allclose(fractions, 1.0)






def test_arbitrary_irregular_geometry_with_hole_and_fractional_boundaries():
    """
    Comprova os 5 critérios científicos obrigatórios para geometrias arbitrárias:
    1. Frações de cobertura f_i,j estritamente em [0.0, 1.0].
    2. Células de fronteira recebem pesos rigorosamente proporcionais à sua área de interseção.
    3. Células externas têm fração e contribuição exatamente zero.
    4. Buracos interiores não são contabilizados como área válida (f = 0.0 no buraco).
    5. A média ponderada e a fração de chuva utilizam exatamente os mesmos pesos válidos.
    """
    # Grade 3x3 centrada em latitudes [10.05, 10.15, 10.25], longitudes [20.05, 20.15, 20.25]
    # Limites da grade: lats [10.0, 10.3], lons [20.0, 20.3]
    lats = np.array([10.05, 10.15, 10.25])
    lons = np.array([20.05, 20.15, 20.25])

    # Polígono irregular: trapézio com exterior cortando a linha 2 diagonalmente
    # Vértices externos: (20.0, 10.0) -> (20.2, 10.0) -> (20.2, 10.2) -> (20.0, 10.3) -> fecha
    # Buraco interior cobrindo a célula central (1, 1): [20.1, 10.1] a [20.2, 10.2]
    exterior_coords = [
        (20.0, 10.0),
        (20.2, 10.0),
        (20.2, 10.2),
        (20.0, 10.3),
        (20.0, 10.0)
    ]
    hole_coords = [
        (20.1, 10.1),
        (20.2, 10.1),
        (20.2, 10.2),
        (20.1, 10.2),
        (20.1, 10.1)
    ]
    irregular_poly = Polygon(exterior_coords, [hole_coords])

    # 1. Frações de cobertura
    fractions = compute_cell_coverage_fractions(lats, lons, irregular_poly, grid_resolution=0.1)
    assert fractions.shape == (3, 3)

    # Critério 1: Frações entre 0.0 e 1.0
    assert np.all(fractions >= 0.0) and np.all(fractions <= 1.0)

    # Critério 3: Células externas na coluna 2 têm fração exatamente 0.0
    assert fractions[0, 2] == 0.0
    assert fractions[1, 2] == 0.0
    assert fractions[2, 2] == 0.0

    # Critério 4: Buraco interior (célula central 1, 1) tem fração 0.0
    assert fractions[1, 1] == 0.0

    # Critério 2: Células totalmente internas têm f = 1.0
    assert fractions[0, 0] == 1.0
    assert fractions[0, 1] == 1.0
    assert fractions[1, 0] == 1.0

    # Células parcialmente cortadas na linha superior (linha 2)
    assert np.isclose(fractions[2, 0], 0.75, atol=0.01)
    assert np.isclose(fractions[2, 1], 0.25, atol=0.01)

    # Matriz com valores heterogêneos de precipitação, incluindo ausentes (-9999.9) e zero
    precip_matrix = np.array([
        [0.0, 2.5, 5.0],      # Linha 0 (todas f=1.0)
        [1.0, 10.0, 3.0],     # Linha 1 (col 1 é o buraco f=0.0)
        [4.0, 2.0, -9999.9]   # Linha 2 (col 2 é externa e -9999.9)
    ])

    indicators = calculate_spatial_indicators_with_geometry(
        precip_matrix, lats, lons, irregular_poly, threshold_rate_mm_h=0.1, missing_value=-9999.9
    )

    # Critério 5: A média ponderada é calculada corretamente
    mean_rate = indicators["mean_precipitation_rate"]
    assert mean_rate is not None and mean_rate > 0.0

    # Verifica cálculo manual dos pesos esperados W_i,j = cos(lat_i) * f_i,j * M_i,j
    cos_l = np.cos(np.radians(lats))
    cos_2d = np.repeat(cos_l[:, np.newaxis], 3, axis=1)
    valid_mask = (precip_matrix >= 0.0) & (precip_matrix != -9999.9)
    expected_weights = cos_2d * fractions * valid_mask

    manual_weighted_sum = np.sum(precip_matrix * expected_weights)
    manual_weight_sum = np.sum(expected_weights)
    manual_mean = float(manual_weighted_sum / manual_weight_sum)

    assert np.isclose(mean_rate, manual_mean, rtol=1e-7)

    # Fração de área com chuva (P >= 0.1)
    rain_mask = valid_mask & (precip_matrix >= 0.1)
    manual_rain_area = float(np.sum(cos_2d * fractions * rain_mask) / manual_weight_sum)
    assert np.isclose(indicators["rain_area_fraction"], manual_rain_area, rtol=1e-7)


def test_densify_geometry_preserves_shape():
    """Valida que densify_geometry adiciona vértices sem alterar área ou validade."""
    from geometry.geospatial_engine import densify_geometry
    poly = Polygon([(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0), (0.0, 0.0)])
    densified = densify_geometry(poly, max_segment_degrees=0.05)

    assert densified.is_valid is True
    assert np.isclose(densified.area, poly.area, rtol=1e-8)
    assert len(densified.exterior.coords) > len(poly.exterior.coords)


def test_real_hdf5_granule_integration_if_present():
    """Valida integração direta com grânulo HDF5 real se disponível localmente."""
    import glob
    from extraction.gpm_extractor import GPMExtractor

    raw_dir = os.path.join(REPO_ROOT, "processing", "data", "raw")
    h5_candidates = sorted(glob.glob(os.path.join(raw_dir, "3B-HHR-E.*-S170000-*.V07B.HDF5")))

    if not h5_candidates:
        pytest.skip("Nenhum grânulo HDF5 vespertino real encontrado localmente.")

    h5_file = h5_candidates[0]
    raw_data = GPMExtractor.read_imerg_hdf5(h5_file)
    lats = np.round(raw_data["latitudes"], 6)
    lons = np.round(raw_data["longitudes"], 6)
    precip = raw_data["precipitation_matrix"]
    fill_val = raw_data["fill_value"]

    # Validação Amazônia Central
    am_geom, _ = load_geojson(AMAZON_GEOJSON)
    subset_am = extract_grid_cells_for_geometry(lats, lons, am_geom, grid_resolution=0.1)
    sub_mat_am = precip[np.ix_(subset_am["lat_indices"], subset_am["lon_indices"])]

    ind_am = calculate_spatial_indicators_with_geometry(
        sub_mat_am, subset_am["latitudes"], subset_am["longitudes"], am_geom, threshold_rate_mm_h=0.1, missing_value=fill_val
    )

    assert subset_am["total_cells"] == 750
    assert ind_am["mask_info"]["intersected_cells_count"] == 750
    assert ind_am["mask_info"]["valid_intersected_count"] == 750
    assert ind_am["mean_precipitation_rate"] > 0.0
    assert ind_am["max_precipitation_rate"] > 0.0

    # Validação Kisangani
    cg_geom, _ = load_geojson(CONGO_GEOJSON)
    subset_cg = extract_grid_cells_for_geometry(lats, lons, cg_geom, grid_resolution=0.1)
    sub_mat_cg = precip[np.ix_(subset_cg["lat_indices"], subset_cg["lon_indices"])]

    ind_cg = calculate_spatial_indicators_with_geometry(
        sub_mat_cg, subset_cg["latitudes"], subset_cg["longitudes"], cg_geom, threshold_rate_mm_h=0.1, missing_value=fill_val
    )

    assert subset_cg["total_cells"] == 750
    assert ind_cg["mask_info"]["intersected_cells_count"] == 750
    assert ind_cg["mask_info"]["valid_intersected_count"] == 750
    assert ind_cg["mean_precipitation_rate"] > 0.0
