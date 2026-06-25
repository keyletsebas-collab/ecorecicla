const fetch = require('node-fetch');
const token = 'dgii_41346f9633e04c1287001ec8aa0fde4b';

async function test() {
  const url = "https://dgiiapicloud.com/api/autocomplete?q=131880738";
  console.log("Testing:", url);
  try {
    const res = await fetch(url, { headers: { "x-api-key": token } });
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
