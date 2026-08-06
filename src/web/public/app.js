document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const statTotal      = document.getElementById('stat-total');
  const statCompleted  = document.getElementById('stat-completed');
  const statPending    = document.getElementById('stat-pending');
  const statFailed     = document.getElementById('stat-failed');

  const videoGrid      = document.getElementById('video-grid');
  const searchInput    = document.getElementById('search-input');
  const statusFilter   = document.getElementById('status-filter');
  const triggerSyncBtn = document.getElementById('trigger-sync-btn');
  const openFolderBtn  = document.getElementById('open-folder-btn');

  const dateFilterMode     = document.getElementById('date-filter-mode');
  const specificDateInput  = document.getElementById('specific-date-input');
  const applyDateFilterBtn = document.getElementById('apply-date-filter-btn');

  const downloadFolderInput = document.getElementById('download-folder-input');
  const browseFolderBtn     = document.getElementById('browse-folder-btn');
  const saveFolderBtn       = document.getElementById('save-folder-btn');

  const enableArchivingChk   = document.getElementById('enable-archiving-chk');
  const maxStorageGbInput    = document.getElementById('max-storage-gb');
  const autoArchiveDaysInput = document.getElementById('auto-archive-days');
  const saveStorageBtn       = document.getElementById('save-storage-btn');

  const modal         = document.getElementById('video-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalPlayer   = document.getElementById('modal-video-player');
  const modalTitle    = document.getElementById('modal-title');

  // ── Config ────────────────────────────────────────────────────────────────
  async function fetchConfig() {
    try {
      const cfg = await fetch('/api/config').then(r => r.json());
      if (cfg.dateFilterMode)   dateFilterMode.value = cfg.dateFilterMode;
      if (cfg.specificDate)     specificDateInput.value = cfg.specificDate;
      if (cfg.downloadFolder)   downloadFolderInput.value = cfg.downloadFolder;
      if (cfg.enableAutoArchiving !== undefined) enableArchivingChk.checked = Boolean(cfg.enableAutoArchiving);
      if (cfg.maxStorageGb)     maxStorageGbInput.value  = cfg.maxStorageGb;
      if (cfg.autoArchiveDays)  autoArchiveDaysInput.value = cfg.autoArchiveDays;
      toggleSpecificDate();
    } catch (e) { console.error('fetchConfig:', e); }
  }

  function toggleSpecificDate() {
    const isSpecific = dateFilterMode.value === 'SPECIFIC';
    specificDateInput.classList.toggle('hidden', !isSpecific);
    if (isSpecific && !specificDateInput.value) {
      specificDateInput.value = new Date().toISOString().slice(0, 10);
    }
  }
  dateFilterMode.addEventListener('change', toggleSpecificDate);

  specificDateInput.addEventListener('click', () => {
    try {
      if (typeof specificDateInput.showPicker === 'function') {
        specificDateInput.showPicker();
      }
    } catch (e) {}
  });

  applyDateFilterBtn.addEventListener('click', async () => {
    applyDateFilterBtn.disabled = true; applyDateFilterBtn.textContent = 'Saving…';
    try {
      await postConfig({ dateFilterMode: dateFilterMode.value, specificDate: specificDateInput.value || '' });
      await Promise.all([fetchStats(), fetchVideos()]);
      showToast('Date filter applied ✓');
    } finally { applyDateFilterBtn.disabled = false; applyDateFilterBtn.textContent = 'Apply Filter'; }
  });

  if (browseFolderBtn) {
    browseFolderBtn.addEventListener('click', async () => {
      browseFolderBtn.disabled = true;
      browseFolderBtn.innerHTML = '<span class="btn-icon">📂</span> Browsing...';
      try {
        const res = await fetch('/api/browse-folder', { method: 'POST' }).then(r => r.json());
        if (res.success && res.folderPath) {
          downloadFolderInput.value = res.folderPath;
          showToast('Folder selected ✓ Click Save Directory to save.');
        } else if (res.cancelled || res.timedOut) {
          showToast('No folder selected.');
        } else if (res.error) {
          showToast(`Browse error: ${res.error}`);
          console.error('Browse folder error:', res.error);
        } else {
          showToast('No folder selected.');
        }
      } catch (e) {
        console.error('Browse folder network error:', e);
        showToast('Could not reach server. Is FlowDownloader running?');
      } finally {
        browseFolderBtn.disabled = false;
        browseFolderBtn.innerHTML = '<span class="btn-icon">📂</span> Browse...';
      }
    });
  }

  saveFolderBtn.addEventListener('click', async () => {
    const newPath = downloadFolderInput.value.trim();
    if (!newPath) { showToast('Please enter a valid directory path.'); return; }
    saveFolderBtn.disabled = true; saveFolderBtn.textContent = 'Saving…';
    try {
      await postConfig({ downloadFolder: newPath });
      showToast('Save directory updated ✓');
    } finally { saveFolderBtn.disabled = false; saveFolderBtn.textContent = 'Save Directory'; }
  });

  openFolderBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/open-folder', { method: 'POST' }).then(r => r.json());
      if (res.success) {
        showToast('Opened download folder in File Explorer 📁');
      } else {
        showToast('Failed to open download folder.');
      }
    } catch (e) { showToast('Failed to open download folder.'); }
  });

  saveStorageBtn.addEventListener('click', async () => {
    saveStorageBtn.disabled = true; saveStorageBtn.textContent = 'Saving…';
    try {
      await postConfig({
        enableAutoArchiving: enableArchivingChk.checked,
        maxStorageGb:    parseInt(maxStorageGbInput.value,    10) || 50,
        autoArchiveDays: parseInt(autoArchiveDaysInput.value, 10) || 30,
      });
      showToast('Storage settings saved ✓');
    } finally { saveStorageBtn.disabled = false; saveStorageBtn.textContent = 'Save Quota'; }
  });

  async function postConfig(payload) {
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async function fetchStats() {
    try {
      const mode = encodeURIComponent(dateFilterMode.value || 'TODAY');
      const spec = encodeURIComponent(specificDateInput.value || '');
      const d = await fetch(`/api/stats?dateFilterMode=${mode}&specificDate=${spec}`).then(r => r.json());
      statTotal.textContent     = d.total     || 0;
      statCompleted.textContent = d.completed || 0;
      statPending.textContent   = d.pending   || 0;
      statFailed.textContent    = d.failed    || 0;
    } catch (e) { console.error('fetchStats:', e); }
  }

  // ── Videos ────────────────────────────────────────────────────────────────
  async function fetchVideos() {
    try {
      const search = encodeURIComponent(searchInput.value || '');
      const status = encodeURIComponent(statusFilter.value || 'ALL');
      const mode   = encodeURIComponent(dateFilterMode.value || 'TODAY');
      const spec   = encodeURIComponent(specificDateInput.value || '');
      const records = await fetch(`/api/videos?search=${search}&status=${status}&dateFilterMode=${mode}&specificDate=${spec}`).then(r => r.json());
      renderVideos(records);
    } catch (e) { console.error('fetchVideos:', e); }
  }

  function renderVideos(records) {
    if (!records || records.length === 0) {
      videoGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:4rem 1rem;">
          <div style="font-size:3rem;margin-bottom:1rem">🎬</div>
          <h3>No videos found</h3>
          <p style="margin-top:.5rem;font-size:.875rem">Completed video generations will appear here automatically.</p>
        </div>`;
      return;
    }

    videoGrid.innerHTML = records.map(rec => {
      const isCompleted = rec.download_status === 'COMPLETED';
      const safePrompt  = escapeHtml(rec.prompt || 'Google Flow Video');
      const sizeMb      = rec.filesize ? (rec.filesize / 1048576).toFixed(2) + ' MB' : '—';
      const safeId      = rec.id;

      const thumbHtml = isCompleted
        ? `<video class="card-video"
                  src="/api/stream/${safeId}#t=0.5"
                  preload="metadata"
                  muted playsinline loop></video>`
        : `<div class="card-placeholder">⏳</div>`;

      return `
        <div class="video-card" data-id="${safeId}" data-status="${rec.download_status}">
          <div class="video-thumb"
               onmouseenter="hoverPlay(this)"
               onmouseleave="hoverStop(this)"
               onclick="openModal('${safeId}','${safePrompt.replace(/'/g,"\\'")}','${rec.download_status}')">
            ${thumbHtml}
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
    if (!vid) return;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  };

  window.hoverStop = function(thumbEl) {
    const vid = thumbEl.querySelector('.card-video');
    if (!vid) return;
    vid.pause();
    vid.currentTime = 0.5; // back to poster frame
  };

  // ── Modal ─────────────────────────────────────────────────────────────────
  window.openModal = function(id, prompt, status) {
    if (status !== 'COMPLETED') { showToast(`Video is ${status} — not yet downloadable.`); return; }
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

  // ── Sync ──────────────────────────────────────────────────────────────────
  triggerSyncBtn.addEventListener('click', async () => {
    triggerSyncBtn.disabled = true;
    triggerSyncBtn.textContent = 'Syncing…';
    try {
      const res = await fetch('/api/trigger', { method: 'POST' }).then(r => r.json());
      await Promise.all([fetchStats(), fetchVideos()]);
      showToast(res.message || 'Sync cycle completed! ⚡');
    } catch { showToast('Sync failed.'); }
    finally {
      triggerSyncBtn.disabled = false;
      triggerSyncBtn.innerHTML = '<span class="btn-icon">⚡</span> Trigger Sync';
    }
  });

  // ── Search / Filter ───────────────────────────────────────────────────────
  let dbt;
  searchInput.addEventListener('input', () => { clearTimeout(dbt); dbt = setTimeout(fetchVideos, 280); });
  statusFilter.addEventListener('change', fetchVideos);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', bottom:'2rem', left:'50%', transform:'translateX(-50%)',
      background:'#1e293b', color:'#f1f5f9', border:'1px solid rgba(255,255,255,.12)',
      padding:'.65rem 1.4rem', borderRadius:'8px', fontSize:'.875rem',
      zIndex:'9999', boxShadow:'0 4px 20px rgba(0,0,0,.5)', whiteSpace:'nowrap',
    });
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
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
}
