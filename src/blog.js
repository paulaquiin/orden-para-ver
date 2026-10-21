import './main.js';
import './style.css';
import './blog.css';

const status = document.getElementById('blog-navigation-status');
const main = document.getElementById('blog-main');

function clearLoading() {
  if (status) status.hidden = true;
  main?.removeAttribute('aria-busy');
}

window.addEventListener('pageshow', clearLoading);
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const target = new URL(link.href, location.href);
  if (target.origin === location.origin && target.pathname.startsWith('/blog') && target.href !== location.href && !target.hash) {
    if (status) status.hidden = false;
    main?.setAttribute('aria-busy', 'true');
    // Also recover when the browser cancels a navigation.
    setTimeout(clearLoading, 15_000);
  }
});
