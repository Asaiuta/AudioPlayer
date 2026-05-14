export const EFFECTS_API_ROUTES = {
  setEq: { method: "POST", path: "/set_eq" },
  setEqType: { method: "POST", path: "/set_eq_type" },
  configureOptimizations: { method: "POST", path: "/configure_optimizations" },
  getCrossfeed: { method: "GET", path: "/crossfeed" },
  setCrossfeed: { method: "POST", path: "/set_crossfeed" },
  getSaturation: { method: "GET", path: "/saturation" },
  setSaturation: { method: "POST", path: "/set_saturation" },
  getDynamicLoudness: { method: "GET", path: "/dynamic_loudness" },
  setDynamicLoudness: { method: "POST", path: "/set_dynamic_loudness" },
  getNoiseShaperCurve: { method: "GET", path: "/noise_shaper_curve" },
  setNoiseShaperCurve: { method: "POST", path: "/set_noise_shaper_curve" },
  configureOutputBits: { method: "POST", path: "/configure_output_bits" }
} as const;

export type EffectsApiMethod = keyof typeof EFFECTS_API_ROUTES;
export type EffectsApiRoute = (typeof EFFECTS_API_ROUTES)[EffectsApiMethod];
