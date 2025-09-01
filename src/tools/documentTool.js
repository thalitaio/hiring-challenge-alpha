import { DynamicTool } from "@langchain/core/tools";
import fs from "fs/promises";
import path from "path";

export class DocumentTool extends DynamicTool {
  constructor(documentsPath = "./data/documents") {
    super({
      name: "document_search",
      description:
        "Search through economics books and documents for relevant information",
      func: async (query) => this._call({ query }),
    });

    this.documentsPath = path.resolve(process.cwd(), documentsPath);
  }

  async _call({ query }) {
    try {
      // Get all text files
      const files = await fs.readdir(this.documentsPath);
      const textFiles = files
        .filter((file) => file.endsWith(".txt"))
        .map((file) => path.join(this.documentsPath, file));

      // Search through documents
      const results = [];
      const searchTerms = query.toLowerCase().split(/\s+/);

      for (const file of textFiles) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const fileName = path.basename(file);

          // Simple keyword search
          const relevanceScore = this.calculateRelevance(
            content.toLowerCase(),
            searchTerms
          );

          if (relevanceScore > 0) {
            // Extract relevant paragraphs
            const paragraphs = content.split(/\n\s*\n/);
            const relevantParagraphs = paragraphs
              .filter((paragraph) =>
                searchTerms.some((term) =>
                  paragraph.toLowerCase().includes(term)
                )
              )
              .slice(0, 3); // Limit to 3 most relevant paragraphs

            if (relevantParagraphs.length > 0) {
              results.push({
                source: fileName,
                relevance: relevanceScore,
                content: relevantParagraphs.join("\n\n"),
                searchTerms: searchTerms,
              });
            }
          }
        } catch (error) {
          console.warn(
            `Warning: Could not read file ${file}: ${error.message}`
          );
        }
      }

      // Sort by relevance and limit results
      results.sort((a, b) => b.relevance - a.relevance);
      const topResults = results.slice(0, 3);

      if (topResults.length === 0) {
        return JSON.stringify(
          {
            message: "No relevant documents found for your query.",
            query: query,
            suggestions: "Try using different keywords or broader terms.",
          },
          null,
          2
        );
      }

      return JSON.stringify(
        {
          query: query,
          results: topResults.map((result) => ({
            source: result.source,
            relevance: result.relevance,
            content:
              result.content.substring(0, 500) +
              (result.content.length > 500 ? "..." : ""),
          })),
        },
        null,
        2
      );
    } catch (error) {
      throw new Error(`Error searching documents: ${error.message}`);
    }
  }

  calculateRelevance(content, searchTerms) {
    let score = 0;
    const words = content.split(/\s+/);

    for (const term of searchTerms) {
      const matches = words.filter((word) =>
        word.toLowerCase().includes(term)
      ).length;
      score += matches;
    }

    return score;
  }

  async searchDocuments(query) {
    return this._call({ query });
  }
}
