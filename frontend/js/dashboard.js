requireAuth();

async function loadDashboard() {
  try {
    const res = await apiFetch('/files/dashboard/stats');
    const d = res.data;

    setText('stat-total-files', d.totalFilesUploaded);
    setText('stat-storage-used', formatBytes(d.storageUsedBytes));
    setText('stat-last-upload', d.lastUploadAt ? formatDate(d.lastUploadAt) : 'No uploads yet');
    setText('stat-verification', d.isVerified ? 'Verified' : 'Not Verified');
    setText('welcome-name', d.name);

    const verifBadge = document.getElementById('verification-badge');
    if (verifBadge) {
      verifBadge.textContent = d.isVerified ? 'Verified' : 'Unverified';
      verifBadge.className = `badge ${d.isVerified ? 'badge-success' : 'badge-warning'}`;
    }

    renderRecentFiles(d.recentFiles || []);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderRecentFiles(files) {
  const container = document.getElementById('recent-files-list');
  if (!container) return;

  if (files.length === 0) {
    container.innerHTML = `<p class="text-muted">No files uploaded yet. <a href="upload.html" style="color:var(--blue-light)">Upload your first file</a>.</p>`;
    return;
  }

  container.innerHTML = files
    .map(
      (f) => `
    <div class="glass-panel file-card">
      <div class="file-icon">${fileIconFor(f.mimeType)}</div>
      <div class="file-meta">
        <div class="file-name">${escapeHtml(f.originalName)}</div>
        <div class="file-sub">${formatBytes(f.sizeBytes)} · ${formatDate(f.createdAt)}</div>
      </div>
    </div>`
    )
    .join('');
}

loadDashboard();

const userNameEl = document.querySelectorAll('.current-user-name');
const storedUser = getStoredUser();
if (storedUser) {
  userNameEl.forEach((el) => (el.textContent = storedUser.name));
}

document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});
