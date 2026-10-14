(() => {
  'use strict';
  const validUsername = value => typeof value === 'string' && /^[a-zA-Z0-9_]{3,24}$/.test(value);
  const params = new URLSearchParams(window.location.search);
  const username = params.getAll('username').length === 1 ? params.get('username') : null;
  const byId = id => document.getElementById(id);
  // Enable only after production SMTP delivery and the updated app are verified.
  const accountInvitesEnabled = document.documentElement.dataset.accountInvites === 'enabled';
  if (!validUsername(username)) {
    byId('invite-title').textContent = 'Let’s build together.';
    byId('invite-description').textContent = 'This invitation is missing a valid username. Ask your friend to send it again, or download Cardia World and search for their username in Friends.';
    return;
  }
  const inviteUrl = 'https://cardiaworld.com/invite/?username=' + encodeURIComponent(username);
  byId('inviter').hidden = false;
  byId('inviter').textContent = 'You’re invited by @' + username;
  byId('open-app').href = 'cardiaworld://friend/' + encodeURIComponent(username);
  document.querySelector('meta[name="apple-itunes-app"]').content = 'app-id=6815041207, app-argument=' + inviteUrl;
  byId('install-hint').textContent = accountInvitesEnabled
    ? 'Already installed? Open the app above. New to Cardia World? Save your invitation below, or download and tap this link again afterward.'
    : 'New to Cardia World? Download the app, sign in or create an account, then return to this invitation and tap Open Cardia World. Your friend’s username is @' + username + '.';
  byId('invite-tools').hidden = false;
  byId('copy-invite').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      byId('copy-status').textContent = 'Copied. Keep this link and open it again after installing Cardia World.';
    } catch {
      byId('copy-status').textContent = 'Copy this link: ' + inviteUrl;
    }
  });
  if (!accountInvitesEnabled) return;
  byId('save-invite').hidden = false;
  byId('show-account').addEventListener('click', () => {
    byId('account-form').hidden = false;
    byId('show-account').hidden = true;
    byId('username').required = true;
    byId('confirm-password').required = true;
    byId('email').focus();
  });
  let creating = true;
  let busy = false;
  byId('account-mode').addEventListener('click', () => {
    if (busy) return;
    creating = !creating;
    byId('username-field').hidden = !creating;
    byId('confirm-field').hidden = !creating;
    byId('username').required = creating;
    byId('confirm-password').required = creating;
    byId('password').autocomplete = creating ? 'new-password' : 'current-password';
    byId('account-heading').textContent = creating ? 'Create your Cardia World account' : 'Sign in to save this invitation';
    byId('submit-account').textContent = creating ? 'Create account & save invite' : 'Sign in & save invite';
    byId('account-mode').textContent = creating ? 'Already have an account? Sign in' : 'New here? Create account';
    byId('account-status').textContent = '';
  });
  const authOrigin = 'https://dvrcmzszdbysscdjnxon.supabase.co';
  const publishableKey = 'sb_publishable_hqgg5sovCltpuMDVuBANPg_1V61xRrs';
  async function authRequest(path, body, token, method = 'POST') {
    const response = await fetch(authOrigin + path, {
      method,
      headers: { apikey: publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.msg || result.message || result.error_description || 'Could not save your invitation. Please try again.');
    return result;
  }
  byId('account-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const status = byId('account-status');
    status.classList.remove('error');
    status.textContent = '';
    if (creating && byId('password').value !== byId('confirm-password').value) {
      status.classList.add('error');
      status.textContent = 'Passwords do not match.';
      return;
    }
    busy = true;
    byId('submit-account').disabled = true;
    byId('account-mode').disabled = true;
    status.textContent = 'Saving your invitation…';
    try {
      const email = byId('email').value.trim();
      const password = byId('password').value;
      if (creating) {
        const newUsername = byId('username').value.trim();
        if (!validUsername(newUsername)) throw new Error('Choose a username with 3–24 letters, numbers or underscores.');
        await authRequest('/auth/v1/signup?redirect_to=' + encodeURIComponent('https://cardiaworld.com/confirmed/'), {
          email, password, data: { username: newUsername, friend_invite_username: username },
        });
        status.textContent = 'Check your email to confirm your account. Then download Cardia World and sign in with this same email and password. In version 1.0.1 or later, the invitation from @' + username + ' will appear in Friends. On version 1.0, tap this invitation link again after signing in.';
      } else {
        const session = await authRequest('/auth/v1/token?grant_type=password', { email, password });
        if (!session.access_token) throw new Error('Could not sign in. Please try again.');
        try {
          await authRequest('/auth/v1/user', { data: { friend_invite_username: username } }, session.access_token, 'PUT');
          status.textContent = 'Invitation saved. Download Cardia World and sign in with the same account. In version 1.0.1 or later, your invitation from @' + username + ' will appear in Friends. On version 1.0, tap this invitation link again after signing in.';
        } finally {
          // Do not keep a website session or store tokens or passwords in the browser.
          await authRequest('/auth/v1/logout?scope=local', {}, session.access_token).catch(() => {});
        }
      }
      byId('account-form').reset();
      byId('account-form').hidden = true;
      byId('show-account').hidden = false;
      byId('show-account').textContent = 'Use another account';
    } catch (error) {
      status.classList.add('error');
      status.textContent = error instanceof Error ? error.message : 'Could not save your invitation. Please try again.';
    } finally {
      byId('password').value = '';
      byId('confirm-password').value = '';
      busy = false;
      byId('submit-account').disabled = false;
      byId('account-mode').disabled = false;
    }
  });
})();
