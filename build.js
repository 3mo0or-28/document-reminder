const fs=require('fs'),u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY;
if(!u||!k){console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');process.exit(1)}
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
let html=fs.readFileSync('index.html','utf8');

// Keep the exact folder the user was viewing when Add Document was opened.
html=html.replace(
  "folder:d?.folder||'personal',pre:",
  "folder:d?.folder||((ui.v=='docs'&&ui.folder)?ui.folder:'personal'),targetFolder:(!d&&ui.v=='docs'&&ui.folder)?ui.folder:'',pre:"
);

// Category selection must not override an explicitly opened folder.
html=html.replace(
  "if(!w.old)w.folder=CATS.find(x=>x[0]==c)[2];w.step=2;wz()",
  "if(!w.old&&!w.targetFolder)w.folder=CATS.find(x=>x[0]==c)[2];w.step=2;wz()"
);

// Review screen should show the actual target folder.
html=html.replace(
  "H(fn(w.folder))",
  "H(fn(w.targetFolder||w.folder))"
);

// Saving must use the original folder context even if the wizard changes folder.
html=html.replace(
  "folder:w.folder,num:w.num.trim()",
  "folder:(w.targetFolder||w.folder),num:w.num.trim()"
);

const required=[
  "targetFolder:(!d&&ui.v=='docs'&&ui.folder)?ui.folder:''",
  "if(!w.old&&!w.targetFolder)",
  "folder:(w.targetFolder||w.folder)"
];
if(required.some(x=>!html.includes(x))){
  console.error('Folder-context patch failed to apply');
  process.exit(1);
}

fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/config.js','window.APP_CONFIG='+JSON.stringify({url:u,anonKey:k})+';');
