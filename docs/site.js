const dialog = document.getElementById('install-dialog');
document.querySelectorAll('[data-install]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {if (event.target === dialog) {const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
document.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', () => {
  const selected = button.dataset.platform;
  document.querySelectorAll('[data-platform]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  for (const platform of ['chrome','safari']) document.getElementById(`install-${platform}`).hidden = selected !== platform;
}));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  for (const view of ['source','summary']) document.getElementById(`example-${view}`).hidden = button.dataset.view !== view;
}));
