(function () {
  if (location.origin !== 'https://blbd.webflow.io') return;
  var script = document.createElement('script');
  script.src = 'https://blbd-2y5wswke8-illi1s-projects.vercel.app/blbd-social.js';
  script.integrity = 'sha256-Quj+jGjTtGNH7rxzBecMfR4HreW4kietGfT/ENz3+so=';
  script.crossOrigin = 'anonymous';
  document.body.appendChild(script);
})();
