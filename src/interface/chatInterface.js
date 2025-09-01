import readline from "readline";
import { Agent } from "../agent/agent.js";

export class ChatInterface {
  constructor() {
    this.agent = new Agent();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.isRunning = false;
  }

  start() {
    console.log("🎵 Multi-Source AI Agent - Music & Economics Assistant");
    console.log("=".repeat(60));
    console.log("Available data sources:");
    console.log(
      "📊 SQLite Database - Music data (artists, albums, tracks, sales)"
    );
    console.log("📚 Documents - Economics and book information");
    console.log(
      "🌐 External Data - Web APIs and system information (with approval)"
    );
    console.log("=".repeat(60));
    console.log('Type "help" for commands, "exit" to quit\n');

    this.isRunning = true;
    this.promptUser();
  }

  promptUser() {
    if (!this.isRunning) return;

    this.rl.question("🤖 You: ", async (input) => {
      const trimmedInput = input.trim();

      if (trimmedInput.toLowerCase() === "exit") {
        this.exit();
        return;
      }

      if (trimmedInput.toLowerCase() === "help") {
        this.showHelp();
        this.promptUser();
        return;
      }

      if (trimmedInput.toLowerCase() === "pending") {
        this.showPendingCommands();
        this.promptUser();
        return;
      }

      if (trimmedInput.toLowerCase() === "clear") {
        console.clear();
        this.promptUser();
        return;
      }

      if (trimmedInput.startsWith("approve ")) {
        const commandId = trimmedInput.substring(8).trim();
        await this.handleCommandApproval(commandId);
        this.promptUser();
        return;
      }

      if (trimmedInput.startsWith("reject ")) {
        const commandId = trimmedInput.substring(7).trim();
        this.handleCommandRejection(commandId);
        this.promptUser();
        return;
      }

      if (trimmedInput === "") {
        this.promptUser();
        return;
      }

      await this.processUserInput(trimmedInput);
    });
  }

  async processUserInput(input) {
    try {
      console.log("\n🔄 Processing your request...\n");

      const response = await this.agent.processQuery(input);

      // Check if response is a command approval request
      try {
        const parsed = JSON.parse(response);
        if (parsed.type === "approval_request") {
          console.log("🤖 Assistant:");
          console.log("🔒 COMMAND REQUIRES USER APPROVAL\n");
          console.log(`Command ID: ${parsed.commandId}`);
          console.log(`Description: ${parsed.description}`);
          console.log(`Command: ${parsed.command}\n`);
          console.log(
            `To approve this command, use: approve ${parsed.commandId}`
          );
          console.log(
            `To reject this command, use: reject ${parsed.commandId}\n`
          );
          console.log(
            "⚠️  Please review the command carefully before approving."
          );
        } else {
          console.log("🤖 Assistant:");
          console.log(
            typeof parsed === "string"
              ? parsed
              : JSON.stringify(parsed, null, 2)
          );
        }
      } catch {
        console.log("🤖 Assistant:");
        console.log(response);
      }

      console.log("\n" + "-".repeat(60) + "\n");
    } catch (error) {
      console.error("❌ Error:", error.message);
      console.log("\n" + "-".repeat(60) + "\n");
    }

    this.promptUser();
  }

  async handleCommandApproval(commandId) {
    try {
      console.log(`\n✅ Approving command: ${commandId}\n`);
      const result = await this.agent.approveCommand(commandId);
      console.log("🤖 Assistant:");

      try {
        const parsed = JSON.parse(result);
        if (parsed.type === "command_result") {
          if (parsed.success) {
            console.log("✅ Command executed successfully:");
            console.log(`Command: ${parsed.command}\n`);
            if (parsed.output) console.log("📤 Output:\n" + parsed.output);
            if (parsed.warnings)
              console.log("⚠️  Warnings:\n" + parsed.warnings);
          } else {
            console.log("❌ Command failed:");
            console.log(parsed.error);
          }
        } else {
          console.log(JSON.stringify(parsed, null, 2));
        }
      } catch {
        console.log(result);
      }

      console.log("\n" + "-".repeat(60) + "\n");
    } catch (error) {
      console.error("❌ Error approving command:", error.message);
    }
  }

  handleCommandRejection(commandId) {
    try {
      console.log(`\n❌ Rejecting command: ${commandId}\n`);
      const result = this.agent.rejectCommand(commandId);
      console.log("🤖 Assistant:");

      try {
        const parsed = JSON.parse(result);
        if (parsed.type === "command_rejected") {
          console.log(`✅ Command rejected: ${parsed.command}`);
        } else {
          console.log(JSON.stringify(parsed, null, 2));
        }
      } catch {
        console.log(result);
      }

      console.log("\n" + "-".repeat(60) + "\n");
    } catch (error) {
      console.error("❌ Error rejecting command:", error.message);
    }
  }

  showPendingCommands() {
    const pending = this.agent.getPendingCommands();

    if (pending.length === 0) {
      console.log("\n✅ No pending commands\n");
      return;
    }

    console.log("\n🔒 Pending Commands:");
    console.log("=".repeat(40));

    pending.forEach((cmd) => {
      console.log(`\nID: ${cmd.id}`);
      console.log(`Command: ${cmd.command}`);
      console.log(`Description: ${cmd.description}`);
      console.log(`Time: ${cmd.timestamp.toLocaleString()}`);
      console.log(`\nTo approve: approve ${cmd.id}`);
      console.log(`To reject: reject ${cmd.id}`);
    });

    console.log("\n" + "=".repeat(40) + "\n");
  }

  showHelp() {
    console.log("\n📖 Available Commands:");
    console.log("=".repeat(30));
    console.log("help          - Show this help message");
    console.log("exit          - Exit the application");
    console.log("clear         - Clear the screen");
    console.log("pending       - Show pending bash commands");
    console.log("approve <id>  - Approve a bash command");
    console.log("reject <id>   - Reject a bash command");
    console.log("\n💡 Example Questions:");
    console.log('• "How many artists are in the database?"');
    console.log('• "Who wrote The Wealth of Nations?"');
    console.log('• "What\'s the current Bitcoin price?"');
    console.log('• "Show me the top 5 albums by sales"');
    console.log('• "What is creative destruction in economics?"');
    console.log('• "Compare music sales trends with economic concepts"');
    console.log("\n" + "=".repeat(30) + "\n");
  }

  exit() {
    console.log("\n👋 Goodbye! Thanks for using the Multi-Source AI Agent!");
    this.isRunning = false;
    this.rl.close();
    process.exit(0);
  }
}

export class WebInterface {
  constructor(port = 3000) {
    this.agent = new Agent();
    this.port = port;
    this.app = null;
  }

  async start() {
    try {
      const express = await import("express");
      this.app = express.default();

      this.app.use(express.default.json());
      this.app.use(express.default.static("public"));

      // API endpoints
      this.app.post("/api/chat", this.handleChat.bind(this));
      this.app.post("/api/approve", this.handleApproval.bind(this));
      this.app.post("/api/reject", this.handleRejection.bind(this));
      this.app.get("/api/pending", this.handlePending.bind(this));

      this.app.listen(this.port, () => {
        console.log(
          `🌐 Web interface running at http://localhost:${this.port}`
        );
      });
    } catch (error) {
      console.error("Error starting web interface:", error.message);
      console.log("Falling back to terminal interface...");
      const terminalInterface = new ChatInterface();
      terminalInterface.start();
    }
  }

  async handleChat(req, res) {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await this.agent.processQuery(message);
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async handleApproval(req, res) {
    try {
      const { commandId } = req.body;
      if (!commandId) {
        return res.status(400).json({ error: "Command ID is required" });
      }

      const result = await this.agent.approveCommand(commandId);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  handleRejection(req, res) {
    try {
      const { commandId } = req.body;
      if (!commandId) {
        return res.status(400).json({ error: "Command ID is required" });
      }

      const result = this.agent.rejectCommand(commandId);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  handlePending(req, res) {
    try {
      const pending = this.agent.getPendingCommands();
      res.json({ pending });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
