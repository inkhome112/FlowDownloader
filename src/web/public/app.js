document.addEventListener('DOMContentLoaded', () => {
  const statTotal = document.getElementById('stat-total');
  const statCompleted = document.getElementById('stat-completed');
  const statPending = document.getElementById('stat-pending');
  const statFailed = document.getElementById('stat-failed');

  const videoGrid = document.getElementById('video-grid');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const triggerSyncBtn = document.getElementById('trigger-sync-btn');

  const dateFilterMode = document.getElementById('date-filter-mode');
  const specificDateInput = document.getElementById('specific-date-input');
  const applyDateFilterBtn = document.getElementById('apply-date-filter-btn');

  const modal = document.getElementById('video-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalPlayer = document.getElementById('modal-video-player');
  const modalTitle = document.getElementById('modal-title');

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      if (config.dateFilterMode) {
        dateFilterMode.value = config.dateFilterMode;
      }
      if (config.specificDate) {
        specificDateInput.value = config.specificDate;
      }
      toggleSpecificDateVisibility();
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  function toggleSpecificDateVisibility() {
    if (dateFilterMode.value === 'SPECIFIC') {
      specificDateInput.classList.remove('hidden');
    } else {
      specificDateInput.classList.add('hidden');
    }
  }

  dateFilterMode.addEventListener('change', toggleSpecificDateVisibility);

  applyDateFilterBtn.addEventListener('click', async () => {
    try {
      applyDateFilterBtn.disabled = true;
      applyDateFilterBtn.textContent = 'Saving...';
      const payload = {
        dateFilterMode: dateFilterMode.value,
        specificDate: specificDateInput.value || '',
      };
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert(`Date filter updated to ${dateFilterMode.value} ${specificDateInput.value ? '(' + specificDateInput.value + ')' : ''}`);
    } catch (err) {
      alert('Failed to update date filter setting.');
    } finally {
      applyDateFilterBtn.disabled = false;
      applyDateFilterBtn.textContent = 'Apply Filter';
    }
  });

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      statTotal.textContent = data.total || 0;
      statCompleted.textContent = data.completed || 0;
      statPending.textContent = data.pending || 0;
      statFailed.textContent = data.failed || 0;
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  async function fetchVideos() {
    try {
      const search = encodeURIComponent(searchInput.value || '');
      const status = encodeURIComponent(statusFilter.value || 'ALL');
      const res = await fetch(`/api/videos?search=${search}&status=${status}`);
      const records = await res.json();
      renderVideos(records);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
    }
  }

  function renderVideos(records) {
    if (!records || records.length === 0) {
      videoGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 4rem 1rem;">
          <h3>No videos found</h3>
          <p style="margin-top: 0.5rem;">Completed video generations will appear here automatically.</p>
        </div>
      `;
      return;
    }

    videoGrid.innerHTML = records.map(rec => `
      <div class="video-card">
        <div class="video-thumb" onclick="openModal('${rec.id}', '${escapeHtml(rec.prompt)}', '${rec.download_status}')">
          <div class="play-overlay">▶</div>
        </div>
        <div class="card-body">
          <div class="card-prompt">${escapeHtml(rec.prompt || 'Google Flow Video')}</div>
          <div class="card-meta">
            <span class="status-tag status-${(rec.download_status || '').toLowerCase()}">${rec.download_status}</span>
            <span>${rec.filesize ? (rec.filesize / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  window.openModal = function(id, prompt, status) {
    if (status !== 'COMPLETED') {
      alert(`Video ${id} is currently ${status}. Stream preview available once download completes.`);
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

  triggerSyncBtn.addEventListener('click', async () => {
    try {
      triggerSyncBtn.disabled = true;
      triggerSyncBtn.textContent = 'Syncing...';
      await fetch('/api/trigger', { method: 'POST' });
      await fetchStats();
      await fetchVideos();
    } catch (err) {
      alert('Failed to trigger sync cycle.');
    } finally {
      triggerSyncBtn.disabled = false;
      triggerSyncBtn.innerHTML = '<span class="btn-icon">⚡</span> Trigger Sync';
    }
  });

  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchVideos, 300);
  });

  statusFilter.addEventListener('change', fetchVideos);

  // Initial load & periodic refresh
  fetchConfig();
  fetchStats();
  fetchVideos();
  setInterval(() => {
    fetchStats();
    fetchVideos();
  }, 10000);
});

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}
