import * as fs from 'fs';
import chalk from 'chalk';
import { Config } from './Config';

export class FileLogger {
    public static write(text: string): void {
        try {
            const logEntry = `[${new Date().toISOString()}] ${text}\n`;

            if (fs.existsSync(Config.logFilePath)) {
                const currentStats = fs.statSync(Config.logFilePath);
                if (currentStats.size > Config.maxLogSizeBytes) {
                    if (fs.existsSync(Config.backupLogPath)) {
                        fs.unlinkSync(Config.backupLogPath);
                    }
                    fs.renameSync(Config.logFilePath, Config.backupLogPath);
                    fs.writeFileSync(Config.logFilePath, `[LOG ROTATION - PREVIOUS LOG ARCHIVED AS OLD.LOG]\n`);
                }
            }

            fs.appendFileSync(Config.logFilePath, logEntry);
        } catch (err) {
            console.error(chalk.red(`⚠️ File Logger Error: ${err}`));
        }
    }
}