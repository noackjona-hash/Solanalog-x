import { Connection, clusterApiUrl } from '@solana/web3.js';
import chalk from 'chalk';

const endpoint = clusterApiUrl('devnet');
const connection = new Connection(endpoint, 'confirmed');

console.clear();
console.log(chalk.magenta.bold('=================================================='));
console.log(chalk.cyan.bold('   🔍 SolanaLog-X: Analyzer 🔍  '));
console.log(chalk.magenta.bold('==================================================\n'));

const shortAddr = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-3)}`;

const subscriptionId = connection.onLogs(
    'all', 
    (logs, context) => {
        let hasError = false;
        let errorMsg = '';
        const parsedLines: string[] = [];

        const cuRegex = /consumed (\d+) of (\d+) compute units/;

        logs.logs.forEach((line) => {
            
            if (line.includes('failed:')) {
                hasError = true;
                errorMsg = line.split('failed:')[1].trim();
                return; 
            }

            const cuMatch = line.match(cuRegex);
            if (cuMatch) {
                const used = parseInt(cuMatch[1]);
                const total = parseInt(cuMatch[2]);
                const pct = ((used / total) * 100).toFixed(1);
                
                let color = chalk.green;
                if (parseFloat(pct) > 80) color = chalk.red.bold;
                else if (parseFloat(pct) > 50) color = chalk.yellow;

                parsedLines.push(`    ⚡ ${color(`${pct}% CUs used`)} (${used}/${total})`);
                return;
            }

            if (line.includes('Instruction:')) {
                const inst = line.split('Instruction:')[1].trim();
                parsedLines.push(`    📥 ${chalk.bold.yellow(`Exec: ${inst}`)}`);
                return;
            }
        });

        // --- DASHBOARD AUSGABE ---
        if (hasError) {
            console.log(chalk.red.bold(`❌ [CRASH] Slot: ${context.slot}`));
            console.log(chalk.gray(`   Sig: ${logs.signature}`));
            console.log(chalk.red(`   🚨 Error: "${errorMsg}"`));
            if (parsedLines.length > 0) console.log(parsedLines.join('\n'));
            console.log(chalk.red(`==================================================\n`));
        } else if (parsedLines.length > 0) {
            console.log(chalk.green.bold(`✅ [SUCCESS] Slot: ${context.slot}`));
            console.log(chalk.gray(`   Sig: ${logs.signature}`));
            console.log(parsedLines.join('\n'));
            console.log(chalk.gray(`--------------------------------------------------\n`));
        }
    },
    'confirmed'
);

process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nStopping WebSocket Stream...'));
    await connection.removeOnLogsListener(subscriptionId);
    process.exit();
});