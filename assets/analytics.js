// Website-only analytics. Never load this on account, recovery, or invitation pages.
(() => {
  const measurementId = 'G-BQ0GPE59HT';
  const allowedPages = new Set(['/', '/how-it-works/', '/cardio-motivation-app/', '/walking-motivation-app/', '/support/', '/privacy/']);
  const location = new URL(window.location.href);
  if (location.protocol !== 'https:' || !['cardiaworld.com', 'www.cardiaworld.com'].includes(location.hostname) || !allowedPages.has(location.pathname) || window.__cardiaAnalytics) return;
  window.__cardiaAnalytics = true;

  const choiceKey = 'cardia_analytics_choice_v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const browserOptOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const channels = new Set(['tiktok', 'facebook', 'instagram', 'reddit']);
  const source = (location.searchParams.get('from') || location.searchParams.get('utm_source') || '').toLowerCase();
  const paid = new Set(['paid', 'paid_social', 'cpc', 'ppc', 'ads']).has((location.searchParams.get('utm_medium') || '').toLowerCase());
  const campaign = channels.has(source) ? `${source}_${paid ? 'paid' : 'organic'}` : 'website';
  const page = {page_location: location.origin + location.pathname, page_title: document.title, page_referrer: ''};
  try { page.page_referrer = new URL(document.referrer).origin + '/'; } catch {}
  const attribution = channels.has(source) ? {campaign_source: source, campaign_medium: paid ? 'paid_social' : 'organic_social', campaign_name: campaign} : {};
  let active = false;
  let loaded = false;

  // Basic consent mode: Google receives no request before an affirmative choice.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  const denied = {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'};
  gtag('consent', 'default', denied);
  window['ga-disable-' + measurementId] = true;

  function start() {
    if (active || browserOptOut) return;
    active = true;
    window['ga-disable-' + measurementId] = false;
    gtag('consent', 'update', {...denied, analytics_storage: 'granted'});
    if (!loaded) {
      loaded = true;
      gtag('js', new Date());
      gtag('config', measurementId, {...page, ...attribution, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_flags: 'SameSite=Lax;Secure', cookie_expires: lifetime / 1000, cookie_update: false});
      gtag('event', 'page_view', {...page, send_to: measurementId});
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
      document.head.appendChild(script);
    }
  }

  function stop() {
    active = false;
    window['ga-disable-' + measurementId] = true;
    gtag('consent', 'update', denied);
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of ['', location.hostname, 'cardiaworld.com']) {
        document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? '; Domain=' + domain : ''}`;
      }
    }
  }

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function button(text, action) {
    const element = node('button', text, 'analytics-button');
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  }
  const banner = node('section', '', 'analytics-choice');
  banner.setAttribute('aria-label', 'Website analytics');
  banner.hidden = true;
  banner.appendChild(node('strong', 'Help us understand what brings you here.'));
  banner.appendChild(node('p', browserOptOut ? 'Analytics are off because of your browser’s privacy setting.' : 'Allow optional Google Analytics cookies to measure visits and App Store button clicks? You can change your choice at any time.'));
  const privacy = node('a', 'Privacy details');
  privacy.href = '/privacy/#website-analytics';
  banner.appendChild(privacy);
  const actions = node('div', '', 'analytics-actions');
  const choices = button('Analytics choices', () => { banner.hidden = false; choices.setAttribute('aria-expanded', 'true'); decline.focus(); });
  choices.className = 'analytics-preferences';
  choices.setAttribute('aria-expanded', 'false');
  function choose(value) {
    try { localStorage.setItem(choiceKey, JSON.stringify({value, updatedAt: Date.now()})); } catch {}
    if (value === 'granted') start(); else stop();
    banner.hidden = true;
    choices.setAttribute('aria-expanded', 'false');
  }
  const decline = button('Decline', () => choose('denied'));
  const accept = button('Allow analytics', () => choose('granted'));
  accept.disabled = browserOptOut;
  actions.appendChild(decline);
  actions.appendChild(accept);
  banner.appendChild(actions);
  document.body.appendChild(banner);
  (document.querySelector('.site-footer nav') || document.querySelector('footer') || document.body).appendChild(choices);

  let saved;
  try {
    const value = JSON.parse(localStorage.getItem(choiceKey));
    const age = Date.now() - value?.updatedAt;
    if (['granted', 'denied'].includes(value?.value) && Number.isFinite(age) && age >= 0 && age < lifetime) saved = value.value;
  } catch {}
  if (browserOptOut) stop();
  else if (saved === 'granted') start();
  else if (!saved) banner.hidden = false;

  document.addEventListener('click', (event) => {
    if (!active) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let destination;
    try { destination = new URL(link.href, location.href); } catch { return; }
    if (destination.protocol !== 'https:' || destination.hostname !== 'apps.apple.com' || !destination.pathname.endsWith('/id6815041207')) return;
    gtag('event', 'app_store_click', {...page, send_to: measurementId, link_url: 'https://apps.apple.com/us/app/cardia-world/id6815041207', website_campaign: campaign});
  });
})();
