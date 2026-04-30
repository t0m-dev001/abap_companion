const cron = require('node-cron');

/**
 * Dynamic BAPI reminder scheduler
 * Handles any number of reminders identified by { id, time, label, emoji, enabled }
 *
 * @param {Function} triggerReminder  called with the full reminder object
 * @param {Store}    store            electron-store for initial load
 */
module.exports = function setupScheduler(triggerReminder, store) {
  const TZ = 'Asia/Jakarta'; // WIB (UTC+7)

  // taskMap: id → cron.ScheduledTask
  const taskMap = new Map();

  function timeToCron(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    // Mon–Fri only; change to '* * *' for every day
    return `${m} ${h} * * 1-5`;
  }

  function scheduleOne(reminder) {
    if (!reminder.enabled) return;
    try {
      const task = cron.schedule(
        timeToCron(reminder.time),
        () => triggerReminder(reminder),
        { timezone: TZ }
      );
      taskMap.set(reminder.id, task);
    } catch (e) {
      console.warn(`[scheduler] Failed to schedule "${reminder.label}" (${reminder.time}):`, e.message);
    }
  }

  function clearAll() {
    taskMap.forEach(t => { try { t.stop(); } catch (_) {} });
    taskMap.clear();
  }

  // Build initial schedule from store
  const saved = store.get('reminders', []);
  saved.forEach(scheduleOne);

  return {
    /**
     * Called whenever the user saves Settings with an updated reminders array.
     * Destroys all existing tasks and rebuilds from the new list.
     */
    update(reminders = []) {
      clearAll();
      reminders.forEach(scheduleOne);
    },

    destroy() {
      clearAll();
    },
  };
};
