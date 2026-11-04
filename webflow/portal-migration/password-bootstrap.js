/* Register as a separate inline loader on the two beta auth pages only. */
(function () {
  if (location.origin !== 'https://blbd.webflow.io' || !/^\/(log-in|sign-up)\/?$/.test(location.pathname)) return;
  var script = document.createElement('script');
  script.src = 'https://blbd-idskqr2bb-illi1s-projects.vercel.app/blbd-auth.js';
  script.integrity = 'sha256-VM/+QTyQGqi+gzrHn0j7+na+UdMUewZf8ULllaj+v5E=';
  script.crossOrigin = 'anonymous';
  document.body.appendChild(script);
})();
