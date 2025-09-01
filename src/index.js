import { config } from "dotenv";
import { ChatInterface, WebInterface } from "./interface/chatInterface.js";

// Load environment variables
config();

/**
 * Main entry point for the Multi-Source AI Agent
 */
async function main() {
  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      "\n⚠️  Warning: OPENAI_API_KEY not found in environment variables"
    );
    console.warn(
      "The agent will have limited functionality without an OpenAI API key"
    );
    console.warn("Please set up your .env file with your OpenAI API key\n");
  }

  // Check command line arguments
  const args = process.argv.slice(2);
  const useWebInterface = args.includes("--web") || args.includes("-w");
  const port =
    args.find((arg) => arg.startsWith("--port="))?.split("=")[1] || 3000;

  try {
    if (useWebInterface) {
      console.log("🌐 Starting web interface...");
      const webInterface = new WebInterface(parseInt(port));
      await webInterface.start();
    } else {
      console.log("💻 Starting terminal interface...");
      const chatInterface = new ChatInterface();
      chatInterface.start();
    }
  } catch (error) {
    console.error("❌ Failed to start application:", error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down gracefully...");
  process.exit(0);
});

// Start the application
main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
