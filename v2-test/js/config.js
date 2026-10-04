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

  const objectivesScript = document.createElement('script');
  objectivesScript.src = 'js/staff-objectives.js?v=4';
  objectivesScript.defer = true;
  document.head.appendChild(objectivesScript);

  const objectivesUnconfirmScript = document.createElement('script');
  objectivesUnconfirmScript.src = 'js/staff-objectives-unconfirm.js?v=1';
  objectivesUnconfirmScript.defer = true;
  document.head.appendChild(objectivesUnconfirmScript);
}

if (window.location.pathname.endsWith('/index.html') || window.location.pathname.endsWith('/v2-test/')) {
  const officialObjectivesScript = document.createElement('script');
  officialObjectivesScript.src = 'js/pilot-objectives-official.js?v=1';
  officialObjectivesScript.defer = true;
  document.head.appendChild(officialObjectivesScript);
}

(() => {
  const publicUrl = 'https://hyperdriveleague.github.io/';

  function makePublicLink(extraClass = '') {
    const link = document.createElement('a');
    link.href = publicUrl;
    link.className = `secondary-button link-button v2-public-site-link${extraClass ? ` ${extraClass}` : ''}`;
    link.textContent = '← WEB PRINCIPAL';
    link.setAttribute('aria-label', 'Volver a la web principal de HyperDrive');
    return link;
  }

  function installPublicLinks() {
    if (!document.getElementById('v2PublicSiteLinkStyles')) {
      const style = document.createElement('style');
      style.id = 'v2PublicSiteLinkStyles';
      style.textContent = '.v2-public-site-link{white-space:nowrap;text-decoration:none}.v2-public-site-link.floating{position:fixed;top:18px;right:18px;z-index:5000;background:#111318}@media(max-width:720px){.v2-public-site-link.floating{top:12px;right:12px;padding:9px 11px;font-size:9px}}';
      document.head.appendChild(style);
    }

    const actionGroups = [...document.querySelectorAll('.topbar-actions')];
    actionGroups.forEach(group => {
      if (!group.querySelector('.v2-public-site-link')) {
        group.insertBefore(makePublicLink(), group.firstChild);
      }
    });

    document.querySelectorAll('.module-header').forEach(header => {
      if (!header.querySelector('.topbar-actions') && !header.querySelector('.v2-public-site-link')) {
        header.appendChild(makePublicLink());
      }
    });

    const hasHeader = document.querySelector('.topbar, .module-header');
    if (!hasHeader && !document.querySelector('.v2-public-site-link')) {
      document.body.appendChild(makePublicLink('floating'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPublicLinks, { once: true });
  } else {
    installPublicLinks();
  }
})();
