import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { DynamicQueryBuilder } from "./dynamic-query-builder";

export type ImportFormat = "json" | "csv" | "xlsx";

export interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
}

export class DataImportService {
  private prisma: PrismaClient;
  private queryBuilder: DynamicQueryBuilder;

  constructor(prisma: PrismaClient, queryBuilder: DynamicQueryBuilder) {
    this.prisma = prisma;
    this.queryBuilder = queryBuilder;
  }

  /**
   * Parse file content based on format
   */
  private parseFile(
    buffer: Buffer,
    format: ImportFormat
  ): Record<string, any>[] {
    switch (format) {
      case "json": {
        const jsonData = JSON.parse(buffer.toString("utf-8"));
        return Array.isArray(jsonData) ? jsonData : [jsonData];
      }

      case "csv": {
        const csvData = parse(buffer.toString("utf-8"), {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
        return csvData as Record<string, any>[];
      }

      case "xlsx": {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const xlsxData = XLSX.utils.sheet_to_json(worksheet);
        return xlsxData as Record<string, any>[];
      }

      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
  }

  /**
   * Import data from file
   */
  async import(
    buffer: Buffer,
    format: ImportFormat,
    options: {
      skipErrors?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<ImportResult> {
    const { skipErrors = true, batchSize = 100 } = options;

    try {
      const data = this.parseFile(buffer, format);
      const result: ImportResult = {
        imported: 0,
        failed: 0,
        errors: [],
      };

      // Process in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          const rowNumber = i + j + 1; // 1-indexed

          try {
            // Clean up data (remove empty strings, convert types)
            const cleanedData = this.cleanData(row);

            await this.queryBuilder.insert(cleanedData);
            result.imported++;
          } catch (err: any) {
            result.failed++;
            result.errors.push({
              row: rowNumber,
              error: err.message || "Unknown error",
              data: row,
            });

            if (!skipErrors) {
              throw err;
            }
          }
        }
      }

      return result;
    } catch (err: any) {
      throw new Error(`Import failed: ${err.message}`);
    }
  }

  /**
   * Clean and normalize imported data
   */
  private cleanData(data: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      // Skip empty strings
      if (value === "" || value === null || value === undefined) {
        continue;
      }

      // Try to parse JSON strings
      if (
        typeof value === "string" &&
        (value.startsWith("{") || value.startsWith("["))
      ) {
        try {
          cleaned[key] = JSON.parse(value);
        } catch {
          cleaned[key] = value;
        }
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }
}
