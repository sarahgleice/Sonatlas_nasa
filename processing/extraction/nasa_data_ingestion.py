"""
Módulo de Ingestão e Resolução Temporal Automatizada de Dados NASA GPM IMERG.

Responsável por:
1. Resolução de intervalos temporais arbitrários em cadência orbital de 30 minutos.
2. Construção padronizada de nomes de grânulos e URLs oficiais da NASA GES DISC.
3. Gerenciamento seguro de credenciais Earthdata (ambiente ou _netrc/.netrc).
4. Validação científica da estrutura HDF5, dimensões, atributos (_FillValue, units) e integridade de dados.
5. Download automático sob demanda com retentativas, streaming, recuperação e prevenção de duplicatas.
"""

import os
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import h5py
import numpy as np
import requests


# ==============================================================================
# HIERARQUIA DE EXCEÇÕES CIENTÍFICAS E OPERACIONAIS
# ==============================================================================

class NASADataIngestionError(Exception):
    """Exceção base para falhas de ingestão ou validação de dados NASA."""
    pass


class NASAAuthenticationError(NASADataIngestionError, PermissionError):
    """Falha de autenticação ou autorização na NASA Earthdata (HTTP 401 ou 403)."""
    pass


class NASAGranuleNotFoundError(NASADataIngestionError, FileNotFoundError):
    """Grânulo solicitado não existe no catálogo da NASA GES DISC (HTTP 404)."""
    pass


class NASAConnectionError(NASADataIngestionError):
    """Falha de conexão, DNS ou timeout ao se comunicar com os servidores da NASA."""
    pass


class NASAServerError(NASADataIngestionError):
    """Instabilidade ou erro interno nos servidores da NASA GES DISC (HTTP 5xx)."""
    pass


class HDF5IntegrityError(NASADataIngestionError, ValueError):
    """Arquivo HDF5 corrompido, truncado ou cientificamente inconsistente."""
    pass


# ==============================================================================
# RESOLUÇÃO TEMPORAL E GRADE IMERG
# ==============================================================================

class IMERGTimeResolver:
    """
    Resolve intervalos temporais UTC arbitrários em grânulos de 30 minutos da missão NASA GPM IMERG.

    Regras de Alinhamento Temporal (Snap Rules):
    -------------------------------------------
    - Cada grânulo IMERG Early possui exatamente 30 minutos de observação (1800 segundos),
      iniciando em minutos redondos :00 ou :30 e encerrando em :29:59 ou :59:59.
    - Se a data/hora inicial de entrada (start_time) possuir minuto entre 00 e 29, ela é
      arredondada (snapped) para baixo para o minuto 00 daquela hora.
    - Se o minuto de start_time estiver entre 30 e 59, é arredondado para o minuto 30.
    - A iteração avança em passos de 30 minutos. O grânulo é incluído na série se o início
      do grânulo for menor ou igual à data/hora final solicitada (end_time).
    - Se start_time e end_time caírem dentro do mesmo grânulo (ex: 17:10 a 17:25), exatamente
      1 grânulo (17:00:00 a 17:29:59) é resolvido para cobrir o intervalo de observação.
    - Transições de dia (meia-noite) e de ano (31 de dezembro para 01 de janeiro) calculam
      automaticamente o dia do ano (Day of Year - DOY), minuto do dia (0 a 1410) e ano civil,
      incluindo anos bissextos (DOY 366).
    """

    MIN_CADENCE_MINUTES = 30
    DEFAULT_PRODUCT = "GPM_3IMERGHHE"
    DEFAULT_VERSION = "07B"
    BASE_GESDISC_URL = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3"

    @classmethod
    def parse_datetime(cls, dt_input: Union[str, datetime]) -> datetime:
        """
        Converte string ISO 8601 ou objeto datetime para datetime UTC padronizado (naive UTC).
        """
        if isinstance(dt_input, datetime):
            if dt_input.tzinfo is not None:
                return dt_input.astimezone(timezone.utc).replace(tzinfo=None)
            return dt_input

        clean_str = dt_input.strip()
        clean_str = clean_str.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(clean_str)
            if dt.tzinfo is not None:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except ValueError:
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y%m%d"]:
                try:
                    return datetime.strptime(clean_str, fmt)
                except ValueError:
                    pass
            raise ValueError(
                f"Formato de data/hora não reconhecido: '{dt_input}'. "
                f"Utilize a formatação ISO 8601 (ex: '2024-01-01T17:00:00Z')."
            )

    @classmethod
    def snap_to_granule_start(cls, dt: datetime) -> datetime:
        """
        Arredonda um datetime para o início do grânulo de 30 minutos imediatamente anterior/igual (minutos 00 ou 30).
        """
        minute = 30 if dt.minute >= 30 else 0
        return dt.replace(minute=minute, second=0, microsecond=0)

    @classmethod
    def resolve_granule_metadata(
        cls,
        granule_dt: datetime,
        product: str = DEFAULT_PRODUCT,
        version: str = DEFAULT_VERSION
    ) -> Dict[str, Any]:
        """
        Gera o nome de arquivo oficial e a URL de acesso da NASA GES DISC para um início de grânulo.
        Ex: 2024-01-01 17:00:00 -> 3B-HHR-E.MS.MRG.3IMERG.20240101-S170000-E172959.1020.V07B.HDF5
        """
        date_str = granule_dt.strftime("%Y%m%d")
        year = granule_dt.strftime("%Y")
        doy = f"{granule_dt.timetuple().tm_yday:03d}"
        minute_of_day = granule_dt.hour * 60 + granule_dt.minute

        start_tag = granule_dt.strftime("%H%M%S")
        end_dt = granule_dt + timedelta(minutes=29, seconds=59)
        end_tag = end_dt.strftime("%H%M%S")

        version_clean = version.lstrip("Vv")
        version_tag = f"V{version_clean}"
        version_num = version_clean[:2]

        filename = f"3B-HHR-E.MS.MRG.3IMERG.{date_str}-S{start_tag}-E{end_tag}.{minute_of_day:04d}.{version_tag}.HDF5"
        download_url = f"{cls.BASE_GESDISC_URL}/{product}.{version_num}/{year}/{doy}/{filename}"

        return {
            "filename": filename,
            "download_url": download_url,
            "timestamp_start_utc": granule_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "timestamp_end_utc": end_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "date": granule_dt.strftime("%Y-%m-%d"),
            "year": year,
            "day_of_year": int(doy),
            "minute_of_day": minute_of_day,
            "product": product,
            "version": version_tag
        }

    @classmethod
    def resolve_interval(
        cls,
        start_time: Union[str, datetime],
        end_time: Union[str, datetime],
        product: str = DEFAULT_PRODUCT,
        version: str = DEFAULT_VERSION
    ) -> List[Dict[str, Any]]:
        """
        Gera a sequência temporal completa de grânulos esperados entre start_time e end_time.
        """
        dt_start = cls.parse_datetime(start_time)
        dt_end = cls.parse_datetime(end_time)

        if dt_start > dt_end:
            raise ValueError(f"Intervalo temporal inválido: data de início ({dt_start}) posterior ao término ({dt_end}).")

        now_utc = datetime.utcnow()
        if dt_start > now_utc:
            raise ValueError(f"Período solicitado ({dt_start}) está no futuro em relação ao tempo UTC atual ({now_utc}).")

        current_dt = cls.snap_to_granule_start(dt_start)
        granules: List[Dict[str, Any]] = []
        seen_filenames = set()

        while current_dt <= dt_end:
            meta = cls.resolve_granule_metadata(current_dt, product=product, version=version)
            if meta["filename"] not in seen_filenames:
                granules.append(meta)
                seen_filenames.add(meta["filename"])
            current_dt += timedelta(minutes=cls.MIN_CADENCE_MINUTES)

        return granules


# ==============================================================================
# VALIDAÇÃO CIENTÍFICA E ESTRUTURAL DE ARQUIVOS HDF5
# ==============================================================================

class HDF5IntegrityChecker:
    """
    Verifica a integridade física, estrutural e científica dos arquivos HDF5 do IMERG.

    Substitui o limiar fixo empírico de 5 MB por uma validação científica multicamadas:
    1. Existência física e tamanho de cabeçalho mínimo (>= 64 KB para descartar erros HTML/respostas vazias).
    2. Abertura do contêiner HDF5 (validação de assinatura binária e árvore de grupos).
    3. Existência do grupo '/Grid' e da variável 'precipitation' (ou 'precipitationCal').
    4. Conformidade dimensional (1, 3600, 1800) ou (3600, 1800), dtype float.
    5. Verificação de atributos científicos obrigatórios:
       - Unidades: 'mm/hr' ou 'mm/h' (aceitando str e bytes)
       - _FillValue ou CodeMissingValue compatível (~ -9999.9 ou -9999.0)
    6. Teste de descompressão ativa de fatia de dados (chunk slice probe), garantindo que
       o arquivo não sofreu truncamento no meio do fluxo binário compactado via deflate.
    7. Verificação de consistência entre nome do arquivo e metadados internos se fornecido.
    """

    MIN_HEADER_SIZE_BYTES = 64 * 1024  # 64 KB (páginas HTML de erro têm tipicamente < 30 KB)
    EXPECTED_SHAPES = [(1, 3600, 1800), (3600, 1800)]

    @classmethod
    def verify(
        cls,
        filepath: Union[str, Path],
        expected_filename: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Inspeciona profundamente o arquivo HDF5 e retorna (is_valid, erro_se_houver).
        """
        p = Path(filepath)
        if not p.exists():
            return False, f"Arquivo não encontrado: {p}"

        size = p.stat().st_size
        if size < cls.MIN_HEADER_SIZE_BYTES:
            return False, (
                f"Arquivo truncado ou incompleto: tamanho {size} bytes é inferior ao "
                f"cabeçalho mínimo ({cls.MIN_HEADER_SIZE_BYTES} bytes). Possível erro HTML ou stream vazio."
            )

        if expected_filename:
            # Desconsidera sufixo .part caso o arquivo ainda esteja em fase de download temporário
            actual_name = p.name[:-5] if p.name.endswith(".part") else p.name
            if actual_name.lower() != expected_filename.lower():
                return False, f"Inconsistência de nomenclatura: arquivo '{p.name}' não corresponde ao esperado '{expected_filename}'."

        try:
            with h5py.File(str(p), "r") as h5:
                # 1. Grupo /Grid
                if "Grid" not in h5:
                    return False, "Grupo obrigatório '/Grid' ausente no arquivo HDF5."
                grid = h5["Grid"]

                # 2. Variável de precipitação
                if "precipitation" not in grid and "precipitationCal" not in grid:
                    return False, "Variável de precipitação ausente em '/Grid' (esperado 'precipitation' ou 'precipitationCal')."

                precip = grid.get("precipitation", grid.get("precipitationCal"))

                # 3. Dimensões
                if precip.shape not in cls.EXPECTED_SHAPES:
                    return False, f"Dimensões inesperadas da matriz de precipitação: {precip.shape} (esperado 1x3600x1800 ou 3600x1800)."

                # 4. Tipo de dado (ponto flutuante)
                if precip.dtype.kind != "f":
                    return False, f"Tipo de dado inesperado da variável de precipitação: {precip.dtype} (esperado float)."

                # 5. Atributo de unidade científica (mm/hr)
                units_attr = precip.attrs.get("Units", precip.attrs.get("units", None))
                if units_attr is not None:
                    if isinstance(units_attr, (bytes, np.bytes_)):
                        units_str = units_attr.decode("utf-8", errors="ignore")
                    else:
                        units_str = str(units_attr)
                    if "mm/hr" not in units_str.lower() and "mm/h" not in units_str.lower():
                        return False, f"Unidade científica inválida: '{units_str}' (esperado 'mm/hr')."

                # 6. Atributo _FillValue
                fill_attr = precip.attrs.get("_FillValue", precip.attrs.get("CodeMissingValue", None))
                if fill_attr is not None:
                    try:
                        if isinstance(fill_attr, (bytes, np.bytes_)):
                            fill_val = float(fill_attr.decode("utf-8", errors="ignore"))
                        else:
                            fill_val = float(fill_attr)
                        if not (-10000.0 <= fill_val <= -9000.0):
                            return False, f"Valor _FillValue fora da faixa esperada: {fill_val} (esperado ~ -9999.9)."
                    except (ValueError, TypeError):
                        pass

                # 7. Prova ativa de descompressão (lê um slice real para garantir ausência de corrupção interna)
                try:
                    if len(precip.shape) == 3:
                        _ = precip[0, :5, :5]
                    else:
                        _ = precip[:5, :5]
                except Exception as slice_err:
                    return False, f"Falha na descompressão do bloco de dados HDF5 (arquivo truncado ou corrompido): {slice_err}"

            return True, None

        except Exception as e:
            return False, f"Falha ao decodificar estrutura HDF5: {e}"


# ==============================================================================
# DOWNLOADER DE GRÂNULOS NASA GES DISC
# ==============================================================================

class NASAGranuleDownloader:
    """
    Gerenciador de autenticação Earthdata e download de dados NASA GES DISC com cache,
    retentativas e classificação explícita de exceções científicas e de rede.
    """

    def __init__(
        self,
        raw_data_dir: Union[str, Path],
        username: Optional[str] = None,
        password: Optional[str] = None
    ):
        self.raw_data_dir = Path(raw_data_dir)
        self.raw_data_dir.mkdir(parents=True, exist_ok=True)
        self.username = username or os.getenv("EARTHDATA_USERNAME")
        self.password = password or os.getenv("EARTHDATA_PASSWORD")
        self._auth_resolved = False
        self._auth_credentials: Optional[Tuple[str, str]] = None

    def get_auth_credentials(self) -> Optional[Tuple[str, str]]:
        """
        Localiza credenciais com segurança (sem expor senhas em logs).
        Verifica: 1. Variáveis de ambiente, 2. Arquivo _netrc / .netrc.
        """
        if self._auth_resolved:
            return self._auth_credentials

        if self.username and self.password:
            self._auth_credentials = (self.username, self.password)
            self._auth_resolved = True
            return self._auth_credentials

        import netrc
        for netrc_candidate in [Path.home() / "_netrc", Path.home() / ".netrc"]:
            if netrc_candidate.exists():
                try:
                    secrets = netrc.netrc(str(netrc_candidate))
                    auth = secrets.authenticators("urs.earthdata.nasa.gov")
                    if auth:
                        self._auth_credentials = (auth[0], auth[2])
                        self._auth_resolved = True
                        return self._auth_credentials
                except Exception:
                    pass

        self._auth_resolved = True
        return None

    def is_authenticated(self) -> bool:
        """Indica se há credenciais válidas configuradas."""
        return self.get_auth_credentials() is not None

    def get_cached_file(self, filename: str) -> Optional[Path]:
        """
        Retorna o caminho do arquivo no cache se ele existir e for íntegro.
        """
        target = self.raw_data_dir / filename
        if target.exists():
            is_valid, _ = HDF5IntegrityChecker.verify(target, expected_filename=filename)
            if is_valid:
                return target
        return None

    def download_granule(
        self,
        granule_meta: Dict[str, Any],
        max_retries: int = 3,
        force_download: bool = False
    ) -> Path:
        """
        Baixa o grânulo se não estiver no cache ou se force_download=True.
        Garante atomicidade através de arquivo temporário .part e limpeza estrita em falha.
        """
        filename = granule_meta["filename"]
        url = granule_meta["download_url"]
        target_path = self.raw_data_dir / filename

        # 1. Checagem de cache prévio
        if not force_download:
            cached = self.get_cached_file(filename)
            if cached:
                return cached

        # 2. Checagem de autenticação
        auth = self.get_auth_credentials()
        if not auth:
            raise NASAAuthenticationError(
                f"Não é possível baixar '{filename}': credenciais NASA Earthdata não configuradas "
                f"(configure variáveis de ambiente EARTHDATA_USERNAME/EARTHDATA_PASSWORD ou arquivo ~/_netrc)."
            )

        # 3. Download com sessão e streaming
        session = requests.Session()
        session.auth = auth

        temp_part = self.raw_data_dir / f"{filename}.part"
        # Limpa .part residual de execuções abortadas anteriormente
        if temp_part.exists():
            try:
                temp_part.unlink()
            except OSError:
                pass

        for attempt in range(1, max_retries + 1):
            try:
                # Checagem prévia HEAD
                try:
                    head = session.head(url, allow_redirects=True, timeout=30)
                except (requests.ConnectionError, requests.Timeout) as conn_err:
                    if attempt == max_retries:
                        raise NASAConnectionError(f"Falha de conexão com os servidores NASA ao consultar '{url}': {conn_err}") from conn_err
                    time.sleep(1.0 * attempt)
                    continue

                if head.status_code == 404:
                    raise NASAGranuleNotFoundError(
                        f"Grânulo não encontrado na NASA GES DISC (HTTP 404): {url}. "
                        f"Verifique se o dado já foi disponibilizado na latência operacional da missão."
                    )
                elif head.status_code in (401, 403):
                    raise NASAAuthenticationError(
                        f"Acesso negado pela NASA Earthdata (HTTP {head.status_code}): "
                        f"verifique login, senha e autorização da aplicação GES DISC no perfil Earthdata."
                    )
                elif head.status_code >= 500:
                    if attempt == max_retries:
                        raise NASAServerError(f"Servidor NASA GES DISC instável (HTTP {head.status_code}) ao acessar {url}")
                    time.sleep(1.5 * attempt)
                    continue

                head.raise_for_status()

                # Download em streaming
                try:
                    with session.get(url, stream=True, allow_redirects=True, timeout=60) as resp:
                        if resp.status_code >= 500:
                            if attempt == max_retries:
                                raise NASAServerError(f"Servidor NASA retornou HTTP {resp.status_code} durante o download de {url}")
                            time.sleep(1.5 * attempt)
                            continue
                        resp.raise_for_status()

                        with open(temp_part, "wb") as f:
                            for chunk in resp.iter_content(chunk_size=256 * 1024):
                                if chunk:
                                    f.write(chunk)
                except (requests.ConnectionError, requests.Timeout) as stream_err:
                    if temp_part.exists():
                        temp_part.unlink()
                    if attempt == max_retries:
                        raise NASAConnectionError(f"Falha de streaming/conexão com a NASA em '{url}': {stream_err}") from stream_err
                    time.sleep(1.5 * attempt)
                    continue

                # Validação de integridade do arquivo temporário
                is_valid, error_msg = HDF5IntegrityChecker.verify(temp_part, expected_filename=filename)
                if not is_valid:
                    if temp_part.exists():
                        temp_part.unlink()
                    raise HDF5IntegrityError(f"Arquivo baixado falhou na validação de integridade HDF5: {error_msg}")

                # Renomeia atomicamente para o arquivo definitivo
                if target_path.exists():
                    target_path.unlink()
                temp_part.rename(target_path)
                return target_path

            except (NASAAuthenticationError, NASAGranuleNotFoundError):
                # Erros fatais não devem sofrer retentativa inútil
                if temp_part.exists():
                    temp_part.unlink()
                raise

            except Exception as err:
                if temp_part.exists():
                    try:
                        temp_part.unlink()
                    except OSError:
                        pass
                if attempt == max_retries:
                    if isinstance(err, (NASADataIngestionError, PermissionError, FileNotFoundError)):
                        raise
                    raise RuntimeError(f"Falha ao baixar grânulo '{filename}' após {max_retries} tentativas: {err}") from err
                time.sleep(1.0 * attempt)

        raise RuntimeError(f"Falha inesperada no download de '{filename}'.")

    def acquire_granules_for_interval(
        self,
        start_time: Union[str, datetime],
        end_time: Union[str, datetime],
        product: str = "GPM_3IMERGHHE",
        version: str = "07B",
        auto_download: bool = True
    ) -> Dict[str, Any]:
        """
        Orquestra a aquisição completa de grânulos para um intervalo:
        1. Resolve a lista de grânulos esperados.
        2. Verifica quais já estão no cache.
        3. Baixa os ausentes se auto_download=True e houver credenciais.
        4. Retorna relatório completo de arquivos disponíveis, faltantes e motivos de erro categorizados.
        """
        resolved_metas = IMERGTimeResolver.resolve_interval(
            start_time=start_time,
            end_time=end_time,
            product=product,
            version=version
        )

        available_files: List[Path] = []
        downloaded_files: List[Path] = []
        cached_files: List[Path] = []
        missing_granules: List[Dict[str, Any]] = []

        for meta in resolved_metas:
            fname = meta["filename"]
            cached = self.get_cached_file(fname)
            if cached:
                available_files.append(cached)
                cached_files.append(cached)
            else:
                if auto_download and self.is_authenticated():
                    try:
                        downloaded = self.download_granule(meta)
                        available_files.append(downloaded)
                        downloaded_files.append(downloaded)
                    except NASAAuthenticationError as auth_err:
                        meta["error_type"] = "authentication"
                        meta["download_error"] = str(auth_err)
                        missing_granules.append(meta)
                    except NASAGranuleNotFoundError as not_found_err:
                        meta["error_type"] = "not_found"
                        meta["download_error"] = str(not_found_err)
                        missing_granules.append(meta)
                    except NASAConnectionError as conn_err:
                        meta["error_type"] = "connection"
                        meta["download_error"] = str(conn_err)
                        missing_granules.append(meta)
                    except NASAServerError as srv_err:
                        meta["error_type"] = "server_error"
                        meta["download_error"] = str(srv_err)
                        missing_granules.append(meta)
                    except HDF5IntegrityError as integ_err:
                        meta["error_type"] = "integrity_error"
                        meta["download_error"] = str(integ_err)
                        missing_granules.append(meta)
                    except Exception as err:
                        meta["error_type"] = "unknown"
                        meta["download_error"] = str(err)
                        missing_granules.append(meta)
                else:
                    meta["error_type"] = "unattempted"
                    meta["download_error"] = "Não baixado: arquivo ausente no cache local e auto_download/credenciais desativados."
                    missing_granules.append(meta)

        return {
            "total_requested": len(resolved_metas),
            "total_available": len(available_files),
            "total_cached": len(cached_files),
            "total_downloaded": len(downloaded_files),
            "total_missing": len(missing_granules),
            "available_files": available_files,
            "cached_files": cached_files,
            "downloaded_files": downloaded_files,
            "missing_granules": missing_granules,
            "granules_metadata": resolved_metas,
            "is_complete": len(missing_granules) == 0
        }
