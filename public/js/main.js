// Auto-dismiss alerts
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .5s'; setTimeout(() => el.remove(), 500); }, 4000);
});

// Confirm before dangerous actions (extra safety beyond inline onclick)
document.querySelectorAll('[data-confirm]').forEach(btn => {
  btn.addEventListener('click', e => {
    if (!confirm(btn.dataset.confirm)) e.preventDefault();
  });
});

// Live clock in topbar if element exists
const clockEl = document.getElementById('live-clock');
if (clockEl) {
  const tick = () => { clockEl.textContent = new Date().toLocaleTimeString(); };
  tick(); setInterval(tick, 1000);
}

// Toggle permission card visual on checkbox change
document.querySelectorAll('.perm-card .toggle input').forEach(cb => {
  cb.addEventListener('change', () => {
    const card = cb.closest('.perm-card');
    card.style.opacity = cb.checked ? '1' : '0.5';
  });
  // Init
  cb.closest('.perm-card').style.opacity = cb.checked ? '1' : '0.5';
});

// Highlight active nav link based on current path
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-link').forEach(link => {
  if (currentPath.startsWith(link.getAttribute('href'))) {
    link.classList.add('active');
  }
});
