"""
Suíte de testes para ingestão, resolução temporal e download de dados NASA GPM IMERG.

Testa:
1. Resolução temporal de intervalos arbitrários em passos de 30 min.
2. Alinhamento de limites de data/hora (snap para 00 e 30 minutos).
3. Cruzamento de meia-noite / mudança de dia do ano (DOY).
4. Rejeição de intervalos futuros ou invertidos.
5. Formatação oficial de nomes e URLs NASA GES DISC.
6. Verificação de integridade HDF5 (arquivos válidos vs truncados/corrompidos).
7. Detecção e reutilização de arquivos em cache local (sem download repetido).
8. Execução do pipeline universal com start_time e end_time.
"""

from datetime import datetime, timedelta
from pathlib import Path
import pytest
import numpy as np
from shapely.geometry import box

from extraction.nasa_data_ingestion import (
    IMERGTimeResolver,
    HDF5IntegrityChecker,
    NASAGranuleDownloader
)
from pipeline.universal_pipeline import UniversalProcessingPipeline
from validation.data_validator import DataValidator

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DATA_DIR = REPO_ROOT / "processing" / "data" / "raw"
AMAZON_GEOJSON = REPO_ROOT / "processing" / "geometry" / "amazon" / "central_amazon_bbox.geojson"


def test_time_resolver_regular_interval():
    """Valida resolução de 6 passos de 30 minutos entre 17:00 e 19:30 UTC."""
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2024-01-01T17:00:00Z",
        end_time="2024-01-01T19:30:00Z",
        product="GPM_3IMERGHHE",
        version="07B"
    )

    assert len(granules) == 6

    expected_minutes = [1020, 1050, 1080, 1110, 1140, 1170]
    expected_starts = ["S170000", "S173000", "S180000", "S183000", "S190000", "S193000"]
    expected_ends = ["E172959", "E175959", "E182959", "E185959", "E192959", "E195959"]

    for idx, g in enumerate(granules):
        assert g["minute_of_day"] == expected_minutes[idx]
        assert f"-{expected_starts[idx]}-" in g["filename"]
        assert f"-{expected_ends[idx]}." in g["filename"]
        assert g["year"] == "2024"
        assert g["day_of_year"] == 1
        assert "gpm1.gesdisc.eosdis.nasa.gov" in g["download_url"]
        assert "/2024/001/" in g["download_url"]


def test_time_resolver_snap_rounding():
    """Valida snap rounding para inícios de grânulos quando a hora não cai exatamente em 00 ou 30 min."""
    dt_snap1 = IMERGTimeResolver.snap_to_granule_start(datetime(2024, 1, 1, 17, 14, 25))
    assert dt_snap1.minute == 0
    assert dt_snap1.second == 0

    dt_snap2 = IMERGTimeResolver.snap_to_granule_start(datetime(2024, 1, 1, 17, 45, 10))
    assert dt_snap2.minute == 30
    assert dt_snap2.second == 0


def test_time_resolver_midnight_crossing():
    """Valida intervalo que cruza a meia-noite (transição de dia 01/01 para 02/01)."""
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2024-01-01T23:00:00Z",
        end_time="2024-01-02T01:30:00Z"
    )

    # 23:00, 23:30 (dia 1) + 00:00, 00:30, 01:00, 01:30 (dia 2) = 6 grânulos
    assert len(granules) == 6

    # Primeiro grânulo no dia 001
    assert granules[0]["date"] == "2024-01-01"
    assert granules[0]["day_of_year"] == 1
    assert "/2024/001/" in granules[0]["download_url"]

    # Grânulos a partir das 00:00 no dia 002
    assert granules[2]["date"] == "2024-01-02"
    assert granules[2]["day_of_year"] == 2
    assert "/2024/002/" in granules[2]["download_url"]
    assert "-S000000-E002959.0000.V07B.HDF5" in granules[2]["filename"]


def test_time_resolver_future_period_rejection():
    """Rejeita consultas para períodos futuros."""
    future_time = datetime.utcnow() + timedelta(days=365)
    with pytest.raises(ValueError, match="no futuro"):
        IMERGTimeResolver.resolve_interval(
            start_time=future_time,
            end_time=future_time + timedelta(hours=2)
        )


def test_time_resolver_inverted_interval_rejection():
    """Rejeita quando data inicial for posterior à data final."""
    with pytest.raises(ValueError, match="posterior ao término"):
        IMERGTimeResolver.resolve_interval(
            start_time="2024-01-02T12:00:00Z",
            end_time="2024-01-01T12:00:00Z"
        )


def test_hdf5_integrity_checker_real_file():
    """Valida integridade de um arquivo real existente no cache."""
    real_files = sorted(list(RAW_DATA_DIR.glob("3B-HHR-E.*.V07B.HDF5")))
    if not real_files:
        pytest.skip("Nenhum grânulo HDF5 encontrado no cache.")

    is_valid, err = HDF5IntegrityChecker.verify(real_files[0])
    assert is_valid is True
    assert err is None


def test_hdf5_integrity_checker_truncated_file(tmp_path):
    """Detecta arquivo truncado ou corrompido com menos de 5 MB."""
    fake_truncated = tmp_path / "fake_truncated.HDF5"
    fake_truncated.write_bytes(b"DATA" * 1000)  # 4 KB

    is_valid, err = HDF5IntegrityChecker.verify(fake_truncated)
    assert is_valid is False
    assert "truncado ou incompleto" in err


def test_hdf5_integrity_checker_corrupted_structure(tmp_path):
    """Detecta arquivo de tamanho grande mas com cabeçalho HDF5 inválido."""
    fake_corrupt = tmp_path / "fake_corrupt.HDF5"
    # Cria arquivo com 5.1 MB de zeros (sem assinatura HDF5 válida)
    fake_corrupt.write_bytes(b"\x00" * (5_100_000))

    is_valid, err = HDF5IntegrityChecker.verify(fake_corrupt)
    assert is_valid is False
    assert "Falha ao decodificar estrutura HDF5" in err


def test_downloader_cache_identification():
    """Comprova que arquivos já presentes no cache são identificados e validados sem download."""
    downloader = NASAGranuleDownloader(raw_data_dir=RAW_DATA_DIR)

    report = downloader.acquire_granules_for_interval(
        start_time="2024-01-01T17:00:00Z",
        end_time="2024-01-01T19:30:00Z",
        auto_download=False
    )

    assert report["total_requested"] == 6
    assert report["total_cached"] == 6
    assert report["total_missing"] == 0
    assert report["is_complete"] is True
    assert len(report["available_files"]) == 6


def test_universal_pipeline_automatic_interval_execution():
    """
    Executa o pipeline universal completo fornecendo APENAS start_time e end_time,
    sem fornecer lista manual de arquivos.
    """
    pipeline = UniversalProcessingPipeline(raw_data_dir=RAW_DATA_DIR)

    dataset = pipeline.process(
        geojson_source=AMAZON_GEOJSON,
        region_id="amazon_auto_interval",
        start_time="2024-01-01T17:00:00Z",
        end_time="2024-01-01T19:30:00Z",
        region_name="Amazônia Central (Ingestão Automática)",
        country="Brasil"
    )

    is_valid, errors = DataValidator.validate_dataset(dataset)
    assert is_valid is True, f"Erros: {errors}"

    assert dataset["region_id"] == "amazon_auto_interval"
    assert len(dataset["observations"]) == 6
    assert dataset["processing_provenance"]["acquisition_mode"] == "interval_auto"
    assert dataset["processing_provenance"]["acquisition_report"]["total_requested"] == 6
    assert dataset["processing_provenance"]["acquisition_report"]["total_cached"] == 6

    # Verifica primeiro e último timestamp
    assert dataset["observations"][0]["timestamp_utc"] == "2024-01-01T17:00:00Z"
    assert dataset["observations"][5]["timestamp_utc"] == "2024-01-01T19:30:00Z"
