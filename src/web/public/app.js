document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const statTotal    = document.getElementById('stat-total');
  const statCompleted = document.getElementById('stat-completed');
  const statPending  = document.getElementById('stat-pending');
  const statFailed   = document.getElementById('stat-failed');

  const videoGrid    = document.getElementById('video-grid');
  const searchInput  = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const triggerSyncBtn = document.getElementById('trigger-sync-btn');

  const dateFilterMode    = document.getElementById('date-filter-mode');
  const specificDateInput = document.getElementById('specific-date-input');
  const applyDateFilterBtn = document.getElementById('apply-date-filter-btn');

  const enableArchivingChk  = document.getElementById('enable-archiving-chk');
  const maxStorageGbInput   = document.getElementById('max-storage-gb');
  const autoArchiveDaysInput = document.getElementById('auto-archive-days');
  const saveStorageBtn      = document.getElementById('save-storage-btn');

  const modal          = document.getElementById('video-modal');
  const modalCloseBtn  = document.getElementById('modal-close-btn');
  const modalPlayer    = document.getElementById('modal-video-player');
  const modalTitle     = document.getElementById('modal-title');

  // ── Config ────────────────────────────────────────────────────────────────
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      if (cfg.dateFilterMode)         dateFilterMode.value = cfg.dateFilterMode;
      if (cfg.specificDate)           specificDateInput.value = cfg.specificDate;
      if (cfg.enableAutoArchiving !== undefined) enableArchivingChk.checked = Boolean(cfg.enableAutoArchiving);
      if (cfg.maxStorageGb)           maxStorageGbInput.value  = cfg.maxStorageGb;
      if (cfg.autoArchiveDays)        autoArchiveDaysInput.value = cfg.autoArchiveDays;
      toggleSpecificDate();
    } catch (e) { console.error('fetchConfig error:', e); }
  }

  function toggleSpecificDate() {
    specificDateInput.classList.toggle('hidden', dateFilterMode.value !== 'SPECIFIC');
  }
  dateFilterMode.addEventListener('change', toggleSpecificDate);

  applyDateFilterBtn.addEventListener('click', async () => {
    applyDateFilterBtn.disabled = true;
    applyDateFilterBtn.textContent = 'Saving…';
    try {
      await postConfig({ dateFilterMode: dateFilterMode.value, specificDate: specificDateInput.value || '' });
      showToast(`Date filter set to ${dateFilterMode.value}`);
    } finally {
      applyDateFilterBtn.disabled = false;
      applyDateFilterBtn.textContent = 'Apply Filter';
    }
  });

  saveStorageBtn.addEventListener('click', async () => {
    saveStorageBtn.disabled = true;
    saveStorageBtn.textContent = 'Saving…';
    try {
      await postConfig({
        enableAutoArchiving: enableArchivingChk.checked,
        maxStorageGb:    parseInt(maxStorageGbInput.value, 10) || 50,
        autoArchiveDays: parseInt(autoArchiveDaysInput.value, 10) || 30,
      });
      showToast('Storage settings saved');
    } finally {
      saveStorageBtn.disabled = false;
      saveStorageBtn.textContent = 'Save';
    }
  });

  async function postConfig(payload) {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async function fetchStats() {
    try {
      const data = await fetch('/api/stats').then(r => r.json());
      statTotal.textContent     = data.total     || 0;
      statCompleted.textContent = data.completed || 0;
      statPending.textContent   = data.pending   || 0;
      statFailed.textContent    = data.failed    || 0;
    } catch (e) { console.error('fetchStats error:', e); }
  }

  // ── Videos ────────────────────────────────────────────────────────────────
  async function fetchVideos() {
    try {
      const search = encodeURIComponent(searchInput.value || '');
      const status = encodeURIComponent(statusFilter.value || 'ALL');
      const records = await fetch(`/api/videos?search=${search}&status=${status}`).then(r => r.json());
      renderVideos(records);
    } catch (e) { console.error('fetchVideos error:', e); }
  }

  function renderVideos(records) {
    if (!records || records.length === 0) {
      videoGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:4rem 1rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">🎬</div>
          <h3 style="font-size:1.1rem;">No videos found</h3>
          <p style="margin-top:0.5rem;font-size:0.875rem;">Completed video generations will appear here automatically.</p>
        </div>`;
      return;
    }

    videoGrid.innerHTML = records.map(rec => {
      const isCompleted = rec.download_status === 'COMPLETED';
      const safePrompt  = escapeHtml(rec.prompt || 'Google Flow Video');
      const sizeMb      = rec.filesize ? (rec.filesize / 1024 / 1024).toFixed(2) + ' MB' : '—';

      // Use native HTML5 video element for BOTH thumbnail and hover preview.
      // #t=0.5 instructs the browser to show frame at 0.5 s as the poster.
      const videoSrc = isCompleted ? `/api/stream/${rec.id}#t=0.5` : '';

      return `
        <div class="video-card" onclick="openModal('${rec.id}','${safePrompt.replace(/'/g,"\\'")}','${rec.download_status}')">
          <div class="video-thumb"
               onmouseenter="hoverPlay(this)"
               onmouseleave="hoverStop(this)">
            <video class="card-video"
                   src="${videoSrc}"
                   preload="metadata"
                   muted
                   playsinline
                   loop></video>
            <div class="play-overlay">
              <div class="play-overlay-icon">▶</div>
            </div>
          </div>
          <div class="card-body">
            <div class="card-prompt">${safePrompt}</div>
            <div class="card-meta">
              <span class="status-tag status-${rec.download_status.toLowerCase()}">${rec.download_status}</span>
              <span>${sizeMb}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // ── Hover Preview ─────────────────────────────────────────────────────────
  window.hoverPlay = function(thumbEl) {
    const vid = thumbEl.querySelector('.card-video');
    if (!vid || !vid.src || vid.src.endsWith('#t=0.5') === false && !vid.src.includes('/api/stream/')) return;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  };

  window.hoverStop = function(thumbEl) {
    const vid = thumbEl.querySelector('.card-video');
    if (!vid) return;
    vid.pause();
    // Reset to poster frame
    vid.currentTime = 0.5;
  };

  // ── Modal ─────────────────────────────────────────────────────────────────
  window.openModal = function(id, prompt, status) {
    if (status !== 'COMPLETED') {
      showToast(`Video is ${status} — not yet available for preview.`);
      return;
    }
    modalTitle.textContent = prompt;
    modalPlayer.src = `/api/stream/${id}`;
    modal.classList.remove('hidden');
  };

  function closeModal() {
    modal.classList.add('hidden');
    modalPlayer.pause();
    modalPlayer.src = '';
  }

  modalCloseBtn.addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ── Sync Button ───────────────────────────────────────────────────────────
  triggerSyncBtn.addEventListener('click', async () => {
    triggerSyncBtn.disabled = true;
    triggerSyncBtn.textContent = 'Syncing…';
    try {
      await fetch('/api/trigger', { method: 'POST' });
      await Promise.all([fetchStats(), fetchVideos()]);
      showToast('Sync cycle triggered!');
    } catch { showToast('Failed to trigger sync.'); }
    finally {
      triggerSyncBtn.disabled = false;
      triggerSyncBtn.innerHTML = '<span class="btn-icon">⚡</span> Trigger Sync';
    }
  });

  // ── Search / Filter ───────────────────────────────────────────────────────
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchVideos, 280);
  });
  statusFilter.addEventListener('change', fetchVideos);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
      position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
      background:#1e293b;color:#f1f5f9;border:1px solid rgba(255,255,255,0.1);
      padding:0.65rem 1.4rem;border-radius:8px;font-size:0.875rem;
      z-index:9999;animation:fadeIn .2s ease;box-shadow:0 4px 20px rgba(0,0,0,.5);`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  fetchConfig();
  fetchStats();
  fetchVideos();
  setInterval(() => { fetchStats(); fetchVideos(); }, 10000);
});

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
