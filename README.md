# Multi-Site Time Limiter (Tampermonkey UserScript)

`Multi-Site Time Limiter` is a userscript for the **Tampermonkey browser extension** that limits daily time spent on selected websites.

## What It Does

- Tracks time spent per configured site each day.
- Uses separate limits for weekdays vs weekends.
- Shows an on-page countdown timer while you browse.
- Can fully block sites after the daily limit is reached (for selected domains).
- Supports a temporary disable window using start/end dates.
- Resets usage at **4:00 AM Mountain Time**.

Current configured sites include:

- `youtube.com`
- `reddit.com`
- `amazon.com`
- `arstechnica.com`

## How It Works (High Level)

- Uses Tampermonkey storage (`GM_getValue` / `GM_setValue`) to persist daily usage data.
- Determines active site from hostname and applies that site's settings.
- Increments a timer while the tab is visible.
- Enforces either blocking or visual warning behavior once the limit is exceeded.

## Install / Use

1. Install the **Tampermonkey** extension in your browser.
2. Install from this repo for easier auto-updates:
   - Open the raw `SiteTimeLimiter.user.js` file URL from this repository in your browser ([https://github.com/tylerforsythe/Tampermonkey-Multi-Site-Time-Limiter/raw/refs/heads/main/SiteTimeLimiter.user.js](https://github.com/tylerforsythe/Tampermonkey-Multi-Site-Time-Limiter/raw/refs/heads/main/SiteTimeLimiter.user.js))
   - Tampermonkey should prompt you to install the script.
   - After installing this way, Tampermonkey can check that source URL for updates automatically.
3. (Alternative) Create a new userscript in Tampermonkey and paste in the contents of `SiteTimeLimiter.user.js` manually.

## Configuration

Main settings live in `SiteTimeLimiter.user.js`:

- `SITE_CONFIG` for per-site limits and block behavior.
- `DISABLE_START_DATE` / `DISABLE_END_DATE` for temporary disable range.
- `RESET_HOUR`, `SAVE_INTERVAL`, and display/block behavior constants.

## AI Generation Note

This repository and script were **~99% AI-generated** (with human review/edits).

## Disclaimer

Use at your own risk. This script is intended as a personal productivity aid.
