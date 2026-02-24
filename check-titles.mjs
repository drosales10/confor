import fs from 'fs';

const forestalCode = fs.readFileSync('src/app/(dashboard)/configuracion-forestal/page.tsx', 'utf8');
const generalCode = fs.readFileSync('src/app/(dashboard)/configuracion-general/page.tsx', 'utf8');
const originalCode = fs.readFileSync('page_original.tsx', 'utf8');

function extractTitles(code) {
    const matches = [...code.matchAll(/<CatalogHeader title="([^"]+)"/g)];
    return matches.map(m => m[1]);
}

console.log("FOREST:", extractTitles(forestalCode));
console.log("GENERAL:", extractTitles(generalCode));
console.log("ORIGINAL:", extractTitles(originalCode));
