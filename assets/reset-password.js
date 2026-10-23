(() => {
  'use strict';
  const origin = 'https://dvrcmzszdbysscdjnxon.supabase.co';
  const key = 'sb_publishable_hqgg5sovCltpuMDVuBANPg_1V61xRrs';
  const form = document.getElementById('request-reset-form');
  const button = document.getElementById('request-reset');
  const status = document.getElementById('request-status');
  let busy = false;
  button.disabled = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const email = document.getElementById('reset-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = 'Enter your account email address first.';
      status.classList.add('error');
      return;
    }
    busy = true; button.disabled = true; status.classList.remove('error');
    status.textContent = 'Requesting your password-reset link…';
    try {
      const response = await fetch(`${origin}/auth/v1/recover?redirect_to=${encodeURIComponent('https://cardiaworld.com/confirmed/')}`, {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
        credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error(response.status === 429 ? 'Please wait a few minutes before requesting another email.' : 'We couldn’t request the reset email. Please try again shortly.');
      status.textContent = 'Check your email. If an account uses this address, you’ll receive a password-reset link. Check Spam or Junk too, and open the newest link.';
      form.hidden = true;
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' || error.name === 'TypeError' ? 'Couldn’t connect. Check your connection and try again.' : error.message;
      status.classList.add('error');
    } finally { busy = false; button.disabled = false; }
  });
})();
