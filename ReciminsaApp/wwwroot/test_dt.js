const fetch = require('node-fetch');

async function test() {
  const url = "https://api-dgii.dominicantechnology.com/api/v1/rnc/131880738";
  console.log("Testing:", url);
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer dgii_41346f9633e04c1287001ec8aa0fde4b'
      }
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch(e) {
    console.error(e.message);
  }
}
test();
