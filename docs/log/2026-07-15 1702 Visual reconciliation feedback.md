# 2026-07-15 1702 Visual reconciliation feedback

## TL;DR
- What changed: Recorded user feedback that authoritative reconciliation visibly rotates a die after it
  appears fully stopped; no runtime code changed.
- Why: The authoritative correction is required, but its current presentation can read as an artificial
  face switch.
- What didn't work: Current sequencing waits for stillness, then runs a 300 ms quaternion correction.
- Next: Keep server results authoritative while blending the correction into the last settling motion,
  no later than M9 visual/physics hardening.

---

## Full notes

- The visible physics result must not become official; the Worker-generated result remains the source of
  truth.
- The current client correctly reconciles to that result, but the transition begins after the die meets the
  stillness threshold. If the physical orientation differs, the correction is easy to notice.
- Candidate tuning directions: begin correction while residual motion remains, lengthen/adapt easing based
  on angular distance, preserve plausible yaw, or add a subtle final-settle motion. Any solution must retain
  the tested face mapping and identical final transform across clients.
- User approved the current build otherwise and requested session closeout.
