const fetch = require('node-fetch');

async function test() {
  const url = "https://api.adamix.net/apec/cedula/40224169733"; // Example Cedula
  console.log("Testing:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch(e) {
    console.error(e.message);
  }
}
test();
