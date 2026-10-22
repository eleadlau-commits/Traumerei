// Downloading text from another website.
//
// In the Android (or iPhone) app the phone downloads it itself, through Capacitor's CapacitorHttp
// plugin called directly, so websites that don't let web pages read them (CORS) still work. In
// the web version it's an ordinary fetch. Only these downloads go through the phone: everything
// else (such as Firebase) uses the web view's own connection, which CapacitorHttp would break
// if it were switched on for the whole app.
//
// Throws an Error with .status for an HTTP error (404, 403 …), or another Error if it couldn't
// connect at all.

export async function getText(url, platform) {
  const http = platform?.native ? platform.plugin('CapacitorHttp') : null;
  if (http) {
    const res = await http.request({ url, method: 'GET', responseType: 'text', headers: { 'Cache-Control': 'no-cache' } });
    if (res.status >= 400) throw Object.assign(new Error('http'), { status: res.status });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw Object.assign(new Error('http'), { status: res.status });
  return res.text();
}
