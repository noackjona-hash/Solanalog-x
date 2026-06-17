import { Connection, clusterApiUrl } from '@solana/web3.js';
import chalk from 'chalk';

const ENDPOINT = clusterApiUrl('devnet');
let connection: Connection;
let subscriptionId: number | null = null;
let reconnectTimeout: NodeJS.Timeout;

console.clear();
console.log(chalk.magenta.bold('=================================================='));
console.log(chalk.cyan.bold('   🔍 SolanaLog-X: Resilient Analyzer Pro v1.1   '));
console.log(chalk.magenta.bold('==================================================\n'));

function startLogListener() {
    try {
        if (subscriptionId !== null && connection) {
            connection.removeOnLogsListener(subscriptionId).catch(() => {});
        }

        connection = new Connection(ENDPOINT, 'confirmed');
        console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] Verbinde mit RPC WebSocket...`));

        const cuRegex = /consumed (\d+) of (\d+) compute units/;

        subscriptionId = connection.onLogs(
            'all',
            (logs, context) => {
                try {
                    let hasError = false;
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
                } catch (parseError) {
                    console.log(chalk.red(`⚠️ Fehler beim Parsen einer Transaktion: ${parseError}`));
                }
            },
            'confirmed'
        );

        // @ts-ignore
        connection._rpcWebSocket.on('close', () => {
            console.log(chalk.red(`\n🚨 WebSocket-Verbindung verloren! Starte Reconnect in 5 Sekunden...`));
            triggerReconnect();
        });

    } catch (error) {
        console.log(chalk.red(`Fehler beim Verbindungsaufbau: ${error}. Reconnect in 5s...`));
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