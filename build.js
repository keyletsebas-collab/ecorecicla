const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        // Omitir carpetas de dependencias y la carpeta destino
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'android' || entry.name === 'www' || entry.name === 'landing 2') {
            continue;
        }

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log("🧹 Limpiando y creando carpeta 'www'...");
if (fs.existsSync('www')) {
    fs.rmSync('www', { recursive: true, force: true });
}
fs.mkdirSync('www', { recursive: true });

console.log("📦 Copiando archivos web a 'www' y 'ReciminsaApp/wwwroot'...");
const filesToCopy = ['index.html', 'service-worker.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'logo-white-lines.png', 'logo-no-white-lines.png'];
const targets = ['www', path.join('ReciminsaApp', 'wwwroot')];

targets.forEach(target => {
    if (fs.existsSync(target)) {
        filesToCopy.forEach(file => {
            if (fs.existsSync(file)) {
                fs.copyFileSync(file, path.join(target, file));
            }
        });

        const dirsToCopy = ['js', 'css'];
        dirsToCopy.forEach(dir => {
            if (fs.existsSync(dir)) {
                copyDir(dir, path.join(target, dir));
            }
        });
    }
});

console.log("✨ Carpetas 'www' y 'ReciminsaApp/wwwroot' preparadas exitosamente.");
