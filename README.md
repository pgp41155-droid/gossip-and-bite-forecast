# Gossip & Bite — Tomorrow, sorted.

A responsive, browser-local replenishment planner for the student cafe at IIM Lucknow. Built for GitHub Pages; no backend, API key, remote AI service, analytics or paid dependency is required.

## Use the app

1. Import a WhatsApp `chat.txt`/`chat.md` export or a GnB JSON backup. The original supplied exports use US month/day/year timestamps. Imports replace the current browser workspace after confirmation.
2. Review the completed-service-day cutoff. The newest imported day is initially excluded from modelling because exports may be made before the day ends.
3. Review unclear names, missing units and late-night timing overlaps in **Data review**.
4. Choose a forecast date, select the items you actually need and adjust purchase increments or quantities.
5. Review the vendor draft, then copy or download it. The app does not place or send orders.
6. Back up your browser workspace regularly. Import that backup to restore it on another device.

The public repository intentionally contains **no cafe purchase history or private chat**. The cleaned private JSON is delivered separately. Do not upload that file to this repository.

## Forecasting and its limits

The app compares 14 statistical and small-sample machine-learning candidates using rolling historical validation. Selection uses only earlier errors. Methods include naive forecasts, moving averages/medians, exponential smoothing, weekday estimates, ridge autoregression, nearest-neighbour regression and a damped trend.

Vendor requests are **not actual customer consumption**. Default forecasts estimate recorded order quantity on observed order days. Missing chat entries are unknown, not zeros. Infrequently ordered products need a human decision about whether a purchase is due. The app does not claim or guarantee 90% demand accuracy.

The headline score is `100 × (1 − mean of eligible item/unit WAPE values)`. Eligibility requires at least 7 historical test observations in the last 28 days, a positive observed total and an observation within the preceding 7 days. Each prediction needs at least 10 earlier observations. Quantities in different units are never added to create an accuracy score. MAE, MASE, baseline performance and indicative interval coverage are also displayed.

The indicative 80% error range is based on prior absolute errors and is not a coverage guarantee. Backtests are observational and provisional: uncertain requests, missing days, stockouts, late-night boundaries and changing purchasing policies limit what can be inferred. A future prospective evaluation is still needed.

**Daily log** accepts actual consumption and explicit zeros. Stockout-flagged consumption stays in history but is excluded from fitting. In consumption mode, usable stock and incoming deliveries reduce the draft. In order-history mode, stock is not deducted twice. Footfall and buffer settings are explicit user scenarios, not learned event effects.

## Date handling and cleaning

- 11 p.m.–midnight nightly lists map to the next calendar day; midnight–6 a.m. lists map to that morning.
- Daytime urgent purchases map to their calendar day. Nearby multi-item nightly lists help resolve short messages in the same five-minute ordering batch.
- Ambiguous 11–11:30 p.m. messages are flagged. Check them in Data review.
- Grams convert to kilograms. Packets, cartons, trays, tubs and pieces remain separate; sizes remain variants.
- Markdown quoted replies are removed. Identical normalized messages within a five-minute time bucket are suppressed.
- The TXT and Markdown exports are alternative representations of the same conversation, not additive data sources.
- Ambiguous names and units remain in the review queue rather than being silently guessed.

## Local development

Requires Node.js 20+ (no dependencies to install):

```sh
npm test
npm start
```

Open the printed local URL. To use a different port: `node server.mjs 4174`.

## GitHub Pages

In repository **Settings → Pages**, select **Deploy from a branch**, **main**, **/(root)** and save. The `.nojekyll` file enables plain static hosting. All imports use relative paths, so the app works under a repository subpath.

## Privacy

Data is processed and saved in this browser's local storage. It does not sync between devices. The app is not an encrypted vault: people using the same browser profile can access its stored data. Browser clearing can remove the workspace. Download private backups after corrections. No private data should be committed to GitHub.

## Research

- [Forecasting: Principles and Practice, chapter 5](https://otexts.com/fpp3/toolbox.html): rolling-origin evaluation, baselines, forecast errors and uncertainty.
- [Forecasting: Principles and Practice, chapter 13](https://otexts.com/fpp3/practical.html): combinations, missing values and intermittent series. Croston-style daily forecasts require defensible zero observations; chat omissions do not provide those.
- [Hyndman, WAPE: Weighted Absolute Percentage Error, 2025](https://robjhyndman.com/hyndsight/wape.html): WAPE limitations and complementary scaled errors.
- [FreshRetailNet-50K, 2025](https://arxiv.org/abs/2505.16319): stockouts and censored retail demand.

See the app's **How it works** page for the full methodology. Tests cover service-day boundaries, spelling and units, quoted-reply removal, duplicates, look-ahead leakage, missing data, stockout treatment, schema validation and stock/pack arithmetic.
