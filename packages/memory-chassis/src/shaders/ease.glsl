// Standard back-out, GSAP s = 1.70158. Analytic — no LUT on GPU.
float backOut(float p) {
  if (p <= 0.0) return 0.0;
  if (p >= 1.0) return 1.0;
  const float s = 1.70158;
  float q = p - 1.0;
  return q * q * ((s + 1.0) * q + s) + 1.0;
}

// Cahn-Hilliard spinodal (custom ease, g = separation gain)
float spinodal(float p, float g) {
  float lo = 1.0 / (1.0 + exp(g));
  float hi = 1.0 / (1.0 + exp(-g));
  return (1.0 / (1.0 + exp(-g * (2.0 * p - 1.0))) - lo) / (hi - lo);
}
