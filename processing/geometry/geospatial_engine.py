"""
Motor Geoespacial Universal — SONATLAS
Processamento Científico Geoespacial Agnóstico de Região para Dados NASA GPM IMERG.

Este módulo implementa operações geoespaciais independentes de região geográfica:
- Leitura e normalização de GeoJSON (Polygon e MultiPolygon).
- Validação rigorosa de coordenadas WGS84 (EPSG:4326) e topologia.
- Correção segura e documentada de geometrias quando viável (orientação de anéis e self-intersections).
- Cálculo exato de bounding box.
- Recorte espacial e extração de células da grade regular IMERG.
- Cálculo de fração de cobertura física celular com projeção equivalente de área autálica
  (Lambert Cylindrical Equal-Area: [lon_rad, sin(lat_rad)]) para preservar as proporções de área real no esferoide.
- Geração de máscaras espaciais e pesos ponderados com rigor metodológico.
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Tuple, Union, Optional
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, box, shape
from shapely.geometry.base import BaseGeometry
from shapely.validation import explain_validity, make_valid
from shapely.geometry.polygon import orient
from shapely import transform
from shapely.prepared import prep


def load_geojson(source: Union[str, Path, dict]) -> Tuple[BaseGeometry, Dict[str, Any]]:
    """
    Carrega e normaliza uma geometria GeoJSON a partir de arquivo em disco ou dicionário em memória.
    Suporta Geometry, Feature e FeatureCollection.
    Se for FeatureCollection contendo múltiplos polígonos, realiza a união espacial limpa.
    
    Retorna:
        Tuple: (geometria_shapely, dicionario_propriedades)
    """
    if isinstance(source, (str, Path)):
        path = Path(source)
        if not path.exists():
            raise FileNotFoundError(f"Arquivo GeoJSON não encontrado: {path}")
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            raise ValueError(f"Falha ao decodificar arquivo GeoJSON '{path}': {e}") from e
    elif isinstance(source, dict):
        data = source
    else:
        raise TypeError(f"Fonte GeoJSON inválida. Esperado str, Path ou dict, recebido: {type(source)}")

    properties: Dict[str, Any] = {}
    geom_type = data.get("type")

    if geom_type == "FeatureCollection":
        features = data.get("features", [])
        if not features:
            raise ValueError("FeatureCollection vazia: não contém feições.")
        geoms = []
        for f in features:
            if "properties" in f and not properties:
                properties = dict(f["properties"])
            g = f.get("geometry")
            if g:
                geoms.append(shape(g))
        if not geoms:
            raise ValueError("FeatureCollection não contém geometrias válidas.")
        if len(geoms) == 1:
            geom = geoms[0]
        else:
            from shapely.ops import unary_union
            geom = unary_union(geoms)

    elif geom_type == "Feature":
        properties = dict(data.get("properties", {}))
        g = data.get("geometry")
        if not g:
            raise ValueError("Feição GeoJSON sem o campo 'geometry'.")
        geom = shape(g)

    elif geom_type in ["Polygon", "MultiPolygon"]:
        geom = shape(data)
    else:
        # Tentativa genérica de shape
        geom = shape(data)

    return geom, properties


def validate_geometry(geom: Any) -> Tuple[bool, List[str]]:
    """
    Valida rigorosamente uma geometria contra os requisitos da plataforma SONATLAS:
    - Deve ser Polygon ou MultiPolygon.
    - Não pode ser vazia.
    - Coordenadas estritamente nos limites WGS84 (Lon: [-180, 180], Lat: [-90, 90]).
    - Topologicamente válida segundo OGC / SFS (sem auto-interseções, anéis invertidos, etc.).
    - Área positiva > 0.
    
    Retorna:
        Tuple: (is_valid, lista_de_erros)
    """
    errors: List[str] = []

    if not isinstance(geom, BaseGeometry):
        return False, [f"Objeto não é uma geometria Shapely: {type(geom)}"]

    if geom.is_empty:
        return False, ["Geometria vazia (sem coordenadas)."]

    if geom.geom_type not in ["Polygon", "MultiPolygon"]:
        return False, [f"Tipo de geometria inválido: '{geom.geom_type}'. Esperado 'Polygon' ou 'MultiPolygon'."]

    # Validação de limites de coordenadas WGS84
    min_lon, min_lat, max_lon, max_lat = geom.bounds
    if min_lon < -180.0 or max_lon > 180.0:
        errors.append(f"Longitude fora dos limites WGS84 [-180, 180]: min={min_lon}, max={max_lon}")
    if min_lat < -90.0 or max_lat > 90.0:
        errors.append(f"Latitude fora dos limites WGS84 [-90, 90]: min={min_lat}, max={max_lat}")

    # Área em graus
    if geom.area <= 0.0:
        errors.append("Área da geometria é zero ou degenerada.")

    # Validação topológica
    if not geom.is_valid:
        explanation = explain_validity(geom)
        errors.append(f"Geometria topologicamente inválida segundo o padrão OGC: {explanation}")

    return (len(errors) == 0), errors


def repair_geometry_if_safe(geom: BaseGeometry) -> Tuple[BaseGeometry, bool, str]:
    """
    Corrige geometrias inválidas apenas quando a correção for matematicamente segura e documentada.
    Casos seguros:
    1. Orientação de anéis (exterior anti-horário, interiores horários) via orient().
    2. Auto-interseção pontual (ex.: polígono borboleta / bow-tie) corrigida via make_valid(),
       desde que o resultado permaneça na dimensão 2D (Polygon ou MultiPolygon), tenha área > 0
       e sua bounding box permaneça contida no envelope da geometria original.
    
    Critérios de recusa:
    - Coordenadas extrapolando o domínio global WGS84 [-180, 180] / [-90, 90].
    - Geometrias degeneradas que colapsam em linhas (1D), pontos (0D) ou vazio.
    - Resultados com área nula ou que permaneçam topologicamente inválidos.
    
    NOTA AUDITORIA: Não utiliza variação percentual de área da geometria inválida como critério,
    pois geometrias auto-intersectantes (ex.: bow-tie) possuem cálculo de área original cancelado
    ou inconsistente por Green/Shoelace, não servindo como referência matemática confiável.
    
    Retorna:
        Tuple: (geometria_corrigida_ou_original, foi_corrigida, motivo_ou_explicacao)
    """
    is_valid, errors = validate_geometry(geom)
    if is_valid:
        return geom, False, "Geometria já é válida segundo os padrões OGC/WGS84."

    # Se erro for coordenadas fora de WGS84, não é seguro corrigir
    min_lon, min_lat, max_lon, max_lat = geom.bounds
    if min_lon < -180.0 or max_lon > 180.0 or min_lat < -90.0 or max_lat > 90.0:
        return geom, False, "Inseguro corrigir: coordenadas extrapolam o domínio global WGS84 [-180, 180] / [-90, 90]."

    try:
        # 1. Tentativa com correção de orientação de anéis se for Polygon
        if geom.geom_type == "Polygon":
            oriented_geom = orient(geom, sign=1.0)
            if oriented_geom.is_valid and oriented_geom.area > 0.0:
                return oriented_geom, True, "Correção segura de orientação de anéis (orientação OGC anti-horária preservando vértices)."

        # 2. Correção topológica via make_valid (ISO 19107 / OGC)
        repaired = make_valid(geom)

        if repaired.is_empty:
            return geom, False, "Inseguro corrigir: make_valid resultou em geometria vazia."

        # Filtrar apenas partes poligonais 2D se make_valid gerou GeometryCollection mista
        if repaired.geom_type == "GeometryCollection":
            from shapely.ops import unary_union
            polys = [p for p in repaired.geoms if p.geom_type in ["Polygon", "MultiPolygon"] and p.area > 0.0]
            if not polys:
                return geom, False, "Inseguro corrigir: geometria colapsou em dimensão inferior (linhas/pontos sem área 2D)."
            repaired = unary_union(polys)

        if repaired.geom_type not in ["Polygon", "MultiPolygon"]:
            return geom, False, f"Inseguro corrigir: resultado é '{repaired.geom_type}' (dimensão < 2D), não poligonal."

        repaired_area = repaired.area
        if repaired_area <= 0.0:
            return geom, False, "Inseguro corrigir: resultado possui área 2D nula ou degenerada."

        # Verificação de contenção espacial: bounding box reparada não pode extrapolar a original
        orig_bounds = geom.bounds
        rep_bounds = repaired.bounds
        tol = 1e-6
        if (rep_bounds[0] < orig_bounds[0] - tol or
            rep_bounds[1] < orig_bounds[1] - tol or
            rep_bounds[2] > orig_bounds[2] + tol or
            rep_bounds[3] > orig_bounds[3] + tol):
            return geom, False, "Inseguro corrigir: bounding box reparada extrapola os limites da geometria original."

        # Validação final da geometria resultante
        final_valid, final_errors = validate_geometry(repaired)
        if not final_valid:
            return geom, False, f"Inseguro corrigir: resultado permanece inválido pós-reparo: {final_errors}"

        return repaired, True, f"Correção segura via make_valid(): topologia OGC restabelecida como {repaired.geom_type} (área física={repaired.area:.6f} graus²)."

    except Exception as e:
        return geom, False, f"Falha na tentativa de correção segura: {e}"


def calculate_bounding_box(geom: BaseGeometry) -> Dict[str, float]:
    """
    Calcula a Bounding Box exata da geometria em formato padronizado.
    """
    min_lon, min_lat, max_lon, max_lat = geom.bounds
    return {
        "min_latitude": float(min_lat),
        "max_latitude": float(max_lat),
        "min_longitude": float(min_lon),
        "max_longitude": float(max_lon)
    }


def to_authalic_coords(coords: np.ndarray) -> np.ndarray:
    """
    Projeção autálica equivalente de área cilíndrica de Lambert:
    x = lon_rad
    y = sin(lat_rad)
    
    Neste espaço de coordenadas, o Jacobiano da transformação é |cos(phi)|,
    de modo que a integral de área planar euclidiana é rigorosamente proporcional
    à área física esférica real:
    Area_fisica = R_E^2 * Area_autálica.
    """
    lon_rad = np.radians(coords[:, 0])
    sin_lat = np.sin(np.radians(coords[:, 1]))
    return np.column_stack([lon_rad, sin_lat])


def compute_authalic_area(geom: BaseGeometry) -> float:
    """
    Calcula a área física autálica de uma geometria no espaço esférico.
    """
    if geom.is_empty:
        return 0.0
    transformed = transform(geom, to_authalic_coords)
    return float(transformed.area)


def densify_geometry(geom: BaseGeometry, max_segment_degrees: float = 0.05) -> BaseGeometry:
    """
    Densifica as bordas de uma geometria em WGS84 para que nenhum segmento exceda max_segment_degrees.
    Garante que a projeção autálica de Lambert capture com fidelidade sub-métrica
    a curvatura física do arco e que a decomposição em células não sofra distorção linear de corda.
    """
    import shapely
    if geom.is_empty:
        return geom
    return shapely.segmentize(geom, max_segment_length=max_segment_degrees)


def extract_grid_cells_for_geometry(
    grid_lats: np.ndarray,
    grid_lons: np.ndarray,
    geom: BaseGeometry,
    grid_resolution: float = 0.1
) -> Dict[str, Any]:
    """
    Identifica e extrai as fatias de latitude e longitude que intersectam
    a bounding box da geometria com área física 2D positiva, considerando a meia-célula (0.05°).
    
    Retorna:
        Dict com sub_lats, sub_lons, lat_indices, lon_indices e bounding_box.
    """
    half_cell = grid_resolution / 2.0
    bbox = calculate_bounding_box(geom)
    eps = 1e-5

    # Células cujo interior 2D intersecta o retângulo limitante da geometria
    # lat_c + half_cell > min_lat  ==>  lat_c >= min_lat - half_cell + eps
    # lat_c - half_cell < max_lat  ==>  lat_c <= max_lat + half_cell - eps
    lat_min_bound = bbox["min_latitude"] - half_cell + eps
    lat_max_bound = bbox["max_latitude"] + half_cell - eps
    lon_min_bound = bbox["min_longitude"] - half_cell + eps
    lon_max_bound = bbox["max_longitude"] + half_cell - eps

    lat_mask = (grid_lats >= lat_min_bound) & (grid_lats <= lat_max_bound)
    lon_mask = (grid_lons >= lon_min_bound) & (grid_lons <= lon_max_bound)

    lat_indices = np.where(lat_mask)[0]
    lon_indices = np.where(lon_mask)[0]

    return {
        "latitudes": grid_lats[lat_mask],
        "longitudes": grid_lons[lon_mask],
        "lat_indices": lat_indices,
        "lon_indices": lon_indices,
        "bounding_box": bbox,
        "n_rows": len(lat_indices),
        "n_cols": len(lon_indices),
        "total_cells": len(lat_indices) * len(lon_indices)
    }


def compute_cell_coverage_fractions(
    lats: np.ndarray,
    lons: np.ndarray,
    geom: BaseGeometry,
    grid_resolution: float = 0.1
) -> np.ndarray:
    """
    Calcula com precisão científica a matriz 2D de frações de cobertura física (f_i,j in [0.0, 1.0])
    para cada célula da grade regular (lat, lon).
    
    Metodologia:
    1. Pré-filtro ultra-rápido com shapely.prepared (prep):
       - Se a geometria contém a célula inteira -> f_i,j = 1.0 (ex.: interior de bacias).
       - Se a geometria for disjunta da célula -> f_i,j = 0.0 (ex.: fora da bacia).
    2. Para células de fronteira (fronteira parcial):
       - Calcula a interseção geométrica exata I = celula ∩ geometria.
       - Projeta a célula e a interseção para o plano autálico (Lambert Cylindrical Equal-Area).
       - f_i,j = Area_autálica(I) / Area_autálica(celula).
    
    Não introduz limiar arbitrário de corte: células tangentes com frações infinitesimais
    possuem contribuição exatamente proporcional à sua área real.
    
    Retorna:
        np.ndarray de shape (len(lats), len(lons)) com valores em [0.0, 1.0].
    """
    n_rows = len(lats)
    n_cols = len(lons)
    fractions = np.zeros((n_rows, n_cols), dtype=np.float64)

    if geom.is_empty or n_rows == 0 or n_cols == 0:
        return fractions

    half_res = grid_resolution / 2.0
    prepared_geom = prep(geom)

    # Pré-cálculo da área autálica das células em cada latitude (independe da longitude)
    cell_auth_areas = np.zeros(n_rows, dtype=np.float64)
    for i, lat in enumerate(lats):
        c_ref = box(-half_res, lat - half_res, half_res, lat + half_res)
        cell_auth_areas[i] = compute_authalic_area(c_ref)

    for i, lat in enumerate(lats):
        c_lat_min = lat - half_res
        c_lat_max = lat + half_res
        c_area = cell_auth_areas[i]

        for j, lon in enumerate(lons):
            c_lon_min = lon - half_res
            c_lon_max = lon + half_res

            cell_polygon = box(c_lon_min, c_lat_min, c_lon_max, c_lat_max)

            # Caso 1: Célula completamente fora
            if prepared_geom.disjoint(cell_polygon):
                fractions[i, j] = 0.0
                continue

            # Caso 2: Célula completamente dentro
            if prepared_geom.contains(cell_polygon):
                fractions[i, j] = 1.0
                continue

            # Caso 3: Célula intersectada parcialmente (fronteira)
            intersection = cell_polygon.intersection(geom)
            if intersection.is_empty or intersection.area <= 1e-14:
                fractions[i, j] = 0.0
            else:
                inter_auth_area = compute_authalic_area(intersection)
                if c_area > 0 and inter_auth_area > 1e-14:
                    frac = inter_auth_area / c_area
                    if frac < 1e-5:
                        fractions[i, j] = 0.0
                    elif frac > 0.99999:
                        fractions[i, j] = 1.0
                    else:
                        fractions[i, j] = float(np.clip(frac, 0.0, 1.0))
                else:
                    fractions[i, j] = 0.0

    return fractions


def generate_spatial_mask(
    precipitation_matrix: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    geom: BaseGeometry,
    missing_value: float = -9999.9
) -> Dict[str, Any]:
    """
    Gera as máscaras e matrizes de ponderação espacial integradas:
    - Frações de cobertura física (f_i,j).
    - Máscara de validade instrumental (M_i,j) baseada nos metadados NASA GPM IMERG V07B.
    - Pesos efetivos ponderados: W_i,j = cos(lat_i) * f_i,j * M_i,j.
    
    Retorna:
        Dict com matrizes e estatísticas completas de cobertura e disponibilidade.
    """
    if precipitation_matrix.shape != (len(lats), len(lons)):
        raise ValueError(
            f"Dimensão da matriz de precipitação {precipitation_matrix.shape} não corresponde a (len(lats), len(lons)) = ({len(lats)}, {len(lons)})"
        )

    fractions = compute_cell_coverage_fractions(lats, lons, geom)
    intersected_mask = fractions > 0.0

    # Máscara rigorosa de dados válidos da NASA GPM IMERG V07B:
    # 1. Não NaN e não infinito
    # 2. Diferente do sentinela/preenchimento (_FillValue = -9999.9 ou -9999.0)
    # 3. Taxa física estritamente não-negativa (P >= 0.0 mm/h)
    valid_data_mask = (
        (~np.isnan(precipitation_matrix))
        & (~np.isinf(precipitation_matrix))
        & (precipitation_matrix > -9000.0)
        & (np.abs(precipitation_matrix - missing_value) > 1e-3)
        & (precipitation_matrix >= 0.0)
    )

    # Ponderação por cosseno da latitude
    cos_lats = np.cos(np.radians(lats))
    cos_weights_2d = np.repeat(cos_lats[:, np.newaxis], len(lons), axis=1)

    # Peso final por célula considerando fração de interseção e validade
    effective_weights = cos_weights_2d * fractions * valid_data_mask

    # Células intersectadas com dados válidos vs ausentes
    intersected_count = int(np.sum(intersected_mask))
    valid_intersected_count = int(np.sum(intersected_mask & valid_data_mask))
    missing_intersected_count = int(intersected_count - valid_intersected_count)

    valid_ratio = float(valid_intersected_count / intersected_count) if intersected_count > 0 else 0.0

    return {
        "coverage_fractions": fractions,
        "is_intersected": intersected_mask,
        "is_fully_covered": fractions >= 0.9999,
        "valid_data_mask": valid_data_mask,
        "effective_weights": effective_weights,
        "total_grid_cells": int(precipitation_matrix.size),
        "intersected_cells_count": intersected_count,
        "valid_intersected_count": valid_intersected_count,
        "missing_intersected_count": missing_intersected_count,
        "valid_ratio": valid_ratio,
        "effective_area_sum": float(np.sum(effective_weights))
    }


def calculate_spatial_indicators_with_geometry(
    precipitation_matrix: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    geom: BaseGeometry,
    threshold_rate_mm_h: float = 0.1,
    missing_value: float = -9999.9,
    min_valid_ratio: float = 0.10
) -> Dict[str, Any]:
    """
    Calcula os indicadores científicos espaciais oficiais a partir de qualquer geometria:
    1. Taxa média ponderada pela área real da célula e fração de interseção.
    2. Fração de área com chuva positiva (>= threshold_rate_mm_h) ponderada.
    3. Pico máximo pontual dentro da geometria e coordenadas geográficas da célula.
    """
    mask_info = generate_spatial_mask(precipitation_matrix, lats, lons, geom, missing_value)

    eff_weights = mask_info["effective_weights"]
    sum_weights = mask_info["effective_area_sum"]
    valid_ratio = mask_info["valid_ratio"]

    if sum_weights <= 0.0 or valid_ratio < min_valid_ratio:
        return {
            "mean_precipitation_rate": None,
            "rain_area_fraction": None,
            "max_precipitation_rate": None,
            "max_coordinates": None,
            "availability_status": "missing",
            "mask_info": mask_info
        }

    # 1. Taxa média espacial ponderada
    weighted_precip = np.sum(precipitation_matrix * eff_weights)
    mean_rate = float(weighted_precip / sum_weights)

    # 2. Fração de área com chuva (>= threshold)
    rain_mask = mask_info["valid_data_mask"] & (precipitation_matrix >= threshold_rate_mm_h)
    rain_weights = np.repeat(np.cos(np.radians(lats))[:, np.newaxis], len(lons), axis=1) * mask_info["coverage_fractions"] * rain_mask
    rain_area_fraction = float(np.sum(rain_weights) / sum_weights)

    # 3. Pico máximo pontual entre as células que intersectam a geometria
    intersected_valid = mask_info["is_intersected"] & mask_info["valid_data_mask"]
    if np.any(intersected_valid):
        masked_precip = np.where(intersected_valid, precipitation_matrix, -np.inf)
        max_idx_flat = np.argmax(masked_precip)
        max_row, max_col = np.unravel_index(max_idx_flat, precipitation_matrix.shape)
        max_rate = float(precipitation_matrix[max_row, max_col])
        max_coords = {"lat": float(lats[max_row]), "lon": float(lons[max_col])}
    else:
        max_rate = None
        max_coords = None

    # Status de disponibilidade conforme contrato da plataforma
    if valid_ratio >= 0.80:
        avail_status = "available"
    elif valid_ratio >= 0.10:
        avail_status = "partial"
    else:
        avail_status = "missing"

    return {
        "mean_precipitation_rate": mean_rate,
        "rain_area_fraction": rain_area_fraction,
        "max_precipitation_rate": max_rate,
        "max_coordinates": max_coords,
        "availability_status": avail_status,
        "mask_info": mask_info
    }
