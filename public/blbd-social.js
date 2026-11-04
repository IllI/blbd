/* Binds designer-owned beta social buttons. Does not replace forms, intercept
 * password submissions, generate page markup, or store/transfer auth tokens. */
(function () {
  'use strict';
  if (location.origin !== 'https://blbd.webflow.io') return;
  var root = document.querySelector('[data-blbd-social]');
  if (!root) return;
  var buttons = Array.from(root.querySelectorAll('[data-blbd-social-provider]'));
  var status = root.querySelector('[data-blbd-social-status]');
  var app = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';
  var signup = root.getAttribute('data-blbd-social') === 'signup';
  var next = new URLSearchParams(location.search).get('next') || '/dashboard';
  if (!next.startsWith('/') || /^\/[/\\]/.test(next) || /[\x00-\x20\x7f]/.test(next)) next = '/dashboard';
  // The old Webflow User Accounts node is opaque to the headless element API.
  // Keep it intact; move ONLY the new native editable group into its form.
  var input = document.getElementById(signup ? 'wf-sign-up-email' : 'wf-log-in-email');
  var form = input && input.closest('form');
  if (form) {
    var footer = form.querySelector('.w-users-userformfooter');
    form.insertBefore(root, footer || null);
  }
  function state(button, available) {
    button.dataset.blbdSocialReady = available ? 'true' : 'false';
    button.setAttribute('aria-disabled', String(!available));
  }
  buttons.forEach(function (button) {
    var provider = button.getAttribute('data-blbd-social-provider');
    if (provider !== 'google' && provider !== 'yahoo') return;
    var target = new URL('/auth/social', app);
    target.searchParams.set('provider', provider); target.searchParams.set('next', next);
    button.setAttribute('href', target.toString());
    state(button, false);
    button.addEventListener('click', function (event) {
      if (button.dataset.blbdSocialReady !== 'true') {
        event.preventDefault(); status.textContent = 'This sign-in provider still needs beta setup. You can use email and password in the beta portal.'; return;
      }
      var consent = signup && document.getElementById('wf-sign-up-accept-privacy');
      if (consent && !consent.checked) {
        event.preventDefault(); status.textContent = 'Please agree to the privacy policy before signing up.'; consent.focus();
      }
    });
  });
  fetch(app + '/api/auth/providers', { credentials: 'omit' }).then(function (r) {
    if (!r.ok) throw new Error('Provider check failed'); return r.json();
  }).then(function (data) {
    var missing = [];
    buttons.forEach(function (button) {
      var provider = button.getAttribute('data-blbd-social-provider'), ready = data.providers && data.providers[provider] === true;
      state(button, ready); if (!ready) missing.push(provider === 'google' ? 'Google' : 'Yahoo');
    });
    status.textContent = missing.length ? missing.join(' and ') + ' sign-in still needs beta provider setup. Email/password remains available in the beta portal.' : 'Choose Google or Yahoo, or continue with your email and password.';
  }).catch(function () { status.textContent = 'Unable to check social sign-in setup. Please refresh or use email and password in the beta portal.'; });
})();
