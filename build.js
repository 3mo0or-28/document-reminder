const fs=require('fs'),u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY;
if(!u||!k){console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');process.exit(1)}
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
let html=fs.readFileSync('index.html','utf8');

const before=html;

// Make the add-document wizard use the folder currently being viewed.
html=html.replace(
  "folder:d?.folder||'personal',pre:",
  "folder:d?.folder||((ui.v=='docs'&&ui.folder)?ui.folder:'personal'),pre:"
);

// Do not let category selection overwrite the current folder.
html=html.replace(
  "if(!w.old)w.folder=CATS.find(x=>x[0]==c)[2];w.step=2;wz()",
  "if(!w.old&&!(ui.v=='docs'&&ui.folder))w.folder=CATS.find(x=>x[0]==c)[2];w.step=2;wz()"
);

// Fail loudly if the source changed and the production patch was not applied.
if(html===before || !html.includes("folder:d?.folder||((ui.v=='docs'&&ui.folder)?ui.folder:'personal'),pre:")){
  console.error('Folder-context patch was not applied to index.html');
  process.exit(1);
}

fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/config.js','window.APP_CONFIG='+JSON.stringify({url:u,anonKey:k})+';');
