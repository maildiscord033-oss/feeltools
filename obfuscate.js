const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const obfuscationOptions = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
};

function getAllJSFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // تخطي node_modules فقط
            if (file === 'node_modules' || file === '.git' || file === 'data') continue;
            getAllJSFiles(filePath, fileList);
        } else if (file.endsWith('.js') && file !== 'obfuscate.js') {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

function obfuscateAll() {
    const rootDir = process.argv[2] || './';
    const files = getAllJSFiles(rootDir);
    
    console.log(`\n🔒 FEEL STORE - Code Obfuscator\n`);
    console.log(`Found ${files.length} files to obfuscate\n`);
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = path.relative(rootDir, file);
        
        try {
            process.stdout.write(`[${i + 1}/${files.length}] ${fileName}... `);
            
            const code = fs.readFileSync(file, 'utf8');
            const result = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
            fs.writeFileSync(file, result.getObfuscatedCode());
            
            console.log('✅');
            success++;
        } catch (err) {
            console.log(`❌ ${err.message}`);
            failed++;
        }
    }
    
    console.log(`\n✅ Done! ${success} obfuscated, ${failed} failed\n`);
    
    if (failed > 0) {
        console.log('⚠️ Some files failed. Check the errors above.\n');
    }
}

obfuscateAll();
