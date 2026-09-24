// 날짜는 'YYYYMMDD' 문자열 하나로만 다룬다(데이터랩 BASE_DATE와 같은 모양). 계산은 UTC 자정 기준.
const RE = /^\d{8}$/;

function toUTC(ymd) {
  if (typeof ymd !== 'string' || !RE.test(ymd)) throw new TypeError(`날짜는 YYYYMMDD: ${ymd}`);
  return Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
}

function fromUTC(ms) {
  const t = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`;
}

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function weekdayOf(ymd) {
  return new Date(toUTC(ymd)).getUTCDay();
}

export function addDays(ymd, n) {
  return fromUTC(toUTC(ymd) + n * 86400000);
}

export function daysBetween(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / 86400000);
}

export function formatKo(ymd) {
  return `${+ymd.slice(4, 6)}월 ${+ymd.slice(6, 8)}일(${WEEKDAY_KO[weekdayOf(ymd)]})`;
}

// 이번 주말·다음 주말. 오늘이 토요일이면 오늘~내일, 일요일이면 오늘 하루.
export function weekendWindows(today) {
  const wd = weekdayOf(today);
  let thisFrom;
  let thisTo;
  if (wd === 0) {
    thisFrom = today;
    thisTo = today;
  } else {
    thisFrom = addDays(today, 6 - wd);
    thisTo = addDays(thisFrom, 1);
  }
  const nextFrom = wd === 0 ? addDays(today, 6) : addDays(thisFrom, 7);
  return [
    { name: '이번 주말', from: thisFrom, to: thisTo },
    { name: '다음 주말', from: nextFrom, to: addDays(nextFrom, 1) },
  ];
}
