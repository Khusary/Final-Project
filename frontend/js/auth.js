// ---------- Register ----------
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = registerForm.querySelector('button[type="submit"]');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setButtonLoading(btn, true, 'Creating account...');
    try {
      await apiFetch('/auth/register', { method: 'POST', body: { name, email, password } });
      showToast('Account created! Check your email for a verification code.', 'success');
      sessionStorage.setItem('pending_verify_email', email);
      setTimeout(() => (window.location.href = 'verify-email.html'), 1200);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ---------- Login ----------
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me')?.checked || false;

    setButtonLoading(btn, true, 'Logging in...');
    try {
      const res = await apiFetch('/auth/login', { method: 'POST', body: { email, password, rememberMe } });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      showToast('Welcome back!', 'success');
      setTimeout(() => (window.location.href = 'dashboard.html'), 600);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ---------- Verify Email (OTP) ----------
const verifyForm = document.getElementById('verify-form');
if (verifyForm) {
  const emailField = document.getElementById('verify-email-display');
  const storedEmail = sessionStorage.getItem('pending_verify_email') || '';
  if (emailField) emailField.textContent = storedEmail;

  setupOtpInputs();

  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = verifyForm.querySelector('button[type="submit"]');
    const otp = collectOtp();
    const email = storedEmail || document.getElementById('verify-email-input')?.value;

    if (otp.length !== 6) {
      showToast('Please enter the full 6-digit code.', 'warning');
      return;
    }

    setButtonLoading(btn, true, 'Verifying...');
    try {
      await apiFetch('/auth/verify-email', { method: 'POST', body: { email, otp } });
      showToast('Email verified! You can now log in.', 'success');
      sessionStorage.removeItem('pending_verify_email');
      setTimeout(() => (window.location.href = 'login.html'), 1000);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });

  const resendBtn = document.getElementById('resend-otp-btn');
  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/auth/resend-verification', { method: 'POST', body: { email: storedEmail } });
        showToast('A new code has been sent to your email.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// ---------- Forgot Password ----------
const forgotForm = document.getElementById('forgot-password-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = forgotForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();

    setButtonLoading(btn, true, 'Sending...');
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
      showToast('If that email exists, a reset code has been sent.', 'success');
      sessionStorage.setItem('pending_reset_email', email);
      setTimeout(() => (window.location.href = 'reset-password.html'), 1200);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ---------- Reset Password ----------
const resetForm = document.getElementById('reset-password-form');
if (resetForm) {
  const storedEmail = sessionStorage.getItem('pending_reset_email') || '';
  const emailField = document.getElementById('reset-email-display');
  if (emailField) emailField.textContent = storedEmail;

  setupOtpInputs();

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = resetForm.querySelector('button[type="submit"]');
    const otp = collectOtp();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'warning');
      return;
    }
    if (otp.length !== 6) {
      showToast('Please enter the full 6-digit code.', 'warning');
      return;
    }

    setButtonLoading(btn, true, 'Resetting...');
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { email: storedEmail, otp, newPassword },
      });
      showToast('Password reset! Please log in.', 'success');
      sessionStorage.removeItem('pending_reset_email');
      setTimeout(() => (window.location.href = 'login.html'), 1000);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

// ---------- OTP input helper (shared across verify + reset pages) ----------
function setupOtpInputs() {
  const inputs = document.querySelectorAll('.otp-inputs input');
  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      pasted.split('').forEach((char, i) => {
        if (inputs[i]) inputs[i].value = char;
      });
      inputs[Math.min(pasted.length, inputs.length - 1)].focus();
    });
  });
}

function collectOtp() {
  const inputs = document.querySelectorAll('.otp-inputs input');
  return Array.from(inputs).map((i) => i.value).join('');
}

// ---------- Logout (used across dashboard pages) ----------
async function handleLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // ignore network errors on logout
  } finally {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'login.html';
  }
}
