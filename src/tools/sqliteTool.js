import { DynamicTool } from "@langchain/core/tools";
import sqlite3 from "sqlite3";
import path from "path";

export class SQLiteTool extends DynamicTool {
  constructor(dbPath = "./data/sqlite/music.db") {
    super({
      name: "sqlite_database",
      description: `Query the music database. Available tables:
        - Artist (ArtistId, Name)
        - Album (AlbumId, Title, ArtistId)
        - Track (TrackId, Name, AlbumId, MediaTypeId, GenreId, Composer, Milliseconds, Bytes, UnitPrice)
        - Genre (GenreId, Name)
        - Customer (CustomerId, FirstName, LastName)
        - Invoice (InvoiceId, CustomerId, Total)
      Only SELECT queries are allowed.`,
      func: async (query) => this._call({ query }),
    });

    this.dbPath = path.resolve(process.cwd(), dbPath);
  }

  async _call({ query }) {
    try {
      // Validate that the query is safe
      const lowerQuery = query.toLowerCase().trim();
      if (
        lowerQuery.includes("drop") ||
        lowerQuery.includes("delete") ||
        lowerQuery.includes("insert") ||
        lowerQuery.includes("update") ||
        lowerQuery.includes("alter") ||
        lowerQuery.includes("create")
      ) {
        throw new Error("Only SELECT queries are allowed for safety");
      }

      if (!lowerQuery.startsWith("select")) {
        throw new Error("Only SELECT queries are allowed");
      }

      const results = await this.executeQuery(query);
      return JSON.stringify(results, null, 2);
    } catch (error) {
      throw new Error(`Error executing query: ${error.message}`);
    }
  }

  async executeQuery(query) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to connect to database: ${err.message}`));
          return;
        }
      });

      db.all(query, [], (err, rows) => {
        if (err) {
          reject(new Error(`Query execution failed: ${err.message}`));
          return;
        }

        db.close((closeErr) => {
          if (closeErr) {
            console.warn(
              "Warning: Failed to close database connection:",
              closeErr.message
            );
          }
        });

        resolve(rows || []);
      });
    });
  }

  async getSchema() {
    const schemaQuery = `
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `;

    try {
      return await this.executeQuery(schemaQuery);
    } catch (error) {
      throw new Error(`Failed to get schema: ${error.message}`);
    }
  }
}
