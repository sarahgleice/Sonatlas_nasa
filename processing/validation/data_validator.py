"""
Validador de integridade e conformidade de dados do SONATLAS.
Assegura cumprimento do contrato definido no data-dictionary.md e regras científicas:
- Proibição de imputação de zero para nulos.
- Coerência de unidades físicas (mm/h).
- Verificação de limites físicos plausíveis.
"""

from typing import Dict, Any, List, Tuple


class DataValidator:
    """
    Validador de regras de negócio e integridade científica dos datasets exportados.
    """

    REQUIRED_ROOT_KEYS = [
        "dataset_version",
        "region_id",
        "region_name",
        "country",
        "data_source",
        "product_name",
        "phenomenon",
        "observations"
    ]

    @classmethod
    def validate_dataset(cls, dataset: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Valida a estrutura completa de um dataset antes da exportação JSON.
        """
        errors: List[str] = []

        # 1. Chaves da raiz
        for key in cls.REQUIRED_ROOT_KEYS:
            if key not in dataset:
                errors.append(f"Chave obrigatória ausente na raiz do dataset: '{key}'")

        if "observations" not in dataset or not isinstance(dataset["observations"], list):
            errors.append("Dataset deve conter uma lista 'observations'")
            return False, errors

        # 2. Validar cada observação
        for idx, obs in enumerate(dataset["observations"]):
            obs_errors = cls.validate_observation(obs, idx)
            errors.extend(obs_errors)

        return (len(errors) == 0), errors

    @classmethod
    def validate_observation(cls, obs: Dict[str, Any], idx: int) -> List[str]:
        """
        Valida uma observação individual.
        """
        errors: List[str] = []
        prefix = f"Observação [{idx}] (ID: {obs.get('observation_id', 'desconhecido')}):"

        if "timestamp_utc" not in obs:
            errors.append(f"{prefix} 'timestamp_utc' ausente.")

        avail = obs.get("availability", {})
        status = avail.get("status")
        if status not in ["available", "partial", "missing"]:
            errors.append(f"{prefix} status de disponibilidade inválido: '{status}'")

        indicators = obs.get("scientific_indicators", {})
        mean_rate_obj = indicators.get("mean_precipitation_rate", {})
        mean_val = mean_rate_obj.get("value")
        unit = mean_rate_obj.get("unit")

        # Regra de unidades
        if unit != "mm/h":
            errors.append(f"{prefix} unidade de taxa de precipitação deve ser 'mm/h', obtido: '{unit}'")

        # Regra de dados ausentes: se status for 'missing', o valor deve ser None
        if status == "missing" and mean_val is not None:
            errors.append(f"{prefix} status é 'missing', logo 'mean_precipitation_rate' deve ser null, não {mean_val}")

        # Se houver valor numérico, verificar limites físicos
        if mean_val is not None:
            if mean_val < 0.0:
                errors.append(f"{prefix} taxa de precipitação não pode ser negativa: {mean_val}")
            if mean_val > 500.0:
                errors.append(f"{prefix} taxa de precipitação acima do limite físico plausível (>500 mm/h): {mean_val}")

        # Proporção de área
        area_obj = indicators.get("rain_area_fraction", {})
        area_val = area_obj.get("value")
        area_unit = area_obj.get("unit")
        if area_unit and area_unit not in ["fraction", "dimensionless", "percentage"]:
            errors.append(f"{prefix} unidade de fração de área deve ser 'fraction', obtido: '{area_unit}'")
        if area_val is not None:
            if not (0.0 <= area_val <= 1.0):
                errors.append(f"{prefix} fração de área chuvosa deve estar entre 0.0 e 1.0: {area_val}")

        return errors
