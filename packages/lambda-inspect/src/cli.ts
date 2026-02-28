#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import fs from "node:fs";
import { analyzeLambda } from "./analyzer";
import { runKnip } from "./knip-integration";

const program = new Command();

program
  .name("lambda-inspect")
  .description("Inspect Lambda functions for bad practices and unused files")
  .version("1.0.0");

program
  .argument("<handler>", "Path to the Lambda handler file")
  .option("--skip-unused-files", "Skip unused files detection", false)
  .action(async (handlerPath, options) => {
    try {
      const absoluteHandlerPath = path.resolve(process.cwd(), handlerPath);

      if (!fs.existsSync(absoluteHandlerPath)) {
        console.error(chalk.red(`Error: File not found at ${absoluteHandlerPath}`));
        process.exit(1);
      }

      console.log(chalk.blue(`Inspecting Lambda at: ${absoluteHandlerPath}`));

      const badPractices = await analyzeLambda(absoluteHandlerPath);
      if (badPractices.length > 0) {
        console.log(chalk.yellow("\n⚠️  Bad Practices Detected:"));
        badPractices.forEach((bp) => {
          console.log(chalk.yellow(`- ${bp.message} [file: ${bp.file}]`));
        });
      } else {
        console.log(chalk.green("\n✅ No bad practices detected in handler."));
      }

      if (!options.skipUnusedFiles) {
        console.log(chalk.blue("\nRunning Knip analysis..."));
        await runKnip();
      }
    } catch (error) {
      console.error(chalk.red("An error occurred during inspection:"), error);
      process.exit(1);
    }
  });

program.parse();
