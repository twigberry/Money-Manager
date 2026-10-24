# Money Manager

A local-first, installable app for recording income and expenses and estimating safe spending limits. Data stays in this browser on this device. The app currently uses US dollars.

## Run it

Open `index.html` in a browser for basic use. For install prompts, offline caching, and a more app-like experience, serve this folder over HTTPS or on `localhost` (for example, run `python -m http.server 8000` here and visit `http://localhost:8000`).

On Windows, use the browser's install action to add it as a desktop app. On Android, install it from the browser menu. On iPhone, open the hosted site in Safari and use Share → Add to Home Screen. A hosted HTTPS address is required for installation across devices. Data is stored separately on each device. Use Export backup and Import backup to move or restore a JSON copy.

## Spending estimates

Set the opening balance before entering transactions, then record income and expenses with their dates. Expense entries use a common household bill list, with “Other” for a custom name. Older entries stay in reports and do not change the opening balance. The current balance includes entries dated from the opening balance date through today. The monthly safe budget is divided by the number of remaining calendar-week blocks, including the current week; the daily amount divides the current week’s share by the remaining days in that week, including today. Upcoming dated entries are included in the safety calculation. Results depend on the accuracy of entered data and are estimates, not guarantees.

The Daily, Weekly, and Monthly buttons below “Safe to spend” show the per-day amount for the current week, the allowance for each remaining week block, or the total safe amount remaining this month.

Monthly reports and entries are retained on the device for a rolling year. When the app opens and finds entries dated more than one calendar year ago, it asks whether to delete them. Choosing “Keep entries” leaves them in place and the app asks again on a later launch. Monthly summaries remain available for the past year. Export a backup before deletion if you want to retain a copy. You can export monthly summaries as a CSV file.
