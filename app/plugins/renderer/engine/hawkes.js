// S1, the timing shared by every mode's spontaneity: a Hawkes process with an exponential kernel,
//   λ(t) = μ + Σ_{tᵢ < t} (n / τ_h) e^(−(t − tᵢ)/τ_h),
// simulated exactly by Ogata's thinning. n is the branching ratio (each event has n offspring on
// average, so the mean rate is μ / (1 − n)); n = 0 is a Poisson process.
//
//   const h = new Hawkes(stream(seed, ':<mode>:time'));
//   h.advance(t, { mu, nH, tauH }, (tc, parent) => record); // calls back once per event up to t, in order
//
// Each accepted event is an immigrant with probability μ / λ, or else the offspring of an earlier
// event j with probability ∝ (n / τ_h) e^(−(t − t_j)/τ_h); the callback gets that event's record (or
// null) and returns the new event's record, which can then be a parent. A candidate time that is drawn
// but not yet reached is kept, so the events up to t never depend on how the calls fell.
// Draw order per candidate: the waiting time, the thinning uniform, then (if accepted) the parent pick.

export class Hawkes {
  constructor(rng) {
    this.rng = rng;
    this.s = 0; // simulated up to s
    this.E = 0; // the excitation Σ (n / τ_h) e^(−(s − tᵢ)/τ_h)
    this.next = null; // a candidate time already drawn, with the bound it was drawn under
    this.recent = []; // { t, rec } of events still able to be parents
  }

  advance(t, { mu, nH, tauH }, born) {
    const n = Math.min(nH, 0.95);
    for (;;) {
      if (!this.next) {
        const bound = mu + this.E;
        if (!(bound > 0)) break;
        this.next = { t: this.s - Math.log(1 - this.rng.U()) / bound, bound };
      }
      if (this.next.t > t) break;
      const { t: tc, bound } = this.next;
      this.next = null;
      this.E *= Math.exp(-(tc - this.s) / tauH);
      this.s = tc;
      const lambda = mu + this.E;
      if (this.rng.U() * bound > lambda) continue; // thinned
      let parent = null;
      let pick = this.rng.U() * lambda - mu;
      if (pick >= 0) {
        for (const r of this.recent) {
          pick -= (n / tauH) * Math.exp(-(tc - r.t) / tauH);
          parent = r.rec;
          if (pick < 0) break;
        }
      }
      const rec = born(tc, parent);
      this.E += n / tauH;
      this.recent.push({ t: tc, rec });
    }
    this.recent = this.recent.filter((r) => this.s - r.t < 20 * tauH);
  }
}
