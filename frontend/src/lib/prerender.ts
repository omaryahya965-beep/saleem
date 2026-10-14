// Removes the build-time prerendered snapshot (#prerender) as soon as the SPA has rendered real
// page content into <main>. MutationObserver callbacks run before the next paint, so the swap
// never shows both versions or an empty frame.
const markReady = () => document.documentElement.setAttribute("data-app-ready", "");

export function handOffPrerender() {
  const snapshot = document.getElementById("prerender");
  const root = document.getElementById("root");
  if (!snapshot || !root) {
    markReady();
    return;
  }
  const done = () => {
    if (root.querySelector("main#main > *")) {
      snapshot.remove();
      observer.disconnect();
      markReady();
      return true;
    }
    return false;
  };
  const observer = new MutationObserver(() => void done());
  observer.observe(root, { childList: true, subtree: true });
  // Safety net: never leave a stale snapshot around.
  setTimeout(() => {
    snapshot.remove();
    observer.disconnect();
    markReady();
  }, 10_000);
}
