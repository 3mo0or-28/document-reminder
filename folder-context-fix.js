// Preserve the currently open folder when adding a new document.
(() => {
  const originalDocForm = docForm;
  let folderAtOpen = '';

  docForm = function patchedDocForm(id) {
    folderAtOpen = !id && ui.v === 'docs' && ui.folder ? ui.folder : '';
    originalDocForm(id);

    if (folderAtOpen && w && !w.old) {
      w.folder = folderAtOpen;
    }
  };

  // The category picker normally switches to a category-default folder.
  // Restore the folder the user was viewing after the tile click completes.
  document.addEventListener('click', (event) => {
    if (!folderAtOpen || !w || w.old) return;
    if (!event.target.closest('.tile')) return;

    const selectedFolder = folderAtOpen;
    setTimeout(() => {
      if (w && !w.old) {
        w.folder = selectedFolder;
        if (w.step === 3) wz(0);
      }
    }, 0);
  }, true);
})();
