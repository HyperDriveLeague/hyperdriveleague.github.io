(() => {
  const content = document.getElementById('adminContent');
  const navigation = content?.querySelector('.admin-section-nav');
  if (!content || !navigation) return;
  const buttons = [...navigation.querySelectorAll('[data-admin-section]')];
  const headings = [...content.querySelectorAll('[data-admin-part]')];
  const store = document.getElementById('adminStoreSection');
  const groups = new Map();
  headings.forEach((heading, i) => {
    const elements = [];
    const next = headings[i + 1] || store;
    let node = heading;
    while (node && node !== next) {
      elements.push(node);
      node = node.nextElementSibling;
    }
    groups.set(heading.dataset.adminPart, (groups.get(heading.dataset.adminPart) || []).concat(elements));
  });
  function activate(key, updateUrl = true) {
    if (!groups.has(key)) return;
    groups.forEach((elements, group) => {
      elements.forEach(element => element.classList.toggle('admin-part-hidden', group !== key));
    });
    buttons.forEach(button => {
      const selected = button.dataset.adminSection === key;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    if (updateUrl) history.replaceState(null, '', '#admin-' + key);
    if (!document.body.classList.contains('admin-store-active')) {
      navigation.scrollIntoView({block:'start',behavior:'smooth'});
    }
  }
  buttons.forEach(button => button.addEventListener('click', () => activate(button.dataset.adminSection)));
  const initial = location.hash.startsWith('#admin-') ? location.hash.slice(7) : 'resumen';
  activate(groups.has(initial) ? initial : 'resumen', false);
  window.addEventListener('hashchange', () => {
    const key = location.hash.slice(7);
    if (location.hash.startsWith('#admin-') && groups.has(key)) activate(key, false);
  });
})();