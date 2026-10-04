const fs=require('fs'),u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY;
if(!u||!k){console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');process.exit(1)}
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
let html=fs.readFileSync('index.html','utf8');

// When Add Document is opened while viewing a folder, default the wizard to
// that exact folder instead of Personal Documents.
html=html.replace(
  "folder:d?.folder||'personal',pre:",
  "folder:d?.folder||((ui.v=='docs'&&ui.folder)?ui.folder:'personal'),pre:"
);

// Picking a document category normally changes the folder automatically.
// Keep the current folder when the user launched Add Document from a folder.
html=html.replace(
  "if(!w.old)w.folder=CATS.find(x=>x[0]==c)[2];w.step=2;wz()",
  "if(!w.old&&!(ui.v=='docs'&&ui.folder))w.folder=CATS.find(x=>x[0]==c)[2];w.step=2;wz()"
);

fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/config.js','window.APP_CONFIG='+JSON.stringify({url:u,anonKey:k})+';');
