import { exec } from "node:child_process";
import util from "node:util";
import chalk from "chalk";

const execAsync = util.promisify(exec);

export async function runKnip(): Promise<void> {
  try {
    const { stdout, stderr } = await execAsync("pnpm knip");
    console.log(stdout);
    if (stderr) {
      console.error(chalk.yellow("Knip stderr:"), stderr);
    }
  } catch (error: unknown) {
    const err = error as Error & { stdout?: string; stderr?: string };
    console.log(err.stdout);
    if (err.stderr) {
      console.error(chalk.red("Knip finished with issues:"), err.stderr);
    }
  }
}
