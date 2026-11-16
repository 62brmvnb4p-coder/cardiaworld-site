(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const [code, ...duplicates] = params.getAll('code');
  const valid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

  if (duplicates.length || !code || !valid.test(code)) {
    byId('invite-title').textContent = 'This Battle link is incomplete.';
    byId('invite-description').textContent = 'Ask the person who challenged you to share a new Cardio Battle invitation.';
    byId('install-hint').hidden = true;
    return;
  }

  const token = code.toLowerCase();
  const link = 'https://cardiaworld.com/invite/cardio-battle/?code=' + token;
  const open = byId('open-battle');
  open.href = 'cardiaworld://battle/' + token;
  open.hidden = false;
  document.querySelector('meta[name="apple-itunes-app"]').content = 'app-id=6815041207, app-argument=' + link;
  byId('battle-link-tools').hidden = false;

  byId('copy-battle-link').addEventListener('click', async () => {
    const status = byId('copy-status');
    try {
      await navigator.clipboard.writeText(link);
      status.textContent = 'Battle link copied. Open it after installing Cardia World.';
    } catch {
      status.textContent = 'Your Battle link: ' + link;
    }
  });
})();
