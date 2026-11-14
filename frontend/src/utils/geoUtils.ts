import { BoundingBox } from '../types/dataset';

/**
 * Converte BoundingBox em coordenadas de polígono Leaflet [[lat, lon], ...]
 */
export function bboxToLeafletPolygon(bbox: BoundingBox): [number, number][] {
  return [
    [bbox.min_latitude, bbox.min_longitude],
    [bbox.min_latitude, bbox.max_longitude],
    [bbox.max_latitude, bbox.max_longitude],
    [bbox.max_latitude, bbox.min_longitude],
    [bbox.min_latitude, bbox.min_longitude]
  ];
}

/**
 * Retorna o centro geométrico [lat, lon] de uma BoundingBox
 */
export function getBboxCenter(bbox: BoundingBox): [number, number] {
  return [
    (bbox.min_latitude + bbox.max_latitude) / 2,
    (bbox.min_longitude + bbox.max_longitude) / 2
  ];
}
