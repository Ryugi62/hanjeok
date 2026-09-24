"""시군구 대표점(면적가중 중심) 계산 — 기상청 격자 조회용.
입력: vuski/admdongkor 행정동 GeoJSON(CC BY 4.0, 원자료 통계청 SGIS) 2개 버전(2025-04, 2026-07).
데이터랩 지역 코드는 2025-04 체계가 대부분이고 인천 신설구(2026-07)도 목록에 있어 두 버전을 합친다(2026-07 우선).
출력: data/centroids.json {code: {name, lat, lon}}
테스트 1개: 서울 종로구(11110) 중심이 위도 37.55~37.63, 경도 126.94~127.03 안.
사용: python3 tools/centroids.py <hjd_2025.geojson> <hjd_2026.geojson> data/centroids.json
"""
import json, sys

def ring_area_centroid(ring):
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        f = x0 * y1 - x1 * y0
        a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
    a *= 0.5
    if abs(a) < 1e-12:
        return 0.0, ring[0][0], ring[0][1]
    return a, cx / (6 * a), cy / (6 * a)

def feature_parts(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for poly in polys:
        outer = [tuple(p[:2]) for p in poly[0]]
        yield ring_area_centroid(outer)

def centroids(path):
    g = json.load(open(path))
    acc = {}
    for ft in g['features']:
        p = ft['properties']
        code = p.get('sgg') or p['adm_cd2'][:5]
        name = f"{p.get('sidonm','')} {p.get('sggnm','')}".strip()
        s = acc.setdefault(code, {'name': name, 'A': 0.0, 'X': 0.0, 'Y': 0.0})
        for a, x, y in feature_parts(ft['geometry']):
            a = abs(a); s['A'] += a; s['X'] += a * x; s['Y'] += a * y
    return {c: {'name': s['name'], 'lat': round(s['Y'] / s['A'], 5), 'lon': round(s['X'] / s['A'], 5)} for c, s in acc.items() if s['A'] > 0}

if __name__ == '__main__':
    old, new, out = sys.argv[1:4]
    res = centroids(old)
    res.update(centroids(new))
    jg = res['11110']
    assert 37.55 < jg['lat'] < 37.63 and 126.94 < jg['lon'] < 127.03, jg
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=0)
    print('centroids', len(res), '종로구', jg)
