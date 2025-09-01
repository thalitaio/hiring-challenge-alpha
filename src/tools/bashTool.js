import { DynamicTool } from "@langchain/core/tools";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class BashTool extends DynamicTool {
  constructor() {
    super({
      name: "bash_command",
      description: `Execute bash commands to get external data. Available commands:
        - date (get current date/time)
        - curl (fetch web content)
        - weather information
        - cryptocurrency prices
        All commands require user approval before execution.`,
      func: async (input) => this._call(input),
    });

    this.pendingCommands = new Map();
  }

  async _call(input) {
    try {
      const { command, description } = JSON.parse(input);

      // Validate command for security
      const validation = this.validateCommand(command);
      if (!validation.isValid) {
        throw new Error(`Command rejected: ${validation.reason}`);
      }

      // Store command for user approval
      const commandId = this.generateCommandId();
      this.pendingCommands.set(commandId, {
        command,
        description,
        timestamp: new Date(),
      });

      return this.formatApprovalRequest(commandId, command, description);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          "Invalid input format. Expected JSON with command and description."
        );
      }
      throw error;
    }
  }

  validateCommand(command) {
    const dangerousPatterns = [
      /rm\s+-rf/,
      /sudo\s+/,
      /chmod\s+777/,
      /chown\s+/,
      /passwd/,
      /useradd/,
      /userdel/,
      /groupadd/,
      /groupdel/,
      /mount/,
      /umount/,
      /fdisk/,
      /mkfs/,
      /dd\s+if=/,
      /nc\s+/,
      /netcat/,
      /wget\s+.*-O\s+\/dev\/shm/,
      /curl\s+.*-o\s+\/dev\/shm/,
      />\s*\/etc\//,
      />>\s*\/etc\//,
      /cat\s+>.*\/etc\//,
      /echo\s+.*>\s*\/etc\//,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return {
          isValid: false,
          reason: `Command contains potentially dangerous pattern: ${pattern}`,
        };
      }
    }

    // Allow safe commands
    const safeCommands = [
      /^curl\s+/,
      /^wget\s+/,
      /^ping\s+/,
      /^nslookup\s+/,
      /^dig\s+/,
      /^date/,
      /^uptime/,
      /^whoami/,
      /^pwd/,
      /^ls\s+/,
      /^cat\s+/,
      /^grep\s+/,
      /^head\s+/,
      /^tail\s+/,
      /^wc\s+/,
      /^sort\s+/,
      /^uniq\s+/,
      /^cut\s+/,
      /^awk\s+/,
      /^sed\s+/,
      /^find\s+/,
      /^which\s+/,
      /^whereis\s+/,
      /^ps\s+/,
      /^top\s*/,
      /^df\s+/,
      /^du\s+/,
      /^free\s*/,
      /^uname\s*/,
      /^hostname/,
      /^id\s*/,
      /^groups\s*/,
      /^env\s*/,
      /^printenv\s*/,
      /^history\s*/,
      /^echo\s+[^>]/,
      /^printf\s+/,
    ];

    const isSafe = safeCommands.some((pattern) => pattern.test(command));
    if (!isSafe) {
      return {
        isValid: false,
        reason: "Command not in the list of allowed safe commands",
      };
    }

    return { isValid: true };
  }

  generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatApprovalRequest(commandId, command, description) {
    return JSON.stringify({
      type: "approval_request",
      commandId,
      command,
      description,
      message: `Command requires approval:\n${description}\nCommand: ${command}\n\nTo approve, use: approve ${commandId}`,
    });
  }

  async executeApprovedCommand(commandId) {
    const commandData = this.pendingCommands.get(commandId);
    if (!commandData) {
      throw new Error(`Command ${commandId} not found or already executed`);
    }

    try {
      const { stdout, stderr } = await execAsync(commandData.command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      // Remove from pending commands
      this.pendingCommands.delete(commandId);

      return JSON.stringify({
        type: "command_result",
        success: true,
        command: commandData.command,
        output: stdout,
        warnings: stderr,
      });
    } catch (error) {
      // Remove from pending commands even on error
      this.pendingCommands.delete(commandId);

      throw new Error(`Command execution failed: ${error.message}`);
    }
  }

  rejectCommand(commandId) {
    const commandData = this.pendingCommands.get(commandId);
    if (!commandData) {
      throw new Error(`Command ${commandId} not found`);
    }

    this.pendingCommands.delete(commandId);
    return JSON.stringify({
      type: "command_rejected",
      commandId,
      command: commandData.command,
    });
  }

  getPendingCommands() {
    const commands = [];
    for (const [id, data] of this.pendingCommands.entries()) {
      commands.push({
        id,
        command: data.command,
        description: data.description,
        timestamp: data.timestamp,
      });
    }
    return commands;
  }
}
