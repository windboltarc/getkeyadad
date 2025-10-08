// app.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// --- In-memory store (demo) ---
const storedKeys = {};

// --- HTML template ---
const HTML_TEMPLATE = (key) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<title>QuackExecutor</title>
<style>
body{font-family:sans-serif;background:#c3cfe2;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.container{background:white;padding:2rem;border-radius:15px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2)}
input{padding:0.8rem;width:80%;margin-bottom:1rem;border-radius:8px;border:2px solid #3498db}
button{padding:0.8rem 2rem;border:none;border-radius:8px;background:#3498db;color:white;cursor:pointer}
</style>
</head>
<body>
<div class="container">
<h1>QuackExecutor</h1>
<p>Your Key:</p>
<input type="text" value="${key||''}" readonly>
<br>
<button onclick="navigator.clipboard.writeText('${key||''}').then(()=>alert('Copied!'))">Copy</button>
</div>
</body>
</html>
`;

// --- Utils ---
function generateRandomKey() {
  const digits = Array.from({length:16},()=>Math.floor(Math.random()*10)).join('');
  return `Quack_${digits}`;
}

// --- Routes ---
app.get('/', (req,res)=>res.send('KeyGen Server Running'));

app.get('/key', (req,res)=>{
  const key = req.query.key||'';
  res.send(HTML_TEMPLATE(key));
});

app.post('/createkey', async (req,res)=>{
  const newKey = generateRandomKey();
  const hostBase = process.env.HOST_BASE || `https://getkeyadad.vercel.app`;
  const targetUrl = `${hostBase}/key?key=${encodeURIComponent(newKey)}`;

  // Optional: try shorten via link4m
  let shortUrl = targetUrl;
  try{
    const resp = await axios.get('https://link4m.co/api-shorten/v2',{
      params:{api:'68ae872a8e209608f24257f7', url:targetUrl}, timeout:5000
    });
    if(resp.data && resp.data.shortenedUrl) shortUrl = resp.data.shortenedUrl;
  }catch(e){}

  storedKeys[newKey] = true; // store in-memory
  res.json({status:'success', key:newKey, link:shortUrl});
});

app.post('/submitkey', (req,res)=>{
  const key = req.body?.key;
  if(!key) return res.status(400).json({status:'error', message:'No key provided'});
  if(!/^Quack_\d{16}$/.test(key)) return res.json({status:'success', isValid:false});
  if(storedKeys[key]){
    delete storedKeys[key];
    return res.json({status:'success', isValid:true});
  }else{
    return res.json({status:'success', isValid:false});
  }
});

// --- Start server ---
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
