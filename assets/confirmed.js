(() => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.has('error')) {
    document.getElementById('confirmation-title').textContent = 'Confirmation link unavailable.';
    document.getElementById('confirmation-message').textContent = 'This link may have expired or already been used. Try signing in to Cardia World. If your email is still unconfirmed, request a new confirmation email.';
  }
  // Supabase can return session material in the fragment. This page never needs it.
  if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
})();
