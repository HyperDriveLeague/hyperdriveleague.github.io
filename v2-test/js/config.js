window.HYPERDRIVE_CONFIG = {
  supabaseUrl: 'https://knyxattsjimsjefydcad.supabase.co',
  supabasePublishableKey: 'sb_publishable_hLAzZZF6kki1xZ0Kyx6lfA_97kzSAmf',
  currentSeason: 8
};

if (window.location.pathname.endsWith('/staff.html')) {
  const metricsScript = document.createElement('script');
  metricsScript.src = 'js/staff-hub-metrics.js?v=1';
  metricsScript.defer = true;
  document.head.appendChild(metricsScript);
}
