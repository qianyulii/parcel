"""M4 flow (fixture API, no passcode): set home by ZIP → add the recorded FedEx
sandbox number → offline geocoding draws its route → detail.
Run with the dev server started as: PG_FIXTURES=1 pnpm dev
Usage: python3 tools/qa/flow_m4.py http://localhost:5173 /tmp/out"""
import sys, os
from playwright.sync_api import sync_playwright

base, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
    pg.goto(base + '/', wait_until='networkidle')
    pg.wait_for_timeout(2000)
    pg.click('[data-testid=home-button]')
    pg.fill('[data-testid=home-input]', '61820')
    pg.click('[data-testid=home-submit]')
    pg.wait_for_selector('[data-testid=home-found]', timeout=8000)
    print('home:', pg.inner_text('[data-testid=home-found]'))
    pg.screenshot(path=f'{out}/home.png')
    pg.click('[data-testid=home-submit]')
    pg.click('[data-testid=add-button]')
    pg.fill('textarea', '123456789012, FedEx sandbox')
    pg.click('[data-testid=add-submit]')
    pg.wait_for_timeout(9000)
    pg.screenshot(path=f'{out}/tracked.png')
    pg.click('text=FedEx sandbox'); pg.wait_for_timeout(5000)
    pg.screenshot(path=f'{out}/detail.png')
    b.close()
print('errors:', errs)
sys.exit(1 if errs else 0)
