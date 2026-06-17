import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const Config = {
    rpcUrl: process.env.SOLANA_RPC_URL,
    logFilePath: path.join(__dirname, '../solanalog-x.log'),
    backupLogPath: path.join(__dirname, '../solanalog-x.old.log'),
    maxLogSizeBytes: 50 * 1024, // 50KB Produktionslimit
    showOnlyErrors: process.argv.includes('--errors'),
    showOnlyHeavy: process.argv.includes('--heavy')
};

if (!Config.rpcUrl) {
    console.error('\x1b[31m%s\x1b[0m', '❌ CRITICAL ERROR: SOLANA_RPC_URL is not defined in .env file!');
    process.exit(1);
}