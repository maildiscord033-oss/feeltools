const crypto = require('crypto');
const os = require('os');
const { machineIdSync } = require('node-machine-id');

class HWIDGenerator {
    static generate() {
        const components = [
            machineIdSync(),
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0].model,
            os.totalmem().toString()
        ];
        
        const raw = components.join('|');
        return crypto.createHash('sha256').update(raw).digest('hex');
    }
    
    static validate(hwid) {
        return /^[a-f0-9]{64}$/i.test(hwid);
    }
}

module.exports = { HWIDGenerator };