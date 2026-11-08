// Account: sign in with Google, and your rooms and settings follow you to every device.
//
// Fills the framework's 'account' slot, so the account button and the menu's Account row open
// a small page to sign in or out. Its item also gives the page as sections (`sections()`), so the
// pages feature can show it as a page in the frame; 'account:changed' says when it changed. Signed
// in, every saved setting (every feature's, except the areas in sync.js's LOCAL_AREAS and the
// world itself) is kept in Firestore at users/{uid}, and the world travels as moments: each push
// sends the rows of the moments log since the last one (world/moments.js), as a batch in
// users/{uid}/moments, never the whole world. This device keeps its own copy as before, so the page
// still works offline and signed out.
//
// On signing in: a new account is given this device's settings and its whole world as one first
// batch; an account that already has settings wins, the batches other devices sent since this
// one last looked are taken into the log, and the page reloads so every feature picks them up.
// After that, each change is sent up a moment after it's made.
//
// Firebase is loaded from Google's servers only once someone signs in (or was signed in last
// time), so visitors who never sign in don't download it. The project is set in config.js.
//
// Opening the app can save things before the account is compared (a day's record, a last visit),
// so right after a reload the two copies may differ again. A reload guard stops that becoming a
// loop: within a minute of an automatic reload the page never reloads again, and sends this
// device's copy up instead; the account page says so.
//
// Saved data: 'signedIn' → true while someone is signed in on this device
//             'reloadedAt' → when the page last reloaded itself to apply the account's settings
//             'device' → this device's name among the account's, 'sent' → the log seq last sent,
//             'pulledAt' → the time of the last batch taken from the account

import { Feature, ui } from 'folio';
import { firebaseConfig } from './config.js';
import { LOCAL_AREAS, pack, unpack, decide, reloadedRecently, settingsOf, incoming, batchesOf } from './sync.js';

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
    this.guarded = false; // true when the reload guard sent this device's copy up instead of reloading
    this.add('account', { name: () => this.name(), open: () => this.open(), sections: () => this.sections() });
    this.moments = this.use('traumerei')?.connect(this).moments || null; // the moments table: the world travels as its rows
    if (!this.storage.get('device')) this.storage.set('device', Math.random().toString(36).slice(2, 10));
    this.app.storage.watch(() => this.changed());
    this.listenTo(window, 'pagehide', () => this.flush());
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
  batches() {
    return this.sdk.collection(this.db, 'users', this.user.uid, 'moments');
  }
  get device() { return this.storage.get('device'); }

  // Compares the account's settings with this device's and takes in the moments other devices
  // sent since this one last looked; then uploads, or applies and reloads.
  async pull() {
    this.setState('busy');
    try {
      const snap = await this.sdk.getDoc(this.doc());
      const cloud = snap.exists() ? settingsOf(unpack(snap.data().settings) || {}) : null; // (an account from before the moments log may still hold the world: not taken)
      const local = settingsOf(this.app.storage.snapshot(LOCAL_AREAS));
      const justReloaded = reloadedRecently(this.storage.get('reloadedAt', null), Date.now());
      const step = decide(cloud, local, justReloaded);
      this.synced = true;
      if (cloud == null) { // a new account: this device's settings, and its whole world as the first batch
        this.storage.set('sent', 0);
        await this.push(this.moments?.outbox(null) || []);
        return;
      }
      const landed = await this.take();
      if (step === 'upload') {
        this.guarded = justReloaded;
        await this.push();
      } else if (step === 'apply' || landed) {
        if (step === 'apply') this.app.storage.restore(cloud, LOCAL_AREAS.concat(['world']));
        this.storage.set('reloadedAt', Date.now());
        location.reload();
      } else {
        await this.push(); // whatever this device did while away
      }
    } catch (e) {
      this.fail(e);
    }
  }

  // Takes in the batches other devices sent since this one last looked. True when rows landed.
  async take() {
    const { query, where, getDocs } = this.sdk;
    const since = this.storage.get('pulledAt', 0);
    const found = await getDocs(query(this.batches(), where('at', '>', since)));
    const batches = incoming(found.docs.map((d) => d.data()), since, this.device);
    let landed = 0;
    for (const b of batches) landed += this.moments?.absorb(b.rows).landed || 0;
    const last = Math.max(since, ...found.docs.map((d) => d.data()?.at || 0));
    this.storage.set('pulledAt', last);
    this.storage.set('sent', this.moments?.seq() || 0); // what landed is the account's already
    return landed > 0;
  }

  // Sends this device's settings and the moments since the last push (or `rows`, given).
  async push(rows = null) {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.user || !this.synced) return;
    this.setState('busy');
    try {
      const settings = pack(settingsOf(this.app.storage.snapshot(LOCAL_AREAS)));
      await this.sdk.setDoc(this.doc(), { settings, updated: Date.now() });
      const seq = this.moments?.seq() || 0;
      const out = rows || this.moments?.outbox(this.storage.get('sent', 0)) || [];
      for (const b of batchesOf(out, this.device)) await this.sdk.addDoc(this.batches(), b);
      this.storage.set('sent', seq);
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
    this.emit('account:changed');
  }

  // ---- The account page ----

  open() {
    if (!this.page) this.page = ui.dialog({ title: 'Account', className: 'account-page' });
    this.render();
    this.page.open();
  }

  // The page in two sections, each { id, title, icon, body (nodes) }: Sign in (who, and the
  // button to sign in or out) and Saving (where the rooms and settings are kept, and how it went).
  sections() {
    const busy = this.state === 'busy';
    const kv = (label, value) => el('div', { class: 'kv' }, el('span', {}, label), el('span', {}, value));
    if (!firebaseConfig) return [{ id: 'account-sign-in', title: 'Sign in', icon: 'account', body: [el('p', {}, "Accounts aren't set up yet.")] }];
    if (!this.user) {
      return [
        { id: 'account-sign-in', title: 'Sign in', icon: 'account', body: [
          kv('Signed in', 'No'),
          el('p', { class: 'hint' }, 'Sign in to keep your rooms and settings on every device.'),
          this.state === 'error' && el('p', { class: 'account-error' }, "Couldn't sign in. Please try again."),
          el('div', {}, el('button', { type: 'button', class: 'btn', disabled: busy, onclick: () => this.signIn() },
            busy ? 'Signing in…' : 'Sign in with Google'))].filter(Boolean) },
        { id: 'account-saving', title: 'Saving', icon: 'refresh', body: [kv('Saved on', 'This device only')] },
      ];
    }
    const status = {
      busy: 'Saving…',
      saved: 'Your rooms and settings are saved to your account.',
      error: "Couldn't reach your account. Your rooms and settings are still saved on this device.",
      idle: '',
    }[this.state];
    return [
      { id: 'account-sign-in', title: 'Signed in', icon: 'account', body: [
        el('div', { class: 'account-who' },
          this.user.photoURL && el('img', { class: 'account-photo', src: this.user.photoURL, alt: '', referrerpolicy: 'no-referrer' }),
          el('div', {}, el('b', {}, this.name()), this.user.email && el('small', {}, this.user.email))),
        el('div', {}, el('button', { type: 'button', class: 'btn', disabled: busy, onclick: () => this.signOut().catch((e) => this.fail(e)) }, 'Sign out'))] },
      { id: 'account-saving', title: 'Saving', icon: 'refresh', body: [
        kv('Saved on', 'Your account and this device'),
        status && el('p', { class: this.state === 'error' ? 'account-error' : 'hint' }, status),
        this.guarded && el('p', { class: 'hint' },
          "The page had just reloaded with your account's rooms and settings, so instead of reloading again it sent this device's copy up."),
        this.state === 'error' && el('div', {}, el('button', { type: 'button', class: 'btn', onclick: () => (this.synced ? this.push() : this.pull()) }, 'Try again'))].filter(Boolean) },
    ];
  }

  // The small page (Folio's window), when no page in the frame shows it: the sections one under
  // another.
  render() {
    this.page.setContent(...this.sections().flatMap((s) => s.body));
  }
}
