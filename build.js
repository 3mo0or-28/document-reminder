const fs=require('fs'),u=process.env.SUPABASE_URL,k=process.env.SUPABASE_ANON_KEY;
if(!u||!k){console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');process.exit(1)}
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');fs.copyFileSync('index.html','dist/index.html');
fs.writeFileSync('dist/config.js','window.APP_CONFIG='+JSON.stringify({url:u,anonKey:k})+';');
