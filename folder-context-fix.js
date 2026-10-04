// Preserve the currently open folder when adding a new document.
// This runs after the main app script and uses the app's global lexical variables
// directly (ui / w), not window.ui / window.w.
(() => {
  if (typeof docForm !== 'function') return;

  const originalDocForm = docForm;
  let folderAtOpen = '';

  docForm = function patchedDocForm(id) {
    folderAtOpen = !id && ui && ui.v === 'docs' && ui.folder ? ui.folder : '';
    originalDocForm(id);
    if (folderAtOpen && w && !w.old) w.folder = folderAtOpen;
  };

  document.addEventListener('click', (event) => {
    if (!folderAtOpen || !w || w.old) return;
    if (!event.target.closest('.tile')) return;

    const selectedFolder = folderAtOpen;
    setTimeout(() => {
      if (w && !w.old) w.folder = selectedFolder;
    }, 0);
  }, true);
})();
