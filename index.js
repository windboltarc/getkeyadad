// index.js
import { NextResponse } from 'next/server';
import axios from 'axios';

// Đây là API duy nhất: cả sinh key và hiển thị
export async function GET(req) {
  try {
    // Sinh key
    const key = "Lunar_" + Math.floor(Math.random() * 1e16);

    // Lưu vào Firebase Realtime Database
    const firebaseUrl = "https://your-project-id-default-rtdb.firebaseio.com/keys.json";
    await axios.patch(firebaseUrl, { [key]: true });

    // HTML đơn giản hiển thị key + copy
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Lunar Key Generator</title>
      <style>
        body { font-family: Arial; text-align: center; padding-top: 50px; }
        input { padding: 10px; width: 300px; }
        button { padding: 10px 20px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>Your Key</h1>
      <input type="text" value="${key}" readonly />
      <br/>
      <button onclick="navigator.clipboard.writeText('${key}')">Copy Key</button>
    </body>
    </html>
    `;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  } catch (err) {
    return new NextResponse("Error generating key: " + err.message, { status: 500 });
  }
}
