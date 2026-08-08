// ---------- Admin Login ----------
const adminLoginForm = document.getElementById('admin-login-form');

// Guard every admin page except the login page itself
if (!adminLoginForm) {
  requireAdminAuth();
}

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = adminLoginForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setButtonLoading(btn, true, 'Logging in...');
    try {
      const res = await apiFetch('/admin/login', { method: 'POST', body: { email, password } });
      localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
      localStorage.setItem('securecrypt_admin', JSON.stringify(res.data.admin));
      showToast('Welcome back, Admin.', 'success');
      setTimeout(() => (window.location.href = 'admin-dashboard.html'), 600);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ---------- Admin Dashboard ----------
async function loadAdminDashboard() {
  const el = document.getElementById('admin-stat-users');
  if (!el) return;

  try {
    const res = await apiFetch('/admin/dashboard', { admin: true });
    const d = res.data;
    document.getElementById('admin-stat-users').textContent = d.totalUsers;
    document.getElementById('admin-stat-verified').textContent = d.verifiedUsers;
    document.getElementById('admin-stat-files').textContent = d.totalFiles;
    document.getElementById('admin-stat-storage').textContent = formatBytes(d.totalStorageBytes);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
loadAdminDashboard();

// ---------- Admin Users Table ----------
async function loadAdminUsers(search = '') {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  try {
    const res = await apiFetch(`/admin/users?search=${encodeURIComponent(search)}`, { admin: true });
    const users = res.data;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center">No users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge ${u.isVerified ? 'badge-success' : 'badge-warning'}">${u.isVerified ? 'Verified' : 'Unverified'}</span></td>
        <td>${u.totalFilesUploaded}</td>
        <td>${formatBytes(u.storageUsedBytes)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteAdminUser('${u._id}')">Delete</button></td>
      </tr>`
      )
      .join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAdminUser(userId) {
  if (!confirm('Delete this user and all of their files permanently?')) return;
  try {
    await apiFetch(`/admin/users/${userId}`, { method: 'DELETE', admin: true });
    showToast('User deleted.', 'success');
    loadAdminUsers(document.getElementById('admin-user-search')?.value || '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('admin-user-search')?.addEventListener('input', (e) => {
  loadAdminUsers(e.target.value);
});
loadAdminUsers();

// ---------- Admin Files Table ----------
async function loadAdminFiles(search = '') {
  const tbody = document.getElementById('admin-files-tbody');
  if (!tbody) return;

  try {
    const res = await apiFetch(`/admin/files?search=${encodeURIComponent(search)}`, { admin: true });
    const files = res.data;

    if (files.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center">No files found.</td></tr>`;
      return;
    }

    tbody.innerHTML = files
      .map(
        (f) => `
      <tr>
        <td>${escapeHtml(f.originalName)}</td>
        <td>${f.owner ? escapeHtml(f.owner.email) : '—'}</td>
        <td>${formatBytes(f.sizeBytes)}</td>
        <td>${formatDate(f.createdAt)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteAdminFile('${f._id}')">Delete</button></td>
      </tr>`
      )
      .join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteAdminFile(fileId) {
  if (!confirm('Delete this file permanently?')) return;
  try {
    await apiFetch(`/admin/files/${fileId}`, { method: 'DELETE', admin: true });
    showToast('File deleted.', 'success');
    loadAdminFiles(document.getElementById('admin-file-search')?.value || '');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('admin-file-search')?.addEventListener('input', (e) => {
  loadAdminFiles(e.target.value);
});
loadAdminFiles();

// ---------- Admin Logs Table ----------
async function loadAdminLogs() {
  const tbody = document.getElementById('admin-logs-tbody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/admin/logs?limit=100', { admin: true });
    const logs = res.data;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center">No activity yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs
      .map(
        (l) => `
      <tr>
        <td><span class="badge badge-info">${l.action}</span></td>
        <td>${l.user ? escapeHtml(l.user.email) : l.admin ? escapeHtml(l.admin.email) : '—'}</td>
        <td>${escapeHtml(l.description || '—')}</td>
        <td>${formatDate(l.createdAt)}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
loadAdminLogs();

// ---------- Admin Logout ----------
function handleAdminLogout() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem('securecrypt_admin');
  window.location.href = 'admin-login.html';
}
document.getElementById('admin-logout-btn')?.addEventListener('click', handleAdminLogout);
document.getElementById('admin-menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});
