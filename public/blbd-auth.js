/* Beta-only behavior for designer-owned auth forms. No generated page UI,
 * cross-origin session copying, password fetch, or browser token storage. */
(function () {
  'use strict';
  if (location.origin !== 'https://blbd.webflow.io') return;
  var app = 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app';
  var form = document.querySelector('form[data-wf-user-form-type="login"],form[data-wf-user-form-type="signup"]');
  if (!form || form.dataset.blbdPasswordBound) return;
  var signup = form.getAttribute('data-wf-user-form-type') === 'signup';
  var fields = signup ? {
    email: 'wf-sign-up-email', password: 'wf-sign-up-password', name: 'wf-sign-up-name',
    privacy: 'wf-sign-up-accept-privacy', marketing: 'wf-sign-up-accept-communications',
  } : { email: 'wf-log-in-email', password: 'wf-log-in-password' };
  var inputs = {};
  Object.keys(fields).forEach(function (key) { inputs[key] = document.getElementById(fields[key]); });
  if (!inputs.email || !inputs.password || (signup && (!inputs.name || !inputs.privacy))) return;
  form.dataset.blbdPasswordBound = 'true';
  form.setAttribute('action', app + '/auth/password');
  form.setAttribute('method', 'post');
  form.setAttribute('enctype', 'application/x-www-form-urlencoded');
  form.removeAttribute('data-wf-user-form-redirect');
  Object.keys(inputs).forEach(function (key) {
    var input = inputs[key]; if (!input) return;
    input.setAttribute('name', key);
    if (input.type === 'checkbox') input.setAttribute('value', 'yes');
    // Repair the legacy template's unmatched label targets, preserving its UI.
    var old = key === 'email' ? 'Email' : key === 'password' ? 'Password' : key === 'name' ? 'Name' : null;
    var label = old && form.querySelector('label[for="' + old + '"]');
    if (label) label.setAttribute('for', input.id);
  });
  inputs.password.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  if (signup) {
    inputs.password.setAttribute('minlength', '8'); inputs.name.setAttribute('maxlength', '120');
    if (inputs.marketing) inputs.marketing.removeAttribute('required');
    var privacyLink = inputs.privacy.closest('label').querySelector('a');
    if (privacyLink) privacyLink.setAttribute('href', '/privacy-policy');
  }
  var params = new URLSearchParams(location.search), next = params.get('next') || '/dashboard';
  if (!next.startsWith('/') || /^\/[/\\]/.test(next) || /[\x00-\x20\x7f\\]/.test(next)) next = '/dashboard';
  form.querySelectorAll('a[href="/log-in"],a[href="/sign-up"]').forEach(function (link) {
    link.setAttribute('href', link.getAttribute('href') + '?next=' + encodeURIComponent(next));
  });
  // Hidden transport fields only; all visible UI remains Webflow-owned.
  [['mode', signup ? 'signup' : 'login'], ['next', next]].forEach(function (entry) {
    var input = document.createElement('input'); input.type = 'hidden'; input.name = entry[0]; input.value = entry[1]; form.appendChild(input);
  });
  var wrapper = form.parentElement;
  var error = wrapper.querySelector('[data-wf-user-form-error]');
  var message = error && error.querySelector('.user-form-error-msg');
  var verification = wrapper.querySelector('[data-wf-user-form-verification]');
  var messages = {
    invalid_fields: 'Please enter a valid email and password.',
    signup_fields: 'Enter your name, a password of at least 8 characters, and agree to the privacy policy. Marketing emails are optional.',
    invalid_credentials: 'That email and password combination did not match an account.',
    confirm_email: 'Please confirm your email before logging in. Check your inbox and spam folder.',
    signup_failed: 'We could not create the account. Try again, or log in/reset your password if you already have one.',
    rate_limited: 'Too many attempts. Please wait a while before trying again.',
    unavailable: 'Beta authentication is temporarily unavailable. Please try again later.',
  };
  var status = params.get('auth_status');
  if (status === 'check_email' && signup && verification) {
    form.style.display = 'none'; verification.style.display = 'block';
    verification.setAttribute('role', 'status'); verification.setAttribute('aria-live', 'polite'); verification.focus();
  } else if (messages[status] && error && message) {
    message.textContent = messages[status]; error.style.display = 'block';
    error.setAttribute('role', 'alert'); error.setAttribute('tabindex', '-1'); error.focus();
  }
  // Never send either form to Webflow's discontinued User Accounts handler.
  // Capture wins over the legacy form's bubbling handler; submit() performs a
  // top-level POST and lets Supabase SSR set cookies on the beta portal host.
  var busy = false, submit = form.querySelector('[type="submit"]');
  var original = submit && submit.value;
  form.addEventListener('submit', function (event) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy || !form.reportValidity()) return;
    busy = true;
    if (submit) { submit.disabled = true; submit.value = 'Please wait…'; }
    form.setAttribute('aria-busy', 'true');
    try { HTMLFormElement.prototype.submit.call(form); }
    catch (_) { busy = false; form.removeAttribute('aria-busy'); if (submit) { submit.disabled = false; submit.value = original; } }
  }, true);
  window.addEventListener('pageshow', function () {
    busy = false; form.removeAttribute('aria-busy'); if (submit) { submit.disabled = false; submit.value = original; }
  });
  // Keep the working first-party recovery screen reachable until its native
  // page receives its own verified recovery controller.
  form.querySelectorAll('a[href="/reset-password"]').forEach(function (link) { link.setAttribute('href', app + '/forgot-password'); });
})();
