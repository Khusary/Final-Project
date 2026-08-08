requireAuth();

const urlParams = new URLSearchParams(window.location.search);
const fileId = urlParams.get('fileId');

let currentSessionId = null;

if (!fileId) {
     showToast('No file selected. Redirecting to My Files...', 'error');
     const btn = document.getElementById('request-otp-btn');
     if (btn) btn.disabled = true;
     setTimeout(() => (window.location.href = 'files.html'), 30000);
   }

async function loadFileInfo() {
  if (!fileId) return;
  try {
    const res = await apiFetch(`/files/${fileId}`);
    const f = res.data;
    document.getElementById('decrypt-file-name').textContent = f.originalName;
    document.getElementById('decrypt-file-meta').textContent =
      `${formatBytes(f.sizeBytes)} · Uploaded ${formatDate(f.createdAt)}`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}
loadFileInfo();

// Step 1: Request OTP
const requestOtpBtn = document.getElementById('request-otp-btn');
if (requestOtpBtn) {
  requestOtpBtn.addEventListener('click', async () => {
     if (!fileId) {
       showToast('No file selected.', 'error');
       return;
     }
     setButtonLoading(requestOtpBtn, true, 'Sending code...');
    try {
      await apiFetch(`/decrypt/${fileId}/request-otp`, { method: 'POST' });
      showToast('Authorization code sent to your email.', 'success');
      document.getElementById('step-1')?.classList.add('hidden');
      document.getElementById('step-2')?.classList.remove('hidden');
      setupOtpInputs();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(requestOtpBtn, false);
    }
  });
}

// Step 2: Verify OTP -> creates a decrypt session
const verifyOtpForm = document.getElementById('decrypt-verify-form');
if (verifyOtpForm) {
  verifyOtpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = verifyOtpForm.querySelector('button[type="submit"]');
    const otp = collectOtp();

    if (otp.length !== 6) {
      showToast('Please enter the full 6-digit code.', 'warning');
      return;
    }

    setButtonLoading(btn, true, 'Verifying...');
    try {
      const res = await apiFetch(`/decrypt/${fileId}/verify-otp`, { method: 'POST', body: { otp } });
      currentSessionId = res.data.sessionId;
      showToast('Verified! You may now decrypt and download.', 'success');
      document.getElementById('step-2')?.classList.add('hidden');
      document.getElementById('step-3')?.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// Step 3: Decrypt & download
const downloadBtn = document.getElementById('decrypt-download-btn');
if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!currentSessionId) {
      showToast('Session not found. Please restart the process.', 'error');
      return;
    }

    setButtonLoading(downloadBtn, true, 'Decrypting file...');
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_URL}/decrypt/session/${currentSessionId}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Decryption failed.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?(.+)"?/);
      const filename = match ? match[1] : 'decrypted-file';

      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      showToast('File decrypted and downloaded securely.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(downloadBtn, false);
    }
  });
}

document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});
