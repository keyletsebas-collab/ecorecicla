const fetch = require('node-fetch');

const urls = [
  'https://dgiiapicloud.com/api/rnc/131880738',
  'https://dgiiapicloud.com/api/v1/rnc/131880738',
  'https://dgiiapicloud.com/rnc/131880738',
  'https://api.dgiiapicloud.com/rnc/131880738',
  'https://api.dgiiapicloud.com/v1/rnc/131880738'
];

async function test() {
  for (const url of urls) {
    try {
      let r = await fetch(url, { headers: { 'Authorization': 'Bearer dgii_41346f9633e04c1287001ec8aa0fde4b', 'x-api-key': 'dgii_41346f9633e04c1287001ec8aa0fde4b' }});
      let text = await r.text();
      if (!text.includes('<!doctype html>')) {
        console.log("SUCCESS on:", url);
        console.log(text);
        return;
      }
    } catch(e) {}
  }
  console.log("All failed or returned HTML");
}
test();
