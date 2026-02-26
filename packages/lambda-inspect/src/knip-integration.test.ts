import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import chalk from "chalk";
import { runKnip } from "./knip-integration";

const { mockExecAsync } = vi.hoisted(() => {
  return { mockExecAsync: vi.fn() };
});

vi.mock("node:util", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    default: {
      ...(actual.default as Record<string, unknown>),
      promisify: () => mockExecAsync
    }
  };
});

describe("runKnip", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  
  beforeEach(() => {
    mockExecAsync.mockClear();
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });
  
  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should output stdout on success", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "success output", stderr: "" });
    
    await runKnip();
    
    expect(mockExecAsync).toHaveBeenCalledWith("pnpm knip");
    expect(consoleLogSpy).toHaveBeenCalledWith("success output");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should output stderr on success if present", async () => {
    mockExecAsync.mockResolvedValue({ stdout: "success output", stderr: "some warning" });
    
    await runKnip();
    
    expect(mockExecAsync).toHaveBeenCalledWith("pnpm knip");
    expect(consoleLogSpy).toHaveBeenCalledWith("success output");
    expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.yellow("Knip stderr:"), "some warning");
  });

  it("should output stdout and stderr from error if command fails", async () => {
    const error = new Error("Command failed") as Error & { stdout: string; stderr: string };
    error.stdout = "error output";
    error.stderr = "issue found";
    mockExecAsync.mockRejectedValue(error);
    
    await runKnip();
    
    expect(mockExecAsync).toHaveBeenCalledWith("pnpm knip");
    expect(consoleLogSpy).toHaveBeenCalledWith("error output");
    expect(consoleErrorSpy).toHaveBeenCalledWith(chalk.red("Knip finished with issues:"), "issue found");
  });

  it("should only output stdout from error if no stderr present", async () => {
    const error = new Error("Command failed") as Error & { stdout: string; stderr: string };
    error.stdout = "error output";
    error.stderr = "";
    mockExecAsync.mockRejectedValue(error);
    
    await runKnip();
    
    expect(mockExecAsync).toHaveBeenCalledWith("pnpm knip");
    expect(consoleLogSpy).toHaveBeenCalledWith("error output");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
