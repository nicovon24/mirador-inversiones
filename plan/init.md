# Investment Analysis App — Video Summary and Requirements

Oct 6, 2026 · @Nico

The video shows Vantage, a web dashboard for tracking the market, creating watchlists, maintaining a manually entered portfolio, and setting price alerts. It is a demo with simulated U.S. stock quotes. Most of its structure is useful for this app; the main gaps are Argentine assets (CEDEARs, local stocks, bonds, MEP/CCL exchange rates), real market data, and plain-language explanations of each metric.

## What the app in the video does

Vantage is a personal tracker for an individual investor. It shows the market, saves watchlists, and calculates portfolio returns. It does not trade or connect to a broker. In the 30-second silent recording, everything is a demo: prices are simulated and data is stored in the browser.

| Screen | What it shows | Available actions |
| --- | --- | --- |
| Overview | Three index cards (S&P 500, Nasdaq, Dow Jones) with value, change, and a sparkline. A chart for the selected asset with open, high, low, previous close, and volume. A watchlist panel, movers ranking, and three news items. | Select a watchlist asset to change the chart. Change range (1D, 1W, 1M, 3M, 6M, 1Y, ALL). Switch between line and candlestick views. Full screen. Chart menu with “create alert” and “export data.” Pause the live feed. |
| Markets | The same indexes and a 15-company table with exchange, price, change, volume, market cap, and trend. | Filter by sector (Technology, Consumer, Finance, Energy). Search companies. Sort by column. Create an alert from each row’s bell icon. |
| Watchlist | Watchlists in tabs with counts (My watchlist 10, Tech leaders 6) and the same table as Markets. | Create a list. Edit symbols. Remove a favorite with the star. Create an alert. |
| Portfolio | Total value, historical return in dollars and percent, and total invested. A chart for one holding. Holdings table with quantity, average cost, market value, return, and portfolio weight. | Add or remove a holding. Export holdings. |
| News & insights | One featured story and a grid of stories with category, source, and age. | Filter by category (Markets, Technology, Economy). Open a story. Use “Daily briefing.” |
| Price alerts | The screen does not open in the video; a count of 3 appears in the menu along with the creation form. | Choose an asset, condition (“price rises above”), and target price, prefilled at 2% above the current price. |

All screens share a sidebar with watchlist shortcuts, a global search (Ctrl K), notification bell, name and email profile, and a footer showing system status and the last update time.

## Functional requirements

There are 54 requirements: 31 for the first release (MVP), 18 for a second release, and 5 for later. Priorities are proposals and can be changed. The last column says whether a requirement comes from the video or is an addition for the Argentine market.

### A. Instruments and market data

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-01 | Instrument catalog by type: CEDEAR, local stock, sovereign bond, corporate bond, bill, and mutual fund. Each has a ticker, name, market, and currency. | MVP | No (U.S. stocks only) |
| RF-02 | Quote per instrument: last price, daily change in amount and percent, open, high, low, previous close, and volume. | MVP | Yes |
| RF-03 | Historical prices by range: 1 day, 1 week, 1, 3, and 6 months, 1 year, and all time. | MVP | Yes |
| RF-04 | Periodic price updates, with the last update time visible and a pause button. | MVP | Yes |
| RF-05 | Home reference cards: Merval, MEP dollar, CCL dollar, and country risk. | MVP | Partial (uses S&P 500, Nasdaq, and Dow Jones) |
| RF-06 | Global search by ticker or name, with a keyboard shortcut. | MVP | Yes |
| RF-07 | Display currency selector: pesos, MEP dollar, or CCL dollar. | V2 | No (USD only) |

### B. Market explorer

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-08 | Instrument table with price, change, volume, and trend (sparkline), sortable by column. | MVP | Yes |
| RF-09 | Filter by asset type (CEDEARs, bonds, stocks), then by sector, issuer, or governing law. | MVP | Partial (sector only) |
| RF-10 | Search within the table. | MVP | Yes |
| RF-11 | Movers ranking: most traded, top gainers, and top losers. | V2 | Yes |
| RF-12 | Row actions: add to watchlist and create an alert. | MVP | Yes |

### C. Instrument detail and analysis

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-13 | Price chart with line and candlestick views, range selector, date-and-price tooltip, full-screen mode, and daily statistics below. | MVP | Yes |
| RF-50 | Basic technical indicators on the chart: moving averages and volume. | MVP | No |
| RF-51 | Advanced technical indicators (RSI, MACD, Bollinger Bands) and manually drawn trend lines. | V2 | No |
| RF-52 | Fundamental ratios for stocks and CEDEARs: P/E, earnings per share, dividend yield, price-to-book, ROE, and debt-to-equity. | MVP | No (market cap only) |
| RF-14 | Export chart data to CSV. | V2 | Yes |
| RF-15 | CEDEAR profile: underlying asset, conversion ratio, underlying price in USD, implied CCL, and spread versus the reference CCL. | MVP | No |
| RF-16 | Bond profile: yield to maturity, parity, duration, technical value, coupon, governing law, payment currency, maturity, and payment schedule. | MVP | No |
| RF-17 | Compare two or more instruments on one chart, with returns rebased to 100. | V2 | No |
| RF-18 | Bond yield curve: yield to maturity versus duration. | V2 | No |

### D. Watchlists

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-19 | Toggle a favorite with the star from any table or profile. | MVP | Yes |
| RF-20 | Multiple named lists: create, rename, and delete. | MVP | Yes |
| RF-21 | Each list uses the explorer table and shows its symbol count. | MVP | Yes |
| RF-22 | Watchlist shortcuts in the sidebar and a watchlist panel on Home; selecting an asset updates the chart. | MVP | Yes |
| RF-23 | Lists can mix asset types and show relevant columns, such as yield for bonds and ratio for CEDEARs. | V2 | No |

### E. Portfolio

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-24 | Manually add holdings: instrument, quantity, average purchase price, and date. | MVP | Yes (form not shown) |
| RF-25 | Portfolio summary: total value, total invested, and return in amount and percent. | MVP | Yes |
| RF-26 | Holdings table: quantity, average cost, market value, return, and portfolio weight; allow removing a holding. | MVP | Yes |
| RF-27 | Export holdings to CSV. | V2 | Yes |
| RF-28 | Portfolio allocation by asset type and currency. | V2 | No |
| RF-29 | Value the portfolio in pesos and in MEP or CCL dollars. | V2 | No |
| RF-30 | Import holdings from a broker instead of entering them manually. | Later | No (the video says no broker is connected) |
| RF-31 | Calendar of coupon and principal payments for bonds in the portfolio. | Later | No |

### F. Price alerts

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-32 | Create an alert from a row, chart menu, or alerts screen: instrument, condition (rises above or falls below), and target value prefilled near the current price. | MVP | Yes (only “rises above” is shown) |
| RF-33 | List active and triggered alerts, show a menu count, and allow editing and deletion. | MVP | Partial (count shown, screen not shown) |
| RF-34 | In-app notification when an alert triggers, including instrument, reached price, and time. | MVP | Partial (bell shown, no notification) |
| RF-36 | Email or push notification while the app is closed; requires server-side alert evaluation. | MVP | No (evaluation only while app is open) |
| RF-35 | Alerts for percentage change and, for bonds, yield or parity. | V2 | No |

### G. News

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-37 | News feed with a featured story, category, source, and age; filter by category. | V2 | Yes |
| RF-38 | News related to watchlist and portfolio instruments. | Later | No |
| RF-39 | Daily market briefing. | Later | Partial (“Daily briefing” button is shown) |

### H. Account and settings

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-40 | Profile with name and email. | MVP | Yes |
| RF-41 | Registration and sign-in, with watchlists, portfolio, and alerts stored on the server. | V2 | No (everything is stored in the browser) |
| RF-42 | Customize which Home panels are displayed and their order. | Later | Partial (“Customize” button is shown) |
| RF-43 | Preferences: default currency, light or dark theme, and update frequency. | V2 | No (Settings does not open) |

### I. Help for learning and decision-making

None of this appears in the video. These features turn the tracker into a tool for making informed decisions without expert knowledge.

| ID | Requirement | Priority | In video |
| --- | --- | --- | --- |
| RF-44 | Contextual help for each metric: an icon beside values (P/E, yield, parity, ratio, volume, change) explains what it is, how to read it, and why it matters in plain language. | MVP | No |
| RF-45 | Searchable glossary: CEDEAR, bond, corporate bond, P/E, yield, duration, MEP, CCL. | MVP | No |
| RF-46 | Plain-language “what it is” profile for each instrument: what it is, who issues it, payment currency, price drivers, and risks. | MVP | No |
| RF-53 | Learn section with step-by-step guides: analyzing a stock or CEDEAR, analyzing a bond, and reading a candlestick chart. | MVP | No |
| RF-54 | Guided instrument analysis that walks through the guide using that asset’s real data and highlights what to inspect at each step. | V2 | No |
| RF-47 | Put each indicator in context by comparing it with its history and similar instruments, and summarizing it in one sentence (“today’s volume is twice the monthly average”). | V2 | No |
| RF-48 | Daily summary of watchlists and portfolio: what moved, by how much, and related news. | V2 | No |
| RF-49 | Natural-language assistant for questions about an instrument or portfolio, with answers grounded in app data. | V2 | No |

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NRF-01 | Data transparency: every quote shows its source, timestamp, and whether it is delayed. |
| NRF-02 | Decoupled data sources: one adapter per provider, so providers can change without modifying the UI; cache data to respect API limits. |
| NRF-03 | Provider credentials stay on the backend and are never exposed in the browser. |
| NRF-04 | Monetary values use exact decimal arithmetic (not floating point) and always specify a currency. |
| NRF-05 | Every panel has loading, empty, and error states, including no data, closed market, and provider outage. |
| NRF-06 | Tables with hundreds of instruments sort and filter without reloading the page. |
| NRF-07 | Spanish UI with Argentine number formatting (1.234,56). |
| NRF-08 | Help explains and contextualizes metrics, showing its basis. The app does not execute trades; the decision remains with the user. |
| NRF-09 | Follow the video’s visual direction: fixed sidebar, summary cards, tables with sparklines, one large chart panel, one accent color, and original branding. |

## What the video does not show

Several requirements are inferred rather than observed because they appear only as a button or menu item: the Price alerts, Settings, and Customize screens; the “Add position,” “Manage watchlist,” “Edit symbols,” and “New list” forms; search results; the notification panel; and “Daily briefing.” The mobile version is also not shown.

## Open decisions

- [x] Personal use, as discussed: sign-in and server-side storage (RF-41) are out of scope for the MVP.
- [ ] Which data source? Real-time data was requested. Of the two options reviewed, IOL’s API provides it with an account. Cost and usage limits still need confirmation.
- [ ] Which asset types come first? CEDEARs, stocks, and sovereign bonds cover the initial request.
- [ ] Tracking only, or also importing the actual broker portfolio (RF-30)?
- [ ] Is mobile support required, or is desktop sufficient as in the video?
- [ ] Should news be included? It contributes the least to the analysis.

## Data sources to evaluate

Real market data is the biggest difference from the video. Two options were reviewed; their costs and usage limits still need confirmation.

| Source | What it offers | Conditions |
| --- | --- | --- |
| [InvertirOnline API](https://www.invertironline.com/api) | Real-time and historical Argentine market quotes (stocks, bonds, options, repos, futures, and currencies), plus portfolio and transactions. JSON responses and a test environment. | Requires an IOL account. Pricing is listed on its fees page. Confirm CEDEAR and mutual fund coverage in the [documentation](https://api.invertironline.com/). |
| [BYMA Market Data](https://www.byma.com.ar/productos/productos-de-datos) | Real-time data, data delayed by 20 minutes, historical, closing, and reference data for instruments. Available through API or FIX protocol. | Real-time data requires a BYMA Market Data contract (marketdata@byma.com.ar). |

MEP and CCL exchange rates do not need a separate source: they can be calculated from the prices of the same bond in pesos and dollars (for example, AL30 versus AL30D and AL30C).

Fundamental ratios (P/E, earnings per share, dividends) are a separate data need. It has not been confirmed that either source provides them, so a third source may be required.
