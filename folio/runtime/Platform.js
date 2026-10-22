// Where the app is running: in a browser ('web'), or inside the Android or iPhone app
// that Capacitor wraps around the same files.

export class Platform {
  get native() {
    return !!window.Capacitor?.isNativePlatform?.();
  }

  // 'web', 'android' or 'ios'.
  get name() {
    return this.native ? window.Capacitor.getPlatform?.() || 'android' : 'web';
  }

  get online() {
    return navigator.onLine;
  }

  // A Capacitor plugin (e.g. 'LocalNotifications'), or null in the web version or when the
  // plugin isn't installed.
  plugin(name) {
    return window.Capacitor?.Plugins?.[name] ?? null;
  }
}
