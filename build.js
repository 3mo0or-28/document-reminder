const fs=require('fs'),u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY;
if(!u||!k){console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');process.exit(1)}
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
let html=fs.readFileSync('index.html','utf8');
html=html.replace('</body>','<script src="/folder-context-fix.js"></script></body>');
fs.writeFileSync('dist/index.html',html);
fs.copyFileSync('folder-context-fix.js','dist/folder-context-fix.js');
fs.writeFileSync('dist/config.js','window.APP_CONFIG='+JSON.stringify({url:u,anonKey:k})+';');
