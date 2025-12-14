
const fs = require('fs');
const path = require('path');

async function verifyFixes() {
    console.log('Verifying TemplateManager fixes...');

    const filePath = 'packages/lokus-plugin-cli/src/utils/template-manager.ts';
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes("types: context.testing === 'jest' ? ['jest'] : []")) {
        console.log('✅ TemplateManager.ts contains the fix for restricted types.');
    } else {
        console.error('❌ TemplateManager.ts does NOT contain the fix.');
        process.exit(1);
    }

    // Verify dev-enhanced.ts
    const devPath = 'packages/lokus-plugin-cli/src/commands/dev-enhanced.ts';
    const devContent = fs.readFileSync(devPath, 'utf-8');

    if (devContent.includes("Waiting for Lokus App to connect")) {
        console.log('✅ dev-enhanced.ts contains the startup message fix.');
    } else {
        console.error('❌ dev-enhanced.ts does NOT contain the startup message fix.');
        process.exit(1);
    }

    if (devContent.includes("logger.success('Client connected to dev server')")) {
        console.log('✅ dev-enhanced.ts contains the connection logging fix.');
    } else {
        console.error('❌ dev-enhanced.ts does NOT contain the connection logging fix.');
        process.exit(1);
    }

    console.log('All CLI fixes verified successfully.');
}

verifyFixes().catch(console.error);
