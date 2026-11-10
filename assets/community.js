(() => {
  'use strict';
  const root = document.querySelector('[data-community]');
  if (!root) return;
  const endpoint = 'https://dvrcmzszdbysscdjnxon.supabase.co/functions/v1/public-community';
  const find = selector => root.querySelector(selector);
  const rows = find('[data-community-rows]');
  const scroll = find('[data-community-scroll]');
  const empty = find('[data-community-empty]');
  const status = find('[data-community-status]');
  const live = find('[data-community-live]');
  const more = find('[data-community-more]');
  const refresh = find('[data-community-refresh]');
  const form = find('[data-community-search]');
  const input = form.querySelector('input');
  const awards = find('[data-community-awards]');
  const week = find('[data-community-week]');
  const number = new Intl.NumberFormat();
  let revision = 0, controller, debounce, page = 0, hasMore = false, busy = false;
  let query = '', displayed = [], lastSuccess = 0;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const validRow = row => row && typeof row.username === 'string' && row.username.length <= 100 &&
    (row.mayorName === null || typeof row.mayorName === 'string') &&
    count(row.rank) && count(row.buildings) && count(row.residents);
  const valid = data => data?.version === 'public-community-v1' &&
    Number.isFinite(Date.parse(data.updatedAt)) && data.totals &&
    ['builders', 'buildings', 'residents'].every(key => count(data.totals[key])) &&
    Array.isArray(data.rows) && data.rows.length <= 25 && data.rows.every(validRow) &&
    count(data.page) && count(data.matched) && typeof data.hasMore === 'boolean' &&
    Array.isArray(data.spotlights?.categories);

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function drawRows(data) {
    const fragment = document.createDocumentFragment();
    for (const item of data) {
      const row = node('tr');
      if (item.rank <= 3) row.dataset.podium = '';
      row.append(node('td', '', String(item.rank)));
      const builder = node('td');
      builder.append(node('span', 'community-builder', '@' + item.username));
      if (item.mayorName) builder.append(node('span', 'community-mayor', 'Mayor ' + item.mayorName));
      row.append(builder, node('td', '', number.format(item.buildings)), node('td', '', number.format(item.residents)));
      fragment.append(row);
    }
    rows.replaceChildren(fragment);
    empty.hidden = data.length > 0;
    empty.textContent = query ? 'No builders found. Try another name.' : 'The first worlds are getting started. Yours could be next.';
  }

  const definitions = [
    {id: 'cozy', label: 'Coziest Town', description: 'A place that feels like home.', path: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7'},
    {id: 'night', label: 'Best Night View', description: 'A world that shines after dark.', path: 'M21 13.5A9 9 0 0 1 10.5 3 9 9 0 1 0 21 13.5Z'},
    {id: 'rising', label: 'Rising Builder', description: 'Small steps. Something wonderful.', path: 'M4 20h16M6 16v-4m6 4V8m6 8V4M5 8l5-4 4 1 5-4'}
  ];

  function drawAwards(data) {
    const fragment = document.createDocumentFragment();
    for (const definition of definitions) {
      const category = data.categories.find(item => item.id === definition.id);
      const card = node('article', 'community-award');
      card.dataset.category = definition.id;
      const mark = node('span', 'community-award-mark');
      mark.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.5');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', definition.path);
      svg.append(path); mark.append(svg); card.append(mark, node('h4', '', definition.label));
      const winner = validRow(category?.winner) ? category.winner : null;
      const leader = validRow(category?.leader) ? category.leader : null;
      if (winner) {
        card.append(node('span', 'community-award-tag', 'Latest winner'), node('p', 'community-award-person', '@' + winner.username));
        const date = dateLabel(winner.week);
        card.append(node('p', '', (date ? 'Week of ' + date + ' · ' : '') + number.format(winner.votes || 0) + ' votes'));
      } else if (leader) {
        card.append(node('span', 'community-award-tag', 'Voting in progress'), node('p', 'community-award-person', '@' + leader.username));
        card.append(node('p', '', (leader.votes > 0 ? 'Current leader · ' + number.format(leader.votes) + ' votes' : 'This week’s contender') + ' · ' + number.format(category.entries || 0) + ' entered'));
      } else {
        card.append(node('span', 'community-award-tag', 'Open this week'), node('p', '', definition.description + ' Enter yours in the app.'));
      }
      fragment.append(card);
    }
    awards.replaceChildren(fragment);
    const close = new Date(data.closesAt);
    week.textContent = Number.isFinite(close.getTime()) ? 'Voting closes ' + close.toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'}) + '. Winners appear here after voting closes.' : 'Winners appear here after voting closes.';
  }

  function dateLabel(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'}) : '';
  }

  function setBusy(value) {
    busy = value;
    root.setAttribute('aria-busy', String(value));
    more.disabled = refresh.disabled = value;
  }

  async function fetchPage(index, requestedQuery, signal) {
    const url = new URL(endpoint);
    url.searchParams.set('page', String(index));
    if (requestedQuery) url.searchParams.set('q', requestedQuery);
    const response = await fetch(url.href, {method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal});
    if (!response.ok) throw Error('Community unavailable');
    const data = await response.json();
    if (!valid(data) || data.page !== index) throw Error('Invalid community response');
    return data;
  }

  async function load(kind = 'refresh') {
    const mine = ++revision;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    const requestedQuery = input.value.trim().toLowerCase().replace(/^@/, '');
    const reset = kind === 'search' || requestedQuery !== query;
    const append = kind === 'more' && !reset;
    const lastPage = reset ? 0 : page;
    const oldScroll = scroll.scrollTop;
    setBusy(true);
    if (!lastSuccess || reset) status.textContent = 'Fetching live rankings…';
    try {
      let data = await fetchPage(append ? page + 1 : 0, requestedQuery, request.signal);
      let nextRows = append ? [...displayed, ...data.rows] : [...data.rows];
      // Refresh all loaded pages together so scrolling does not jump back to page one.
      if (!append) for (let index = 1; index <= lastPage && data.hasMore; index++) {
        data = await fetchPage(index, requestedQuery, request.signal);
        nextRows.push(...data.rows);
      }
      if (mine !== revision) return;
      query = requestedQuery;
      displayed = [...new Map(nextRows.map(item => [item.username.toLowerCase(), item])).values()];
      page = data.page; hasMore = data.hasMore; lastSuccess = Date.now();
      drawRows(displayed);
      scroll.scrollTop = reset ? 0 : oldScroll;
      root.querySelectorAll('[data-community-total]').forEach(element => {
        element.textContent = number.format(data.totals[element.dataset.communityTotal]);
      });
      drawAwards(data.spotlights);
      more.hidden = !hasMore;
      more.textContent = 'Show more builders';
      live.textContent = 'Live'; live.dataset.state = 'live';
      const time = new Date(data.updatedAt).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
      status.textContent = number.format(displayed.length) + ' of ' + number.format(data.matched) + (query ? ' matches' : ' builders') + ' · Updated ' + time;
    } catch {
      if (mine !== revision) return;
      live.textContent = lastSuccess ? 'Needs refresh' : 'Unavailable'; live.dataset.state = 'stale';
      if (reset) { displayed = []; drawRows([]); more.hidden = true; empty.textContent = 'Search could not load. Please try again.'; }
      else if (!lastSuccess) { empty.textContent = 'Live rankings could not load. Tap Refresh to try again.'; }
      status.textContent = lastSuccess && !reset ? 'Could not refresh. Showing the last loaded rankings.' : 'Could not load live rankings. Please try again.';
      if (!lastSuccess) {
        awards.replaceChildren(node('p', 'community-board-note', 'Spotlights could not load. Tap Refresh to try again.'));
      }
      if (append) more.textContent = 'Try loading more';
    } finally {
      clearTimeout(timeout);
      if (mine === revision) setBusy(false);
    }
  }

  function scheduleSearch() {
    clearTimeout(debounce);
    ++revision; controller?.abort(); setBusy(false);
    debounce = setTimeout(() => load('search'), 300);
  }
  input.addEventListener('input', scheduleSearch);
  form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(debounce); load('search'); });
  more.addEventListener('click', () => { if (!busy && hasMore) load('more'); });
  refresh.addEventListener('click', () => { clearTimeout(debounce); load(); });
  // Check again while visible, including after returning from the app.
  const maybeRefresh = () => { if (!document.hidden && !busy && Date.now() - lastSuccess >= 60000) load(); };
  setInterval(maybeRefresh, 60000);
  document.addEventListener('visibilitychange', maybeRefresh);
  load();
})();
