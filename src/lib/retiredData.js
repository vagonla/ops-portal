// Remove only retired tracking/account metadata. Shift files, preferences and
// the existing ops-tracked-friends-v1 list must remain on the device.
export function clearRetiredData(browser = window) {
  const keys = ['ops-analytics-visitor-v1', 'ops-analytics-session-v1', 'vardiya-pending-invite'];
  for (const kind of ['localStorage', 'sessionStorage']) {
    for (const key of keys) {
      try { browser[kind].removeItem(key); } catch { /* Storage may be disabled. */ }
    }
  }
  for (const name of ['ops_analytics_visitor', 'ops_analytics_session']) {
    try { browser.document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${browser.location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* Best effort. */ }
  }
  try {
    const request = browser.indexedDB.deleteDatabase('ops-analytics-v1');
    request.onerror = () => {}; // A later page load retries if an old tab holds it open.
  } catch { /* IndexedDB may be disabled. */ }
}
