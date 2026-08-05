import Account from '../models/Account.js';
import Settings from '../models/Settings.js';
import { syncLinkedinMessagesForAccount, checkLinkedinCookiesForAccount } from './linkedinService.js';

let isSyncRunning = false;
let syncIntervalTimer = null;
let currentIntervalMs = 30000;

let isCookieCheckRunning = false;
let cookieCheckTimer = null;

/**
 * Perform background cookie health check for all accounts in MongoDB every 1 minute
 */
export async function runCookieCheckCron() {
  if (isCookieCheckRunning) return;
  isCookieCheckRunning = true;
  try {
    const accounts = await Account.find();
    if (accounts && accounts.length > 0) {
      console.log(`[Cookie Check Cron] Running 1-minute cookie health check for ${accounts.length} account(s)...`);
      for (const account of accounts) {
        await checkLinkedinCookiesForAccount(account);
      }
    }
  } catch (err) {
    console.error('[Cookie Check Cron Error]:', err.message);
  } finally {
    isCookieCheckRunning = false;
  }
}

/**
 * Perform background sync for all active accounts stored in MongoDB
 */
export async function runBackgroundSync(isManual = false) {
  if (isSyncRunning) {
    console.log('[Background Sync] Previous sync process still running. Skipping iteration.');
    return;
  }

  // Check persistent execution time if not manually triggered
  if (!isManual) {
    try {
      const settings = await Settings.findOne({ key: 'global' });
      if (settings && settings.lastSyncRunAt) {
        const lastRun = new Date(settings.lastSyncRunAt).getTime();
        const diffMs = Date.now() - lastRun;
        if (diffMs < 15 * 60 * 1000) {
          const remainingMins = Math.ceil((15 * 60 * 1000 - diffMs) / 60000);
          console.log(`[Background Sync] Skipping periodic sync. Last sync was ${Math.round(diffMs / 60000)}m ago. Re-executing in ${remainingMins}m.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[Background Sync Warning] Failed to fetch settings for last execution check:', err.message);
    }
  }

  isSyncRunning = true;
  try {
    const accounts = await Account.find({ status: 'active' });
    if (!accounts || accounts.length === 0) {
      console.log('[Background Sync] No active LinkedIn accounts found for periodic refetch.');
    } else {
      console.log(`\n--------------------------------------------------`);
      console.log(`[Background Sync Cron] Refetching messages (${currentIntervalMs / 1000}s cycle) for ${accounts.length} active account(s)...`);
      for (const account of accounts) {
        if (!account.cookies || (Array.isArray(account.cookies) && account.cookies.length === 0)) {
          console.log(`[Background Sync Cron] Skipping "${account.name}" - Missing cookie data.`);
          continue;
        }
        try {
          await syncLinkedinMessagesForAccount(account, account.cookies);
        } catch (accErr) {
          console.error(`[Background Sync Cron Error] Failed syncing for "${account.name}": ${accErr.message}`);
        }
      }
      console.log(`[Background Sync Cron] Completed refetch cycle at ${new Date().toLocaleTimeString()}.`);
      console.log(`--------------------------------------------------\n`);

      // Persist the execution time
      try {
        await Settings.findOneAndUpdate(
          { key: 'global' },
          { lastSyncRunAt: new Date() },
          { upsert: true }
        );
      } catch (err) {
        console.warn('[Background Sync Warning] Failed to update lastSyncRunAt in Settings:', err.message);
      }
    }
  } catch (err) {
    console.error('[Background Sync Cron Error]:', err.message);
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Update background sync interval dynamically
 */
export function updateSyncFrequency(frequencyMinutes) {
  const mins = parseFloat(frequencyMinutes) || 0.5;
  currentIntervalMs = Math.max(10000, Math.round(mins * 60 * 1000));
  
  console.log(`[Cron Scheduler] Sync frequency updated to ${mins} minute(s) (${currentIntervalMs / 1000}s).`);
  
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);
  syncIntervalTimer = setInterval(runBackgroundSync, currentIntervalMs);
}

/**
 * Start background sync cron job with settings from MongoDB
 */
export async function startSyncCron() {
  let mins = 0.5;
  try {
    const settings = await Settings.findOne({ key: 'global' });
    if (settings && settings.syncFrequencyMinutes) {
      mins = settings.syncFrequencyMinutes;
    }
  } catch (err) {
    console.warn('[Cron Scheduler] Settings load error, using default frequency.');
  }

  currentIntervalMs = Math.max(10000, Math.round(mins * 60 * 1000));
  console.log(`[Cron Scheduler] Initialized background LinkedIn refetch cron job every ${mins} min(s) (${currentIntervalMs / 1000}s).`);
  console.log(`[Cron Scheduler] Initialized 1-minute background cookie check cron job.`);

  // 1. Run 1-minute cookie check after 2s, then every 60,000ms
  setTimeout(() => {
    runCookieCheckCron();
  }, 2000);

  if (cookieCheckTimer) clearInterval(cookieCheckTimer);
  cookieCheckTimer = setInterval(runCookieCheckCron, 60000);

  // 2. First run of background message sync 5 seconds after server startup
  setTimeout(() => {
    runBackgroundSync();
  }, 5000);

  // Set recurring interval for message sync
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);
  syncIntervalTimer = setInterval(runBackgroundSync, currentIntervalMs);
}

