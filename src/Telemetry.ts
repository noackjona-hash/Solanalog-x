import chalk from 'chalk';

export class TelemetryTracker {
    public startTime = new Date();
    public totalTransactionsProcessed = 0;
    public crashCount = 0;
    public heavyCount = 0;
    public reconnects = 0;

    public printSummary(): void {
        const durationSeconds = Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
        console.log(chalk.cyan.bold('\n=================================================='));
        console.log(chalk.cyan.bold('        📊 SOLANALOG-X SESSION SUMMARY'));
        console.log(chalk.cyan.bold('=================================================='));
        console.log(`⏱️  Duration:           ${durationSeconds} seconds`);
        console.log(`📥 Total Analyzed:     ${this.totalTransactionsProcessed}`);
        console.log(`❌ Total Crashes:      ${chalk.red.bold(this.crashCount)}`);
        console.log(`⚡ Heavy CUs (>80%):   ${chalk.yellow.bold(this.heavyCount)}`);
        console.log(`🔄 Reconnections:      ${this.reconnects}`);
        console.log(chalk.cyan.bold('=================================================='));
    }
}