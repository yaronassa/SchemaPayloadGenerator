// tslint:disable

const {execSync} = require('child_process');

class GITHooksProcessor {
    public async runFromArgs() {
        const hook = process.argv[process.argv.length - 1];
        return this.processGitHook(hook);
    }

    public async processGitHook(hookName: string) {

        switch (hookName) {
            case 'preCommit':
                return this.processPreCommit();

            default:
                throw new Error(`Unknown hook: ${hookName}`);
        }
    }

    private async processPreCommit() {
        const files: string[] = execSync('git diff --cached --name-only').toString().split('\n');

        const lintFiles = files.filter(file => file.endsWith('.ts'));

        if (lintFiles.length > 0) execSync(`./node_modules/.bin/tslint ${lintFiles.join(' ')}`);

        execSync('npm test');
    }
}

export {GITHooksProcessor};

if (require.main === module) {
    const processor = new GITHooksProcessor();
    processor.runFromArgs()
        .then(() => {
            console.log('Git hook processed');
            process.exit(0);
        })
        .catch(e => {
            console.error(`Error processing git hook : ${e.message}`);
            process.exit(1);
        });
}
