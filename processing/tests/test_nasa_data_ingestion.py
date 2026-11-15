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
from unittest.mock import MagicMock, patch
import pytest
import requests
import numpy as np
from shapely.geometry import box

from extraction.nasa_data_ingestion import (
    IMERGTimeResolver,
    HDF5IntegrityChecker,
    NASAGranuleDownloader,
    NASASecurityError,
    validate_nasa_url,
    validate_granule_filename,
    SafeNASASession
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
    real_files = sorted(list(RAW_DATA_DIR.glob("3B-HHR-E.*-S1[7-9]*.V07B.HDF5")))
    if len(real_files) < 6:
        pytest.skip(f"Esperado 6 grânulos reais no cache local, encontrados {len(real_files)}.")

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
    real_files = sorted(list(RAW_DATA_DIR.glob("3B-HHR-E.*-S1[7-9]*.V07B.HDF5")))
    if len(real_files) < 6:
        pytest.skip(f"Esperado 6 grânulos reais no cache local, encontrados {len(real_files)}.")

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


# ==============================================================================
# TESTES DE SEGURANÇA E HARDENING (FASE 4.2)
# ==============================================================================

def test_security_authorized_https_url():
    """1. URL HTTPS NASA autorizada deve passar na validação."""
    valid_urls = [
        "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGHHE.07/2024/001/3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5",
        "https://gpm2.gesdisc.eosdis.nasa.gov/data/GPM_L3/file.HDF5",
        "https://disc.gsfc.nasa.gov/data/file.HDF5",
        "https://urs.earthdata.nasa.gov/oauth/authorize?client_id=xyz",
        "https://data.gesdisc.earthdata.nasa.gov/archive/file.HDF5"
    ]
    for u in valid_urls:
        validate_nasa_url(u)  # Não deve levantar exceção


def test_security_http_url_rejected():
    """2. URL HTTP não criptografada deve ser estritamente rejeitada."""
    insecure_url = "http://gpm1.gesdisc.eosdis.nasa.gov/data/file.HDF5"
    with pytest.raises(NASASecurityError, match="Protocolo inseguro"):
        validate_nasa_url(insecure_url)


def test_security_external_host_rejected():
    """3. Host externo deve ser estritamente rejeitado."""
    external_urls = [
        "https://attacker.com/fake.HDF5",
        "https://evil-server.org/data",
        "https://192.168.1.100/data.HDF5"
    ]
    for u in external_urls:
        with pytest.raises(NASASecurityError, match="não autorizado"):
            validate_nasa_url(u)


def test_security_spoofed_nasa_host_rejected():
    """4. Host parecido com NASA mas não autorizado deve ser rejeitado."""
    spoofed_urls = [
        "https://evil-gesdisc.eosdis.nasa.gov/data",
        "https://gesdisc.eosdis.nasa.gov.evil.com/data",
        "https://earthdata.nasa.gov.attacker.com/data",
        "https://fake-earthdata.nasa.gov/oauth"
    ]
    for u in spoofed_urls:
        with pytest.raises(NASASecurityError, match="não autorizado"):
            validate_nasa_url(u)


def test_security_embedded_credentials_rejected():
    """5. URL com usuário e senha embutidos deve ser rejeitada."""
    embedded_creds = "https://user:secret@gpm1.gesdisc.eosdis.nasa.gov/data.HDF5"
    with pytest.raises(NASASecurityError, match="credenciais de autenticação embutidas"):
        validate_nasa_url(embedded_creds)


def test_security_unauthorized_redirect_blocked():
    """6. Redirecionamento HTTP para host não autorizado deve ser bloqueado."""
    session = SafeNASASession()
    fake_req = requests.Request("GET", "https://attacker.com/steal").prepare()
    fake_resp = requests.Response()
    fake_resp.status_code = 302
    fake_resp.headers["Location"] = "https://attacker.com/steal"

    with pytest.raises(NASASecurityError, match="não autorizado"):
        session.rebuild_auth(fake_req, fake_resp)


def test_security_legitimate_earthdata_redirect_allowed():
    """7. Redirecionamento legítimo necessário ao Earthdata deve funcionar."""
    session = SafeNASASession()
    fake_req = requests.Request("GET", "https://urs.earthdata.nasa.gov/oauth/authorize?app=gesdisc").prepare()
    fake_resp = requests.Response()
    fake_resp.status_code = 302
    fake_resp.headers["Location"] = "https://urs.earthdata.nasa.gov/oauth/authorize?app=gesdisc"

    # Não deve levantar NASASecurityError
    session.rebuild_auth(fake_req, fake_resp)


def test_security_path_traversal_blocked(tmp_path):
    """8. Tentativa de path traversal em filename deve ser bloqueada."""
    traversal_names = [
        "../../etc/passwd",
        "..\\..\\Windows\\System32\\calc.exe",
        "/absolute/path/3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5",
        "subfolder/3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5",
        "3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5\0nullbyte"
    ]
    for name in traversal_names:
        with pytest.raises(NASASecurityError, match="path traversal|byte NUL"):
            validate_granule_filename(name, tmp_path)


def test_security_valid_imerg_filename_accepted(tmp_path):
    """9. Nome de grânulo IMERG oficial válido deve ser aceito."""
    valid_name = "3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5"
    resolved = validate_granule_filename(valid_name, tmp_path)
    assert resolved == tmp_path / valid_name
    assert resolved.name == valid_name


def test_security_invalid_filename_format_rejected(tmp_path):
    """10. Extensão ou formato inválido deve ser rejeitado."""
    invalid_names = [
        "malicious_script.sh",
        "not_an_imerg_granule.HDF5",
        "3B-HHR-E.MS.MRG.3IMERG.invalid_format.txt"
    ]
    for name in invalid_names:
        with pytest.raises(NASASecurityError, match="não atende ao padrão oficial"):
            validate_granule_filename(name, tmp_path)


def test_security_atomic_replace_success(tmp_path):
    """11. Substituição do arquivo existente realizada corretamente e atomicamente."""
    from tests.test_nasa_ingestion_stress import create_synthetic_imerg_hdf5

    fname = "3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5"
    downloader = NASAGranuleDownloader(raw_data_dir=tmp_path, username="user", password="pwd")
    target_file = tmp_path / fname

    # Cria arquivo pré-existente
    create_synthetic_imerg_hdf5(target_file, fill_value=-9999.0)

    meta = {
        "filename": fname,
        "download_url": f"https://gpm1.gesdisc.eosdis.nasa.gov/data/{fname}"
    }

    # Mock de download gerando novo arquivo sintético íntegro no .part
    def mock_stream(*args, **kwargs):
        part_path = tmp_path / f"{fname}.part"
        create_synthetic_imerg_hdf5(part_path, fill_value=-9999.9)
        resp = MagicMock()
        resp.status_code = 200
        resp.iter_content = MagicMock(return_value=[b""])
        resp.__enter__ = MagicMock(return_value=resp)
        resp.__exit__ = MagicMock(return_value=None)
        return resp

    head_mock = MagicMock()
    head_mock.status_code = 200

    with patch.object(SafeNASASession, "head", return_value=head_mock), \
         patch.object(SafeNASASession, "get", side_effect=mock_stream):
        result_path = downloader.download_granule(meta, force_download=True)

    assert result_path.exists()
    assert not (tmp_path / f"{fname}.part").exists()
    is_valid, _ = HDF5IntegrityChecker.verify(result_path)
    assert is_valid is True


def test_security_download_failure_preserves_original(tmp_path):
    """12. Falha durante o download preserva integralmente o arquivo original e descarta .part."""
    from tests.test_nasa_ingestion_stress import create_synthetic_imerg_hdf5
    from extraction.nasa_data_ingestion import HDF5IntegrityError

    fname = "3B-HHR-E.MS.MRG.3IMERG.20240101-S000000-E002959.0000.V07B.HDF5"
    downloader = NASAGranuleDownloader(raw_data_dir=tmp_path, username="user", password="pwd")
    target_file = tmp_path / fname

    # Cria arquivo original saudável
    create_synthetic_imerg_hdf5(target_file, fill_value=-9999.0)
    original_size = target_file.stat().st_size

    meta = {
        "filename": fname,
        "download_url": f"https://gpm1.gesdisc.eosdis.nasa.gov/data/{fname}"
    }

    # Simula download que corrompe o arquivo temporário
    def mock_stream_corrupt(*args, **kwargs):
        part_path = tmp_path / f"{fname}.part"
        part_path.write_bytes(b"CORRUPTED_STREAM_DATA")
        resp = MagicMock()
        resp.status_code = 200
        resp.iter_content = MagicMock(return_value=[b""])
        resp.__enter__ = MagicMock(return_value=resp)
        resp.__exit__ = MagicMock(return_value=None)
        return resp

    head_mock = MagicMock()
    head_mock.status_code = 200

    with patch.object(SafeNASASession, "head", return_value=head_mock), \
         patch.object(SafeNASASession, "get", side_effect=mock_stream_corrupt):
        with pytest.raises(HDF5IntegrityError):
            downloader.download_granule(meta, force_download=True, max_retries=1)

    # O arquivo original DEVE permanecer intacto com o mesmo tamanho
    assert target_file.exists()
    assert target_file.stat().st_size == original_size
    # O arquivo temporário .part DEVE ter sido removido
    assert not (tmp_path / f"{fname}.part").exists()
