/* Registration template: replace the two public placeholders when registering
 * a version. ASSET_ORIGIN must be an immutable beta Vercel deployment URL. */
(function () {
  if (location.origin !== 'https://blbd.webflow.io') return;
  var origin = '__ASSET_ORIGIN__';
  var sdk = document.createElement('script');
  sdk.src = origin + '/blbd.js';
  Object.assign(sdk.dataset, {
    supabaseUrl: 'https://hfmjvbjyectxiszutwen.supabase.co',
    supabaseKey: '__PUBLIC_ANON_KEY__',
    appUrl: 'https://blbd-git-feat-admin-portal-illi1s-projects.vercel.app',
    nativePortal: 'true', loginPath: '/log-in', signupPath: '/sign-up',
    membersPath: '/members/dashboard', afterLogin: '/members/dashboard',
    memberPaths: '/members/dashboard,/members/goals,/members/profile,/members/member,/members/community,/members/settings,/members/checkout,/admin/portal,/admin/accounts,/admin/newsletter'
  });
  function failed() {
    var status = document.querySelector('[data-blbdp-status], [data-blbd-status]');
    if (status) status.textContent = 'Unable to load the beta services. Please refresh or try again later.';
  }
  sdk.onerror = failed;
  sdk.onload = function () {
    var controller = document.createElement('script');
    controller.src = origin + '/blbd-portal.js'; controller.onerror = failed;
    document.body.appendChild(controller);
  };
  document.body.appendChild(sdk);
})();
