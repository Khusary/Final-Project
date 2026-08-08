requireAuth();

let allFiles = [];

async function loadFiles() {
  const listEl = document.getElementById('files-list');
  if (!listEl) return;

  try {
    const res = await apiFetch('/files');
    allFiles = res.data;
    renderFiles(allFiles);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderFiles(files) {
  const listEl = document.getElementById('files-list');
  if (!listEl) return;

  if (files.length === 0) {
    listEl.innerHTML = `<p class="text-muted">No files found. <a href="upload.html" style="color:var(--blue-light)">Upload one now</a>.</p>`;
    return;
  }

  listEl.innerHTML = files
    .map(
      (f) => `
    <div class="glass-panel file-card">
      <div class="file-icon">${fileIconFor(f.mimeType)}</div>
      <div class="file-meta">
        <div class="file-name">${escapeHtml(f.originalName)}</div>
        <div class="file-sub">${formatBytes(f.sizeBytes)} · Uploaded ${formatDate(f.createdAt)}</div>
      </div>
      <div class="file-actions">
        <a class="btn btn-outline btn-sm" href="./decrypt.html?fileId=${encodeURIComponent(f._id)}">Decrypt</a>
        <button class="btn btn-danger btn-sm" onclick="deleteFile('${f._id}')">Delete</button>
      </div>
    </div>`
    )
    .join('');
}

async function deleteFile(fileId) {
  if (!confirm('Delete this file permanently? This cannot be undone.')) return;
  try {
    await apiFetch(`/files/${fileId}`, { method: 'DELETE' });
    showToast('File deleted.', 'success');
    allFiles = allFiles.filter((f) => f._id !== fileId);
    renderFiles(allFiles);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('file-search')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderFiles(allFiles.filter((f) => f.originalName.toLowerCase().includes(q)));
});

loadFiles();

document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});
