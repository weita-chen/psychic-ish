/* Installability only. Never intercept fetches and never claim open pages —
   claiming during first load freezes taps on mobile WebViews. */
self.addEventListener("install", () => {
  self.skipWaiting();
});
