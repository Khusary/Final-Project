requireAuth();

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const progressWrap = document.getElementById('upload-progress-wrap');
const progressFill = document.getElementById('upload-progress-fill');
const progressLabel = document.getElementById('upload-progress-label');
const selectedFileName = document.getElementById('selected-file-name');
const uploadBtn = document.getElementById('upload-btn');

let selectedFile = null;

if (dropzone && fileInput) {
  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    })
  );

  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    })
  );

  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFileSelect(fileInput.files[0]);
  });
}

function handleFileSelect(file) {
  selectedFile = file;
  if (selectedFileName) {
    selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
    selectedFileName.classList.remove('hidden');
  }
  if (uploadBtn) uploadBtn.disabled = false;
}

if (uploadBtn) {
  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) {
      showToast('Please select a file first.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setButtonLoading(uploadBtn, true, 'Encrypting & uploading...');
    progressWrap?.classList.remove('hidden');

    try {
      await uploadWithProgress(formData);
      showToast('File encrypted and uploaded successfully!', 'success');
      setTimeout(() => (window.location.href = 'files.html'), 1200);
    } catch (err) {
      showToast(err.message || 'Upload failed.', 'error');
      setButtonLoading(uploadBtn, false);
    }
  });
}

function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/files/upload`);
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressLabel) progressLabel.textContent = `${percent}%`;
      }
    });

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          resolve(data);
        } else {
          reject(new Error(data.message || 'Upload failed.'));
        }
      } catch {
        reject(new Error('Unexpected server response.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(formData);
  });
}

document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.toggle('open');
});
