(() => {
  const card = document.querySelector('[data-role-card="team_principal"]');
  if (!card) return;

  card.classList.add('module-card');
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Abrir módulo Team Principal');

  const label = card.querySelector('.coming-soon');
  if (label) {
    label.className = 'module-link';
    label.textContent = 'ABRIR MÓDULO →';
  }

  const open = () => {
    if (card.classList.contains('has-access')) window.location.href = 'team.html';
  };

  card.addEventListener('click', open);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
})();
