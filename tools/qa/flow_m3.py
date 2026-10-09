"""M3 flow (fixture API): add parcels → passcode prompt → unlock → tracked → detail.
Run with the dev server started as: PG_FIXTURES=1 APP_PASSCODE=letmein pnpm dev
Usage: python3 tools/qa/flow_m3.py http://localhost:5173 /tmp/out"""
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
    pg.on('console', lambda m: m.type == 'error' and '401' not in m.text and errs.append(m.text))
    pg.goto(base + '/', wait_until='networkidle')
    pg.wait_for_timeout(2500)
    pg.click('[data-testid=add-button]')
    pg.fill('textarea', '770000003317, Desk lamp\n1Z999AA10123456784, Keyboard\n770000000000, Typo')
    pg.click('[data-testid=add-submit]')
    pg.wait_for_selector('[data-testid=passcode-dialog]', timeout=8000)
    pg.screenshot(path=f'{out}/passcode.png')
    pg.fill('[data-testid=passcode-input]', 'wrong'); pg.keyboard.press('Enter'); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{out}/passcode-wrong.png')
    pg.fill('[data-testid=passcode-input]', 'letmein'); pg.keyboard.press('Enter')
    pg.wait_for_selector('[data-testid=passcode-dialog]', state='detached', timeout=8000)
    pg.wait_for_timeout(3000)
    pg.screenshot(path=f'{out}/tracked.png')
    pg.click('text=Keyboard'); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{out}/detail-ups.png')
    pg.click('text=Typo'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{out}/detail-error.png')
    b.close()
print('errors:', errs)
sys.exit(1 if errs else 0)
