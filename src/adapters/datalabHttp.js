// 한국관광 데이터랩 공개 화면이 쓰는 조회 엔드포인트 어댑터.
// 화면에 표시되는 값만 가져온다(예측 방문자 수 등 화면에서 숨긴 값은 요청하지 않는다).
export const DATALAB = 'https://datalab.visitkorea.or.kr';
const REFERER = `${DATALAB}/datalab/portal/loc/getAreaDataForm.do`;
const UA = 'Mozilla/5.0 (compatible; hanjeok/0.1; datalab concentration guide)';

export const QID = Object.freeze({
  CONCENTRATION_30D: 'LN_04_01_011', // 지역별 관광 현황 > 지역 집중률 > 향후 30일간 지역 집중률
  SIMILAR_REGIONS: 'LN_03_01_030', // AI 관광 분석 > 유사지역
  POPULAR_SPOTS: 'LN_03_01_038', // 인기관광지 현황(전체, 내비게이션 검색건수)
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createDatalabClient({ fetchImpl = globalThis.fetch, timeoutMs = 60000, retries = 1, gapMs = 300 } = {}) {
  async function query(form) {
    const body = new URLSearchParams(form).toString();
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(`${DATALAB}/visualize/getTempleteData.do`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: REFERER,
            Origin: DATALAB,
            'User-Agent': UA,
          },
          body,
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`datalab HTTP ${res.status}`);
        const json = await res.json();
        if (!json || !Array.isArray(json.list)) throw new Error('datalab 응답에 list가 없음');
        if (gapMs) await sleep(gapMs);
        return json.list;
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(t);
      }
    }
    throw lastErr;
  }

  const base = (code) => ({ SGG_CD: code, srchAreaDate: '1', sggIntgYnFlag: 'N' });

  return {
    query,
    async forecast(code) {
      const list = await query({ qid: QID.CONCENTRATION_30D, ...base(code), tabDiv: '9' });
      return list.map((x) => ({ date: String(x.BASE_DATE), index: Number(x.LRFRN_VISITR_ESTI_NUM) }));
    },
    async similar(code, ym) {
      const list = await query({ qid: QID.SIMILAR_REGIONS, ...base(code), tabDiv: '8', BASE_YM1: ym || '', BASE_YM2: ym || '' });
      return list.map((x) => ({ code: String(x.CMPR_SGG_CD_2), name: String(x.SGG_NM), similarity: Number(x.SIMIL_DGRE) }));
    },
    async top(code, ym) {
      const list = await query({ qid: QID.POPULAR_SPOTS, ...base(code), tabDiv: '3', BASE_YM1: ym, BASE_YM2: ym });
      return list.map((x) => ({ rank: Number(x.RK), name: String(x.ITS_BRO_NM), category: String(x.KTO_CATE_NAME_B || ''), searchCount: Number(x.SRCH_CNT) }));
    },
    async regions(sidoCodes) {
      const out = [];
      for (const [sidoCd, sidoNm] of sidoCodes) {
        const res = await fetchImpl(`${DATALAB}/portal/getSggCdMappingList.do`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Referer: REFERER, 'User-Agent': UA },
          body: new URLSearchParams({ sidoCd }).toString(),
        });
        if (!res.ok) throw new Error(`datalab 지역 목록 HTTP ${res.status}`);
        const json = await res.json();
        for (const it of json.list || []) out.push({ code: String(it.sggCd), name: String(it.sggNm), sido: sidoNm });
        if (gapMs) await sleep(gapMs);
      }
      return out;
    },
  };
}

export const SIDO = [
  ['11', '서울특별시'], ['26', '부산광역시'], ['27', '대구광역시'], ['28', '인천광역시'], ['29', '광주광역시'],
  ['30', '대전광역시'], ['31', '울산광역시'], ['36', '세종특별자치시'], ['41', '경기도'], ['51', '강원특별자치도'],
  ['43', '충청북도'], ['44', '충청남도'], ['52', '전북특별자치도'], ['46', '전라남도'], ['47', '경상북도'],
  ['48', '경상남도'], ['50', '제주특별자치도'],
  ['12', '전남광주통합특별시'], // 2026-07 통합 — 9/24 실측 목록은 있으나 집중률은 빈 값(데이터 전환 중)
];
