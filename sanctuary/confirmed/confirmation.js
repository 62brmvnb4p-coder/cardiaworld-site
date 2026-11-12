(() => {
  "use strict";
  const origin = "https://icltllijvivnqxhgmypf.supabase.co";
  const apiKey = "sb_publishable_9zlZ2vzVdN3rPDr8lHkciw_vl1f_YWE";
  const fragment = new URLSearchParams(location.hash.slice(1));
  const hashes = fragment.getAll("token_hash");
  if (location.hash || location.search) history.replaceState(null, "", location.pathname);
  const title = document.getElementById("title");
  const message = document.getElementById("message");
  const show = (heading, detail) => {
    title.textContent = heading;
    message.textContent = detail;
  };

  if (!hashes.length) return;
  if (hashes.length !== 1 || !/^[a-zA-Z0-9_-]{40,128}$/.test(hashes[0])) {
    show("Link unavailable", "Open the newest confirmation email, or return to the app to request another link.");
    return;
  }

  show("Confirming your email…", "We’re checking your Manifestation Sanctuary confirmation link.");
  void confirmEmail(hashes[0]);

  async function confirmEmail(tokenHash) {
    const common = { method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" };
    try {
      const response = await fetch(origin + "/auth/v1/verify", {
        ...common,
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", token_hash: tokenHash }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || !result.user?.email_confirmed_at) {
        show("Link unavailable", "This link may have expired or already been used. Try signing in, or request a new confirmation email in the app.");
        return;
      }
      show("Email confirmed", "Your Manifestation Sanctuary account is ready. Return to the app and sign in with your email and password.");
      if (result.access_token) {
        void fetch(origin + "/auth/v1/logout?scope=local", {
          ...common,
          headers: { apikey: apiKey, Authorization: "Bearer " + result.access_token },
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    } catch {
      show("We couldn’t check this link", "Check your connection and reopen the link from your confirmation email.");
    }
  }
})();
