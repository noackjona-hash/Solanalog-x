import { Connection, clusterApiUrl } from '@solana/web3.js';
import chalk from 'chalk';

// 1. Verbindung zum Solana Devnet aufbauen
const endpoint = clusterApiUrl('devnet');
const connection = new Connection(endpoint, 'confirmed');

console.clear();
console.log(chalk.blue.bold('=================================================='));
console.log(chalk.green.bold(' 🚀 SolanaLog-X: Live WebSocket Logger gestartet!'));
console.log(chalk.blue(` Connected to: ${endpoint}`));
console.log(chalk.blue.bold('==================================================\n'));

console.log(chalk.yellow('Warte auf Live-Transaktionen im Devnet...\n'));

// 2. Live-Logs über WebSockets abfangen
const subscriptionId = connection.onLogs(
    'all', 
    (logs, context) => {
        console.log(chalk.gray(`[Slot: ${context.slot}] New transaction detected!`));
        console.log(chalk.cyan(`Signature: ${logs.signature}`));
        
        console.log(chalk.white('--- Raw Logs ---'));
        
        // Wir gehen jede Log-Zeile durch und färben sie passend ein
        logs.logs.forEach((line) => {
            if (line.includes('failed')) {
                console.log(chalk.red(`  ❌ ${line}`));
            } else if (line.includes('success') || line.includes('invoke')) {
                console.log(chalk.green(`  📥 ${line}`));
            } else {
                console.log(`  🔹 ${line}`);
            }
        });
        
        console.log(chalk.gray('--------------------------------------------------\n'));
    },
    'confirmed'
);

// Sauberer Abbruch bei STRG+C
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nBeende WebSocket-Verbindung...'));
    await connection.removeOnLogsListener(subscriptionId);
    console.log(chalk.green('Erfolgreich getrennt. Tschüss!'));
    process.exit();
});