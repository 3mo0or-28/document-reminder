// Preserve the currently open folder when adding a new document.
// The main wizard auto-picks a category folder; this patch keeps the user's
// explicit folder context when Add Document is launched from a folder view.
(() => {
  const originalDocForm = window.docForm;
  if (typeof originalDocForm !== 'function') return;

  let folderAtOpen = '';

  window.docForm = function patchedDocForm(id) {
    folderAtOpen = !id && window.ui?.v === 'docs' && window.ui?.folder
      ? window.ui.folder
      : '';

    originalDocForm(id);

    if (folderAtOpen && window.w && !window.w.old) {
      window.w.folder = folderAtOpen;
    }
  };

  // `pick()` in the existing wizard assigns a category-default folder.
  // Restore the folder the user was actually viewing immediately afterward.
  document.addEventListener('click', (event) => {
    if (!folderAtOpen || !window.w || window.w.old) return;
    if (!event.target.closest('.tile')) return;

    const selectedFolder = folderAtOpen;
    setTimeout(() => {
      if (window.w && !window.w.old) window.w.folder = selectedFolder;
    }, 0);
  }, true);
})();
