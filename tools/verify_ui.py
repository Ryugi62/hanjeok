"""UI 물리 검증(AC-14): 390·1280 가로 스크롤 0, 콘솔 에러 0, /r/48220 진입 시 통영시, 날짜 탭 순위, 임베드.
사용: python3 tools/verify_ui.py [base_url] [out_dir]  — 캡처는 out_dir에 저장."""
import sys, json
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173'
out = sys.argv[2] if len(sys.argv) > 2 else 'tmp'
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (390, 1280):
        pg = b.new_page(viewport={'width': w, 'height': 900})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{base}/r/48220', wait_until='networkidle')
        pg.wait_for_selector('#lead-num:not(:empty)', timeout=10000)
        r = {
            'scrollW': pg.evaluate('document.documentElement.scrollWidth'),
            'q': pg.input_value('#q'),
            'lead': pg.inner_text('#lead-when') + ' | ' + pg.inner_text('#lead-num') + ' | ' + pg.inner_text('#lead-verdict'),
            'bars': pg.locator('#tide .col').count(),
            'alts': pg.locator('#alts li').count(),
            'spots': pg.locator('#spots li').count(),
            'cta': pg.inner_text('#cta-btn'),
        }
        pg.screenshot(path=f'{out}/region-{w}.png', full_page=True)
        pg.click('#tide .col:nth-child(5)')
        r['afterClick'] = pg.inner_text('#lead-when')
        pg.fill('#q', '강릉')
        pg.wait_for_selector('#suggest li[data-code]')
        r['suggest'] = pg.inner_text('#suggest li:first-child')
        pg.click('#tab-date')
        pg.wait_for_selector('#rank li')
        r['rankFirst'] = pg.inner_text('#rank li:first-child')
        r['rankCount'] = pg.locator('#rank li').count()
        r['scrollW_date'] = pg.evaluate('document.documentElement.scrollWidth')
        pg.screenshot(path=f'{out}/date-{w}.png', full_page=True)
        r['errors'] = errs
        res[w] = r
        pg.close()
    pg = b.new_page(viewport={'width': 400, 'height': 220})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(f'{base}/embed.html?sgg=48220', wait_until='networkidle')
    pg.wait_for_selector('.strip')
    res['embed'] = {'text': pg.inner_text('#w')[:200], 'boxes': pg.locator('.bx').count(), 'errors': errs}
    pg.screenshot(path=f'{out}/embed.png')
    b.close()
print(json.dumps(res, ensure_ascii=False, indent=1))
ok = all(res[w]['scrollW'] <= w and res[w]['scrollW_date'] <= w and not res[w]['errors'] and '통영' in res[w]['q'] for w in (390, 1280)) and not res['embed']['errors'] and res['embed']['boxes'] >= 5
print('UI_OK' if ok else 'UI_FAIL')
sys.exit(0 if ok else 1)
