// Account: sign in with Google, and your settings follow you to every device.
//
// Fills the framework's 'account' slot, so the account button and the menu's Account row open
// a small page to sign in or out. Signed in, every saved setting (every feature's, except the
// areas in sync.js's LOCAL_AREAS) is kept in Firestore at users/{uid}, and this device keeps its
// own copy as before, so the page still works offline and signed out.
//
// On signing in: a new account is given this device's settings; an account that already has
// settings wins, and the page reloads so every feature picks them up. After that, each change is
// sent up a moment after it's made.
//
// Firebase is loaded from Google's servers only once someone signs in (or was signed in last
// time), so visitors who never sign in don't download it. The project is set in config.js.
//
// Saved data: 'signedIn' → true while someone is signed in on this device

import { Feature, ui } from 'folio';
import { firebaseConfig } from './config.js';
import { LOCAL_AREAS, pack, unpack, decide } from './sync.js';

const { el } = ui;
const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const UPLOAD_DELAY = 1500; // ms after the last change before it's sent

export default class Account extends Feature {
  start() {
    this.user = null;
    this.state = 'idle'; // 'idle' | 'busy' | 'saved' | 'error'
    this.page = null;
    this.timer = null;
    this.synced = false; // true once this device and the account agree, so changes can go up
    this.add('account', { name: () => this.name(), open: () => this.open() });
    this.app.storage.watch(() => this.changed());
    window.addEventListener('pagehide', () => this.flush());
    if (firebaseConfig && this.storage.get('signedIn', false)) this.connect().catch((e) => this.fail(e));
  }

  name() {
    return this.user ? (this.user.displayName || this.user.email || 'Signed in') : null;
  }

  // ---- Firebase ----

  // Loads Firebase and finds out who is signed in. Runs once.
  connect() {
    if (!this.ready) {
      this.ready = (async () => {
        const [appSdk, authSdk, db] = await Promise.all(
          ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore-lite.js'].map((f) => import(SDK + f)));
        this.sdk = { ...authSdk, ...db };
        const app = appSdk.initializeApp(firebaseConfig);
        this.auth = authSdk.getAuth(app);
        this.db = db.getFirestore(app);
        await this.auth.authStateReady();
        authSdk.onAuthStateChanged(this.auth, (user) => this.signedInAs(user));
      })();
      this.ready.catch(() => { this.ready = null; });
    }
    return this.ready;
  }

  async signIn() {
    this.setState('busy');
    try {
      await this.connect();
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = this.sdk;
      const provider = new GoogleAuthProvider();
      try {
        await signInWithPopup(this.auth, provider);
      } catch (e) {
        if (e?.code !== 'auth/popup-blocked') throw e;
        this.storage.set('signedIn', true);
        await signInWithRedirect(this.auth, provider); // leaves the page and comes back signed in
      }
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') this.setState('idle');
      else this.fail(e);
    }
  }

  async signOut() {
    await this.flush();
    await this.sdk.signOut(this.auth);
  }

  // Called by Firebase whenever who is signed in changes (and once when it has looked).
  async signedInAs(user) {
    if ((user?.uid ?? null) === (this.user?.uid ?? null) && this.synced) return;
    this.user = user;
    this.synced = false;
    this.storage.set('signedIn', !!user);
    this.setState('idle');
    this.refresh();
    if (user) await this.pull();
  }

  doc() {
    return this.sdk.doc(this.db, 'users', this.user.uid);
  }

  // Compares the account's settings with this device's, then uploads or applies them.
  async pull() {
    this.setState('busy');
    try {
      const snap = await this.sdk.getDoc(this.doc());
      const cloud = snap.exists() ? unpack(snap.data().settings) : null;
      const local = this.app.storage.snapshot(LOCAL_AREAS);
      const step = decide(cloud, local);
      this.synced = true;
      if (step === 'upload') await this.push();
      else if (step === 'apply') {
        this.app.storage.restore(cloud, LOCAL_AREAS);
        location.reload();
      } else this.setState('saved');
    } catch (e) {
      this.fail(e);
    }
  }

  async push() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.user || !this.synced) return;
    this.setState('busy');
    try {
      const settings = pack(this.app.storage.snapshot(LOCAL_AREAS));
      await this.sdk.setDoc(this.doc(), { settings, updated: Date.now() });
      this.setState('saved');
    } catch (e) {
      this.fail(e);
    }
  }

  // Something was saved on this device: send it up shortly (sliders save on every move).
  changed() {
    if (!this.user || !this.synced) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.push(), UPLOAD_DELAY);
  }

  // Sends a waiting change now, e.g. before the page closes.
  flush() {
    return this.timer ? this.push() : Promise.resolve();
  }

  fail(e) {
    console.error(e);
    this.setState('error');
  }

  setState(state) {
    this.state = state;
    if (this.page?.isOpen) this.render();
  }

  // ---- The account page ----

  open() {
    if (!this.page) this.page = ui.dialog({ title: 'Account', size: 'box', className: 'account-page' });
    this.render();
    this.page.open();
  }

  render() {
    const busy = this.state === 'busy';
    if (!firebaseConfig) {
      this.page.setContent(el('p', {}, "Accounts aren't set up yet."));
      return;
    }
    if (!this.user) {
      this.page.setContent(
        el('p', {}, 'Sign in to keep your settings on every device.'),
        this.state === 'error' && el('p', { class: 'account-error' }, "Couldn't sign in. Please try again."),
        el('button', { type: 'button', class: 'btn', disabled: busy, onclick: () => this.signIn() },
          busy ? 'Signing in…' : 'Sign in with Google'));
      return;
    }
    const status = {
      busy: 'Saving…',
      saved: 'Your settings are saved to your account.',
      error: "Couldn't reach your account. Your settings are still saved on this device.",
      idle: '',
    }[this.state];
    this.page.setContent(
      el('div', { class: 'account-who' },
        this.user.photoURL && el('img', { class: 'account-photo', src: this.user.photoURL, alt: '', referrerpolicy: 'no-referrer' }),
        el('div', {}, el('b', {}, this.name()), this.user.email && el('small', {}, this.user.email))),
      status && el('p', { class: this.state === 'error' ? 'account-error' : 'hint' }, status),
      this.state === 'error' && el('button', { type: 'button', class: 'btn', onclick: () => (this.synced ? this.push() : this.pull()) }, 'Try again'),
      el('button', { type: 'button', class: 'btn', disabled: busy, onclick: () => this.signOut().catch((e) => this.fail(e)) }, 'Sign out'));
  }
}
