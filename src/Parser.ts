import chalk from 'chalk';

export interface ParsedResult {
    hasError: boolean;
    isHeavy: boolean;
    errorMsg: string;
    formattedLines: string[];
}

export class LogParser {
    private static cuRegex = /consumed (\d+) of (\d+) compute units/;

    public static parse(logs: string[]): ParsedResult {
        let hasError = false;
        let isHeavy = false;
        let errorMsg = '';
        const formattedLines: string[] = [];

        logs.forEach((line) => {
            if (line.includes('failed:')) {
                hasError = true;
                errorMsg = line.split('failed:')[1].trim();
                return;
            }

            const cuMatch = line.match(this.cuRegex);
            if (cuMatch) {
                const used = parseInt(cuMatch[1]);
                const total = parseInt(cuMatch[2]);
                const pct = (used / total) * 100;
                
                if (pct > 80) isHeavy = true;

                let color = chalk.green;
                if (pct > 80) color = chalk.red.bold;
                else if (pct > 50) color = chalk.yellow;

                formattedLines.push(`    ⚡ ${color(`${pct.toFixed(1)}% CUs used`)} (${used}/${total})`);
                return;
            }

            if (line.includes('Instruction:')) {
                const inst = line.split('Instruction:')[1].trim();
                formattedLines.push(`    📥 ${chalk.bold.yellow(`Exec: ${inst}`)}`);
                return;
            }
        });

        return { hasError, isHeavy, errorMsg, formattedLines };
    }
}