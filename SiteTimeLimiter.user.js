// ==UserScript==
// @name         Multi-Site Time Limiter
// @namespace    http://tampermonkey.net/
// @version      2.2.
// @description  Limits daily usage time across multiple sites with weekend/weekday settings and countdown timer. Has ability to disable during a date range.
// @match        *://*.youtube.com/*
// @match        *://*.reddit.com/*
// @match        *://*.amazon.com/*
// @exclude      *://*.console.aws.amazon.com/*
// @exclude      *://lightsail.aws.amazon.com/*
// @exclude      *://docs.aws.amazon.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

// LLM INSTRUCTIONS: After any edits to this file, run `node --check SiteTimeLimiter.user.js` from the repo root to validate syntax.

(function() {
    'use strict';

    const DISABLE_START_DATE = '';
    const DISABLE_END_DATE = '';

    const RESET_HOUR = 4;
    const SAVE_INTERVAL = 10000;

    const SITE_CONFIG = {
        'youtube.com': {
            limitMinutesWeekday: 35,
            limitMinutesWeekend: 60,
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
        }
    };

    function isWeekend() {
        const mt = getMountainTimeDate();
        const dayOfWeek = mt.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
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

        document.documentElement.innerHTML = `
            <html>
            <head><title>Site Blocked</title></head>
            <body style="margin:0;padding:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f0f0f;color:#fff;font-family:sans-serif;">
                <div style="text-align:center;">
                    <h1 style="font-size:48px;margin-bottom:20px;">Daily Limit Reached</h1>
                    <p style="font-size:24px;">You've used ${minutes} minutes today.</p>
                    <p style="font-size:18px;color:#aaa;">Resets at 4:00 AM Mountain Time</p>
                </div>
            </body>
            </html>
        `;
    }

    if (getSecondsToday() >= DAILY_LIMIT_SECONDS && config.blockOnExpire) {
        blockPage();
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

    function startTimer() {
        if (intervalId) return;

        intervalId = setInterval(() => {
            currentSeconds++;

            if (currentSeconds >= DAILY_LIMIT_SECONDS) {
                if (config.blockOnExpire) {
                    stopTimer();
                    saveSecondsToday(currentSeconds);
                    blockPage();
                } else {
                    startFlashing();
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
            clearInterval(flashIntervalId);
            flashIntervalId = null;
        }
        saveSecondsToday(currentSeconds);
    }

    function init() {
        if (document.body) {
            timerDisplay = createTimerDisplay();
            updateDisplay();

            if (currentSeconds >= DAILY_LIMIT_SECONDS && !config.blockOnExpire) {
                startFlashing();
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
