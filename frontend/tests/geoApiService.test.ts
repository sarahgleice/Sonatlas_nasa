import { describe, expect, it, vi } from 'vitest';
import { createGeoApiService } from '../src/services/geoApiService';

const feature = {
  type: 'Feature',
  properties: { region_id: 'amazon_central' },
  geometry: { type: 'Polygon', coordinates: [[[-61, -4], [-60, -4], [-60, -3], [-61, -4]]] },
};

describe('geoApiService', () => {
  it('reports unavailable and sends no request when the base URL is absent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const geoApiService = createGeoApiService(undefined);

    await expect(geoApiService.getHealth()).resolves.toEqual({ available: false });
    await expect(geoApiService.getRegions()).resolves.toEqual({ available: false });
    await expect(geoApiService.getRegion('amazon_central')).resolves.toEqual({ available: false });
    await expect(geoApiService.locate(-3, -60)).resolves.toEqual({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes the configured base and validates health, regions and feature responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ status: 'ok', regioes_carregadas: 2 }))
      .mockResolvedValueOnce(Response.json([{
        region_id: 'amazon_central', region_name: 'Amazônia Central', country: 'Brasil', status: 'preliminary_verified',
        is_placeholder: false, has_geometry: true,
        bbox: { south: -4, west: -61, north: -1, east: -58 }, center: { lat: -3, lon: -60 },
      }]))
      .mockResolvedValueOnce(Response.json(feature));
    vi.stubGlobal('fetch', fetchMock);
    const geoApiService = createGeoApiService('https://example.test/geo///');

    expect((await geoApiService.getHealth()).available).toBe(true);
    expect((await geoApiService.getRegions()).available).toBe(true);
    expect((await geoApiService.getRegion('amazon_central')).available).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://example.test/geo/health', 'https://example.test/geo/regions', 'https://example.test/geo/regions/amazon_central',
    ]);
  });

  it('rejects malformed HTTP JSON payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok', regioes_carregadas: '2' })));
    const geoApiService = createGeoApiService('https://example.test');
    await expect(geoApiService.getHealth()).rejects.toThrow(/payload incompatível/);
  });

  it('reports HTTP errors, including a region that the API does not know', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const geoApiService = createGeoApiService('https://example.test');
    await expect(geoApiService.getRegion('unknown')).rejects.toThrow('HTTP 404');
  });

  it('rejects malformed GeoJSON features', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...feature, geometry: { type: 'Polygon', coordinates: 'bad' } })));
    const geoApiService = createGeoApiService('https://example.test');
    await expect(geoApiService.getRegion('amazon_central')).rejects.toThrow(/payload incompatível/);
  });

  it('validates locate responses and posts the requested coordinates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      lat: -3, lon: -60, regioes: ['amazon_central'], dentro_de_alguma: true,
    }));
    vi.stubGlobal('fetch', fetchMock);
    const geoApiService = createGeoApiService('https://example.test');

    await expect(geoApiService.locate(-3, -60)).resolves.toMatchObject({ available: true });
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/locate', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ lat: -3, lon: -60 }),
    }));

    fetchMock.mockResolvedValueOnce(Response.json({ lat: -3, lon: -60, regioes: [], dentro_de_alguma: true }));
    await expect(geoApiService.locate(-3, -60)).rejects.toThrow(/payload incompatível/);
  });
});
