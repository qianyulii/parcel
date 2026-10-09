# Carrier fixtures

`*.doc.json` are **doc-shaped** responses, hand-written from the carriers' published
schemas (FedEx Track API v1, UPS Tracking.yaml) with fake data. They are not real
captures. When a live response is recorded, scrub it (names, street lines, signature,
reference numbers) and save it as `*.live.json`; tests run against both.
