/* Native Webflow portal controllers. All layout and repeated-item markup is
 * designer-owned; this file only binds behavior, text, and template clones.
 * Requires blbd.js with data-native-portal="true". Beta rollout only. */
(function () {
  'use strict';
  var root = document.querySelector('[data-blbd-page]');
  var sdk = window.BLBD;
  if (!root || !sdk || !sdk.ready) return;
  var page = root.getAttribute('data-blbd-page');
  var templates = {}, busy = false, sending = false, stop = false;
  var data, activeId = null, approvedId = null, selected = new Set(), groupId = '';
  var accountPage = 1, accountData, contactOffset = 0, contactSearch = '', controlId = 0;
  var status = root.querySelector('[data-blbdp-status], [data-blbd-status]');
  var privateArea = root.querySelector('[data-blbdp-private]');
  function all(selector, node) { return Array.from((node || root).querySelectorAll(selector)); }
  function field(name, node) { return (node || root).querySelector('[data-blbdp-field="' + name + '"]'); }
  function text(name, value, node) { all('[data-blbdp-bind="' + name + '"]', node).forEach(function (el) { el.textContent = String(value == null ? '' : value); }); }
  function visible(el, yes) { if (el) { el.hidden = !yes; el.style.display = yes ? '' : 'none'; } }
  function notice(message) { if (status) status.textContent = message; }
  function lock(el, value) {
    el.dataset.blbdpLocked = value ? 'true' : ''; el.disabled = busy || value;
    el.setAttribute('aria-disabled', String(el.disabled));
    if (el.tagName === 'A') { el.setAttribute('role', 'button'); el.tabIndex = el.disabled ? -1 : 0; }
  }
  function nativeControls(node) {
    all('input, textarea, select', node).forEach(function (el) {
      el.id = 'blbdp-' + page + '-' + (++controlId);
      var label = el.closest('label') || el.parentNode.querySelector('label');
      if (label) label.setAttribute('for', el.id);
      var limit = { subject: 200, body: 50000, 'display-name': 100, 'group-name': 100 }[el.getAttribute('data-blbdp-field')];
      if (limit) el.maxLength = limit;
    });
  }
  function controls() {
    all('button, input, textarea, select, [data-blbdp-action]').forEach(function (el) {
      el.disabled = busy || el.dataset.blbdpLocked === 'true';
      if (el.getAttribute('data-blbdp-action') === 'pause') { el.disabled = !sending; visible(el, sending); }
      // Webflow's native Button is an anchor. Keep its designer-owned node,
      // and supply button semantics, keyboard behavior and disabled state.
      if (el.tagName === 'A') { el.setAttribute('role', 'button'); el.tabIndex = el.disabled ? -1 : 0; }
      el.setAttribute('aria-disabled', String(el.disabled));
    });
    root.setAttribute('aria-busy', String(busy));
  }
  function deny(message) { stop = true; visible(privateArea, false); notice(message); }
  async function json(response) {
    var payload;
    try { payload = await response.json(); } catch (_) { throw new Error('The service did not return a valid response. Please retry.'); }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) deny(payload.error || 'Sign in with a verified administrator account.');
      throw new Error(payload.error || 'Request failed. Please retry.');
    }
    return payload;
  }
  function service(path, body, method) { return sdk.serviceRequest(path, { method: method || (body ? 'POST' : 'GET'), body: body }).then(json); }
  function post(input) { return service('/api/admin/mail', input); }
  async function run(action) {
    if (busy) return;
    busy = true; controls(); notice('Working…');
    try { await action(); } catch (error) { notice(error.message || 'Request failed. Please retry.'); }
    finally { busy = false; controls(); }
  }
  function capture() {
    all('[data-blbdp-template], [data-blbd-template^="dashboard-"]').forEach(function (node) {
      var name = node.getAttribute('data-blbdp-template') || node.getAttribute('data-blbd-template');
      templates[name] = { node: node, parent: node.parentNode };
      node.remove();
    });
  }
  function render(name, rows, draw) {
    var template = templates[name];
    if (!template) throw new Error('A designer template is missing: ' + name);
    all('[data-blbdp-instance="' + name + '"]', template.parent).forEach(function (node) { node.remove(); });
    rows.forEach(function (row) {
      var node = template.node.cloneNode(true);
      node.removeAttribute('data-blbdp-template'); node.removeAttribute('data-blbd-template');
      node.setAttribute('data-blbdp-instance', name);
      // Avoid duplicate designer DOM IDs when cloning repeated controls.
      if (node.id) node.removeAttribute('id');
      all('[id]', node).forEach(function (child) { child.removeAttribute('id'); });
      nativeControls(node); draw(node, row); template.parent.appendChild(node);
    });
  }
  function panel(name) {
    all('[data-blbdp-panel]').forEach(function (el) { visible(el, el.getAttribute('data-blbdp-panel') === name); });
    all('[data-blbdp-action="compose"], [data-blbdp-action="drafts"], [data-blbdp-action="contacts"]').forEach(function (el) { el.setAttribute('aria-pressed', String(el.getAttribute('data-blbdp-action') === name)); });
  }
  function active() { return data && data.campaigns.find(function (c) { return c.id === activeId; }); }
  function audience() {
    var radio = all('[data-blbdp-field="audience"]').find(function (el) { return el.checked; });
    var kind = radio ? radio.getAttribute('data-blbdp-value') : 'subscribers';
    if (kind === 'individuals') return { kind: kind, emails: Array.from(selected) };
    if (kind === 'group') return { kind: kind, groupId: groupId };
    return { kind: kind };
  }
  function setAudience(kind) { all('[data-blbdp-field="audience"]').forEach(function (el) { el.checked = el.getAttribute('data-blbdp-value') === kind; }); }
  function audienceLabel(a) {
    if (a.kind === 'individuals') return 'Selected individuals: ' + a.emails.join(', ');
    if (a.kind === 'group') { var group = data.groups.find(function (g) { return g.id === a.groupId; }); return 'Group: ' + (group ? group.name : 'Saved group'); }
    return { all: 'Everyone in beta', members: 'Verified beta members', subscribers: 'Confirmed beta subscribers' }[a.kind];
  }
  function selection() {
    text('selected-count', selected.size + ' contacts selected');
    all('[data-blbdp-when]').forEach(function (el) { visible(el, el.getAttribute('data-blbdp-when') === audience().kind); });
    var group = data && data.groups.find(function (g) { return g.id === groupId; });
    text('selected-group', group ? group.name + ' · ' + group.emails.length + ' contacts' : 'No group selected. Choose a group in Contacts & groups.');
  }
  function review() {
    var c = active(), el = root.querySelector('[data-blbdp-review]');
    visible(el, !!c); if (!c) return;
    text('review-subject', c.subject); text('review-body', c.body);
    text('review-audience', audienceLabel(c.audience) + ' · ' + c.recipient_count + ' recipients');
    text('test-state', c.tested_at ? '✓ Test sent — check your inbox before approving' : 'First, send yourself a test');
    text('delivery', c.accepted + ' accepted by provider · ' + c.skipped + ' skipped · ' + c.pending + ' remaining. Accepted does not mean delivered or opened.');
    var complete = c.status === 'complete';
    var blockers = complete ? ['Send complete. This campaign will not resend.'] : data.mail.sendBlockers.slice();
    if (!complete && !c.tested_at) blockers.push('Send yourself a successful test before sending to the audience.');
    text('send-blockers', blockers.join(' ') || 'Ready: check the approval box to send to this reviewed audience.');
    var send = root.querySelector('[data-blbdp-action="send"]');
    send.textContent = (c.status === 'sending' ? 'Resume send to ' : 'Send to ') + c.recipient_count + ' recipients';
    lock(send, complete || !data.mail.canSend || !c.tested_at || approvedId !== c.id);
    var test = root.querySelector('[data-blbdp-action="test"]');
    test.textContent = c.tested_at ? 'Send another test to myself' : 'Send test to myself';
    lock(test, complete || !data.mail.canTest);
    if (!data.mail.canTest && !complete) text('send-blockers', blockers.concat(data.mail.testBlockers).join(' '));
    field('approve').checked = approvedId === c.id;
    lock(field('approve'), complete || !data.mail.canSend || !c.tested_at);
  }
  function drawMail() {
    render('campaign', data.campaigns, function (node, c) {
      node.dataset.blbdpId = c.id; text('subject', c.subject, node);
      text('campaign-state', (c.status === 'complete' ? 'Sent' : c.status === 'sending' ? 'Send started' : c.tested_at ? 'Test sent' : 'Draft') + ' · ' + new Date(c.created_at).toLocaleString(), node);
      node.setAttribute('aria-pressed', String(c.id === activeId));
    });
    visible(root.querySelector('[data-blbdp-empty="campaigns"]'), !data.campaigns.length);
    render('contact', data.contacts, function (node, c) {
      text('email', c.email, node); text('contact-state', (c.member ? 'Member ' : '') + (c.subscriber ? 'Subscriber ' : '') + (c.opted_out ? 'Opted out' : ''), node);
      var checkbox = field('contact', node); checkbox.dataset.blbdpEmail = c.email; checkbox.checked = selected.has(c.email); lock(checkbox, c.opted_out);
    });
    visible(root.querySelector('[data-blbdp-empty="contacts"]'), !data.contacts.length);
    render('group', data.groups, function (node, g) { node.dataset.blbdpId = g.id; text('name', g.name, node); text('group-count', g.emails.length + ' contacts → Write update', node); });
    lock(root.querySelector('[data-blbdp-action="contacts-previous"]'), contactOffset === 0);
    lock(root.querySelector('[data-blbdp-action="contacts-next"]'), data.contacts.length < 100);
    selection(); review(); controls();
  }
  async function loadMail() {
    data = await service('/api/admin/mail?q=' + encodeURIComponent(contactSearch) + '&offset=' + contactOffset);
    if (!activeId && data.campaigns.length) activeId = data.campaigns[0].id;
    drawMail(); visible(privateArea, true);
  }
  async function loadAccounts(pageNumber) {
    accountData = await service('/api/admin/accounts?page=' + pageNumber); accountPage = accountData.page;
    drawAccounts(); visible(privateArea, true);
  }
  function drawAccounts() {
    var filter = field('account-filter').value.toLowerCase();
    var rows = accountData.accounts.filter(function (a) { return (a.email + ' ' + (a.display_name || '')).toLowerCase().indexOf(filter) !== -1; });
    render('account', rows, function (node, a) {
      node.dataset.blbdpId = a.id; text('email', a.email, node);
      text('account-state', (a.verified ? 'Verified' : 'Email not verified') + ' · Membership: ' + a.membership_tier, node);
      field('display-name', node).value = a.display_name || '';
      field('is-admin', node).checked = a.is_admin; lock(field('is-admin', node), !a.verified);
    });
    text('page', 'Page ' + accountPage); visible(root.querySelector('[data-blbdp-empty="accounts"]'), !rows.length);
    lock(root.querySelector('[data-blbdp-action="accounts-previous"]'), accountPage <= 1);
    lock(root.querySelector('[data-blbdp-action="accounts-next"]'), !accountData.hasMore); controls();
  }
  async function dashboard() {
    var id = encodeURIComponent(sdk.session.user.id);
    var results = await Promise.all([
      sdk.request('/rest/v1/goals?user_id=eq.' + id + '&select=*&order=position').then(json),
      sdk.request('/rest/v1/blog_comments?user_id=eq.' + id + '&select=content,post_slug&order=created_at.desc&limit=5').then(json),
    ]);
    var goals = results[0], comments = results[1];
    ['living', 'dying'].forEach(function (category) {
      var rows = goals.filter(function (g) { return g.category === category; });
      root.querySelector('[data-blbd-dashboard="' + category + '-count"]').textContent = rows.length;
      root.querySelector('[data-blbd-dashboard="' + category + '-completed"]').textContent = rows.filter(function (g) { return g.is_completed; }).length + ' complete';
    });
    render('dashboard-goal', goals.slice(0, 6), function (node, g) {
      ['title', 'description'].forEach(function (key) { node.querySelector('[data-blbd-bind="' + key + '"]').textContent = g[key] || ''; });
      node.querySelector('[data-blbd-bind="status"]').textContent = g.is_completed ? 'Complete' : 'In progress';
    });
    render('dashboard-comment', comments, function (node, c) {
      node.querySelector('[data-blbd-bind="content"]').textContent = c.content;
      node.querySelector('[data-blbd-bind="post-link"]').setAttribute('href', '/blog-posts/' + encodeURIComponent(c.post_slug));
    });
    visible(root.querySelector('[data-blbd-empty="goals"]'), !goals.length);
    visible(root.querySelector('[data-blbd-empty="comments"]'), !comments.length);
    notice('Your beta dashboard is up to date.');
  }
  async function action(name, trigger) {
    if (['compose', 'drafts', 'contacts'].indexOf(name) !== -1) { panel(name); notice(''); return; }
    if (name === 'reload') { await loadMail(); notice('Email workspace refreshed.'); return; }
    if (name === 'open-campaign') { activeId = trigger.dataset.blbdpId; approvedId = null; drawMail(); notice('Review this saved email, then test and approve it.'); return; }
    if (name === 'prepare') {
      var a = audience(), count = await post({ action: 'preview', audience: a });
      if (!count.count) throw new Error('No eligible recipients. Choose verified members or confirmed subscribers who have not opted out.');
      var saved = await post({ action: 'prepare', subject: field('subject').value, body: field('body').value, audience: a });
      activeId = saved.id; approvedId = null; await loadMail(); panel('drafts'); notice('Draft saved. Send yourself a test, then approve sending below.'); return;
    }
    if (name === 'test') { await post({ action: 'test', id: activeId }); approvedId = null; await loadMail(); notice('Test sent to your signed-in inbox. No audience emails sent.'); return; }
    if (name === 'copy') {
      if ((field('subject').value.trim() || field('body').value.trim()) && !window.confirm('Replace the unsaved text with a copy? The saved original will not change.')) return;
      var c = active(); field('subject').value = c.subject; field('body').value = c.body; setAudience(c.audience.kind);
      selected = new Set(c.audience.kind === 'individuals' ? c.audience.emails : []); groupId = c.audience.groupId || '';
      approvedId = null; selection(); panel('compose'); notice('New copy. Save and test it again before sending.'); return;
    }
    if (name === 'send') {
      var campaign = active();
      if (!campaign || approvedId !== campaign.id || !campaign.tested_at || !data.mail.canSend || campaign.status === 'complete') return;
      sending = true; stop = false; controls();
      try {
        var complete = false;
        while (!complete && !stop) { var result = await post({ action: 'send', id: campaign.id, confirmCount: campaign.recipient_count }); complete = result.complete; await loadMail(); }
        notice(complete ? 'Send complete. Accepted means the email provider accepted the messages, not confirmed delivery.' : 'Paused after the current batch. Resume this same campaign to avoid duplicates.');
      } finally { sending = false; approvedId = null; review(); }
      return;
    }
    if (name === 'search') { contactSearch = field('search').value.trim(); contactOffset = 0; await loadMail(); notice('Search complete.'); return; }
    if (name === 'contacts-next' || name === 'contacts-previous') { contactOffset = Math.max(0, contactOffset + (name === 'contacts-next' ? 100 : -100)); await loadMail(); notice('Contacts loaded.'); return; }
    if (name === 'clear-selection') { selected.clear(); drawMail(); return; }
    if (name === 'use-contacts') { setAudience('individuals'); selection(); panel('compose'); return; }
    if (name === 'use-group') { groupId = trigger.dataset.blbdpId; setAudience('group'); selection(); panel('compose'); return; }
    if (name === 'save-group') { var group = await post({ action: 'group', name: field('group-name').value, emails: Array.from(selected) }); await loadMail(); groupId = group.group.id; setAudience('group'); selection(); panel('compose'); notice('Group saved and selected for this update.'); return; }
    if (name === 'accounts-next' || name === 'accounts-previous') { await loadAccounts(accountPage + (name === 'accounts-next' ? 1 : -1)); notice('Accounts loaded.'); return; }
    if (name === 'save-account') {
      var row = trigger.closest('[data-blbdp-instance="account"]'), account = accountData.accounts.find(function (a) { return a.id === row.dataset.blbdpId; });
      if (!window.confirm('Save ' + account.email + '? Administrator access will be ' + (field('is-admin', row).checked ? 'enabled' : 'disabled') + '.')) return;
      await service('/api/admin/accounts', { id: account.id, display_name: field('display-name', row).value, is_admin: field('is-admin', row).checked }, 'PATCH');
      await loadAccounts(accountPage); notice('Account saved.');
    }
  }
  visible(privateArea, false);
  capture();
  nativeControls(root);
  // Native Form elements are required by Webflow for editable input controls.
  // These forms use our services, never Webflow's email/collection handler.
  root.addEventListener('submit', function (event) { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  root.addEventListener('keydown', function (event) { var el = event.target.closest('a[data-blbdp-action]'); if (el && event.key === ' ') { event.preventDefault(); if (!el.disabled) el.click(); } });
  document.addEventListener('blbd:logout', function () { deny('Signed out. Sign in to continue.'); });
  window.addEventListener('pagehide', function () { stop = true; });
  root.addEventListener('click', function (event) {
    var button = event.target.closest('[data-blbdp-action]');
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    if (button.getAttribute('data-blbdp-action') === 'pause') { stop = true; notice('Pausing after the current batch…'); return; }
    if (!button.disabled) run(function () { return action(button.getAttribute('data-blbdp-action'), button); });
  });
  root.addEventListener('change', function (event) {
    if (busy) return;
    var el = event.target, name = el.getAttribute('data-blbdp-field');
    if (name === 'approve') { approvedId = el.checked && active() ? activeId : null; review(); }
    if (name === 'contact') { if (el.checked) selected.add(el.dataset.blbdpEmail); else selected.delete(el.dataset.blbdpEmail); selection(); }
    if (name === 'audience') { setAudience(el.getAttribute('data-blbdp-value')); selection(); }
    if (name === 'is-admin' && accountData) {
      var row = el.closest('[data-blbdp-instance="account"]');
      var account = row && accountData.accounts.find(function (a) { return a.id === row.dataset.blbdpId; });
      if (account) account.is_admin = el.checked;
    }
  });
  root.addEventListener('input', function (event) {
    if (!accountData) return;
    var el = event.target;
    if (el === field('account-filter')) drawAccounts();
    if (el.getAttribute('data-blbdp-field') === 'display-name') {
      var row = el.closest('[data-blbdp-instance="account"]');
      var account = row && accountData.accounts.find(function (a) { return a.id === row.dataset.blbdpId; });
      if (account) account.display_name = el.value;
    }
  });
  sdk.ready.then(function () {
    all('[data-blbd-access="admin"]').forEach(function (el) { visible(el, !!(sdk.profile && sdk.profile.is_admin)); });
    if (!sdk.isLoggedIn()) { deny('Sign in to continue.'); return; }
    return run(async function () {
      if (page === 'dashboard') { await dashboard(); return; }
      if (page === 'accounts') await loadAccounts(1);
      else if (page === 'newsletter') { await loadMail(); panel('drafts'); }
      else if (page === 'admin') { await service('/api/admin/accounts?page=1'); visible(privateArea, true); }
      notice('Connected to the isolated beta environment.');
    });
  }).catch(function () { deny('Unable to initialize your session. Sign in again or retry.'); });
})();
