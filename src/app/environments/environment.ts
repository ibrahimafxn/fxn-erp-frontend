export const environment = {
  production: false,
  apiBaseUrl: '/api', // passe par le proxy Angular (proxy.conf.json → localhost:5000)
  // tu peux ajouter d'autres variables ici, ex: analytics, feature flags
  featureFlags: {
    enableDebug: true
  }
};
