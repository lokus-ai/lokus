const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function clockText() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `🕐 ${DAYS[d.getDay()]} ${hh}:${mm}:${ss}`;
}

module.exports = {
  async activate(lokus) {
    console.log('[live-clock] plugin activated — starting ticks');

    const tick = async () => {
      try {
        await lokus.ui.setStatusBarItem('clock', { text: clockText() });
      } catch (err) {
        console.warn('[live-clock] tick blocked:', err.message);
      }
    };

    await tick();
    this.timer = setInterval(tick, 1000);

    lokus.on('command', async ({ id }) => {
      if (id !== 'insert-timestamp') return;
      const stamp = new Date().toLocaleString();
      console.log('[live-clock] inserting timestamp:', stamp);
      try {
        await lokus.editor.insert(`\n🕐 *${stamp}*\n`);
        await lokus.ui.notify({
          message: `Timestamp inserted: ${stamp}`,
          type: 'success',
          title: 'Live Clock',
        });
      } catch (err) {
        console.error('[live-clock] insert failed:', err.message);
        await lokus.ui.notify({
          message: `Could not insert timestamp: ${err.message}`,
          type: 'error',
          title: 'Live Clock',
        });
      }
    });
  },

  async deactivate() {
    if (this.timer) clearInterval(this.timer);
    console.log('[live-clock] plugin deactivated');
  },
};
