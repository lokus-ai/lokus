#!/usr/bin/env node
const dgram = require('dgram');
const os = require('os');

const PORT = 9999;
const server = dgram.createSocket('udp4');

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
};

function formatLevel(level) {
    switch (level.toLowerCase()) {
        case 'error': return `${colors.red}ERROR${colors.reset}`;
        case 'warn': return `${colors.yellow}WARN ${colors.reset}`;
        case 'info': return `${colors.blue}INFO ${colors.reset}`;
        case 'debug': return `${colors.gray}DEBUG${colors.reset}`;
        default: return `${colors.cyan}LOG  ${colors.reset}`;
    }
}

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({ name, address: iface.address });
            }
        }
    }
    return ips;
}

server.on('message', (msg) => {
    try {
        const entry = JSON.parse(msg.toString());
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const level = formatLevel(entry.level);
        console.log(`${colors.gray}${time}${colors.reset} ${level} ${entry.message}`);
    } catch {
        console.log(`${colors.gray}[RAW]${colors.reset} ${msg.toString()}`);
    }
});

server.on('listening', () => {
    console.log('');
    console.log(`${colors.green}╔════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║${colors.reset}     ${colors.cyan}Lokus Remote Log Server${colors.reset}              ${colors.green}║${colors.reset}`);
    console.log(`${colors.green}╚════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    console.log(`Listening on UDP port ${colors.yellow}${PORT}${colors.reset}`);
    console.log('');
    console.log('Your IP addresses:');
    getLocalIPs().forEach(({ name, address }) => {
        console.log(`  ${colors.gray}${name}:${colors.reset} ${colors.cyan}${address}${colors.reset}`);
    });
    console.log('');
    console.log(`${colors.green}Waiting for logs from iOS...${colors.reset}`);
    console.log(`${colors.gray}${'─'.repeat(50)}${colors.reset}`);
});

server.bind(PORT);

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
});
