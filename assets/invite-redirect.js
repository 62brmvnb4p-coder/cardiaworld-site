(() => {
  try {
    const match = /^\/invite\/([^/]+)\/?$/.exec(window.location.pathname);
    if (!match) return;
    const username = decodeURIComponent(match[1]);
    if (/^[a-zA-Z0-9_]{3,24}$/.test(username)) window.location.replace('/invite/?username=' + encodeURIComponent(username));
  } catch { /* Keep the ordinary not-found page for malformed links. */ }
})();
