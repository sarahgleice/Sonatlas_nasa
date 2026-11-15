"""
Suíte de Testes de Estresse e Homologação Científica da Ingestão NASA GPM IMERG.

Cobre rigorosamente os requisitos da ETAPA 3.2:
1. Teste de aquisição completa: simulação de 6 grânulos em cache vazio, 100% reutilização em re-execução,
   e recuperação de download interrompido com descarte seguro de arquivos .part.
2. Validação científica profunda: estrutura HDF5, dimensões (1, 3600, 1800), unidades 'mm/hr',
   atributos _FillValue (-9999.9), leitura de fatia (probe slice) e consistência de nomenclatura.
3. Resolução temporal e casos de borda: snap rounding para limites fora de :00 e :30, transição de dia (meia-noite),
   transição de ano civil (DOY 365/366 para 001), ano bissexto, intervalo de 1 grânulo e rejeição de períodos futuros/inválidos.
4. Taxonomia de erros e resiliência: classificação explícita de falhas de autenticação (401/403),
   grânulo inexistente (404), indisponibilidade de servidor (5xx), timeouts/queda de rede e corrupção HDF5.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
import h5py
import numpy as np
import requests

from extraction.nasa_data_ingestion import (
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

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAW_DATA_DIR = REPO_ROOT / "processing" / "data" / "raw"


# ==============================================================================
# FIXTURES E UTILITÁRIOS CIENTÍFICOS
# ==============================================================================

def create_synthetic_imerg_hdf5(
    target_path: Path,
    shape: tuple = (1, 3600, 1800),
    dtype: str = "float32",
    var_name: str = "precipitation",
    units: str = "mm/hr",
    fill_value: float = -9999.9,
    corrupt_data_chunk: bool = False,
    min_size_kb: int = 80
) -> Path:
    """
    Cria um arquivo HDF5 sintético em conformidade estrita com o produto NASA GPM IMERG V07B.
    """
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with h5py.File(str(target_path), "w") as h5:
        grid = h5.create_group("Grid")
        ds = grid.create_dataset(
            var_name,
            shape=shape,
            dtype=dtype,
            fillvalue=fill_value,
            compression="gzip",
            compression_opts=1,
            chunks=(1, 100, 100) if len(shape) == 3 else (100, 100)
        )
        ds.attrs["Units"] = np.bytes_(units.encode("utf-8"))
        ds.attrs["units"] = np.bytes_(units.encode("utf-8"))
        ds.attrs["_FillValue"] = np.float32(fill_value)
        ds.attrs["DimensionNames"] = np.bytes_(b"time,lon,lat")

        # Escreve fatia de teste válida
        if len(shape) == 3:
            ds[0, :5, :5] = 1.25
        else:
            ds[:5, :5] = 1.25

        # Preenche com dados sintéticos adicionais para garantir tamanho físico > cabeçalho mínimo (64 KB)
        padding_elements = max(1000, (min_size_kb * 1024) // 4)
        h5.create_dataset("padding", data=np.zeros(padding_elements, dtype="float32"))

    if corrupt_data_chunk:
        # Corrompe intencionalmente os bytes centrais do arquivo para testar falha de descompressão
        file_bytes = bytearray(target_path.read_bytes())
        mid = len(file_bytes) // 2
        file_bytes[mid:mid + 1024] = b"\xFF" * 1024
        target_path.write_bytes(file_bytes)

    return target_path


# ==============================================================================
# 1. TESTES DE AQUISIÇÃO COMPLETA, CACHE E RECUPERAÇÃO DE FALHAS
# ==============================================================================

def test_stress_full_acquisition_simulation_empty_cache(tmp_path):
    """
    Simula aquisição de 6 grânulos IMERG com cache inicialmente vazio.
    Verifica se todos os 6 arquivos são resolvidos, baixados e armazenados com integridade comprovada.
    """
    cache_dir = tmp_path / "raw_cache"
    cache_dir.mkdir()

    downloader = NASAGranuleDownloader(
        raw_data_dir=cache_dir,
        username="test_user",
        password="test_password"
    )

    # Mock de download: gera arquivo HDF5 sintético válido quando a sessão do downloader faz streaming
    def mock_get(url, stream=True, allow_redirects=True, timeout=60):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()

        # Cria um arquivo temporário em memória e gera chunks
        temp_file = tmp_path / "temp_mock.HDF5"
        create_synthetic_imerg_hdf5(temp_file)
        content_bytes = temp_file.read_bytes()

        def iter_content(chunk_size=256 * 1024):
            for i in range(0, len(content_bytes), chunk_size):
                yield content_bytes[i:i + chunk_size]

        mock_resp.iter_content = iter_content
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    def mock_head(url, allow_redirects=True, timeout=30):
        mock_head_resp = MagicMock()
        mock_head_resp.status_code = 200
        mock_head_resp.headers = {"Content-Length": "100000"}
        mock_head_resp.raise_for_status = MagicMock()
        return mock_head_resp

    with patch("requests.Session.head", side_effect=mock_head), \
         patch("requests.Session.get", side_effect=mock_get):

        report = downloader.acquire_granules_for_interval(
            start_time="2024-01-01T17:00:00Z",
            end_time="2024-01-01T19:30:00Z",
            auto_download=True
        )

        assert report["total_requested"] == 6
        assert report["total_downloaded"] == 6
        assert report["total_cached"] == 0
        assert report["total_missing"] == 0
        assert report["is_complete"] is True
        assert len(report["available_files"]) == 6

        # Confirma que os 6 arquivos físicos existem no diretório
        for f in report["available_files"]:
            assert f.exists()
            is_valid, err = HDF5IntegrityChecker.verify(f)
            assert is_valid is True, f"Falha de integridade: {err}"


def test_stress_cache_reutilization_idempotency(tmp_path):
    """
    Executa o mesmo intervalo em cache já preenchido e comprova 100% de reuso (zero downloads).
    """
    cache_dir = tmp_path / "raw_cache"
    cache_dir.mkdir()

    # Pré-popula os 6 grânulos no cache
    metas = IMERGTimeResolver.resolve_interval("2024-01-01T17:00:00Z", "2024-01-01T19:30:00Z")
    for meta in metas:
        target_f = cache_dir / meta["filename"]
        create_synthetic_imerg_hdf5(target_f)

    downloader = NASAGranuleDownloader(
        raw_data_dir=cache_dir,
        username="test_user",
        password="test_password"
    )

    # Nenhuma chamada de rede deve ser disparada
    mock_session = MagicMock()
    with patch("requests.Session", return_value=mock_session):
        report = downloader.acquire_granules_for_interval(
            start_time="2024-01-01T17:00:00Z",
            end_time="2024-01-01T19:30:00Z",
            auto_download=True
        )

        assert report["total_requested"] == 6
        assert report["total_cached"] == 6
        assert report["total_downloaded"] == 0
        assert report["total_missing"] == 0
        assert report["is_complete"] is True
        assert len(report["cached_files"]) == 6
        mock_session.get.assert_not_called()
        mock_session.head.assert_not_called()


def test_stress_download_failure_and_part_cleanup(tmp_path):
    """
    Simula interrupção no terceiro grânulo, comprovando que arquivos .part são descartados
    e que uma nova execução recupera o processo baixando apenas os arquivos restantes.
    """
    cache_dir = tmp_path / "raw_cache"
    cache_dir.mkdir()

    downloader = NASAGranuleDownloader(
        raw_data_dir=cache_dir,
        username="test_user",
        password="test_password"
    )

    def mock_get_with_network_drop(url, stream=True, allow_redirects=True, timeout=60):
        # Simula queda geral de conexão a partir das 18:00 UTC (após baixar 17:00 e 17:30)
        if "180000" in url or "183000" in url or "190000" in url or "193000" in url:
            raise requests.ConnectionError("Conexão de rede interrompida com servidores da NASA.")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()

        temp_file = tmp_path / "temp_mock_drop.HDF5"
        create_synthetic_imerg_hdf5(temp_file)
        content_bytes = temp_file.read_bytes()

        def iter_content(chunk_size=256 * 1024):
            for i in range(0, len(content_bytes), chunk_size):
                yield content_bytes[i:i + chunk_size]

        mock_resp.iter_content = iter_content
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    def mock_head_ok(url, allow_redirects=True, timeout=30):
        if "180000" in url or "183000" in url or "190000" in url or "193000" in url:
            raise requests.ConnectionError("Conexão de rede interrompida com servidores da NASA.")
        mock_h = MagicMock()
        mock_h.status_code = 200
        mock_h.headers = {"Content-Length": "100000"}
        mock_h.raise_for_status = MagicMock()
        return mock_h

    # Primeira execução: queda de rede a partir das 18:00 UTC
    with patch("requests.Session.head", side_effect=mock_head_ok), \
         patch("requests.Session.get", side_effect=mock_get_with_network_drop), \
         patch("time.sleep", return_value=None):

        report1 = downloader.acquire_granules_for_interval(
            start_time="2024-01-01T17:00:00Z",
            end_time="2024-01-01T19:30:00Z",
            auto_download=True
        )

        assert report1["total_requested"] == 6
        assert report1["total_downloaded"] == 2
        assert report1["total_cached"] == 0
        assert report1["total_missing"] == 4
        assert report1["is_complete"] is False

        # Verifica que nenhum arquivo .part residual ficou órfão no diretório
        part_files = list(cache_dir.glob("*.part"))
        assert len(part_files) == 0, f"Arquivos .part não foram descartados: {part_files}"

    # Segunda execução (recuperação do processo após restabelecimento)
    def mock_get_recovered(url, stream=True, allow_redirects=True, timeout=60):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()

        temp_file = tmp_path / "temp_recovered.HDF5"
        create_synthetic_imerg_hdf5(temp_file)
        content_bytes = temp_file.read_bytes()

        def iter_content(chunk_size=256 * 1024):
            for i in range(0, len(content_bytes), chunk_size):
                yield content_bytes[i:i + chunk_size]

        mock_resp.iter_content = iter_content
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    def mock_head_recovered(url, allow_redirects=True, timeout=30):
        mock_h = MagicMock()
        mock_h.status_code = 200
        mock_h.headers = {"Content-Length": "100000"}
        mock_h.raise_for_status = MagicMock()
        return mock_h

    with patch("requests.Session.head", side_effect=mock_head_recovered), \
         patch("requests.Session.get", side_effect=mock_get_recovered):

        report2 = downloader.acquire_granules_for_interval(
            start_time="2024-01-01T17:00:00Z",
            end_time="2024-01-01T19:30:00Z",
            auto_download=True
        )

        # Na segunda execução: 2 já estavam em cache, os 4 restantes foram baixados
        assert report2["total_requested"] == 6
        assert report2["total_cached"] == 2
        assert report2["total_downloaded"] == 4
        assert report2["total_missing"] == 0
        assert report2["is_complete"] is True
        assert len(report2["available_files"]) == 6


# ==============================================================================
# 2. VALIDAÇÃO CIENTÍFICA E ESTRUTURAL DE ARQUIVOS HDF5
# ==============================================================================

def test_scientific_validation_valid_granule(tmp_path):
    """Arquivo sintético com estrutura canônica IMERG é aprovado."""
    valid_file = tmp_path / "valid.HDF5"
    create_synthetic_imerg_hdf5(valid_file)

    is_valid, err = HDF5IntegrityChecker.verify(valid_file)
    assert is_valid is True
    assert err is None


def test_scientific_validation_variant_shapes_and_names(tmp_path):
    """Aceita shape 2D (3600, 1800) e variante de nome precipitationCal."""
    variant_file = tmp_path / "variant.HDF5"
    create_synthetic_imerg_hdf5(
        variant_file,
        shape=(3600, 1800),
        var_name="precipitationCal"
    )

    is_valid, err = HDF5IntegrityChecker.verify(variant_file)
    assert is_valid is True
    assert err is None


def test_scientific_validation_rejection_of_invalid_shape(tmp_path):
    """Rejeita matriz de precipitação com dimensões não orbitais (ex: 100x100)."""
    bad_shape_file = tmp_path / "bad_shape.HDF5"
    create_synthetic_imerg_hdf5(bad_shape_file, shape=(1, 100, 100))

    is_valid, err = HDF5IntegrityChecker.verify(bad_shape_file)
    assert is_valid is False
    assert "Dimensões inesperadas" in err


def test_scientific_validation_rejection_of_missing_precipitation(tmp_path):
    """Rejeita contêiner HDF5 sem variável de precipitação em /Grid."""
    missing_var_file = tmp_path / "missing_precip.HDF5"
    with h5py.File(str(missing_var_file), "w") as h5:
        h5.create_group("Grid")
        h5.create_dataset("padding", data=np.zeros(20000, dtype="float32"))

    is_valid, err = HDF5IntegrityChecker.verify(missing_var_file)
    assert is_valid is False
    assert "Variável de precipitação ausente" in err


def test_scientific_validation_rejection_of_invalid_units(tmp_path):
    """Rejeita arquivos com unidade física não compatível com mm/hr."""
    bad_unit_file = tmp_path / "bad_unit.HDF5"
    create_synthetic_imerg_hdf5(bad_unit_file, units="m/s")

    is_valid, err = HDF5IntegrityChecker.verify(bad_unit_file)
    assert is_valid is False
    assert "Unidade científica inválida" in err


def test_scientific_validation_rejection_of_invalid_fill_value(tmp_path):
    """Rejeita atributos _FillValue fora da faixa científica esperada (-9999.9)."""
    bad_fill_file = tmp_path / "bad_fill.HDF5"
    create_synthetic_imerg_hdf5(bad_fill_file, fill_value=0.0)

    is_valid, err = HDF5IntegrityChecker.verify(bad_fill_file)
    assert is_valid is False
    assert "_FillValue fora da faixa" in err


def test_scientific_validation_probe_slice_chunk_corruption(tmp_path):
    """
    Detecta corrupção no fluxo binário compactado via deflate através da prova ativa
    de descompressão de fatia de dados (chunk slice probe).
    """
    test_file = tmp_path / "corrupt_probe.HDF5"
    create_synthetic_imerg_hdf5(test_file)

    # Simula erro de descompressão/leitura de chunk HDF5 (ex: zlib inflate failed)
    with patch("h5py.Dataset.__getitem__", side_effect=OSError("Can't read data (inflate() failed)")):
        is_valid, err = HDF5IntegrityChecker.verify(test_file)
        assert is_valid is False
        assert "Falha na descompressão do bloco de dados HDF5" in err


def test_scientific_validation_header_size_threshold(tmp_path):
    """
    Rejeita arquivos menores que 64 KB (como páginas de erro HTML retornadas com status 200).
    """
    tiny_file = tmp_path / "tiny_error.html"
    tiny_file.write_text("<html><body>404 Not Found Gateway</body></html>")

    is_valid, err = HDF5IntegrityChecker.verify(tiny_file)
    assert is_valid is False
    assert "inferior ao cabeçalho mínimo" in err


def test_scientific_validation_expected_filename_consistency(tmp_path):
    """Verifica correspondência entre o nome em disco e o metadado esperado."""
    f = tmp_path / "actual_name.HDF5"
    create_synthetic_imerg_hdf5(f)

    is_valid, err = HDF5IntegrityChecker.verify(f, expected_filename="different_name.HDF5")
    assert is_valid is False
    assert "Inconsistência de nomenclatura" in err


# ==============================================================================
# 3. RESOLUÇÃO TEMPORAL E CASOS DE BORDA
# ==============================================================================

def test_temporal_snap_rule_sub_half_hour_boundaries():
    """
    Comprova as regras de snap rounding:
    - Minutos 00 a 29 arredondam para minuto 00 da mesma hora.
    - Minutos 30 a 59 arredondam para minuto 30 da mesma hora.
    """
    dt1 = IMERGTimeResolver.snap_to_granule_start(datetime(2024, 1, 1, 17, 14, 32))
    assert dt1.hour == 17
    assert dt1.minute == 0
    assert dt1.second == 0

    dt2 = IMERGTimeResolver.snap_to_granule_start(datetime(2024, 1, 1, 17, 48, 10))
    assert dt2.hour == 17
    assert dt2.minute == 30
    assert dt2.second == 0


def test_temporal_single_granule_fractional_window():
    """
    Intervalo compreendido dentro de um único grânulo (ex: 17:10 a 17:25)
    resolve exatamente 1 grânulo (17:00 a 17:29:59).
    """
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2024-01-01T17:10:00Z",
        end_time="2024-01-01T17:25:00Z"
    )
    assert len(granules) == 1
    assert "-S170000-E172959.1020." in granules[0]["filename"]


def test_temporal_fractional_window_spanning_two_granules():
    """
    Intervalo 17:10 a 17:40 abrange dois períodos de observação (17:00 e 17:30).
    """
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2024-01-01T17:10:00Z",
        end_time="2024-01-01T17:40:00Z"
    )
    assert len(granules) == 2
    assert "-S170000-E172959.1020." in granules[0]["filename"]
    assert "-S173000-E175959.1050." in granules[1]["filename"]


def test_temporal_midnight_crossing_doy_increment():
    """
    Transição entre 23:15 e 01:45 cruza a meia-noite e incrementa DOY e minutos do dia.
    """
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2024-01-01T23:15:00Z",
        end_time="2024-01-02T01:45:00Z"
    )
    # Grânulos: 23:00, 23:30 (dia 1) + 00:00, 00:30, 01:00, 01:30 (dia 2) = 6
    assert len(granules) == 6

    # Dia 1
    assert granules[0]["day_of_year"] == 1
    assert granules[0]["minute_of_day"] == 1380
    assert granules[1]["day_of_year"] == 1
    assert granules[1]["minute_of_day"] == 1410

    # Dia 2 (reinício do minuto do dia e incremento de DOY)
    assert granules[2]["day_of_year"] == 2
    assert granules[2]["minute_of_day"] == 0
    assert "-S000000-E002959.0000." in granules[2]["filename"]
    assert "/2024/002/" in granules[2]["download_url"]

    assert granules[5]["day_of_year"] == 2
    assert granules[5]["minute_of_day"] == 90
    assert "-S013000-E015959.0090." in granules[5]["filename"]


def test_temporal_year_transition_rollover():
    """
    Transição de ano civil (2023-12-31 para 2024-01-01):
    - Ano 2023 com DOY 365
    - Ano 2024 com DOY 001
    - URLs da NASA apontam para os diretórios corretos de cada ano
    """
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2023-12-31T23:00:00Z",
        end_time="2024-01-01T01:00:00Z"
    )
    # 23:00, 23:30 (2023) + 00:00, 00:30, 01:00 (2024) = 5
    assert len(granules) == 5

    # 2023
    assert granules[0]["year"] == "2023"
    assert granules[0]["day_of_year"] == 365
    assert "/2023/365/" in granules[0]["download_url"]

    # 2024
    assert granules[2]["year"] == "2024"
    assert granules[2]["day_of_year"] == 1
    assert "/2024/001/" in granules[2]["download_url"]
    assert "20240101-S000000-" in granules[2]["filename"]


def test_temporal_leap_year_transition():
    """Ano bissexto 2024: 31 de dezembro possui DOY 366."""
    granule_dt = datetime(2024, 12, 31, 23, 30, 0)
    meta = IMERGTimeResolver.resolve_granule_metadata(granule_dt)

    assert meta["year"] == "2024"
    assert meta["day_of_year"] == 366
    assert "/2024/366/" in meta["download_url"]


def test_temporal_exact_single_timestamp_interval():
    """Intervalo onde início e fim são rigorosamente idênticos."""
    granules = IMERGTimeResolver.resolve_interval(
        start_time="2024-01-01T17:00:00Z",
        end_time="2024-01-01T17:00:00Z"
    )
    assert len(granules) == 1
    assert "-S170000-E172959.1020." in granules[0]["filename"]


def test_temporal_rejection_of_future_and_inverted_dates():
    """Rejeita períodos futuros ou início posterior ao término."""
    future_date = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=60)
    with pytest.raises(ValueError, match="no futuro"):
        IMERGTimeResolver.resolve_interval(future_date, future_date + timedelta(hours=1))

    with pytest.raises(ValueError, match="posterior ao término"):
        IMERGTimeResolver.resolve_interval("2024-01-02T12:00:00Z", "2024-01-01T12:00:00Z")


def test_temporal_invalid_date_format():
    """Rejeita datas com formatação inválida ou inexistentes no calendário."""
    with pytest.raises(ValueError, match="Formato de data/hora não reconhecido"):
        IMERGTimeResolver.parse_datetime("data_invalida_2024")


# ==============================================================================
# 4. TAXONOMIA DE ERROS E TRATAMENTO DE FALHAS
# ==============================================================================

def test_fault_authentication_error_missing_credentials(tmp_path):
    """Dispara NASAAuthenticationError quando não há credenciais configuradas."""
    downloader = NASAGranuleDownloader(
        raw_data_dir=tmp_path,
        username="",
        password=""
    )
    # Limpa credenciais cacheadas se houver
    downloader._auth_resolved = True
    downloader._auth_credentials = None

    meta = IMERGTimeResolver.resolve_granule_metadata(datetime(2024, 1, 1, 17, 0))
    with pytest.raises(NASAAuthenticationError, match="credenciais NASA Earthdata não configuradas"):
        downloader.download_granule(meta)


def test_fault_authentication_error_http_401_403(tmp_path):
    """Mapeia HTTP 401/403 da NASA Earthdata para NASAAuthenticationError."""
    downloader = NASAGranuleDownloader(
        raw_data_dir=tmp_path,
        username="user",
        password="bad_password"
    )

    mock_head = MagicMock()
    mock_head.status_code = 401

    with patch("requests.Session.head", return_value=mock_head):
        meta = IMERGTimeResolver.resolve_granule_metadata(datetime(2024, 1, 1, 17, 0))
        with pytest.raises(NASAAuthenticationError, match="Acesso negado pela NASA Earthdata"):
            downloader.download_granule(meta)


def test_fault_granule_not_found_http_404(tmp_path):
    """Mapeia HTTP 404 da NASA GES DISC para NASAGranuleNotFoundError."""
    downloader = NASAGranuleDownloader(
        raw_data_dir=tmp_path,
        username="user",
        password="password"
    )

    mock_head = MagicMock()
    mock_head.status_code = 404

    with patch("requests.Session.head", return_value=mock_head):
        meta = IMERGTimeResolver.resolve_granule_metadata(datetime(2024, 1, 1, 17, 0))
        with pytest.raises(NASAGranuleNotFoundError, match="Grânulo não encontrado na NASA GES DISC"):
            downloader.download_granule(meta)


def test_fault_server_error_http_5xx_retries(tmp_path):
    """Executa retentativas diante de HTTP 500/503 e dispara NASAServerError ao esgotar."""
    downloader = NASAGranuleDownloader(
        raw_data_dir=tmp_path,
        username="user",
        password="password"
    )

    mock_head = MagicMock()
    mock_head.status_code = 503

    with patch("requests.Session.head", return_value=mock_head), \
         patch("time.sleep", return_value=None):
        meta = IMERGTimeResolver.resolve_granule_metadata(datetime(2024, 1, 1, 17, 0))
        with pytest.raises(NASAServerError, match="Servidor NASA GES DISC instável"):
            downloader.download_granule(meta, max_retries=2)


def test_fault_connection_timeout_retries(tmp_path):
    """Executa retentativas diante de queda de rede ou timeout e dispara NASAConnectionError."""
    downloader = NASAGranuleDownloader(
        raw_data_dir=tmp_path,
        username="user",
        password="password"
    )

    with patch("requests.Session.head", side_effect=requests.Timeout("Timeout")), \
         patch("time.sleep", return_value=None):
        meta = IMERGTimeResolver.resolve_granule_metadata(datetime(2024, 1, 1, 17, 0))
        with pytest.raises(NASAConnectionError, match="Falha de conexão com os servidores NASA"):
            downloader.download_granule(meta, max_retries=2)


def test_fault_part_file_cleanup_on_unhandled_exception(tmp_path):
    """Garante que nenhum arquivo .part permanece em disco se ocorrer exceção não tratada."""
    downloader = NASAGranuleDownloader(
        raw_data_dir=tmp_path,
        username="user",
        password="password"
    )

    meta = IMERGTimeResolver.resolve_granule_metadata(datetime(2024, 1, 1, 17, 0))
    part_file = tmp_path / f"{meta['filename']}.part"

    def mock_get_explodes(*args, **kwargs):
        # Simula criação do .part antes de explodir
        part_file.write_bytes(b"dados parciais incompletos")
        raise RuntimeError("Falha inesperada no meio da escrita.")

    mock_head = MagicMock()
    mock_head.status_code = 200
    mock_head.headers = {"Content-Length": "100000"}
    mock_head.raise_for_status = MagicMock()

    with patch("requests.Session.head", return_value=mock_head), \
         patch("requests.Session.get", side_effect=mock_get_explodes), \
         patch("time.sleep", return_value=None):

        with pytest.raises(RuntimeError, match="Falha ao baixar grânulo"):
            downloader.download_granule(meta, max_retries=1)

        assert not part_file.exists(), "O arquivo temporário .part deveria ter sido removido!"
