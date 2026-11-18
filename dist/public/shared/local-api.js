// Keep browser game API requests on the local HTTP server during development.
(() => {
  const host = window.location.hostname;
  if (window.location.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(host)) return;

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...options) {
    if (typeof url === 'string') {
      const target = URL.canParse(url, window.location.href) && new URL(url, window.location.href);
      if (target && target.hostname === `api.${host}` && /^\/(web-api|game-api)\//.test(target.pathname)) {
        url = window.location.origin + target.pathname + target.search;
      }
    }
    return originalOpen.call(this, method, url, ...options);
  };

  // Use the game's existing Ignore action for the fictitious local session.
  const params = new URLSearchParams(window.location.search);
  if (params.get('localDemo') !== '1' || params.get('t') !== 'local-demo-token') return;

  const observer = new MutationObserver(() => {
    const ignore = [...document.querySelectorAll('button, [role="button"], div, span')].find(element =>
      element.childElementCount === 0 && /^(Ignorar|Ignore)$/.test(element.textContent.trim()) &&
      element.getClientRects().length > 0
    );
    if (!ignore) return;

    observer.disconnect();
    ignore.click();
  });
  observer.observe(document.documentElement, {childList: true, subtree: true});
})();
