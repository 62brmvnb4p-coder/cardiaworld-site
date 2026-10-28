const menuButton = document.querySelector('[data-menu-button]');
const nav = document.querySelector('[data-nav]');

// Apple campaign attribution uses the provider token generated in App Store Connect.
// Only these public channel labels are forwarded; no cookies or visitor IDs are used.
(() => {
  const params = new URLSearchParams(window.location.search);
  const source = (params.get('from') || params.get('utm_source') || '').toLowerCase();
  const medium = (params.get('utm_medium') || '').toLowerCase();
  const channels = new Set(['tiktok', 'facebook', 'instagram', 'reddit']);
  const paid = new Set(['paid', 'paid_social', 'cpc', 'ppc', 'ads']).has(medium);
  const campaign = channels.has(source) ? `${source}_${paid ? 'paid' : 'organic'}` : 'website';

  document.querySelectorAll('a[href*="apps.apple.com"]').forEach((link) => {
    const destination = new URL(link.href, window.location.href);
    if (destination.hostname !== 'apps.apple.com' || !destination.pathname.endsWith('/id6815041207')) return;
    destination.searchParams.set('pt', '129494535');
    destination.searchParams.set('ct', campaign);
    destination.searchParams.set('mt', '8');
    link.href = destination.href;
  });

  // Retain the channel while someone reads another public marketing page.
  if (!channels.has(source)) return;
  const marketingPages = new Set(['/', '/how-it-works/', '/walking-motivation-app/', '/cardio-motivation-app/', '/build-a-cardio-habit/']);
  document.querySelectorAll('a[href]').forEach((link) => {
    if (link.getAttribute('href').startsWith('#')) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || !marketingPages.has(destination.pathname)) return;
    destination.searchParams.set('from', source);
    destination.searchParams.set('utm_medium', paid ? 'paid_social' : 'organic_social');
    link.href = destination.href;
  });
})();

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    });
  });
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reveals = document.querySelectorAll('.reveal');

if (!reducedMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add('visible'));
}

// Optional website analytics manages consent before loading Google's tag.
const analytics = document.createElement('script');
analytics.src = '/assets/analytics.js?v=20261028-seo';
analytics.async = true;
document.head.appendChild(analytics);

