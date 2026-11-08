// Forma za rezervaciju se prikazuje preko celog ekrana, van Hero sekcije. Ovaj
// element nosi klasu .hero-tpl, da bi i tamo važili stilovi iz hero.css.
let root = null;

export function heroPortalRoot() {
  if (!root) {
    root = document.createElement('div');
    root.className = 'hero-tpl';
    document.body.appendChild(root);
  }
  return root;
}
