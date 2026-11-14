import { RegionDataset, RegionOption } from '../types/dataset';

export const AVAILABLE_REGIONS: RegionOption[] = [
  {
    id: 'amazon_central',
    name: 'Amazônia Central',
    country: 'Brasil',
    filePath: '/data/amazon/observations.json',
    status: 'active'
  },
  {
    id: 'international_candidate',
    name: 'Região Internacional (Bacia do Congo)',
    country: 'África Central (Em validação)',
    filePath: '/data/international_candidate_series.json',
    status: 'candidate'
  }
];

export class DataService {
  public static async loadRegionDataset(filePath: string): Promise<RegionDataset> {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Falha ao carregar dataset em '${filePath}': ${response.statusText}`);
    }
    const data: RegionDataset = await response.json();

    // Validação básica em runtime
    if (!data.region_id || !Array.isArray(data.observations)) {
      throw new Error(`Formato de dataset inválido em '${filePath}': chave 'observations' ausente.`);
    }

    return data;
  }
}
