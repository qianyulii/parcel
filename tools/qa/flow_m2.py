"""M2 visual flow: delivery firework frames + add dialog. Usage: python3 tools/qa/flow_m2.py http://localhost:5173 /tmp/out"""
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
    pg.goto(base + '/?burst=1', wait_until='networkidle')
    pg.wait_for_timeout(2600)
    for i, d in enumerate([150, 350, 600]):
        pg.wait_for_timeout(d if i == 0 else d - [150, 350, 600][i - 1])
        pg.screenshot(path=f'{out}/burst-{i}.png')
    pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{out}/after.png')
    pg.click('[data-testid=add-button]')
    pg.fill('textarea', '1Z 999 AA1 0000 0099 01, Desk lamp\n770000001234\n9400111899223344556677, Book\n12345')
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{out}/add.png')
    pg.click('button:has-text("PICK")') if False else None
    pg.click('[data-testid=add-submit]')
    pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{out}/added.png')
    b.close()
print('errors:', errs)
