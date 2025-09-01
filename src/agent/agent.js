import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { SQLiteTool } from "../tools/sqliteTool.js";
import { DocumentTool } from "../tools/documentTool.js";
import { BashTool } from "../tools/bashTool.js";

export class Agent {
  constructor() {
    // Check if we have a valid OpenAI API key
    this.hasValidAPI =
      process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== "your_openai_api_key_here" &&
      (process.env.OPENAI_API_KEY.startsWith("sk-") ||
        process.env.OPENAI_API_KEY.startsWith("sk-proj-"));

    if (this.hasValidAPI) {
      // Initialize LLM
      this.llm = new ChatOpenAI({
        modelName: process.env.MODEL_NAME || "gpt-3.5-turbo",
        temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
        maxTokens: parseInt(process.env.MAX_TOKENS) || 500,
      });

      // Initialize prompts
      this.prompts = {
        analyze: ChatPromptTemplate.fromTemplate(`
          You are a helpful AI assistant that analyzes user queries and determines which tool to use.
          
          Available tools:
          1. sqlite_database - For querying music database (artists, albums, tracks, sales)
          2. document_search - For searching economics books and documents
          3. bash_command - For executing system commands and getting external data
          
          User query: {query}
          
          Select the most appropriate tool and explain why.
          Respond with a JSON object containing:
          {{
            "tool_name": "one of: sqlite_database, document_search, bash_command",
            "reasoning": "brief explanation of your choice"
          }}
        `),

        generateInput: ChatPromptTemplate.fromTemplate(`
          Generate appropriate input for the {tool_name} tool.
          
          User query: {query}
          Previous results: {previous_results}
          
          Tool input requirements:
          - sqlite_database: SQL query string
          - document_search: Search terms string
          - bash_command: JSON string with command and description
          
          Generate the input only, no explanation needed.
        `),

        synthesize: ChatPromptTemplate.fromTemplate(`
          Create a natural language response based on the tool results.
          
          User query: {query}
          Tool used: {tool_name}
          Tool output: {tool_output}
          
          Generate a clear and helpful response, explaining the results and suggesting follow-up queries if relevant.
        `),
      };
    } else {
      console.log(
        "⚠️  OpenAI API key not available. Using fallback mode with limited functionality."
      );
    }

    // Initialize tools
    this.tools = {
      sqlite_database: new SQLiteTool(),
      document_search: new DocumentTool(),
      bash_command: new BashTool(),
    };
  }

  async processQuery(query) {
    try {
      if (this.hasValidAPI) {
        return await this.processWithLLM(query);
      } else {
        return await this.processWithFallback(query);
      }
    } catch (error) {
      return `Error processing query: ${error.message}`;
    }
  }

  async processWithLLM(query) {
    // Step 1: Analyze query and select tool
    const analysisResult = await this.prompts.analyze
      .pipe(this.llm)
      .pipe(new StringOutputParser())
      .invoke({ query });

    const { tool_name, reasoning } = JSON.parse(analysisResult);
    console.log(`\n🔍 Selected tool: ${tool_name}\n   Reason: ${reasoning}\n`);

    // Step 2: Generate tool input
    const toolInput = await this.prompts.generateInput
      .pipe(this.llm)
      .pipe(new StringOutputParser())
      .invoke({
        query,
        tool_name,
        previous_results: "[]",
      });

    // Step 3: Execute tool
    const tool = this.tools[tool_name];
    if (!tool) {
      throw new Error(`Tool not found: ${tool_name}`);
    }

    const toolOutput = await tool.call(toolInput);

    // Step 4: Generate response
    const response = await this.prompts.synthesize
      .pipe(this.llm)
      .pipe(new StringOutputParser())
      .invoke({
        query,
        tool_name,
        tool_output: toolOutput,
      });

    return response;
  }

  async processWithFallback(query) {
    const lowerQuery = query.toLowerCase();

    // Simple keyword-based routing
    let toolName = "document_search"; // default
    let reasoning = "Defaulting to document search";

    if (
      lowerQuery.includes("hora") ||
      lowerQuery.includes("time") ||
      lowerQuery.includes("data") ||
      lowerQuery.includes("date")
    ) {
      toolName = "bash_command";
      reasoning = "Query about time/date - using bash command";
    } else if (
      lowerQuery.includes("artista") ||
      lowerQuery.includes("album") ||
      lowerQuery.includes("música") ||
      lowerQuery.includes("music") ||
      lowerQuery.includes("track") ||
      lowerQuery.includes("venda") ||
      lowerQuery.includes("sale")
    ) {
      toolName = "sqlite_database";
      reasoning = "Query about music data - using SQLite database";
    } else if (
      lowerQuery.includes("economia") ||
      lowerQuery.includes("economics") ||
      lowerQuery.includes("livro") ||
      lowerQuery.includes("book") ||
      lowerQuery.includes("documento") ||
      lowerQuery.includes("document")
    ) {
      toolName = "document_search";
      reasoning = "Query about economics/documents - using document search";
    }

    console.log(`\n🔍 Selected tool: ${toolName}\n   Reason: ${reasoning}\n`);

    // Generate simple input based on tool
    let toolInput;
    switch (toolName) {
      case "sqlite_database":
        if (lowerQuery.includes("quantos") || lowerQuery.includes("how many")) {
          toolInput = "SELECT COUNT(*) as count FROM Artist";
        } else if (
          lowerQuery.includes("artista") ||
          lowerQuery.includes("artist")
        ) {
          toolInput = "SELECT * FROM Artist LIMIT 10";
        } else if (
          lowerQuery.includes("album") ||
          lowerQuery.includes("album")
        ) {
          toolInput = "SELECT * FROM Album LIMIT 10";
        } else {
          toolInput = "SELECT * FROM Artist LIMIT 5";
        }
        break;

      case "document_search":
        toolInput = query;
        break;

      case "bash_command":
        if (lowerQuery.includes("hora") || lowerQuery.includes("time")) {
          toolInput = JSON.stringify({
            command: "date",
            description: "Get current date and time",
          });
        } else {
          toolInput = JSON.stringify({
            command: "date",
            description: "Get current date and time",
          });
        }
        break;

      default:
        toolInput = query;
    }

    // Execute tool
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const toolOutput = await tool.call(toolInput);

    // Generate simple response
    return this.generateSimpleResponse(query, toolName, toolOutput);
  }

  generateSimpleResponse(query, toolName, toolOutput) {
    const lowerQuery = query.toLowerCase();

    if (toolName === "sqlite_database") {
      try {
        const results = JSON.parse(toolOutput);
        if (results.length === 0) {
          return "Não encontrei resultados para sua consulta no banco de dados de música.";
        }
        return `Encontrei ${
          results.length
        } resultado(s) no banco de dados de música:\n\n${JSON.stringify(
          results,
          null,
          2
        )}`;
      } catch {
        return `Resultado da consulta SQL: ${toolOutput}`;
      }
    } else if (toolName === "document_search") {
      try {
        const results = JSON.parse(toolOutput);
        if (results.message) {
          return results.message;
        }
        return `Encontrei ${
          results.results.length
        } documento(s) relevante(s):\n\n${results.results
          .map(
            (r) => `📚 ${r.source} (relevância: ${r.relevance})\n${r.content}\n`
          )
          .join("\n")}`;
      } catch {
        return `Resultado da busca em documentos: ${toolOutput}`;
      }
    } else if (toolName === "bash_command") {
      try {
        const result = JSON.parse(toolOutput);
        if (result.type === "approval_request") {
          return result.message;
        }
        return `Resultado do comando: ${toolOutput}`;
      } catch {
        return `Resultado do comando bash: ${toolOutput}`;
      }
    }

    return `Processei sua consulta usando ${toolName}. Resultado: ${toolOutput}`;
  }

  async approveCommand(commandId) {
    return await this.tools.bash_command.executeApprovedCommand(commandId);
  }

  rejectCommand(commandId) {
    return this.tools.bash_command.rejectCommand(commandId);
  }

  getPendingCommands() {
    return this.tools.bash_command.getPendingCommands();
  }
}
