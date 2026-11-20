import { describe, expect, it } from 'vitest';
import { mapMarkers, type MapPoint } from './mapMarkers';

const city = (name: string, lng: number, count: number, country = 'Россия'): MapPoint =>
  ({ id:name, city:name, country, lng, lat:50, count, users:[] });
const project = (p: [number,number]): [number,number] => p;

describe('подписи меток сообщества', () => {
  it('соседние пригороды не объединяют цепочкой два центра', () => {
    const cities = [city('Москва', 30, 10), city('Пригород', 34, 30), city('Санкт-Петербург', 38, 9)];
    const markers = mapMarkers(cities, project, 10, 1);
    expect(markers.map(m => m.labels)).toEqual([['Москва'], ['Санкт-Петербург']]);
    expect(markers.map(m => m.count)).toEqual([40, 9]);
    expect(mapMarkers([...cities].reverse(), project, 10, 1)).toEqual(markers);
    expect(mapMarkers(cities, project, 10, .5)[0]?.labels).toEqual(['Москва', 'Санкт-Петербург']);
  });

  it('подписывает группы и одиночные точки странами на общем плане', () => {
    const cities = [city('Минск', 25, 3, 'Беларусь'), city('Москва', 30, 12), city('Астана', 100, 1, 'Казахстан')];
    expect(mapMarkers(cities, project, 2, 1).map(m => m.labels)).toEqual([['Россия +1'], ['Казахстан']]);
    expect(mapMarkers(cities, project, 20, 1).every(m => m.labels[0] === m.points[0]!.city)).toBe(true);
  });
});
