export interface MapPoint {
  id: string; city: string; country: string; lat: number; lng: number; count: number;
  users: { id: string; publicId?: number; name: string; initials: string; color: string }[];
}
type Position = [number, number];
interface ProjectedCity { point: MapPoint; position: Position }
export interface MapMarker {
  id: string; position: Position; points: MapPoint[]; count: number; clustered: boolean;
  labels: string[]; labelOffset: Position;
}
const majorCities = new Set(['москва', 'санкт-петербург']);
const major = (point: MapPoint) => majorCities.has(point.city.trim().toLocaleLowerCase('ru'));

interface Box { left: number; top: number; right: number; bottom: number }
function positionLabels(markers: MapMarker[], screenScale: number) {
  // Reserve all circles first, then place labels in priority order using nearby boxes only.
  const occupied = new Map<string, Box[]>();
  function cells(box: Box) {
    const keys: string[] = [];
    for (let x = Math.floor(box.left/64); x <= Math.floor(box.right/64); x++)
      for (let y = Math.floor(box.top/64); y <= Math.floor(box.bottom/64); y++) keys.push(`${x}:${y}`);
    return keys;
  }
  function reserve(box: Box) {
    for (const key of cells(box)) {
      if (!occupied.has(key)) occupied.set(key, []);
      occupied.get(key)!.push(box);
    }
  }
  for (const {position, clustered} of markers) {
    const x = position[0]*screenScale, y = position[1]*screenScale, r = clustered ? 21 : 18;
    reserve({left:x-r, right:x+r, top:y-r, bottom:y+r});
  }
  for (const marker of markers) {
    const x = marker.position[0]*screenScale, y = marker.position[1]*screenScale;
    const half = Math.max(...marker.labels.map(label => label.length)) * 3.6 + 2;
    const extra = (marker.labels.length-1)*13;
    const offsets: Position[] = [[0,34], [0,-26-extra], [half+24,4-extra/2], [-half-24,4-extra/2],
      [half/2,34], [-half/2,34], [half/2,-26-extra], [-half/2,-26-extra]];
    let bestBox: Box | undefined, bestOverlap = Infinity;
    for (const offset of offsets) {
      const [dx,dy] = offset;
      const box = {left:x+dx-half, right:x+dx+half, top:y+dy-11, bottom:y+dy+extra+3};
      let overlap = 0;
      for (const other of new Set(cells(box).flatMap(key => occupied.get(key) ?? []))) {
        overlap += Math.max(0, Math.min(box.right,other.right)-Math.max(box.left,other.left))
          * Math.max(0, Math.min(box.bottom,other.bottom)-Math.max(box.top,other.top));
      }
      if (overlap < bestOverlap) { bestBox = box; bestOverlap = overlap; marker.labelOffset = offset; }
      if (overlap === 0) break;
    }
    reserve(bestBox!);
  }
}

export function mapMarkers(points: MapPoint[], project: (coordinates: Position) => Position | null, zoom: number, pixelsPerUnit: number): MapMarker[] {
  const cities: ProjectedCity[] = [];
  for (const point of points) {
    if (!point.city.trim() || !Number.isFinite(point.lat) || Math.abs(point.lat) > 90
      || !Number.isFinite(point.lng) || Math.abs(point.lng) > 180) continue;
    const position = project([point.lng, point.lat]);
    if (position?.every(Number.isFinite)) cities.push({point, position});
  }
  // A nearby suburb can join a centre, but cannot chain two distant centres together.
  const countryView = zoom < 4;
  cities.sort((a, b) => (countryView ? 0 : Number(major(b.point)) - Number(major(a.point)))
    || b.point.count - a.point.count || a.point.id.localeCompare(b.point.id));
  const radius = 54 / (zoom * pixelsPerUnit);
  const cells = new Map<string, MapMarker[]>();
  const markers: MapMarker[] = [];
  for (const {point, position} of cities) {
    const x = Math.floor(position[0] / radius), y = Math.floor(position[1] / radius);
    let nearest: MapMarker | undefined;
    let distance = radius;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const marker of cells.get(`${x+dx}:${y+dy}`) ?? []) {
        const d = Math.hypot(position[0]-marker.position[0], position[1]-marker.position[1]);
        if (d < distance) { nearest = marker; distance = d; }
      }
    }
    if (nearest) {
      nearest.points.push(point);
      nearest.count += point.count;
      nearest.clustered = true;
      if (!countryView && major(point) && !nearest.labels.includes(point.city)) nearest.labels.push(point.city);
    } else {
      const marker: MapMarker = {id:point.id, position, points:[point], count:point.count, clustered:false, labels:[point.city], labelOffset:[0,34]};
      markers.push(marker);
      const key = `${x}:${y}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(marker);
    }
  }
  for (const marker of markers) {
    if (marker.clustered) marker.id = 'cluster:' + marker.id;
    if (countryView) {
      const countries = new Map<string, number>();
      for (const point of marker.points) {
        const label = point.country.trim() || point.city;
        countries.set(label, (countries.get(label) ?? 0) + point.count);
      }
      const [first] = [...countries].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'ru'));
      marker.labels = [first![0] + (countries.size > 1 ? ` +${countries.size-1}` : '')];
    }
  }
  positionLabels(markers, zoom * pixelsPerUnit);
  return markers;
}
