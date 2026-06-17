import { Connection, clusterApiUrl } from '@solana/web3.js';
import chalk from 'chalk';

const ENDPOINT = clusterApiUrl('devnet');
let connection: Connection;
let subscriptionId: number | null = null;
let reconnectTimeout: NodeJS.Timeout;

const showOnlyErrors = process.argv.includes('--errors');
const showOnlyHeavy = process.argv.includes('--heavy');

console.clear();
console.log(chalk.magenta.bold('=================================================='));
console.log(chalk.cyan.bold('   🔍 SolanaLog-X: Resilient Analyzer Pro v1.2   '));
if (showOnlyErrors) console.log(chalk.red.bold('   ⚠️ MODE: Only showing CRASHES (--errors)'));
else if (showOnlyHeavy) console.log(chalk.yellow.bold('   ⚠️ MODE: Only showing HIGH CU USAGE >80% (--heavy)'));
else console.log(chalk.green('   ✨ MODE: Streaming ALL transactions'));
console.log(chalk.magenta.bold('==================================================\n'));

function startLogListener() {
    try {
        if (subscriptionId !== null && connection) {
            connection.removeOnLogsListener(subscriptionId).catch(() => {});
        }

        connection = new Connection(ENDPOINT, 'confirmed');
        console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] Connected to RPC WebSocket...`));

        const cuRegex = /consumed (\d+) of (\d+) compute units/;

        subscriptionId = connection.onLogs(
            'all',
            (logs, context) => {
                try {
                    let hasError = false;
                    let isHeavy = false;
                    let errorMsg = '';
                    const parsedLines: string[] = [];

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
                            const pct = ((used / total) * 100);
                            
                            if (pct > 80) isHeavy = true;

                            let color = chalk.green;
                            if (pct > 80) color = chalk.red.bold;
                            else if (pct > 50) color = chalk.yellow;

                            parsedLines.push(`    ⚡ ${color(`${pct.toFixed(1)}% CUs used`)} (${used}/${total})`);
                            return;
                        }

                        if (line.includes('Instruction:')) {
                            const inst = line.split('Instruction:')[1].trim();
                            parsedLines.push(`    📥 ${chalk.bold.yellow(`Exec: ${inst}`)}`);
                            return;
                        }
                    });

                    if (hasError) {
                        if (showOnlyHeavy) return;
                        console.log(chalk.red.bold(`❌ [CRASH] Slot: ${context.slot}`));
                        console.log(chalk.gray(`   Sig: ${logs.signature}`));
                        console.log(chalk.red(`   🚨 Error: "${errorMsg}"`));
                        if (parsedLines.length > 0) console.log(parsedLines.join('\n'));
                        console.log(chalk.red(`==================================================\n`));
                    } else if (parsedLines.length > 0) {
                        if (showOnlyErrors) return;
                        if (showOnlyHeavy && !isHeavy) return;
                        
                        console.log(chalk.green.bold(`✅ [SUCCESS] Slot: ${context.slot}`));
                        console.log(chalk.gray(`   Sig: ${logs.signature}`));
                        console.log(parsedLines.join('\n'));
                        console.log(chalk.gray(`--------------------------------------------------\n`));
                    }
                } catch (parseError) {
                    console.log(chalk.red(`⚠️ Parse-Error: ${parseError}`));
                }
            },
            'confirmed'
        );

        // @ts-ignore
        connection._rpcWebSocket.on('close', () => {
            console.log(chalk.red(`\n🚨 WebSocket closed! Reconnecting in 5s...`));
            triggerReconnect();
        });

    } catch (error) {
        console.log(chalk.red(`Connection error: ${error}. Reconnecting in 5s...`));
        triggerReconnect();
    }
}

function triggerReconnect() {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        startLogListener();
    }, 5000);
}

startLogListener();

process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nBeende WebSocket Stream sauber...'));
    clearTimeout(reconnectTimeout);
    if (subscriptionId !== null && connection) {
        await connection.removeOnLogsListener(subscriptionId).catch(() => {});
    }
    console.log(chalk.green('Erfolgreich getrennt.'));
    process.exit();
});