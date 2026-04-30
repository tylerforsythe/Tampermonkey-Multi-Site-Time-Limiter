// ==UserScript==
// @name         Multi-Site Time Limiter
// @namespace    http://tampermonkey.net/
// @version      2.4.5
// @description  Limits daily usage time across multiple sites with weekend/weekday settings and countdown timer. Has ability to disable during a date range.
// @match        *://*.youtube.com/*
// @match        *://*.reddit.com/*
// @match        *://*.amazon.com/*
// @match        *://arstechnica.com/*
// @match        *://*.arstechnica.com/*
// @exclude      *://*.console.aws.amazon.com/*
// @exclude      *://*aws.amazon.com/*
// @exclude      *://lightsail.aws.amazon.com/*
// @exclude      *://docs.aws.amazon.com/*
// @exclude      *://*.aws.amazon.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

// LLM INSTRUCTIONS:
// - After any edits to this file, run `node --check SiteTimeLimiter.user.js` from the repo root to validate syntax.
// - The @version should be incremented with changes, and the version number may _not_ end in a period ('.').
// - Sites appearing in SITE_CONFIG need to be in the @match list above as well.

(function() {
    'use strict';

    const DISABLE_START_DATE = '';
    const DISABLE_END_DATE = '';

    const RESET_HOUR = 4;
    const SAVE_INTERVAL = 10000;
    const FLASH_STOP_OVERTIME_SECONDS = 60;
    const BLOCK_OVERLAY_ID = 'site-time-limiter-block-overlay';

    // Sites appearing in here need to be in the @match list above
    const SITE_CONFIG = {
        'youtube.com': {
            limitMinutesWeekday: 35,
            limitMinutesWeekend: 90,
            blockOnExpire: true
        },
        'reddit.com': {
            limitMinutesWeekday: 15,
            limitMinutesWeekend: 30,
            blockOnExpire: true
        },
        'amazon.com': {
            limitMinutesWeekday: 15,
            limitMinutesWeekend: 30,
            blockOnExpire: false
        },
        'arstechnica.com': {
            limitMinutesWeekday: 10,
            limitMinutesWeekend: 15,
            blockOnExpire: true
        }
    };

    function isWeekend() {
        const mt = getMountainTimeDate();
        const dayOfWeek = mt.getDay();
        return dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // 5 = Friday, 6 = Saturday, 0 = Sunday
    }

    function getCurrentDomain() {
        const hostname = window.location.hostname;
        for (const domain in SITE_CONFIG) {
            if (hostname.includes(domain)) {
                return domain;
            }
        }
        return null;
    }

    function isScriptDisabled() {
        if (!DISABLE_START_DATE || !DISABLE_END_DATE) {
            return false;
        }

        const now = new Date();
        const start = new Date(DISABLE_START_DATE);
        const end = new Date(DISABLE_END_DATE);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return false;
        }

        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
    }

    if (isScriptDisabled()) return;

    const currentDomain = getCurrentDomain();
    if (!currentDomain) return;

    const config = SITE_CONFIG[currentDomain];
    const DAILY_LIMIT_SECONDS = (isWeekend() ? config.limitMinutesWeekend : config.limitMinutesWeekday) * 60;

    function getMountainTimeDate() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }));
    }

    function getTodayKey() {
        const mt = getMountainTimeDate();
        const resetTime = new Date(mt);
        resetTime.setHours(RESET_HOUR, 0, 0, 0);

        if (mt < resetTime) {
            resetTime.setDate(resetTime.getDate() - 1);
        }

        return resetTime.toISOString().split('T')[0];
    }

    function getAllSiteData() {
        return GM_getValue('site_time_data', {});
    }

    function getSiteData(domain) {
        const allData = getAllSiteData();
        return allData[domain] || {};
    }

    function setSiteData(domain, data) {
        const allData = getAllSiteData();
        allData[domain] = data;
        GM_setValue('site_time_data', allData);
    }

    function getSecondsToday() {
        const todayKey = getTodayKey();
        const siteData = getSiteData(currentDomain);

        if (siteData.date !== todayKey) {
            return 0;
        }

        return siteData.seconds || 0;
    }

    function saveSecondsToday(seconds) {
        const todayKey = getTodayKey();
        const siteData = getSiteData(currentDomain);

        if (siteData.date && siteData.date !== todayKey) {
            const allData = getAllSiteData();
            allData[`${currentDomain}_${siteData.date}`] = {
                date: siteData.date,
                seconds: siteData.seconds
            };
            GM_setValue('site_time_data', allData);
        }

        setSiteData(currentDomain, {
            date: todayKey,
            seconds: seconds
        });
    }

    function formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (seconds >= 3600) {
            return `${hours}:${minutes.toString().padStart(2, '0')}`;
        } else if (seconds >= 600) {
            return `${minutes}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    function createTimerDisplay() {
        const div = document.createElement('div');
        div.id = 'yt-time-limiter';
        div.style.cssText = 'position:fixed;bottom:20px;left:20px;background:#d32f2f;color:#fff;padding:10px 16px;border-radius:6px;font-family:monospace;font-size:16px;font-weight:bold;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:background-color 2s ease-in-out;';
        document.body.appendChild(div);
        return div;
    }

    function blockPage() {
        const seconds = getSecondsToday();
        const minutes = Math.floor(seconds / 60);

        try {
            if (!document.documentElement) {
                return false;
            }

            let title = document.querySelector('title');
            if (!title) {
                title = document.createElement('title');
                (document.head || document.documentElement).appendChild(title);
            }
            title.textContent = 'Site Blocked';

            document.documentElement.style.overflow = 'hidden';
            if (document.body) {
                document.body.style.overflow = 'hidden';
            }

            let overlay = document.getElementById(BLOCK_OVERLAY_ID);
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = BLOCK_OVERLAY_ID;
                overlay.style.position = 'fixed';
                overlay.style.inset = '0';
                overlay.style.display = 'flex';
                overlay.style.justifyContent = 'center';
                overlay.style.alignItems = 'center';
                overlay.style.background = '#0f0f0f';
                overlay.style.color = '#fff';
                overlay.style.fontFamily = 'sans-serif';
                overlay.style.zIndex = '2147483647';

                const wrapper = document.createElement('div');
                wrapper.style.textAlign = 'center';

                const heading = document.createElement('h1');
                heading.textContent = 'Daily Limit Reached';
                heading.style.fontSize = '48px';
                heading.style.marginBottom = '20px';

                const minutesText = document.createElement('p');
                minutesText.id = `${BLOCK_OVERLAY_ID}-minutes`;
                minutesText.style.fontSize = '24px';

                const resetText = document.createElement('p');
                resetText.textContent = 'Resets at 4:00 AM Mountain Time';
                resetText.style.fontSize = '18px';
                resetText.style.color = '#aaa';

                wrapper.appendChild(heading);
                wrapper.appendChild(minutesText);
                wrapper.appendChild(resetText);
                overlay.appendChild(wrapper);
            }

            const minutesText = overlay.querySelector(`#${BLOCK_OVERLAY_ID}-minutes`);
            if (minutesText) {
                minutesText.textContent = `You've used ${minutes} minutes today.`;
            }

            if (!overlay.parentNode) {
                document.documentElement.appendChild(overlay);
            }

            return true;
        } catch (error) {
            console.error('[SiteTimeLimiter] Failed to block page:', error);
            return false;
        }
    }

    let blockEnforceIntervalId = null;

    function startBlockEnforcement() {
        if (blockEnforceIntervalId) return;

        const enforce = () => {
            if (getSecondsToday() < DAILY_LIMIT_SECONDS) {
                clearInterval(blockEnforceIntervalId);
                blockEnforceIntervalId = null;
                window.location.reload();
                return;
            }

            if (blockPage()) {
                stopTimer();
            }
        };

        enforce();
        blockEnforceIntervalId = setInterval(enforce, 1000);
    }

    if (getSecondsToday() >= DAILY_LIMIT_SECONDS && config.blockOnExpire) {
        startBlockEnforcement();
        return;
    }

    let intervalId = null;
    let saveIntervalId = null;
    let displayIntervalId = null;
    let flashIntervalId = null;
    let currentSeconds = getSecondsToday();
    let timerDisplay = null;
    let isFlashing = false;

    function updateDisplay() {
        if (!timerDisplay) return;
        const remaining = DAILY_LIMIT_SECONDS - currentSeconds;
        timerDisplay.textContent = formatTime(remaining);
    }

    function startFlashing() {
        if (isFlashing || !timerDisplay) return;
        isFlashing = true;

        let isRed = true;
        flashIntervalId = setInterval(() => {
            timerDisplay.style.backgroundColor = isRed ? '#d32f2f' : '#ffffff';
            timerDisplay.style.color = isRed ? '#ffffff' : '#d32f2f';
            isRed = !isRed;
        }, 2000);
    }

    function stopFlashing() {
        if (flashIntervalId) {
            clearInterval(flashIntervalId);
            flashIntervalId = null;
        }

        isFlashing = false;

        if (timerDisplay) {
            timerDisplay.style.backgroundColor = '#d32f2f';
            timerDisplay.style.color = '#ffffff';
        }
    }

    function startTimer() {
        if (intervalId) return;

        intervalId = setInterval(() => {
            currentSeconds++;

            if (currentSeconds >= DAILY_LIMIT_SECONDS) {
                if (config.blockOnExpire) {
                    saveSecondsToday(currentSeconds);
                    startBlockEnforcement();
                } else {
                    const overtimeSeconds = currentSeconds - DAILY_LIMIT_SECONDS;
                    if (overtimeSeconds <= FLASH_STOP_OVERTIME_SECONDS) {
                        startFlashing();
                    } else {
                        stopFlashing();
                    }
                }
            }
        }, 1000);

        saveIntervalId = setInterval(() => {
            saveSecondsToday(currentSeconds);
        }, SAVE_INTERVAL);

        displayIntervalId = setInterval(updateDisplay, 1000);
    }

    function stopTimer() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (saveIntervalId) {
            clearInterval(saveIntervalId);
            saveIntervalId = null;
        }
        if (displayIntervalId) {
            clearInterval(displayIntervalId);
            displayIntervalId = null;
        }
        if (flashIntervalId) {
            stopFlashing();
        }
        saveSecondsToday(currentSeconds);
    }

    function init() {
        if (document.body) {
            timerDisplay = createTimerDisplay();
            updateDisplay();

            if (currentSeconds >= DAILY_LIMIT_SECONDS && !config.blockOnExpire) {
                const overtimeSeconds = currentSeconds - DAILY_LIMIT_SECONDS;
                if (overtimeSeconds <= FLASH_STOP_OVERTIME_SECONDS) {
                    startFlashing();
                }
            }
        } else {
            setTimeout(init, 100);
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            currentSeconds = getSecondsToday();
            updateDisplay();
            startTimer();
        } else {
            stopTimer();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if (document.visibilityState === 'visible') {
        startTimer();
    }
})();
