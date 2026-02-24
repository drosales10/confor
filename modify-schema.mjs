import fs from 'fs';

let schemaCode = fs.readFileSync('prisma/schema.prisma', 'utf8');

const modelsToAddRel = [
    'ManagementScheme',
    'ForestInventoryTypeCatalog',
    'ImaClass',
    'Species',
    'Provenance',
    'VegetalMaterial',
    'LandUseType',
    'Spacing',
    'ProductType'
];

modelsToAddRel.forEach(model => {
    const modelStart = schemaCode.indexOf(`model ${model} {`);
    if (modelStart !== -1) {
        const nextBracket = schemaCode.indexOf('}', modelStart);
        let originalModel = schemaCode.substring(modelStart, nextBracket);
        if (!originalModel.includes('organizationId')) {
            const newLine = `\  organizationId String? @db.Uuid\n  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)\n`;
            const modifiedModel = originalModel + newLine;
            schemaCode = schemaCode.replace(originalModel, modifiedModel);
        }
    }
});

const orgStart = schemaCode.indexOf('model Organization {');
if (orgStart !== -1) {
    const orgNextBracket = schemaCode.indexOf('}', orgStart);
    let orgModel = schemaCode.substring(orgStart, orgNextBracket);

    const reverseRels = [
        '  managementSchemes ManagementScheme[]',
        '  inventoryTypes ForestInventoryTypeCatalog[]',
        '  imaClasses ImaClass[]',
        '  species Species[]',
        '  provenances Provenance[]',
        '  vegetalMaterials VegetalMaterial[]',
        '  landUseTypes LandUseType[]',
        '  spacings Spacing[]',
        '  productTypes ProductType[]'
    ];

    for (const rel of reverseRels) {
        if (!orgModel.includes(rel.trim())) {
            orgModel += rel + '\n';
        }
    }

    schemaCode = schemaCode.replace(schemaCode.substring(orgStart, orgNextBracket), orgModel);
}

fs.writeFileSync('prisma/schema.prisma', schemaCode);
console.log('Schema updated successfully');
