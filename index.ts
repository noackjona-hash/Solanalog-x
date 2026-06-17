import { Connection } from '@solana/web3.js';
import chalk from 'chalk';
import { Config } from './src/Config';
import { FileLogger } from './src/Logger';
import { TelemetryTracker } from './src/Telemetry';
import { LogParser } from './src/Parser';

const telemetry = new TelemetryTracker();
let connection: Connection;
let subscriptionId: number | null = null;
let reconnectTimeout: NodeJS.Timeout;

console.clear();
console.log(chalk.magenta.bold('=================================================='));
console.log(chalk.cyan.bold('   🔍 SolanaLog-X: Modular v2.0       '));
if (Config.showOnlyErrors) console.log(chalk.red.bold('   ⚠️ MODE: Only showing CRASHES (--errors)'));
else if (Config.showOnlyHeavy) console.log(chalk.yellow.bold('   ⚠️ MODE: Only showing HIGH CU USAGE >80% (--heavy)'));
else console.log(chalk.green('   ✨ MODE: Streaming ALL transactions'));
console.log(chalk.magenta.bold('==================================================\n'));

function startLogListener() {
    try {
        if (subscriptionId !== null && connection) {
            connection.removeOnLogsListener(subscriptionId).catch(() => {});
        }

        connection = new Connection(Config.rpcUrl!, 'confirmed');
        console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] Connected to RPC WebSocket...`));
        FileLogger.write('SYSTEM: Connected to RPC WebSocket.');

        subscriptionId = connection.onLogs(
            'all',
            (logs, context) => {
                try {
                    telemetry.totalTransactionsProcessed++;
                    const result = LogParser.parse(logs.logs);

                    if (result.hasError) {
                        telemetry.crashCount++;
                        FileLogger.write(`CRASH [Slot ${context.slot}]: ${result.errorMsg} (Sig: ${logs.signature})`);
                        if (Config.showOnlyHeavy) return;
                        
                        console.log(chalk.red.bold(`❌ [CRASH] Slot: ${context.slot}`));
                        console.log(chalk.gray(`   Sig: ${logs.signature}`));
                        console.log(chalk.red(`   🚨 Error: "${result.errorMsg}"`));
                        if (result.formattedLines.length > 0) console.log(result.formattedLines.join('\n'));
                        console.log(chalk.red(`==================================================\n`));
                    } else if (result.formattedLines.length > 0) {
                        if (result.isHeavy) {
                            telemetry.heavyCount++;
                            FileLogger.write(`HEAVY PERFORMANCE [Slot ${context.slot}]: Sig: ${logs.signature}`);
                        }

                        if (Config.showOnlyErrors) return;
                        if (Config.showOnlyHeavy && !result.isHeavy) return;
                        
                        console.log(chalk.green.bold(`✅ [SUCCESS] Slot: ${context.slot}`));
                        console.log(chalk.gray(`   Sig: ${logs.signature}`));
                        console.log(result.formattedLines.join('\n'));
                        console.log(chalk.gray(`--------------------------------------------------\n`));
                    }
                } catch (parseError) {
                    console.error(chalk.red(`⚠️ Stream Parsing Exception: ${parseError}`));
                }
            },
            'confirmed'
        );

        // @ts-ignore
        connection._rpcWebSocket.on('close', () => {
            telemetry.reconnects++;
            console.log(chalk.red(`\n🚨 WebSocket closed! Reconnecting in 5s...`));
            FileLogger.write('SYSTEM: WebSocket connection lost. Triggering reconnect.');
            triggerReconnect();
        });

    } catch (error) {
        telemetry.reconnects++;
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
    FileLogger.write('SYSTEM: Process terminated by user.');
    clearTimeout(reconnectTimeout);
    if (subscriptionId !== null && connection) {
        await connection.removeOnLogsListener(subscriptionId).catch(() => {});
    }
    telemetry.printSummary();
    console.log(chalk.green('\nErfolgreich getrennt.'));
    process.exit();
});