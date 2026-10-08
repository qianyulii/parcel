"""Headless WebGL screenshot + console capture for Parcel Globe visual QA.
Usage: python tools/qa/shot.py URL OUT.png [--wait MS] [--w 1280 --h 800] [--mobile]
Uses system Chromium (/usr/bin/chromium) with SwiftShader so WebGL renders without a GPU.
Exits 1 if the page logs a pageerror or console error (favicon 404 ignored)."""
import argparse, sys
from playwright.sync_api import sync_playwright
a = argparse.ArgumentParser(); a.add_argument('url'); a.add_argument('out')
a.add_argument('--wait', type=int, default=3000); a.add_argument('--w', type=int, default=1280); a.add_argument('--h', type=int, default=800)
a.add_argument('--mobile', action='store_true'); o = a.parse_args()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = p.devices['iPhone 13'] if o.mobile else {'viewport': {'width': o.w, 'height': o.h}}
    pg = b.new_page(**ctx); logs = []; bad = []
    pg.on('console', lambda m: (logs.append(f'{m.type}: {m.text}'), m.type == 'error' and 'favicon' not in m.text and '404' not in m.text and bad.append(m.text)))
    pg.on('pageerror', lambda e: (logs.append(f'pageerror: {e}'), bad.append(str(e))))
    pg.goto(o.url); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(o.wait)
    pg.screenshot(path=o.out); b.close()
print('\n'.join(logs) or 'no console output'); sys.exit(1 if bad else 0)
