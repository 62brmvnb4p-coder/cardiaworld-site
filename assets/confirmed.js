(() => {
  'use strict';
  const origin = 'https://dvrcmzszdbysscdjnxon.supabase.co';
  const key = 'sb_publishable_hqgg5sovCltpuMDVuBANPg_1V61xRrs';
  const params = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const type = params.getAll('type').length === 1 ? params.get('type') : null;
  let token = type === 'recovery' && params.getAll('access_token').length === 1 ? params.get('access_token') : null;
  const signup = type === 'signup' && params.getAll('access_token').length === 1 && Boolean(params.get('access_token'));
  // Remove session material before any network request. Keep only the recovery token in memory.
  if (window.location.hash || window.location.search) history.replaceState(null, '', window.location.pathname);
  params.delete('access_token'); params.delete('refresh_token');
  const title = document.getElementById('confirmation-title');
  const message = document.getElementById('confirmation-message');
  const form = document.getElementById('change-password-form');
  const password = document.getElementById('new-password');
  const repeat = document.getElementById('repeat-password');
  const button = document.getElementById('save-password');
  const status = document.getElementById('password-status');
  const another = document.getElementById('request-another-reset');
  let userId = null, busy = false;
  function lock() { token = null; userId = null; password.value = ''; repeat.value = ''; password.disabled = repeat.disabled = button.disabled = true; form.hidden = true; }
  function unavailable() {
    lock(); title.textContent = 'This link is unavailable.';
    message.textContent = 'It may have expired or already been used. Request a new password-reset email, then open the newest link.';
    another.hidden = false;
  }
  window.addEventListener('pagehide', lock);
  async function auth(method, endpoint, body, bearer = token) {
    const response = await fetch(origin + '/auth/v1/' + endpoint, {
      method, headers: { apikey: key, Authorization: `Bearer ${bearer}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(25000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error('Request failed'); error.status = response.status; error.code = data.code ?? data.error_code; throw error; }
    return data;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !token || !userId) return;
    const value = password.value;
    status.classList.remove('error');
    if (value.length < 6 || value.length > 128) { status.textContent = 'Choose a password with 6 to 128 characters.'; status.classList.add('error'); return; }
    if (value !== repeat.value) { status.textContent = 'The passwords don’t match. Please enter them again.'; status.classList.add('error'); return; }
    busy = true; button.disabled = true; password.disabled = repeat.disabled = true;
    password.value = ''; repeat.value = ''; status.textContent = 'Updating your password…';
    try {
      const updated = await auth('PUT', 'user', { password: value });
      if (!token || !userId) return;
      if (updated.id !== userId) throw new Error('Unexpected account response');
      const finishedToken = token;
      lock(); title.textContent = 'Password updated.';
      message.textContent = 'Return to Cardia World and sign in with your account email and new password. Your existing account and progress stay with you.';
      status.textContent = ''; another.hidden = true;
      await auth('POST', 'logout?scope=local', undefined, finishedToken).catch(() => {});
    } catch (error) {
      if (error.status === 401 || error.status === 403) unavailable();
      else {
        status.textContent = error.code === 'same_password' ? 'Choose a password different from your current password.' : error.code === 'weak_password' ? 'Choose a stronger password and try again.' : 'We couldn’t confirm the update. Try signing in with the new password, or request a new reset link.';
        status.classList.add('error'); another.hidden = false;
      }
    } finally { busy = false; if (token && userId) password.disabled = repeat.disabled = button.disabled = false; }
  });
  if (params.has('error') || query.has('error') || query.has('code')) { unavailable(); return; }
  if (type !== 'recovery' || !token) {
    if (type === 'recovery') unavailable();
    else if (signup) {
      title.textContent = 'Email confirmed.';
      message.textContent = 'Your Cardia World account is ready. Return to the app and sign in with the same email and password.';
    }
    return;
  }
  title.textContent = 'Checking your reset link…';
  message.textContent = 'Please wait while we verify the link for your account.';
  auth('GET', 'user').then(user => {
    if (!token) return;
    if (!user.id || !user.email) { unavailable(); return; }
    userId = user.id; title.textContent = 'Choose a new password.';
    message.textContent = `Update the password for ${user.email}, then return to the app to sign in.`;
    form.hidden = false; password.disabled = repeat.disabled = button.disabled = false; another.hidden = true;
  }).catch(() => { if (token) unavailable(); });
})();
