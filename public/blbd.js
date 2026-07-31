/* =====================================================================
 * blbd.js — the BLBD membership layer for Webflow
 * =====================================================================
 *
 * A free, self-hosted replacement for Memberstack. Drop one script tag into
 * Webflow and the site's existing (currently dead) Webflow User Accounts
 * forms start working again, backed by Supabase.
 *
 * Webflow stays in charge of design and content. This script adds behaviour
 * to markup that already exists — it never injects layout of its own except
 * inside containers you explicitly mark.
 *
 * INSTALL — Webflow → Project Settings → Custom Code → Footer Code:
 *
 *   <script defer src="https://app.blbd.life/blbd.js"
 *     data-supabase-url="https://YOUR_PROJECT.supabase.co"
 *     data-supabase-key="YOUR_ANON_KEY"
 *     data-app-url="https://app.blbd.life"></script>
 *
 * The anon key is designed to be public — every row is protected by
 * Postgres row-level security, so the key alone grants nothing.
 *
 * ---------------------------------------------------------------------
 * AUTOMATIC (no attributes needed)
 *   /log-in   — takes over the form with #wf-log-in-email / -password
 *   /sign-up  — takes over #wf-sign-up-email / -name / -password
 *
 * WEBFLOW CUSTOM ATTRIBUTES (Element Settings → Custom attributes)
 *   data-blbd="member-only"        hidden unless signed in
 *   data-blbd="anon-only"          hidden when signed in
 *   data-blbd="logout"             click signs out
 *   data-blbd="comments"           renders the comment thread here
 *   data-blbd-tier="supporter"     needs this tier or higher
 *   data-blbd-field="display_name" replaced with the member's value
 *                                  (display_name | email | membership_tier)
 *   data-blbd-checkout="supporter" click → portal checkout for that tier
 * ---------------------------------------------------------------------
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Config — read off this script's own tag
  // ---------------------------------------------------------------
  var script =
    document.currentScript || document.querySelector('script[src*="blbd.js"]');

  var CFG = {
    supabaseUrl: (script && script.dataset.supabaseUrl) || '',
    supabaseKey: (script && script.dataset.supabaseKey) || '',
    appUrl: (script && script.dataset.appUrl) || 'https://app.blbd.life',
    afterLogin: (script && script.dataset.afterLogin) || '/',
    // Where the auth pages live in Webflow. Override per site with
    // data-signup-path / data-login-path on the script tag.
    signupPath: (script && script.dataset.signupPath) || '/sign-up',
    loginPath: (script && script.dataset.loginPath) || '/log-in',
  };

  if (!CFG.supabaseUrl || !CFG.supabaseKey) {
    console.error('[blbd] Missing data-supabase-url or data-supabase-key on the script tag.');
    return;
  }

  var STORAGE_KEY = 'blbd.session';
  var PAID = ['supporter', 'member', 'founding'];
  var TIER_RANK = { free: 0, supporter: 1, member: 2, founding: 3 };

  // ---------------------------------------------------------------
  // Session store — first-party localStorage on blbd.life.
  // This is why auth lives here and not in a cross-site iframe:
  // no third-party cookie or storage-partition problems.
  // ---------------------------------------------------------------
  var session = null;
  var profile = null;

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function saveSession(s) {
    session = s;
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function api(path, options) {
    options = options || {};
    var headers = Object.assign(
      { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
      options.headers || {}
    );
    if (options.auth !== false && session && session.access_token) {
      headers.Authorization = 'Bearer ' + session.access_token;
    }
    return fetch(CFG.supabaseUrl + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  function expired() {
    return !session || !session.expires_at || Date.now() / 1000 > session.expires_at - 60;
  }

  function refresh() {
    if (!session || !session.refresh_token) return Promise.resolve(null);
    return api('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      auth: false,
      body: { refresh_token: session.refresh_token },
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || !data.access_token) {
          saveSession(null);
          return null;
        }
        saveSession(normalize(data));
        return session;
      })
      .catch(function () {
        return null;
      });
  }

  function normalize(data) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user || null,
    };
  }

  function fetchProfile() {
    if (!session || !session.user) return Promise.resolve(null);
    return api(
      '/rest/v1/profiles?id=eq.' +
        session.user.id +
        '&select=id,display_name,avatar_url,membership_tier,is_admin'
    )
      .then(function (r) {
        return r.ok ? r.json() : [];
      })
      .then(function (rows) {
        profile = (rows && rows[0]) || null;
        return profile;
      })
      .catch(function () {
        return null;
      });
  }

  // ---------------------------------------------------------------
  // Public API — window.BLBD
  // ---------------------------------------------------------------
  var BLBD = {
    get session() {
      return session;
    },
    get profile() {
      return profile;
    },
    isLoggedIn: function () {
      return !!(session && session.user);
    },
    tier: function () {
      return (profile && profile.membership_tier) || 'free';
    },
    hasPaidTier: function () {
      return PAID.indexOf(BLBD.tier()) !== -1;
    },
    login: login,
    signup: signup,
    logout: logout,
    refresh: applyState,
  };
  window.BLBD = BLBD;

  function emit(name) {
    document.dispatchEvent(new CustomEvent(name, { detail: { session: session, profile: profile } }));
  }

  // ---------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------
  function login(email, password) {
    return api('/auth/v1/token?grant_type=password', {
      method: 'POST',
      auth: false,
      body: { email: email, password: password },
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(friendly(data));
        saveSession(normalize(data));
        return fetchProfile().then(function () {
          applyState();
          emit('blbd:login');
          return session;
        });
      });
    });
  }

  function signup(email, password, displayName) {
    return api('/auth/v1/signup', {
      method: 'POST',
      auth: false,
      body: {
        email: email,
        password: password,
        data: { display_name: displayName || '' },
      },
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(friendly(data));
        // With email confirmation on, there's no session yet.
        if (data.access_token) {
          saveSession(normalize(data));
          return fetchProfile().then(function () {
            applyState();
            emit('blbd:login');
            return { confirmed: true };
          });
        }
        return { confirmed: false };
      });
    });
  }

  function logout() {
    var had = !!session;
    return api('/auth/v1/logout', { method: 'POST' })
      .catch(function () {})
      .then(function () {
        saveSession(null);
        profile = null;
        applyState();
        if (had) emit('blbd:logout');
      });
  }

  function friendly(data) {
    var msg = (data && (data.error_description || data.msg || data.message || data.error)) || '';
    if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match an account.';
    if (/already registered|already been registered/i.test(msg)) return 'That email already has an account. Try logging in.';
    if (/password should be at least/i.test(msg)) return 'Password must be at least 6 characters.';
    return msg || 'Something went wrong. Please try again.';
  }

  // ---------------------------------------------------------------
  // Take over the dead auth forms.
  //
  // Three markup conventions are supported, checked in this order:
  //
  //   1. Generic:      form[data-blbd-form="login|signup"] with fields
  //                     carrying data-blbd-input="email|name|password|consent".
  //                     This is the recommended convention when the design
  //                     team is building the page from scratch in Webflow —
  //                     it imposes zero required classes, IDs, or styling.
  //                     Design freely, then tag four elements.
  //   2. Native Webflow: #wf-log-in-email / #wf-sign-up-email (+ -name, -password)
  //   3. Memberstack:    form[data-ms-form="login|signup"] with fields
  //                      carrying data-ms-member="email|name|password"
  //
  // A field resolver is built per form; the submit handler is convention-
  // agnostic from there.
  // ---------------------------------------------------------------
  function wireAuthForms() {
    // 1. Generic data-blbd-form / data-blbd-input — build the page however
    // you like in Webflow, then tag the form and its four fields.
    document.querySelectorAll('form[data-blbd-form]').forEach(function (form) {
      var kind = (form.getAttribute('data-blbd-form') || '').toLowerCase();
      if (kind !== 'login' && kind !== 'signup') return;
      wireForm(form, kind, {
        email: form.querySelector('[data-blbd-input="email"]'),
        name: form.querySelector('[data-blbd-input="name"]'),
        password: form.querySelector('[data-blbd-input="password"]'),
        consent: form.querySelector('[data-blbd-input="consent"]'),
      });
    });

    // 2. Native Webflow User Accounts forms.
    var wfLogin = document.getElementById('wf-log-in-email');
    var wfSignup = document.getElementById('wf-sign-up-email');
    if (wfLogin) {
      wireForm(wfLogin.form, 'login', {
        email: wfLogin,
        password: document.getElementById('wf-log-in-password'),
      });
    }
    if (wfSignup) {
      wireForm(wfSignup.form, 'signup', {
        email: wfSignup,
        name: document.getElementById('wf-sign-up-name'),
        password: document.getElementById('wf-sign-up-password'),
        consent: document.getElementById('wf-sign-up-accept-privacy'),
      });
    }

    // 3. Memberstack-attributed forms (legacy pages still built for it).
    document.querySelectorAll('form[data-ms-form]').forEach(function (form) {
      var type = (form.getAttribute('data-ms-form') || '').toLowerCase();
      var kind = type === 'login' || type === 'signup' ? type : null;
      // Fall back to guessing by which fields exist.
      if (!kind) kind = msField(form, 'name') ? 'signup' : 'login';

      wireForm(form, kind, {
        email: msField(form, 'email') || form.querySelector('input[type="email"]'),
        name: msField(form, 'name'),
        password: msField(form, 'password') || form.querySelector('input[type="password"]'),
        // Terms/consent checkbox — data-ms-member="consent" or a required checkbox.
        consent: msField(form, 'consent') || form.querySelector('input[type="checkbox"][required]'),
      });
    });
  }

  function msField(form, member) {
    return form.querySelector('[data-ms-member="' + member + '"]');
  }

  function wireForm(form, kind, fields) {
    if (!form || form.dataset.blbdWired) return;
    form.dataset.blbdWired = '1';

    // Stop the host framework's own handler from firing.
    form.setAttribute('action', '');
    form.removeAttribute('data-wf-user-form-type');
    form.removeAttribute('data-ms-form');

    var read = function (el) {
      return el ? String(el.value || '').trim() : '';
    };

    form.addEventListener(
      'submit',
      function (event) {
        event.preventDefault();
        event.stopPropagation();

        var button = form.querySelector('[type="submit"], .w-users-userformbutton, .ms-button');
        var original = button ? button.value || button.textContent : '';
        setButton(button, 'Please wait…', true);
        clearMessage(form);

        var done = function (err, note) {
          setButton(button, original, false);
          if (err) showMessage(form, err.message || String(err), 'error');
          else if (note) showMessage(form, note, 'success');
        };

        if (kind === 'login') {
          login(read(fields.email), read(fields.password))
            .then(function () {
              window.location.href = redirectTarget();
            })
            .catch(done);
        } else {
          if (fields.consent && fields.consent.type === 'checkbox' && !fields.consent.checked) {
            return done(new Error('Please accept the terms to continue.'));
          }
          signup(read(fields.email), read(fields.password), read(fields.name))
            .then(function (result) {
              if (result.confirmed) window.location.href = redirectTarget();
              else done(null, 'Check your email to confirm your account, then log in.');
            })
            .catch(done);
        }
      },
      true
    );
  }

  function redirectTarget() {
    var next = new URLSearchParams(location.search).get('next');
    if (next && next.charAt(0) === '/' && next.charAt(1) !== '/') return next;
    return CFG.afterLogin;
  }

  // ---------------------------------------------------------------
  // OAuth (Google, Facebook, …). Supabase's authorize endpoint runs the
  // provider's login, then redirects back here with the session in the URL
  // *fragment* (`#access_token=…`) — never the query string, and never sent
  // to a server. This SDK has no framework to lean on for that, so it's
  // parsed by hand once at boot, before anything else reads `session`.
  // ---------------------------------------------------------------
  function oauthLogin(provider) {
    var redirectTo = location.origin + location.pathname + (location.search || '');
    window.location.href =
      CFG.supabaseUrl +
      '/auth/v1/authorize?provider=' +
      encodeURIComponent(provider) +
      '&redirect_to=' +
      encodeURIComponent(redirectTo);
  }

  function consumeAuthFragment() {
    if (!location.hash || location.hash.length < 2) return Promise.resolve(false);

    var params = new URLSearchParams(location.hash.slice(1));

    // Supabase redirects with #error=…&error_description=… when the
    // provider isn't enabled in the dashboard yet, or the user cancels.
    if (params.get('error')) {
      var message = (params.get('error_description') || params.get('error') || '').replace(/\+/g, ' ');
      history.replaceState(null, '', location.pathname + location.search);
      reportAuthError(message || 'That sign-in method is not available yet.');
      return Promise.resolve(false);
    }

    var accessToken = params.get('access_token');
    if (!accessToken) return Promise.resolve(false);

    var refreshToken = params.get('refresh_token');
    var expiresIn = params.get('expires_in');

    return fetch(CFG.supabaseUrl + '/auth/v1/user', {
      headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + accessToken },
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (user) {
        history.replaceState(null, '', location.pathname + location.search);
        if (!user) return false;
        saveSession({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + (Number(expiresIn) || 3600),
          user: user,
        });
        return true;
      })
      .catch(function () {
        history.replaceState(null, '', location.pathname + location.search);
        return false;
      });
  }

  // Best-effort: there's no guaranteed form on the page you land back on
  // after an OAuth redirect, so this prefers a message slot if one exists.
  function reportAuthError(message) {
    var slot = document.querySelector('[data-blbd-input="message"]');
    if (slot) {
      slot.textContent = message;
      slot.setAttribute('data-blbd-tone', 'error');
      show(slot, true);
    } else {
      window.alert(message);
    }
  }

  function setButton(button, text, disabled) {
    if (!button) return;
    if (button.tagName === 'INPUT') button.value = text;
    else button.textContent = text;
    button.disabled = !!disabled;
  }

  // Prefers a message slot the design team placed themselves
  // (`data-blbd-input="message"`, styled however they like), then falls back
  // to Webflow/Memberstack's own error/success blocks, then a plain injected
  // note as a last resort.
  function showMessage(form, text, tone) {
    var custom = form.querySelector('[data-blbd-input="message"]');
    if (custom) {
      custom.textContent = text;
      custom.setAttribute('data-blbd-tone', tone);
      show(custom, true);
      return;
    }

    var wrap = form.parentElement || form;
    var target =
      wrap.querySelector(
        tone === 'error' ? '.w-users-userformerrorstate, .w-form-fail' : '.w-form-done'
      ) || null;

    if (target) {
      var slot = target.querySelector('div') || target;
      slot.textContent = text;
      target.style.display = 'block';
      return;
    }

    var note = form.querySelector('.blbd-note') || document.createElement('div');
    note.className = 'blbd-note';
    note.setAttribute('role', 'alert');
    note.style.cssText =
      'margin-top:12px;padding:10px 12px;border-radius:8px;font-size:14px;' +
      (tone === 'error'
        ? 'background:#fdecee;color:#99323c;border:1px solid rgba(242,82,96,.3);'
        : 'background:#e8f8f2;color:#0b6b50;border:1px solid rgba(16,185,129,.3);');
    note.textContent = text;
    if (!note.parentElement) form.appendChild(note);
  }

  function clearMessage(form) {
    var custom = form.querySelector('[data-blbd-input="message"]');
    if (custom) show(custom, false);

    var wrap = form.parentElement || form;
    ['.w-users-userformerrorstate', '.w-form-fail', '.w-form-done'].forEach(function (sel) {
      var el = wrap.querySelector(sel);
      if (el) el.style.display = 'none';
    });
    var note = form.querySelector('.blbd-note');
    if (note) note.remove();
  }

  // ---------------------------------------------------------------
  // Gating + personalisation on ordinary Webflow elements
  // ---------------------------------------------------------------
  function applyState() {
    var loggedIn = BLBD.isLoggedIn();

    document.querySelectorAll('[data-blbd]').forEach(function (el) {
      var role = el.getAttribute('data-blbd');
      if (role === 'member-only') show(el, loggedIn);
      else if (role === 'anon-only') show(el, !loggedIn);
    });

    document.querySelectorAll('[data-blbd-tier]').forEach(function (el) {
      var needed = el.getAttribute('data-blbd-tier');
      var ok = loggedIn && TIER_RANK[BLBD.tier()] >= (TIER_RANK[needed] || 0);
      show(el, ok);
    });

    document.querySelectorAll('[data-blbd-field]').forEach(function (el) {
      var field = el.getAttribute('data-blbd-field');
      var value =
        field === 'email'
          ? (session && session.user && session.user.email) || ''
          : (profile && profile[field]) || '';
      if (value) el.textContent = value;
    });

    // Point the (previously dead) nav login link somewhere useful.
    document.querySelectorAll('[data-blbd="account-link"]').forEach(function (el) {
      el.setAttribute('href', loggedIn ? CFG.appUrl + '/dashboard' : CFG.loginPath);
      if (loggedIn) el.textContent = 'Dashboard';
    });

    document.documentElement.setAttribute('data-blbd-auth', loggedIn ? 'member' : 'guest');
    document.documentElement.setAttribute('data-blbd-tier', BLBD.tier());
  }

  function show(el, visible) {
    if (visible) {
      el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
    } else {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  // Create a Stripe Checkout Session server-side and hand off. The member
  // stays on blbd.life (with their localStorage session) right up until the
  // jump to Stripe's hosted page — no bounce through app.blbd.life, where
  // they'd appear logged out.
  function startCheckout(tier, trigger) {
    if (!BLBD.isLoggedIn()) {
      window.location.href = CFG.loginPath + '?next=' + encodeURIComponent(location.pathname);
      return;
    }
    if (trigger) setButton(trigger, 'Starting…', true);

    fetch(CFG.appUrl + '/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ tier: tier, returnTo: location.origin + location.pathname }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok || !d.url) throw new Error(d.error || 'Could not start checkout.');
          window.location.href = d.url;
        });
      })
      .catch(function (err) {
        if (trigger) setButton(trigger, trigger.getAttribute('data-label') || 'Join', false);
        alert(err.message);
      });
  }

  function wireActions() {
    document.addEventListener('click', function (event) {
      var logoutEl = event.target.closest('[data-blbd="logout"]');
      if (logoutEl) {
        event.preventDefault();
        logout().then(function () {
          window.location.href = '/';
        });
        return;
      }

      var checkoutEl = event.target.closest('[data-blbd-checkout]');
      if (checkoutEl) {
        event.preventDefault();
        startCheckout(checkoutEl.getAttribute('data-blbd-checkout'), checkoutEl);
        return;
      }

      // Social login. `data-ms-auth-provider` is Memberstack's convention —
      // recognized as-is so existing Memberstack-template buttons (Google,
      // Facebook) work with zero markup changes. `data-blbd-oauth` is the
      // equivalent for hand-built forms.
      var oauthEl = event.target.closest('[data-ms-auth-provider], [data-blbd-oauth]');
      if (oauthEl) {
        event.preventDefault();
        var provider =
          oauthEl.getAttribute('data-ms-auth-provider') || oauthEl.getAttribute('data-blbd-oauth');
        oauthLogin(provider);
        return;
      }

      // Explicit auth-link attributes.
      var authEl = event.target.closest('[data-blbd="signup"], [data-blbd="login"]');
      if (authEl) {
        event.preventDefault();
        window.location.href =
          authEl.getAttribute('data-blbd') === 'login' ? CFG.loginPath : CFG.signupPath;
        return;
      }

      // Convenience: a "Join"/"Sign up"/"Log in" link the designer left as a
      // bare href="#" placeholder. Rather than force a Designer edit, treat it
      // as intent and route it. Only unlinked anchors are touched, so a real
      // Webflow link is never overridden.
      var dead = event.target.closest('a[href="#"], a[href=""], a:not([href])');
      if (dead && isPlaceholderHref(dead)) {
        var intent = authIntent(dead.textContent || '');
        if (intent) {
          event.preventDefault();
          window.location.href = intent === 'login' ? CFG.loginPath : CFG.signupPath;
        }
      }
    });
  }

  function isPlaceholderHref(a) {
    var href = a.getAttribute('href');
    return href === '#' || href === '' || href === null || /^javascript:/i.test(href || '');
  }

  function authIntent(text) {
    var t = text.trim().toLowerCase();
    if (/\b(log ?in|sign ?in)\b/.test(t)) return 'login';
    if (/\b(join|sign ?up|get started|become a member|register)\b/.test(t)) return 'signup';
    return null;
  }

  // ---------------------------------------------------------------
  // Comments — rendered inline, no iframe.
  // Because the SDK is first-party on blbd.life, the member's token works
  // directly against Supabase and RLS enforces who may post.
  // ---------------------------------------------------------------
  function mountComments() {
    var host = document.querySelector('[data-blbd="comments"]');
    if (!host) return;

    var slug =
      host.getAttribute('data-blbd-slug') ||
      location.pathname.split('/').filter(Boolean).pop() ||
      'home';

    host.innerHTML = '<div class="blbd-c-loading" style="padding:24px 0;color:#69778c;">Loading comments…</div>';
    injectStyles();

    function render(list) {
      var top = list.filter(function (c) {
        return !c.parent_id;
      });
      var repliesOf = function (id) {
        return list.filter(function (c) {
          return c.parent_id === id;
        });
      };

      var html = '<div class="blbd-c">';
      html += '<h3 class="blbd-c-title">' + list.length + (list.length === 1 ? ' comment' : ' comments') + '</h3>';
      html += composerHtml();
      html += '<div class="blbd-c-list">';
      if (!top.length) {
        html += '<p class="blbd-c-empty">Be the first to share a thought.</p>';
      }
      top.forEach(function (c) {
        html += commentHtml(c);
        var replies = repliesOf(c.id);
        if (replies.length) {
          html += '<div class="blbd-c-replies">';
          replies.forEach(function (r) {
            html += commentHtml(r);
          });
          html += '</div>';
        }
      });
      html += '</div></div>';
      host.innerHTML = html;
      wireComposer(host, slug, load);
    }

    function composerHtml() {
      if (!BLBD.isLoggedIn()) {
        return (
          '<div class="blbd-c-gate"><p>Log in to join the conversation.</p>' +
          '<a class="blbd-c-btn" href="/log-in?next=' +
          encodeURIComponent(location.pathname) +
          '">Log in</a> ' +
          '<a class="blbd-c-btn blbd-c-btn--ghost" href="/sign-up">Create account</a></div>'
        );
      }
      if (!BLBD.hasPaidTier()) {
        return (
          '<div class="blbd-c-gate"><p>Commenting is for supporting members.</p>' +
          '<a class="blbd-c-btn" href="' +
          CFG.appUrl +
          '/checkout">See the tiers</a></div>'
        );
      }
      return (
        '<form class="blbd-c-form"><textarea class="blbd-c-input" rows="3" ' +
        'placeholder="Add to the conversation…" maxlength="5000"></textarea>' +
        '<button class="blbd-c-btn" type="submit">Post</button></form>'
      );
    }

    function commentHtml(c) {
      var author = (c.author && c.author.display_name) || 'BLBD member';
      var avatar = c.author && c.author.avatar_url;
      return (
        '<article class="blbd-c-item">' +
        (avatar
          ? '<img class="blbd-c-avatar" src="' + esc(avatar) + '" alt="">'
          : '<span class="blbd-c-avatar blbd-c-avatar--initial">' + esc(author.charAt(0).toUpperCase()) + '</span>') +
        '<div class="blbd-c-body"><div class="blbd-c-head"><strong>' +
        esc(author) +
        '</strong> <time>' +
        relative(c.created_at) +
        (c.is_edited ? ' · edited' : '') +
        '</time></div><div class="blbd-c-text">' +
        esc(c.content) +
        '</div></div></article>'
      );
    }

    function load() {
      var q =
        '/rest/v1/blog_comments?post_slug=eq.' +
        encodeURIComponent(slug) +
        '&select=id,parent_id,content,is_edited,created_at,user_id,author:profiles(display_name,avatar_url,membership_tier)' +
        '&order=created_at.asc';
      api(q)
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(render)
        .catch(function () {
          host.innerHTML = '<p class="blbd-c-empty">Comments are unavailable right now.</p>';
        });
    }

    load();
    document.addEventListener('blbd:login', load);
    document.addEventListener('blbd:logout', load);
  }

  function wireComposer(host, slug, reload) {
    var form = host.querySelector('.blbd-c-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = form.querySelector('.blbd-c-input');
      var text = input.value.trim();
      if (!text) return;

      var button = form.querySelector('button');
      setButton(button, 'Posting…', true);

      api('/rest/v1/blog_comments', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: { post_slug: slug, user_id: session.user.id, content: text },
      })
        .then(function (r) {
          setButton(button, 'Post', false);
          if (!r.ok) {
            return r.json().then(function (d) {
              throw new Error(d.message || 'Could not post that comment.');
            });
          }
          input.value = '';
          reload();
        })
        .catch(function (err) {
          setButton(button, 'Post', false);
          alert(err.message);
        });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function relative(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
  }

  function injectStyles() {
    if (document.getElementById('blbd-c-styles')) return;
    var css = document.createElement('style');
    css.id = 'blbd-c-styles';
    css.textContent = [
      // --- shared widget chrome ---
      '.blbd-w{font-family:inherit;color:#28264d}',
      '.blbd-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}',
      '.blbd-row--between{justify-content:space-between;width:100%}',
      '.blbd-hint{font-size:13px;color:#96a9b3}',
      '.blbd-note{font-size:13px;color:#69778c;margin:4px 2px 0}',
      '.blbd-in{width:100%;padding:10px 12px;border:1px solid #e4e8ed;border-radius:8px;font:inherit;font-size:15px;background:#fff;color:#28264d}',
      '.blbd-in:focus{outline:none;border-color:#6695f2;box-shadow:0 0 0 3px rgba(102,149,242,.18)}',
      '.blbd-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}',
      '.blbd-field>span{font-size:13px;font-weight:600}',
      '.blbd-check{display:flex;gap:9px;align-items:flex-start;margin-bottom:10px;font-size:15px;cursor:pointer}',
      '.blbd-check input{margin-top:3px;accent-color:#48468c}',
      '.blbd-avatar{width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none}',
      '.blbd-avatar--initial{background:#48468c;color:#fff;display:grid;place-items:center;font-weight:700;font-size:20px}',
      '.blbd-avatar-row{display:flex;gap:16px;align-items:center;margin-bottom:20px;flex-wrap:wrap}',
      '.blbd-saved{color:#10b981;font-size:14px;font-weight:600}',
      '.blbd-tier{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;background:rgba(150,169,179,.22);color:#5a6b74}',
      '.blbd-tier--supporter{background:rgba(253,192,103,.28);color:#8a5b10}',
      '.blbd-tier--member{background:rgba(102,149,242,.22);color:#2f4f97}',
      '.blbd-tier--founding{background:rgba(242,167,216,.28);color:#8e3a70}',
      // --- goals ---
      '.blbd-goals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}',
      '@media(max-width:820px){.blbd-goals{grid-template-columns:1fr}}',
      '.blbd-col{border:1px solid #e4e8ed;border-radius:12px;background:#fff;overflow:hidden}',
      '.blbd-col-head{padding:16px 18px;color:#fff}',
      '.blbd-col-head h3{margin:0;font-size:17px}',
      '.blbd-col-head span{font-size:13px;opacity:.92}',
      '.blbd-col--living .blbd-col-head{background:linear-gradient(135deg,#fdc067,#f59e0b);color:#4a2f04}',
      '.blbd-col--dying .blbd-col-head{background:linear-gradient(135deg,#48468c,#28264d)}',
      '.blbd-col-body{padding:14px;display:flex;flex-direction:column;gap:10px}',
      '.blbd-goal{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid #e4e8ed;border-radius:8px}',
      '.blbd-goal.is-done .blbd-goal-title{text-decoration:line-through;color:#96a9b3}',
      '.blbd-goal-main{flex:1;min-width:0}',
      '.blbd-goal-title{font-weight:600;word-break:break-word}',
      '.blbd-goal-desc{font-size:14px;color:#69778c;margin-top:3px;white-space:pre-wrap}',
      '.blbd-goal-meta{font-size:13px;color:#96a9b3;margin-top:6px}',
      '.blbd-goal-tick{flex:none;width:22px;height:22px;margin-top:2px;border:2px solid #e4e8ed;border-radius:50%;background:#fff;cursor:pointer;display:grid;place-items:center;font-size:12px;color:#fff;padding:0}',
      '.blbd-goal.is-done .blbd-goal-tick{background:#10b981;border-color:#10b981}',
      '.blbd-goal-del{background:none;border:none;color:#96a9b3;font-size:20px;line-height:1;cursor:pointer;padding:0 4px}',
      '.blbd-goal-del:hover{color:#f25260}',
      '.blbd-slot{display:flex;align-items:center;gap:10px;width:100%;padding:12px;border:1px dashed #e4e8ed;border-radius:8px;background:none;color:#69778c;font:inherit;font-size:15px;text-align:left;cursor:pointer}',
      '.blbd-slot:hover:not(:disabled){border-color:#6695f2;color:#48468c}',
      '.blbd-slot.is-locked{opacity:.65;cursor:not-allowed}',
      '.blbd-slot-n{flex:none;width:24px;height:24px;border:1px solid #e4e8ed;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700}',
      '.blbd-goal-form{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #6695f2;border-radius:8px}',
      // --- directory ---
      '.blbd-dir{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}',
      '.blbd-dir-card{display:flex;gap:12px;padding:16px;border:1px solid #e4e8ed;border-radius:12px;background:#fff}',
      '.blbd-dir-name{font-weight:700}',
      '.blbd-dir-bio{font-size:14px;color:#69778c;margin:6px 0 0}',
      // --- account ---
      '.blbd-account{padding:18px;border:1px solid #e4e8ed;border-radius:12px;background:#fff}',
      // --- auth form widget ---
      '.blbd-auth{max-width:380px;display:flex;flex-direction:column;gap:14px}',
      '.blbd-auth-msg{font-size:14px}',
      // --- comments ---
      '.blbd-c{font-family:inherit;color:#28264d;max-width:720px}',
      '.blbd-c-title{font-size:18px;margin:0 0 16px}',
      '.blbd-c-list{display:flex;flex-direction:column;gap:18px;margin-top:24px}',
      '.blbd-c-item{display:flex;gap:12px}',
      '.blbd-c-avatar{width:36px;height:36px;border-radius:50%;flex:none;object-fit:cover}',
      '.blbd-c-avatar--initial{background:#48468c;color:#fff;display:grid;place-items:center;font-weight:700}',
      '.blbd-c-body{min-width:0;flex:1}',
      '.blbd-c-head{font-size:14px}.blbd-c-head time{color:#96a9b3;font-size:13px}',
      '.blbd-c-text{margin-top:2px;white-space:pre-wrap;word-break:break-word}',
      '.blbd-c-replies{margin:14px 0 0 20px;padding-left:16px;border-left:2px solid #e4e8ed;display:flex;flex-direction:column;gap:18px}',
      '.blbd-c-form{display:flex;flex-direction:column;gap:10px;align-items:flex-start}',
      '.blbd-c-input{width:100%;padding:10px 12px;border:1px solid #e4e8ed;border-radius:8px;font:inherit;font-size:15px;resize:vertical}',
      '.blbd-c-input:focus{outline:none;border-color:#6695f2;box-shadow:0 0 0 3px rgba(102,149,242,.18)}',
      '.blbd-c-btn{display:inline-block;padding:9px 18px;border:1px solid transparent;border-radius:8px;background:#48468c;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}',
      '.blbd-c-btn:hover{background:#302e59;color:#fff}',
      '.blbd-c-btn--ghost{background:#fff;color:#28264d;border-color:#e4e8ed}',
      '.blbd-c-gate{padding:18px;border:1px solid #e4e8ed;border-radius:12px;background:#fff;text-align:center}',
      '.blbd-c-gate p{margin:0 0 10px;color:#69778c}',
      '.blbd-c-empty{color:#69778c;font-size:15px}',
    ].join('');
    document.head.appendChild(css);
  }

  // ===============================================================
  // MEMBER WIDGETS
  // Everything below renders the member experience *inside* Webflow
  // pages, so nobody ever has to leave blbd.life.
  // ===============================================================

  function gate(message, cta) {
    return (
      '<div class="blbd-c-gate"><p>' +
      esc(message) +
      '</p>' +
      (cta || '<a class="blbd-c-btn" href="/log-in?next=' + encodeURIComponent(location.pathname) + '">Log in</a>') +
      '</div>'
    );
  }

  function rest(path, options) {
    return api('/rest/v1' + path, options);
  }

  // ---------------------------------------------------------------
  // Goals — the 5 Living / 5 Dying board
  //
  // Two rendering modes:
  //   - Templated: the design team builds the card/slot markup themselves in
  //     Webflow (see detectGoalTemplates below) — full control over layout
  //     and style, restyled entirely from the Designer.
  //   - Built-in: a single <div data-blbd="goals"> with no templates inside
  //     gets the pre-styled board below, unchanged from before.
  // ---------------------------------------------------------------
  function mountGoals() {
    var host = document.querySelector('[data-blbd="goals"]');
    if (!host) return;
    injectStyles();

    var templates = detectGoalTemplates(host);
    if (templates) return mountGoalsTemplated(host, templates);

    mountGoalsBuiltin(host);
  }

  /**
   * Looks for design-team-built goal templates inside the host, so the whole
   * board can be restyled in Webflow with zero CSS from this file:
   *
   *   <div data-blbd="goals">
   *     <div data-blbd-list="living">
   *       <div data-blbd-template="goal">           one goal card, hidden and
   *         <div data-blbd-bind="title"></div>       cloned per goal
   *         <div data-blbd-bind="description"></div>
   *         <div data-blbd-bind="target_date"></div>
   *         <div data-blbd-when="is_completed">Done</div>
   *         <button data-blbd-action="toggle">Mark done</button>
   *         <button data-blbd-action="delete">Delete</button>
   *       </div>
   *       <div data-blbd-template="slot">           one empty slot, hidden
   *         <div data-blbd-bind="position"></div>    and cloned per open slot
   *         <button data-blbd-action="add">Add a goal</button>
   *       </div>
   *     </div>
   *     <div data-blbd-list="dying"> ...same shape... </div>
   *   </div>
   *
   * `data-blbd-when` toggles visibility on any truthy goal field; prefix with
   * `!` to invert (`data-blbd-when="!is_completed"`). Falls back to the
   * built-in board when no `data-blbd-template` is present.
   */
  function detectGoalTemplates(host) {
    var lists = [];
    var listEls = host.querySelectorAll('[data-blbd-list]');

    if (listEls.length) {
      listEls.forEach(function (listEl) {
        var goalTemplate = listEl.querySelector('[data-blbd-template="goal"]');
        if (!goalTemplate) return;
        lists.push({
          category: listEl.getAttribute('data-blbd-list'),
          listEl: listEl,
          goalTemplate: goalTemplate,
          slotTemplate: listEl.querySelector('[data-blbd-template="slot"]'),
        });
      });
    } else {
      var soloTemplate = host.querySelector('[data-blbd-template="goal"]');
      if (soloTemplate) {
        lists.push({
          category: host.getAttribute('data-blbd-category') || 'living',
          listEl: host,
          goalTemplate: soloTemplate,
          slotTemplate: host.querySelector('[data-blbd-template="slot"]'),
        });
      }
    }

    return lists.length ? lists : null;
  }

  function mountGoalsTemplated(host, lists) {
    var goals = [];

    function slots() {
      return BLBD.hasPaidTier() ? 5 : 2;
    }

    function load() {
      if (!BLBD.isLoggedIn()) return Promise.resolve([]);
      return rest('/goals?user_id=eq.' + session.user.id + '&select=*&order=position.asc')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (rows) {
          goals = rows || [];
          return goals;
        });
    }

    function refresh() {
      load().then(draw);
    }

    function bindGoalClone(clone, goal) {
      clone.querySelectorAll('[data-blbd-bind]').forEach(function (el) {
        var key = el.getAttribute('data-blbd-bind');
        el.textContent = key === 'position' ? goal.position : goal[key] || '';
      });
      clone.querySelectorAll('[data-blbd-when]').forEach(function (el) {
        var cond = el.getAttribute('data-blbd-when');
        var negate = cond.charAt(0) === '!';
        var truthy = !!goal[negate ? cond.slice(1) : cond];
        show(el, negate ? !truthy : truthy);
      });
      clone.querySelectorAll('[data-blbd-action="toggle"]').forEach(function (el) {
        el.addEventListener('click', function (event) {
          event.preventDefault();
          rest('/goals?id=eq.' + goal.id, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: { is_completed: !goal.is_completed },
          }).then(refresh);
        });
      });
      clone.querySelectorAll('[data-blbd-action="delete"]').forEach(function (el) {
        el.addEventListener('click', function (event) {
          event.preventDefault();
          if (!window.confirm('Delete "' + goal.title + '"?')) return;
          rest('/goals?id=eq.' + goal.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).then(
            refresh
          );
        });
      });
    }

    function bindSlotClone(clone, category, position, locked) {
      clone.querySelectorAll('[data-blbd-bind="position"]').forEach(function (el) {
        el.textContent = position;
      });
      clone.setAttribute('data-blbd-locked', locked ? 'true' : 'false');
      clone.querySelectorAll('[data-blbd-action="add"]').forEach(function (el) {
        if ('disabled' in el) el.disabled = !!locked;
        if (locked) return;
        el.addEventListener('click', function (event) {
          event.preventDefault();
          openInlineAdd(clone, category, position, refresh);
        });
      });
    }

    // The prototypes stay in the DOM as the clone source, always hidden.
    lists.forEach(function (entry) {
      entry.goalTemplate.style.display = 'none';
      if (entry.slotTemplate) entry.slotTemplate.style.display = 'none';
    });

    function draw() {
      lists.forEach(function (entry) {
        entry.listEl.querySelectorAll('[data-blbd-clone]').forEach(function (el) {
          el.remove();
        });

        var mine = goals
          .filter(function (g) {
            return g.category === entry.category;
          })
          .sort(function (a, b) {
            return a.position - b.position;
          });

        var taken = {};
        mine.forEach(function (goal) {
          taken[goal.position] = true;
          var clone = entry.goalTemplate.cloneNode(true);
          clone.removeAttribute('data-blbd-template');
          clone.setAttribute('data-blbd-clone', 'goal');
          clone.style.display = '';
          bindGoalClone(clone, goal);
          entry.listEl.insertBefore(clone, entry.goalTemplate);
        });

        if (entry.slotTemplate) {
          for (var position = 1; position <= 5; position++) {
            if (taken[position]) continue;
            var slotClone = entry.slotTemplate.cloneNode(true);
            slotClone.removeAttribute('data-blbd-template');
            slotClone.setAttribute('data-blbd-clone', 'slot');
            slotClone.style.display = '';
            bindSlotClone(slotClone, entry.category, position, position > slots());
            entry.listEl.appendChild(slotClone);
          }
        }
      });
    }

    refresh();
    document.addEventListener('blbd:login', refresh);
    document.addEventListener('blbd:logout', refresh);
  }

  /** Minimal inline add-goal form, shared by the templated board. */
  function openInlineAdd(anchorEl, category, position, onSaved) {
    var form = document.createElement('form');
    form.className = 'blbd-goal-form';
    form.innerHTML =
      '<input class="blbd-in" name="title" placeholder="What is the goal?" maxlength="200" required>' +
      '<textarea class="blbd-in" name="description" rows="2" placeholder="Why it matters (optional)" maxlength="2000"></textarea>' +
      '<input class="blbd-in" name="target_date" type="date">' +
      '<div class="blbd-row"><button class="blbd-c-btn" type="submit">Save</button>' +
      '<button class="blbd-c-btn blbd-c-btn--ghost" type="button" data-cancel>Cancel</button></div>';
    anchorEl.replaceWith(form);
    form.querySelector('input').focus();

    form.querySelector('[data-cancel]').addEventListener('click', function () {
      onSaved(); // redraw restores the slot in place of this form
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var submit = form.querySelector('[type="submit"]');
      setButton(submit, 'Saving…', true);
      rest('/goals', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: {
          user_id: session.user.id,
          category: category,
          position: position,
          title: form.title.value.trim(),
          description: form.description.value.trim() || null,
          target_date: form.target_date.value || null,
        },
      })
        .then(function (r) {
          if (!r.ok) {
            return r.json().then(function (d) {
              throw new Error(d.message || 'Could not save that goal.');
            });
          }
          onSaved();
        })
        .catch(function (err) {
          setButton(submit, 'Save', false);
          alert(err.message);
        });
    });
  }

  function mountGoalsBuiltin(host) {
    var goals = [];

    function slots() {
      return BLBD.hasPaidTier() ? 5 : 2;
    }

    function load() {
      if (!BLBD.isLoggedIn()) return Promise.resolve([]);
      return rest('/goals?user_id=eq.' + session.user.id + '&select=*&order=position.asc')
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (rows) {
          goals = rows || [];
          return goals;
        });
    }

    function draw() {
      if (!BLBD.isLoggedIn()) {
        host.innerHTML = gate('Log in to set your five goals for living and five for dying.');
        return;
      }

      var html = '<div class="blbd-w blbd-goals">';
      ['living', 'dying'].forEach(function (cat) {
        var mine = goals
          .filter(function (g) {
            return g.category === cat;
          })
          .sort(function (a, b) {
            return a.position - b.position;
          });
        var done = mine.filter(function (g) {
          return g.is_completed;
        }).length;

        html +=
          '<section class="blbd-col blbd-col--' + cat + '">' +
          '<header class="blbd-col-head"><h3>5 Goals for Better ' +
          (cat === 'living' ? 'Living' : 'Dying') +
          '</h3><span>' + done + ' of ' + mine.length + ' complete</span></header>' +
          '<div class="blbd-col-body">';

        var taken = {};
        mine.forEach(function (g) {
          taken[g.position] = true;
          html +=
            '<div class="blbd-goal' + (g.is_completed ? ' is-done' : '') + '" data-id="' + g.id + '">' +
            '<button class="blbd-goal-tick" data-act="toggle" aria-label="Toggle complete">' +
            (g.is_completed ? '✓' : '') + '</button>' +
            '<div class="blbd-goal-main"><div class="blbd-goal-title">' + esc(g.title) + '</div>' +
            (g.description ? '<div class="blbd-goal-desc">' + esc(g.description) + '</div>' : '') +
            (g.target_date ? '<div class="blbd-goal-meta">◷ ' + esc(g.target_date) + '</div>' : '') +
            '</div><button class="blbd-goal-del" data-act="delete" aria-label="Delete">×</button></div>';
        });

        for (var i = 1; i <= 5; i++) {
          if (taken[i]) continue;
          var locked = i > slots();
          html +=
            '<button class="blbd-slot' + (locked ? ' is-locked' : '') + '" data-act="add" ' +
            'data-cat="' + cat + '" data-pos="' + i + '"' + (locked ? ' disabled' : '') + '>' +
            '<span class="blbd-slot-n">' + i + '</span>' +
            (locked ? 'Unlock with a membership' : 'Add a goal') + '</button>';
        }

        if (slots() < 5) {
          html +=
            '<p class="blbd-note">Free members get 2 per list. ' +
            '<a href="/join">Upgrade</a> to open all five.</p>';
        }
        html += '</div></section>';
      });
      html += '</div>';
      host.innerHTML = html;
    }

    host.addEventListener('click', function (event) {
      var addBtn = event.target.closest('[data-act="add"]');
      if (addBtn) return openAdd(addBtn);

      var row = event.target.closest('.blbd-goal');
      if (!row) return;
      var id = row.getAttribute('data-id');

      if (event.target.closest('[data-act="toggle"]')) {
        var goal = goals.filter(function (g) {
          return g.id === id;
        })[0];
        if (!goal) return;
        rest('/goals?id=eq.' + id, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: { is_completed: !goal.is_completed },
        }).then(function () {
          load().then(draw);
        });
      }

      if (event.target.closest('[data-act="delete"]')) {
        if (!confirm('Delete this goal?')) return;
        rest('/goals?id=eq.' + id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).then(
          function () {
            load().then(draw);
          }
        );
      }
    });

    function openAdd(button) {
      var cat = button.getAttribute('data-cat');
      var pos = button.getAttribute('data-pos');
      var form = document.createElement('form');
      form.className = 'blbd-goal-form';
      form.innerHTML =
        '<input class="blbd-in" name="title" placeholder="What is the goal?" maxlength="200" required>' +
        '<textarea class="blbd-in" name="description" rows="2" placeholder="Why it matters (optional)" maxlength="2000"></textarea>' +
        '<input class="blbd-in" name="target_date" type="date">' +
        '<div class="blbd-row"><button class="blbd-c-btn" type="submit">Save</button>' +
        '<button class="blbd-c-btn blbd-c-btn--ghost" type="button" data-cancel>Cancel</button></div>';
      button.replaceWith(form);
      form.querySelector('input').focus();

      form.querySelector('[data-cancel]').addEventListener('click', function () {
        draw();
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var submit = form.querySelector('[type="submit"]');
        setButton(submit, 'Saving…', true);
        rest('/goals', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: {
            user_id: session.user.id,
            category: cat,
            position: Number(pos),
            title: form.title.value.trim(),
            description: form.description.value.trim() || null,
            target_date: form.target_date.value || null,
          },
        })
          .then(function (r) {
            if (!r.ok) {
              return r.json().then(function (d) {
                throw new Error(d.message || 'Could not save that goal.');
              });
            }
            return load().then(draw);
          })
          .catch(function (err) {
            setButton(submit, 'Save', false);
            alert(err.message);
          });
      });
    }

    function refresh() {
      load().then(draw);
    }
    refresh();
    document.addEventListener('blbd:login', refresh);
    document.addEventListener('blbd:logout', refresh);
  }

  // ---------------------------------------------------------------
  // Profile editor
  // ---------------------------------------------------------------
  function mountProfile() {
    var host = document.querySelector('[data-blbd="profile"]');
    if (!host) return;
    injectStyles();

    function draw() {
      if (!BLBD.isLoggedIn()) {
        host.innerHTML = gate('Log in to edit your profile.');
        return;
      }
      var p = profile || {};
      host.innerHTML =
        '<form class="blbd-w blbd-profile">' +
        '<div class="blbd-avatar-row">' +
        (p.avatar_url
          ? '<img class="blbd-avatar" src="' + esc(p.avatar_url) + '" alt="">'
          : '<span class="blbd-avatar blbd-avatar--initial">' +
            esc((p.display_name || '?').charAt(0).toUpperCase()) +
            '</span>') +
        '<div><input type="file" accept="image/*" hidden name="file">' +
        '<button type="button" class="blbd-c-btn blbd-c-btn--ghost" data-pick>Change photo</button>' +
        '<div class="blbd-hint">JPEG, PNG, WebP or GIF · up to 2 MB</div></div></div>' +
        field('display_name', 'Display name', p.display_name) +
        area('bio', 'Bio', p.bio) +
        field('location', 'Location', p.location) +
        field('website', 'Website', p.website) +
        check('is_public', 'Show my profile in the community', p.is_public) +
        check('show_goals_publicly', 'Show my goals on my profile', p.show_goals_publicly) +
        '<div class="blbd-row"><button class="blbd-c-btn" type="submit">Save profile</button>' +
        '<span class="blbd-saved" hidden>Saved ✓</span></div></form>';
      wire();
    }

    function field(name, label, value) {
      return (
        '<label class="blbd-field"><span>' + label + '</span>' +
        '<input class="blbd-in" name="' + name + '" value="' + esc(value || '') + '" maxlength="200"></label>'
      );
    }
    function area(name, label, value) {
      return (
        '<label class="blbd-field"><span>' + label + '</span>' +
        '<textarea class="blbd-in" name="' + name + '" rows="4" maxlength="1000">' +
        esc(value || '') + '</textarea></label>'
      );
    }
    function check(name, label, value) {
      return (
        '<label class="blbd-check"><input type="checkbox" name="' + name + '"' +
        (value ? ' checked' : '') + '><span>' + label + '</span></label>'
      );
    }

    function wire() {
      var form = host.querySelector('form');
      var file = form.file;

      form.querySelector('[data-pick]').addEventListener('click', function () {
        file.click();
      });

      file.addEventListener('change', function () {
        var f = file.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) return alert('That image is over 2 MB.');
        var ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        var path = session.user.id + '/avatar.' + ext;

        fetch(CFG.supabaseUrl + '/storage/v1/object/avatars/' + path, {
          method: 'POST',
          headers: {
            apikey: CFG.supabaseKey,
            Authorization: 'Bearer ' + session.access_token,
            'Content-Type': f.type,
            'x-upsert': 'true',
          },
          body: f,
        })
          .then(function (r) {
            if (!r.ok) throw new Error('Upload failed.');
            var url =
              CFG.supabaseUrl + '/storage/v1/object/public/avatars/' + path + '?v=' + Date.now();
            return rest('/profiles?id=eq.' + session.user.id, {
              method: 'PATCH',
              headers: { Prefer: 'return=minimal' },
              body: { avatar_url: url },
            });
          })
          .then(function () {
            return fetchProfile();
          })
          .then(function () {
            draw();
            applyState();
          })
          .catch(function (err) {
            alert(err.message);
          });
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var submit = form.querySelector('[type="submit"]');
        setButton(submit, 'Saving…', true);
        rest('/profiles?id=eq.' + session.user.id, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: {
            display_name: form.display_name.value.trim() || null,
            bio: form.bio.value.trim() || null,
            location: form.location.value.trim() || null,
            website: form.website.value.trim() || null,
            is_public: form.is_public.checked,
            show_goals_publicly: form.show_goals_publicly.checked,
          },
        })
          .then(function (r) {
            setButton(submit, 'Save profile', false);
            if (!r.ok) throw new Error('Could not save.');
            var saved = form.querySelector('.blbd-saved');
            saved.hidden = false;
            setTimeout(function () {
              saved.hidden = true;
            }, 2500);
            return fetchProfile().then(applyState);
          })
          .catch(function (err) {
            setButton(submit, 'Save profile', false);
            alert(err.message);
          });
      });
    }

    draw();
    document.addEventListener('blbd:login', draw);
    document.addEventListener('blbd:logout', draw);
  }

  // ---------------------------------------------------------------
  // Member directory
  // ---------------------------------------------------------------
  function mountDirectory() {
    var host = document.querySelector('[data-blbd="directory"]');
    if (!host) return;
    injectStyles();

    function draw() {
      if (!BLBD.isLoggedIn()) {
        host.innerHTML = gate('Log in to see the community.');
        return;
      }
      if (!BLBD.hasPaidTier()) {
        host.innerHTML = gate(
          'The member directory is for supporting members.',
          '<a class="blbd-c-btn" href="/join">See the tiers</a>'
        );
        return;
      }
      host.innerHTML = '<p class="blbd-c-empty">Loading members…</p>';
      rest(
        '/profiles?is_public=eq.true&select=id,display_name,avatar_url,membership_tier,location,bio&order=created_at.desc&limit=48'
      )
        .then(function (r) {
          return r.ok ? r.json() : [];
        })
        .then(function (rows) {
          if (!rows.length) {
            host.innerHTML = '<p class="blbd-c-empty">No public profiles yet.</p>';
            return;
          }
          host.innerHTML =
            '<div class="blbd-w blbd-dir">' +
            rows
              .map(function (m) {
                var name = m.display_name || 'BLBD member';
                return (
                  '<article class="blbd-dir-card">' +
                  (m.avatar_url
                    ? '<img class="blbd-avatar" src="' + esc(m.avatar_url) + '" alt="">'
                    : '<span class="blbd-avatar blbd-avatar--initial">' +
                      esc(name.charAt(0).toUpperCase()) + '</span>') +
                  '<div><div class="blbd-dir-name">' + esc(name) + '</div>' +
                  (m.location ? '<div class="blbd-hint">' + esc(m.location) + '</div>' : '') +
                  (m.bio ? '<p class="blbd-dir-bio">' + esc(m.bio) + '</p>' : '') +
                  '</div></article>'
                );
              })
              .join('') +
            '</div>';
        });
    }

    draw();
    document.addEventListener('blbd:login', draw);
    document.addEventListener('blbd:logout', draw);
  }

  // ---------------------------------------------------------------
  // Account / billing summary
  // ---------------------------------------------------------------
  function mountAccount() {
    var host = document.querySelector('[data-blbd="account"]');
    if (!host) return;
    injectStyles();

    function draw() {
      if (!BLBD.isLoggedIn()) {
        host.innerHTML = gate('Log in to manage your membership.');
        return;
      }
      var tier = BLBD.tier();
      host.innerHTML =
        '<div class="blbd-w blbd-account">' +
        '<div class="blbd-row blbd-row--between"><div>' +
        '<div class="blbd-hint">Signed in as</div>' +
        '<strong>' + esc((session.user && session.user.email) || '') + '</strong>' +
        '<div class="blbd-tier blbd-tier--' + tier + '">' + tier + '</div></div>' +
        '<div class="blbd-row">' +
        (tier === 'free'
          ? '<a class="blbd-c-btn" href="/join">Become a member</a>'
          : '<button class="blbd-c-btn blbd-c-btn--ghost" data-billing>Manage billing</button>') +
        '<button class="blbd-c-btn blbd-c-btn--ghost" data-blbd="logout">Log out</button>' +
        '</div></div></div>';

      var billing = host.querySelector('[data-billing]');
      if (billing) {
        billing.addEventListener('click', function () {
          setButton(billing, 'Opening…', true);
          fetch(CFG.appUrl + '/api/stripe/portal', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + session.access_token },
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (d) {
              if (d.url) window.location.href = d.url;
              else {
                setButton(billing, 'Manage billing', false);
                alert(d.error || 'Could not open billing.');
              }
            })
            .catch(function () {
              setButton(billing, 'Manage billing', false);
              alert('Could not open billing.');
            });
        });
      }
    }

    draw();
    document.addEventListener('blbd:login', draw);
    document.addEventListener('blbd:logout', draw);
  }

  // ---------------------------------------------------------------
  // Auth widgets — render a full login/signup form into an empty div, so a
  // Webflow page needs no form-building. Use when the site has no native
  // Webflow/Memberstack auth form to take over.
  //   <div data-blbd="login-form"></div>
  //   <div data-blbd="signup-form"></div>
  // ---------------------------------------------------------------
  function mountAuthWidgets() {
    var loginHost = document.querySelector('[data-blbd="login-form"]');
    var signupHost = document.querySelector('[data-blbd="signup-form"]');
    if (loginHost) renderAuthForm(loginHost, 'login');
    if (signupHost) renderAuthForm(signupHost, 'signup');
  }

  function renderAuthForm(host, kind) {
    injectStyles();
    var isLogin = kind === 'login';

    function draw() {
      if (BLBD.isLoggedIn()) {
        host.innerHTML =
          '<div class="blbd-c-gate"><p>You&rsquo;re signed in.</p>' +
          '<a class="blbd-c-btn" href="' + esc(CFG.afterLogin) + '">Continue</a> ' +
          '<button class="blbd-c-btn blbd-c-btn--ghost" data-blbd="logout">Log out</button></div>';
        return;
      }

      host.innerHTML =
        '<form class="blbd-w blbd-auth">' +
        (isLogin
          ? ''
          : '<label class="blbd-field"><span>Name</span><input class="blbd-in" name="name" autocomplete="name" required></label>') +
        '<label class="blbd-field"><span>Email</span><input class="blbd-in" name="email" type="email" autocomplete="email" required></label>' +
        '<label class="blbd-field"><span>Password</span><input class="blbd-in" name="password" type="password" autocomplete="' +
        (isLogin ? 'current-password' : 'new-password') +
        '" required></label>' +
        '<div class="blbd-auth-msg" role="alert" hidden></div>' +
        '<button class="blbd-c-btn" type="submit">' +
        (isLogin ? 'Log in' : 'Create account') +
        '</button>' +
        '<p class="blbd-hint">' +
        (isLogin
          ? 'New here? <a href="' + esc(CFG.signupPath) + '">Create an account</a>'
          : 'Already a member? <a href="' + esc(CFG.loginPath) + '">Log in</a>') +
        '</p></form>';

      var form = host.querySelector('form');
      var msg = host.querySelector('.blbd-auth-msg');
      var note = function (text, ok) {
        msg.hidden = false;
        msg.textContent = text;
        msg.style.color = ok ? '#0b6b50' : '#99323c';
      };

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        var orig = btn.textContent;
        setButton(btn, 'Please wait…', true);
        msg.hidden = true;

        if (isLogin) {
          login(form.email.value.trim(), form.password.value)
            .then(function () {
              window.location.href = redirectTarget();
            })
            .catch(function (err) {
              setButton(btn, orig, false);
              note(err.message);
            });
        } else {
          signup(form.email.value.trim(), form.password.value, form.name.value.trim())
            .then(function (result) {
              if (result.confirmed) window.location.href = redirectTarget();
              else {
                setButton(btn, orig, false);
                note('Check your email to confirm your account, then log in.', true);
              }
            })
            .catch(function (err) {
              setButton(btn, orig, false);
              note(err.message);
            });
        }
      });
    }

    draw();
    document.addEventListener('blbd:login', draw);
    document.addEventListener('blbd:logout', draw);
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  function start() {
    wireAuthForms();
    wireActions();
    applyState();
    mountComments();
    mountGoals();
    mountProfile();
    mountDirectory();
    mountAccount();
    mountAuthWidgets();
  }

  var ready = consumeAuthFragment().then(function (consumed) {
    if (!consumed) session = loadSession();
    return expired() && session ? refresh() : Promise.resolve(session);
  });

  ready
    .then(function () {
      return BLBD.isLoggedIn() ? fetchProfile() : null;
    })
    .catch(function () {})
    .then(function () {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
      } else {
        start();
      }
    });
})();
