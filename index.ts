import { Connection } from '@solana/web3.js';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Konfiguration laden
dotenv.config();

const ENDPOINT = process.env.SOLANA_RPC_URL;
const LOG_FILE_PATH = path.join(__dirname, 'solanalog-x.log');
const BACKUP_LOG_PATH = path.join(__dirname, 'solanalog-x.old.log');
const MAX_LOG_SIZE_BYTES = 25 * 1024; // Auf 25KB erhöht für mehr Produktionsdaten

if (!ENDPOINT) {
    console.error(chalk.red.bold('❌ FEHLER: SOLANA_RPC_URL ist nicht in der .env Datei definiert!'));
    process.exit(1);
}

let connection: Connection;
let subscriptionId: number | null = null;
let reconnectTimeout: NodeJS.Timeout;

// Metriken für die Session-Zusammenfassung
const stats = {
    startTime: new Date(),
    totalTransactionsProcessed: 0,
    crashCount: 0,
    heavyCount: 0,
    reconnects: 0
};

const showOnlyErrors = process.argv.includes('--errors');
const showOnlyHeavy = process.argv.includes('--heavy');

console.clear();
console.log(chalk.magenta.bold('=================================================='));
console.log(chalk.cyan.bold('   🔍 SolanaLog-X: Resilient Analyzer Pro v1.4   '));
if (showOnlyErrors) console.log(chalk.red.bold('   ⚠️ MODE: Only showing CRASHES (--errors)'));
else if (showOnlyHeavy) console.log(chalk.yellow.bold('   ⚠️ MODE: Only showing HIGH CU USAGE >80% (--heavy)'));
else console.log(chalk.green('   ✨ MODE: Streaming ALL transactions'));
console.log(chalk.magenta.bold('==================================================\n'));

function writeToLogFile(text: string) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${text}\n`;

        if (fs.existsSync(LOG_FILE_PATH)) {
            const currentStats = fs.statSync(LOG_FILE_PATH);
            if (currentStats.size > MAX_LOG_SIZE_BYTES) {
                // Log-Rotation: Altes Log archivieren statt löschen
                if (fs.existsSync(BACKUP_LOG_PATH)) {
                    fs.unlinkSync(BACKUP_LOG_PATH);
                }
                fs.renameSync(LOG_FILE_PATH, BACKUP_LOG_PATH);
                fs.writeFileSync(LOG_FILE_PATH, `[LOG ROTATION - PREVIOUS LOG ARCHIVED AS OLD.LOG]\n`);
            }
        }

        fs.appendFileSync(LOG_FILE_PATH, logEntry);
    } catch (err) {
        console.log(chalk.red(`⚠️ Fehler beim Schreiben in Log-Datei: ${err}`));
    }
}

function startLogListener() {
    try {
        if (subscriptionId !== null && connection) {
            connection.removeOnLogsListener(subscriptionId).catch(() => {});
        }

        connection = new Connection(ENDPOINT!, 'confirmed');
        console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] Connected to RPC WebSocket...`));
        writeToLogFile('SYSTEM: Connected to RPC WebSocket.');

        const cuRegex = /consumed (\d+) of (\d+) compute units/;

        subscriptionId = connection.onLogs(
            'all',
            (logs, context) => {
                try {
                    stats.totalTransactionsProcessed++;
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
                        stats.crashCount++;
                        writeToLogFile(`CRASH [Slot ${context.slot}]: ${errorMsg} (Sig: ${logs.signature})`);
                        if (showOnlyHeavy) return;
                        
                        console.log(chalk.red.bold(`❌ [CRASH] Slot: ${context.slot}`));
                        console.log(chalk.gray(`   Sig: ${logs.signature}`));
                        console.log(chalk.red(`   🚨 Error: "${errorMsg}"`));
                        if (parsedLines.length > 0) console.log(parsedLines.join('\n'));
                        console.log(chalk.red(`==================================================\n`));
                    } else if (parsedLines.length > 0) {
                        if (isHeavy) {
                            stats.heavyCount++;
                            writeToLogFile(`HEAVY PERFORMANCE [Slot ${context.slot}]: Sig: ${logs.signature}`);
                        }

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
            stats.reconnects++;
            console.log(chalk.red(`\n🚨 WebSocket closed! Reconnecting in 5s...`));
            writeToLogFile('SYSTEM: WebSocket connection lost. Triggering reconnect.');
            triggerReconnect();
        });

    } catch (error) {
        stats.reconnects++;
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

function printSessionSummary() {
    const durationSeconds = Math.floor((new Date().getTime() - stats.startTime.getTime()) / 1000);
    console.log(chalk.cyan.bold('\n=================================================='));
    console.log(chalk.cyan.bold('        📊 SOLANALOG-X SESSION SUMMARY'));
    console.log(chalk.cyan.bold('=================================================='));
    console.log(`⏱️  Dauer der Session:      ${durationSeconds} Sekunden`);
    console.log(`📥 Transaktionen analysiert:  ${stats.totalTransactionsProcessed}`);
    console.log(`❌ Crashes erkannt:          ${chalk.red.bold(stats.crashCount)}`);
    console.log(`⚡ Heavy CUs (>80%):         ${chalk.yellow.bold(stats.heavyCount)}`);
    console.log(`🔄 Reconnect-Versuche:       ${stats.reconnects}`);
    console.log(chalk.cyan.bold('=================================================='));
}

startLogListener();

process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nBeende WebSocket Stream sauber...'));
    writeToLogFile('SYSTEM: Process terminated by user.');
    clearTimeout(reconnectTimeout);
    if (subscriptionId !== null && connection) {
        await connection.removeOnLogsListener(subscriptionId).catch(() => {});
    }
    printSessionSummary();
    console.log(chalk.green('\nErfolgreich getrennt.'));
    process.exit();
});