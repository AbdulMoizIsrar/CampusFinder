import { CSS_COLORS, SPECIAL_COLORS, colorToHex } from './colorPalette.js';
import { REPORT_NAME_RE, REGISTRATION_RE, formatRegistration, normalizeName, normalizeWhatsApp } from '/js/reportContact.js';
const $ = id => document.getElementById(id);
const API_BASE = '/api/v1';
const CATEGORIES = ['Electronics', 'Documents', 'Keys', 'Bags', 'Clothing', 'Accessories', 'Other'];
const CATEGORY_ICONS = { Electronics:'⌁', Documents:'▤', Keys:'⚿', Bags:'▢', Clothing:'♧', Accessories:'◇', Other:'✦' };
const state = { user: null, accessToken: '', csrf: '', socket: null, authTab: 'login', page: 'dashboard', browsePage: 1, browsePages: 1, editItem: null, refreshPromise: null, categoryRoom: null };
const html = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const colorName = value => {
  if (!value) return 'Not specified';
  if (value.startsWith('#')) return value.toUpperCase();
  const special = SPECIAL_COLORS.find(c => c.value === value);
  if (special) return special.label;
  return value.replace(/^./, c => c.toUpperCase());
};
const colorSwatch = value => value === 'transparent' ? 'transparent' : value === 'multicolor' ? 'multicolor' : '';
function colorOptions(search = '') {
  const term = search.trim().toLowerCase().replace(/\s+/g,'');
  const opts = [{ value: '', label: 'No color selected' }, ...SPECIAL_COLORS,
    ...Object.entries(CSS_COLORS).map(([value]) => ({value, label: colorName(value)}))];
  const filtered = opts.filter(c => !term || c.value.replace(/\s+/g,'').includes(term) || c.label.toLowerCase().replace(/\s+/g,'').includes(term));
  $('colorList').innerHTML = filtered.length ? filtered.map(c => `<button class="color-option" type="button" role="option" aria-selected="${$('itemColor').value === c.value}" data-color-value="${html(c.value)}"><span class="color-swatch ${colorSwatch(c.value)}" ${colorToHex(c.value) ? `style="background:${colorToHex(c.value)}"` : ''}></span>${html(c.label)}</button>`).join('') : '<span class="status-help">No colors found. Try a custom shade below.</span>';
}
function setSelectedColor(value = '') {
  $('itemColor').value = value;
  $('selectedColorText').textContent = value ? colorName(value) : 'Select a color';
  $('selectedColorSwatch').className = `color-swatch ${colorSwatch(value)}`;
  $('selectedColorSwatch').style.background = colorToHex(value) || '';
  closeColorPicker();
}
function closeColorPicker() {
  $('colorPickerPanel').hidden = true;
  $('colorPickerButton').setAttribute('aria-expanded','false');
}
function toggleColorPicker() {
  const show = $('colorPickerPanel').hidden;
  $('colorPickerPanel').hidden = !show;
  $('colorPickerButton').setAttribute('aria-expanded',String(show));
  if (show) { $('colorSearch').value = ''; colorOptions(); $('colorSearch').focus(); }
}
const pretty = text => String(text || '').replaceAll('_', ' ').replace(/\b\w/g, s => s.toUpperCase());
const date = d => d ? new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' }) : '—';
const relative = d => {
  const delta = Date.now() - new Date(d).getTime();
  if (delta < 60_000) return 'Just now';
  if (delta < 3600_000) return `${Math.floor(delta / 60_000)} min ago`;
  if (delta < 86400_000) return `${Math.floor(delta / 3600_000)} hr ago`;
  return date(d);
};
const isStaff = () => ['moderator', 'admin'].includes(state.user?.role);
function toast(message, error = false) {
  const el = document.createElement('div'); el.className = `toast ${error ? 'error' : ''}`;
  el.innerHTML = `<span class="toast-symbol">${error ? '!' : '✦'}</span><span>${html(message)}</span>`;
  $('toastRoot').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}
function setBusy(button, yes) { if (!button) return; button.disabled = yes; button.dataset.original ||= button.textContent; button.textContent = yes ? 'Please wait...' : button.dataset.original; }
async function fetchJson(url, init = {}, retry = true) {
  const headers = { ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  const response = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (response.status === 401 && retry && state.user && !url.includes('/auth/refresh')) {
    try { await refreshAccess(); return fetchJson(url, init, false); }
    catch { endSession(); throw new Error('Session expired. Please sign in again.'); }
  }
  if (response.status === 204) return {};
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `Request failed (${response.status})`);
  return result;
}
const api = (path, init) => fetchJson(`${API_BASE}${path}`, init);
const post = (path, data) => api(path, { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) });
const patch = (path, data) => api(path, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) });
async function getCsrf() { const r = await api('/auth/csrf'); state.csrf = r.csrfToken; return state.csrf; }
async function refreshAccess() {
  if (state.refreshPromise) return state.refreshPromise;
  state.refreshPromise = (async () => {
    if (!state.csrf) await getCsrf();
    const response = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': state.csrf }, credentials: 'same-origin', body: '{}' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || 'Session expired');
    state.accessToken = payload.accessToken; state.user = payload.user;
    state.socket?.disconnect(); state.socket = null; connectSocket();
    return payload;
  })().finally(() => { state.refreshPromise = null; });
  return state.refreshPromise;
}
function endSession() {
  state.user = null; state.accessToken = '';
  state.socket?.disconnect(); state.socket = null;
  $('appShell').hidden = true; $('authShell').hidden = false;
}
function startSession(payload) {
  state.user = payload.user; state.accessToken = payload.accessToken;
  $('authShell').hidden = true; $('appShell').hidden = false;
  $('profileName').textContent = state.user.name;
  $('profileRole').textContent = pretty(state.user.role);
  const initials = state.user.name.split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase()).join('');
  $('profileInitials').textContent = initials; $('topAvatar').textContent = initials;
  $('manageLabel').hidden = !isStaff(); $('manageNavigation').hidden = !isStaff(); $('adminNav').hidden = state.user.role !== 'admin';
  $('welcomeTitle').textContent = `Welcome back, ${state.user.name.split(' ')[0]} 👋`;
  connectSocket(); showPage('dashboard'); loadNotifications(true);
}
let fallbackPollStarted = false;
function connectSocket() {
  if (!state.accessToken) return;
  if (typeof io !== 'function') {
    // Vercel: use durable MongoDB notifications rather than instance-local socket rooms.
    if (!fallbackPollStarted) {
      fallbackPollStarted = true;
      setInterval(() => {
        if (!state.user || document.hidden) return;
        loadNotifications(true);
        if (state.page === 'browse') loadBrowse();
        if (state.page === 'mine') loadMine();
        if (state.page === 'moderation') loadModeration();
      }, 20_000);
    }
    return;
  }
  state.socket?.disconnect();
  state.socket = io({ auth: { token: state.accessToken }, reconnection: true });
  state.socket.on('connect', () => { if (state.categoryRoom) subscribeCategory(state.categoryRoom); loadNotifications(true); });
  state.socket.on('connect_error', err => console.warn('Realtime connection:', err.message));
  state.socket.on('notification:new', n => {
    toast(n.message); loadNotifications(true);
    if (state.page === 'dashboard') loadDashboard();
  });
  state.socket.on('item:new', () => {
    if (['browse', 'dashboard'].includes(state.page)) loadPageData(state.page);
  });
  state.socket.on('item:deleted', () => { if (state.page === 'browse') loadBrowse(); });
  state.socket.on('claim:new', () => { if (state.page === 'moderation') loadModeration(); if (state.page === 'mine') loadMine(); });
}
function subscribeCategory(category) {
  if (!state.socket?.connected) return;
  if (state.categoryRoom && state.categoryRoom !== category) state.socket.emit('category:subscribe', { category: state.categoryRoom, subscribe: false });
  state.categoryRoom = category;
  if (category) state.socket.emit('category:subscribe', { category, subscribe: true });
}
function setAuthTab(tab) {
  state.authTab = tab; const register = tab === 'register';
  $('registerFields').hidden = !register; $('authName').required = register;
  $('verificationFields').hidden = !register; $('authVerificationCode').required = register;
  $('authTitle').textContent = register ? 'Join your campus community' : 'Welcome back 👋';
  $('authSubtitle').textContent = register ? 'Create your account and help lost things get home.' : 'Sign in to reconnect with your campus community.';
  $('authSubmit').textContent = register ? 'Create account →' : 'Sign in →';
  $('passwordHint').hidden = !register;
  $('authPassword').autocomplete = register ? 'new-password' : 'current-password';
  $('loginTab').classList.toggle('active', !register); $('registerTab').classList.toggle('active', register);
}
async function handleAuth(event) {
  event.preventDefault();
  const button = $('authSubmit'); setBusy(button, true);
  try {
    const payload = { email: $('authEmail').value.trim(), password: $('authPassword').value };
    if (state.authTab === 'register') { payload.name = $('authName').value.trim(); payload.verificationCode = $('authVerificationCode').value.trim(); }
    const result = await post(state.authTab === 'register' ? '/auth/register' : '/auth/login', payload);
    $('authForm').reset(); toast(state.authTab === 'register' ? 'Account created successfully' : 'Signed in successfully'); startSession(result);
  } catch (e) { toast(e.message, true); } finally { setBusy(button, false); }
}
async function sendCodeClick() {
  const email = $('authEmail').value.trim();
  if (!$('authEmail').checkValidity()) return toast('Enter a valid email before requesting a code', true);
  const button = $('sendEmailCode'); setBusy(button, true);
  try { const result = await post('/auth/send-code', { email }); toast(result.message); }
  catch (error) { toast(error.message, true); }
  finally { setBusy(button, false); }
}
function prettifyRegistrationInput(input) {
  const raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  input.value = [raw.slice(0,4), raw.slice(4,7), raw.slice(7)].filter(Boolean).join('-');
}
const pageNames = { dashboard:'Overview', browse:'Explore items', report:'Report an item', mine:'My reports', claims:'My claims', notifications:'Notifications', moderation:'Claim queue', analytics:'Statistics', users:'Manage users' };
function showPage(page) {
  if (state.page === 'report' && page !== 'report') resetReportForm();
  if (!pageNames[page] || ((page === 'moderation' || page === 'analytics') && !isStaff()) || (page === 'users' && state.user.role !== 'admin')) return;
  if (page === 'report' && state.page !== 'report' && !state.editItem) resetReportForm();
  state.page = page; $('breadcrumbCurrent').textContent = pageNames[page];
  document.querySelectorAll('.page-view').forEach(section => { section.hidden = section.id !== `${page}Page`; });
  document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.page === page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadPageData(page);
}
function loadPageData(page) {
  ({ dashboard: loadDashboard, browse: loadBrowse, mine: loadMine, claims: loadMyClaims,
    notifications: () => loadNotifications(false), moderation: loadModeration, analytics: loadAnalytics, users: loadUsers })[page]?.();
}
const empty = (title = 'No items found', message = 'There is nothing here yet. Try a different filter or create a report.') => `<div class="empty-state"><div class="empty-icon">✦</div><h3>${html(title)}</h3><p>${html(message)}</p></div>`;
const categoryClass = c => String(c || 'other').toLowerCase().replace(/[^a-z]/g, '');
function card(item, isMine = false) {
  const owned = isMine || String(item.reporter?._id || item.reporter) === String(state.user?._id);
  const type = item.type || 'lost';
  const icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.Other;
  let actions = '';
  if (owned) {
    actions = `<div class="card-owner-actions"><button class="tiny-btn" data-action="matches" data-id="${html(item._id)}">Matches</button><button class="tiny-btn" data-action="view-claims" data-id="${html(item._id)}">View claims</button>${!['claimed', 'returned'].includes(item.status) ? `<button class="tiny-btn" data-action="edit" data-id="${html(item._id)}">Edit</button>` : ''}${item.status === 'claimed' ? `<button class="tiny-btn" data-action="return" data-id="${html(item._id)}">Mark returned</button>` : ''}<button class="tiny-btn danger" data-action="delete" data-id="${html(item._id)}">Delete</button></div>`;
  }
  return `<article class="item-card"><div class="item-card-banner ${categoryClass(item.category)}">${item.imageUrl ? `<img class="item-photo" src="${html(item.imageUrl)}" alt="${html(item.title)}" loading="lazy">` : `<span class="item-icon">${icon}</span>`}</div><div class="item-card-content"><div class="card-badges"><span class="pill ${html(type)}">${pretty(type)}</span><span class="pill ${html(item.status)}">${pretty(item.status)}</span></div><h3>${html(item.title)}</h3><p class="description">${html(item.description)}</p><div class="card-details">⌖ &nbsp;${html(item.location)}</div><div class="card-details">▦ &nbsp;${date(item.date)} · ${html(item.category)}</div>${item.brand || item.color ? `<div class="card-details">${item.brand ? `Brand: ${html(item.brand)}` : ''}${item.brand && item.color ? ' · ' : ''}${item.color ? `Color: ${html(colorName(item.color))}` : ''}</div>` : ''}${actions}</div><div class="item-card-actions"><span>${relative(item.createdAt)}</span><button data-action="open" data-id="${html(item._id)}">View details →</button></div></article>`;
}
async function loadDashboard() {
  try {
    const [all, mine, claims, notes] = await Promise.all([api('/items?limit=6'), api('/items/mine?limit=1'), api('/claims/mine'), api('/notifications?unread=true')]);
    $('statReports').textContent = mine.total; $('statAll').textContent = all.total;
    $('statClaims').textContent = claims.claims.length; $('statAlerts').textContent = notes.unreadCount;
    $('recentGrid').innerHTML = all.items.length ? all.items.map(i => card(i)).join('') : empty('No reports yet', 'Be the first to share a lost or found item.');
  } catch (error) { toast(error.message, true); }
}
function browseParams() {
  const q = new URLSearchParams({ page: state.browsePage, limit: 9, sort: $('sortFilter').value });
  for (const [id, key] of [['searchInput','q'], ['typeFilter','type'], ['categoryFilter','category'], ['statusFilter','status']]) {
    if ($(id).value.trim()) q.set(key, $(id).value.trim());
  }
  return q.toString();
}
async function loadBrowse() {
  try {
    const result = await api(`/items?${browseParams()}`);
    state.browsePages = result.pages;
    $('browseCount').textContent = `${result.total} item${result.total === 1 ? '' : 's'} found`;
    $('browseGrid').innerHTML = result.items.length ? result.items.map(i => card(i)).join('') : empty('No matching reports', 'Try changing the filters or searching with another word.');
    $('pageIndicator').textContent = `Page ${result.page} of ${result.pages || 1}`;
    $('prevPage').disabled = state.browsePage <= 1; $('nextPage').disabled = state.browsePage >= result.pages;
    subscribeCategory($('categoryFilter').value || null);
  } catch (error) { toast(error.message, true); }
}
async function loadMine() {
  try {
    const res = await api('/items/mine?limit=50');
    $('myGrid').innerHTML = res.items.length ? res.items.map(i => card(i, true)).join('') : empty('No reports yet', 'Your lost and found reports will appear here.');
  } catch (error) { toast(error.message, true); }
}
function claimRow(c, moderation = false) {
  const item = c.item || {};
  return `<div class="data-row"><div class="row-icon">◇</div><div class="row-left" style="flex:1"><strong>${html(item.title || 'Item deleted')} <span class="pill ${html(c.status)}">${pretty(c.status)}</span></strong><p>${moderation ? `Claimant: ${html(c.claimant?.name || 'Unknown')} · ` : ''}${date(c.createdAt)}${moderation ? `<br>Proof: ${html(c.proofText)}` : ` · ${html(item.location || '')}`}</p></div>${moderation && c.status === 'pending' ? `<div class="row-actions"><button class="btn btn-small btn-outline" data-action="decide" data-id="${html(c._id)}" data-status="rejected">Reject</button><button class="btn btn-small btn-primary" data-action="decide" data-id="${html(c._id)}" data-status="approved">Approve</button></div>` : ''}</div>`;
}
async function loadMyClaims() {
  try { const { claims } = await api('/claims/mine'); $('myClaimsList').innerHTML = claims.length ? claims.map(c => claimRow(c)).join('') : empty('No claims submitted', 'Find an item that belongs to you and submit proof of ownership.'); }
  catch (error) { toast(error.message, true); }
}
async function loadNotifications(silent = false) {
  if (!state.user) return;
  try {
    const { items, unreadCount } = await api('/notifications');
    $('navBadge').textContent = unreadCount > 99 ? '99+' : unreadCount; $('navBadge').hidden = unreadCount === 0;
    $('topBadge').hidden = unreadCount === 0;
    if ($('statAlerts')) $('statAlerts').textContent = unreadCount;
    if (!silent) $('notificationList').innerHTML = items.length ? items.map(note => `<div class="data-row note-row ${note.read ? '' : 'unread'}"><div class="row-icon">${note.type === 'match:suggested' ? '⌕' : '♧'}</div><div class="row-left" style="flex:1"><strong>${html(note.message)}</strong><p>${relative(note.createdAt)} · ${pretty(note.type.replace(':', ' '))}</p></div><div class="row-actions">${!note.read ? `<button class="tiny-btn" data-action="read" data-id="${html(note._id)}">Mark read</button>` : ''}${note.itemId ? `<button class="tiny-btn" data-action="open" data-id="${html(note.itemId)}">View item</button>` : ''}</div></div>`).join('') : empty('All caught up!', 'New matches and claim updates will appear here.');
  } catch (error) { if (!silent) toast(error.message, true); }
}
async function loadModeration() {
  if (!isStaff()) return;
  try { const { claims } = await api('/admin/claims'); $('moderationList').innerHTML = claims.length ? claims.map(c => claimRow(c, true)).join('') : empty('No pending claims', 'Nothing needs review right now.'); }
  catch (error) { toast(error.message, true); }
}
function bars(rows) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return rows.length ? rows.map(r => `<div class="bar-row"><span>${html(pretty(r.label || r.date))}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(r.count / max * 100)}%"></div></div><b>${r.count}</b></div>`).join('') : '<p class="muted">No data to show.</p>';
}
async function loadAnalytics() {
  if (!isStaff()) return;
  try {
    const query = '{ itemStats { total byStatus { label count } byCategory { label count } byType { label count } } claimsPerDay(days: 7) { date count } recentClaims(limit: 6) { id status createdAt item { title } claimant { name } } }';
    const response = await fetchJson('/graphql', { method: 'POST', body: JSON.stringify({ query }) });
    if (response.errors?.length) throw new Error(response.errors[0].message);
    const d = response.data;
    $('analyticsContent').innerHTML = `<div class="stat-row"><article class="stat-card"><p>Total reports</p><strong>${d.itemStats.total}</strong></article><article class="stat-card"><p>Open reports</p><strong>${d.itemStats.byStatus.find(r => r.label === 'open')?.count || 0}</strong></article><article class="stat-card"><p>Pending claims</p><strong>${d.itemStats.byStatus.find(r => r.label === 'claim_pending')?.count || 0}</strong></article><article class="stat-card"><p>Returned items</p><strong>${d.itemStats.byStatus.find(r => r.label === 'returned')?.count || 0}</strong></article></div><div class="analytics-grid"><div class="panel"><h3>By category</h3>${bars(d.itemStats.byCategory)}</div><div class="panel"><h3>By status</h3>${bars(d.itemStats.byStatus)}</div><div class="panel"><h3>Claims in the last week</h3>${bars(d.claimsPerDay.map(v => ({label:v.date,count:v.count})))}</div><div class="panel"><h3>Recent claim activity</h3>${d.recentClaims.length ? d.recentClaims.map(c => `<div class="data-row"><div class="row-left"><strong>${html(c.item?.title || 'Deleted item')}</strong><p>${html(c.claimant?.name || 'Unknown')} · ${date(c.createdAt)}</p></div><span class="pill ${html(c.status)}">${pretty(c.status)}</span></div>`).join('') : '<p class="muted">No claims yet.</p>'}</div></div>`;
  } catch (error) { toast(error.message, true); }
}
async function loadUsers() {
  if (state.user?.role !== 'admin') return;
  try {
    const { users } = await api('/admin/users');
    $('userList').classList.add('no-pad');
    $('userList').innerHTML = `<div class="table-wrap"><table class="user-table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Role</th></tr></thead><tbody>${users.map(u => `<tr><td><strong>${html(u.name)}</strong></td><td>${html(u.email)}</td><td>${date(u.createdAt)}</td><td><select class="user-select" data-role-user="${html(u._id)}" ${u._id === state.user._id ? 'disabled' : ''}>${['user', 'moderator', 'admin'].map(role => `<option value="${role}" ${u.role === role ? 'selected' : ''}>${pretty(role)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
  } catch (error) { toast(error.message, true); }
}
function setImagePreview(src = '', objectUrl = false) {
  const preview = $('itemImagePreview');
  if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
  delete preview.dataset.objectUrl;
  preview.hidden = !src;
  if (src) preview.src = src; else preview.removeAttribute('src');
  if (objectUrl) preview.dataset.objectUrl = src;
}
function resetReportForm() {
  state.editItem = null; $('reportForm').reset(); $('reportHeading').textContent = 'Report an item'; $('reportSubmit').textContent = 'Publish report →';
  $('itemDate').value = new Date().toISOString().slice(0, 10);
  setImagePreview();
  setSelectedColor();
  $('reporterName').value = '';
  $('registrationNumber').value = '';
  $('whatsapp').value = '';
  $('shareWhatsappOnMatch').checked = false;
}
async function handleReport(event) {
  event.preventDefault(); const button = $('reportSubmit'); setBusy(button, true);
  try {
    const reporterName = normalizeName($('reporterName').value);
    const registrationNumber = formatRegistration($('registrationNumber').value);
    const whatsappRaw = $('whatsapp').value.trim();
    const whatsapp = whatsappRaw ? normalizeWhatsApp(whatsappRaw) : '';
    if (!REPORT_NAME_RE.test(reporterName)) throw new Error('Name must contain letters and spaces only (2-80 characters)');
    if (!REGISTRATION_RE.test(registrationNumber)) throw new Error('Registration number must look like FA21-BEE-091');
    if (whatsappRaw && !whatsapp) throw new Error('Enter a valid WhatsApp number, e.g. 03001234567');
    if ($('shareWhatsappOnMatch').checked && !whatsapp) throw new Error('Enter WhatsApp before enabling email sharing');
    const form = new FormData(event.currentTarget);
    form.set('reporterName', reporterName);
    form.set('registrationNumber', registrationNumber);
    form.set('whatsapp', whatsapp);
    form.set('shareWhatsappOnMatch', String($('shareWhatsappOnMatch').checked));
    if (!form.get('image')?.size) form.delete('image');
    const editId = state.editItem;
    if (editId) { await patch(`/items/${editId}`, form); toast('Report updated successfully'); }
    else { await post('/items', form); toast('Your report is live! Matching reports are checked automatically.'); }
    resetReportForm(); showPage('mine');
  } catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
}
function modal(body) { $('modalBody').innerHTML = body; $('modalRoot').hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { $('modalRoot').hidden = true; $('modalBody').innerHTML = ''; document.body.style.overflow = ''; }
async function openItem(id) {
  try {
    const { item } = await api(`/items/${id}`);
    const owned = String(item.reporter?._id || item.reporter) === String(state.user._id);
    const claimable = !owned && ['open','claim_pending'].includes(item.status);
    modal(`<div class="card-badges" style="justify-content:flex-start;gap:9px;margin-bottom:13px"><span class="pill ${html(item.type)}">${pretty(item.type)}</span><span class="pill ${html(item.status)}">${pretty(item.status)}</span></div><h2 id="modalTitle">${html(item.title)}</h2><div class="modal-meta"><span>⌖ ${html(item.location)}</span><span>▦ ${date(item.date)}</span><span>✦ ${html(item.category)}</span></div>${item.brand || item.color ? `<p class="status-help">${item.brand ? `Brand: ${html(item.brand)}` : ''}${item.brand && item.color ? ' · ' : ''}${item.color ? `Color: ${html(colorName(item.color))}` : ''}</p>` : ''}${item.imageUrl ? `<img class="modal-item-photo" src="${html(item.imageUrl)}" alt="${html(item.title)}">` : ''}<h4>Item description</h4><p>${html(item.description)}</p><hr class="modal-divider"><p class="status-help">Reported by ${html(item.reporter?.name || 'Campus member')} on ${date(item.createdAt)}.</p>${claimable ? `<form id="claimForm" data-id="${html(item._id)}"><label for="proofText">Proof of ownership</label><textarea id="proofText" name="proofText" required minlength="15" maxlength="1500" rows="4" placeholder="Describe a unique marking, the contents or the exact circumstances that prove this item belongs to you..."></textarea><p class="status-help">This proof is shown only to the reporter and campus moderators.</p><div class="modal-actions"><button class="btn btn-primary" type="submit">Submit claim request →</button></div></form>` : `<div class="modal-actions">${owned ? `<button class="btn btn-primary" data-action="view-claims" data-id="${html(item._id)}">Review claims</button><button class="btn btn-outline" data-action="matches" data-id="${html(item._id)}">See matches</button>` : `<span class="pill ${html(item.status)}">${item.status === 'returned' ? 'Already returned' : 'Not accepting new claims'}</span>`}</div>`}`);
  } catch (error) { toast(error.message, true); }
}
async function showMatches(id) {
  try {
    const { matches } = await api(`/items/${id}/matches`);
    modal(`<h2 id="modalTitle">Possible matches</h2><p>Ranked using description, location, date, brand, color and optional photo similarity. Scores are suggestions, not ownership verification.</p><div>${matches.length ? matches.map(m => `<div class="data-row"><div class="row-icon">⌕</div><div class="row-left" style="flex:1"><strong>${html(m.title)}</strong><p>${html(m.location)} · ${pretty(m.type)}</p></div><div class="row-actions"><span class="pill found">${m.matchScore}% match</span><button class="tiny-btn" data-action="open" data-id="${html(m._id)}">View</button></div></div>`).join('') : empty('No matches yet', 'We will notify you when a likely matching report is submitted.')}</div>`);
  } catch (error) { toast(error.message, true); }
}
async function showItemClaims(id) {
  try {
    const { claims } = await api(`/items/${id}/claims`);
    modal(`<h2 id="modalTitle">Ownership claims</h2><p>Verify unique details before approving. Only one claim can be approved.</p>${claims.length ? claims.map(c => claimRow(c, true)).join('') : empty('No claims yet', 'Claims for this report will show up here.')}`);
  } catch (error) { toast(error.message, true); }
}
async function handleClaim(event) {
  if (event.target.id !== 'claimForm') return;
  event.preventDefault(); const button = event.target.querySelector('[type=submit]'); setBusy(button, true);
  try { await post(`/items/${event.target.dataset.id}/claims`, { proofText: $('proofText').value }); toast('Claim submitted. The reporter will review your proof.'); closeModal(); if (state.page === 'browse') loadBrowse(); }
  catch (error) { toast(error.message, true); } finally { setBusy(button, false); }
}
async function handleAction(button) {
  const action = button.dataset.action, id = button.dataset.id;
  try {
    if (action === 'close-modal') return closeModal();
    if (action === 'open') return openItem(id);
    if (action === 'matches') return showMatches(id);
    if (action === 'view-claims') return showItemClaims(id);
    if (action === 'edit') {
      const { item } = await api(`/items/${id}`);
      state.editItem = id; showPage('report');
      $('reportHeading').textContent = 'Edit your report'; $('reportSubmit').textContent = 'Save changes →';
      for (const name of ['title', 'description', 'category', 'location']) $(`item${name[0].toUpperCase()}${name.slice(1)}`).value = item[name];
      $('itemDate').value = new Date(item.date).toISOString().slice(0, 10);
      $('itemBrand').value = item.brand || '';
      const { details } = await api(`/items/${id}/private`);
      $('reporterName').value = details.reporterName || '';
      $('registrationNumber').value = details.registrationNumber || '';
      $('whatsapp').value = details.whatsapp || '';
      $('shareWhatsappOnMatch').checked = Boolean(details.shareWhatsappOnMatch);
      setSelectedColor(item.color || '');
      document.querySelector(`input[name="type"][value="${item.type}"]`).checked = true;
      setImagePreview(item.imageUrl || '');
      return;
    }
    if (action === 'delete') {
      if (!confirm('Delete this report and all of its claims? This cannot be undone.')) return;
      await api(`/items/${id}`, { method: 'DELETE' }); toast('Report removed'); loadPageData(state.page); return;
    }
    if (action === 'return') {
      if (!confirm('Confirm this item was safely returned to its owner?')) return;
      await patch(`/items/${id}`, { status: 'returned' }); toast('Item marked as returned'); loadPageData(state.page); return;
    }
    if (action === 'decide') {
      const status = button.dataset.status;
      if (!confirm(`Are you sure you want to ${status === 'approved' ? 'approve' : 'reject'} this claim?`)) return;
      await patch(`/claims/${id}`, { status }); toast(`Claim ${status}`); closeModal(); loadPageData(state.page); return;
    }
    if (action === 'read') { await patch(`/notifications/${id}/read`, {}); loadNotifications(false); }
  } catch (error) { toast(error.message, true); }
}
async function init() {
  for (const id of ['categoryFilter', 'itemCategory']) {
    $(id).insertAdjacentHTML('beforeend', CATEGORIES.map(c => `<option value="${html(c)}">${html(c)}</option>`).join(''));
  }
  $('itemDate').max = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  resetReportForm();
  document.querySelectorAll('[data-auth-tab]').forEach(b => b.addEventListener('click', () => setAuthTab(b.dataset.authTab)));
  $('authForm').addEventListener('submit', handleAuth);
  $('sendEmailCode').addEventListener('click', sendCodeClick);
  $('reporterName').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\p{L}\s]/gu, '').replace(/\s{2,}/g, ' '); });
  $('registrationNumber').addEventListener('input', e => prettifyRegistrationInput(e.target));
  $('reportForm').addEventListener('submit', handleReport);
  $('colorPickerButton').addEventListener('click', toggleColorPicker);
  $('colorSearch').addEventListener('input', event => colorOptions(event.target.value));
  $('colorList').addEventListener('click', event => {
    const choice = event.target.closest('[data-color-value]');
    if (choice) setSelectedColor(choice.dataset.colorValue);
  });
  $('applyCustomColor').addEventListener('click', () => setSelectedColor($('colorCustom').value.toLowerCase()));
  document.addEventListener('click', event => { if (!event.target.closest('#colorPicker')) closeColorPicker(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeColorPicker(); });

  $('itemImage').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return setImagePreview();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      event.target.value = '';
      setImagePreview();
      return toast('Choose a JPG, PNG or WebP image under 3 MB', true);
    }
    setImagePreview(URL.createObjectURL(file), true);
  });
  $('filterForm').addEventListener('submit', e => { e.preventDefault(); state.browsePage = 1; loadBrowse(); });
  $('resetFilters').addEventListener('click', () => { $('filterForm').reset(); state.browsePage = 1; loadBrowse(); });
  $('prevPage').addEventListener('click', () => { state.browsePage = Math.max(1, state.browsePage - 1); loadBrowse(); });
  $('nextPage').addEventListener('click', () => { state.browsePage++; loadBrowse(); });
  $('logoutButton').addEventListener('click', async () => {
    try { await api('/auth/logout', { method:'POST', headers: { 'X-CSRF-Token': state.csrf }, body:'{}' }); }
    catch (error) { console.warn('Logout request:', error.message); }
    endSession(); toast('Signed out');
  });
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (action) { event.preventDefault(); handleAction(action); return; }
    const nav = event.target.closest('[data-page]');
    if (nav && state.user) { event.preventDefault(); showPage(nav.dataset.page); }
  });
  document.addEventListener('submit', handleClaim);
  document.addEventListener('change', async event => {
    if (!event.target.matches('[data-role-user]')) return;
    const element = event.target;
    try { await patch(`/admin/users/${element.dataset.roleUser}/role`, { role: element.value }); toast('User role updated'); }
    catch (error) { toast(error.message, true); loadUsers(); }
  });
  $('modalRoot').addEventListener('click', e => { if (e.target === $('modalRoot')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  try {
    await getCsrf();
    try { const payload = await refreshAccess(); startSession(payload); }
    catch { endSession(); }
  } catch (error) { toast('Cannot connect to CampusFinder server. Please reload the page.', true); }
}
init();
