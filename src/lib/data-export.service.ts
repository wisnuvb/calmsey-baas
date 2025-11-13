import { PrismaClient } from "@prisma/client";
import { stringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";
import { DynamicQueryBuilder } from "./dynamic-query-builder";
import { CollectionSchema, QueryParams } from "../types";

export type ExportFormat = "json" | "csv" | "xlsx";

export class DataExportService {
  private prisma: PrismaClient;
  private queryBuilder: DynamicQueryBuilder;

  constructor(prisma: PrismaClient, queryBuilder: DynamicQueryBuilder) {
    this.prisma = prisma;
    this.queryBuilder = queryBuilder;
  }

  /**
   * Export data to specified format
   */
  async export(
    format: ExportFormat,
    params: QueryParams = {}
  ): Promise<Buffer> {
    // Fetch all data (no pagination for export)
    const result = await this.queryBuilder.findMany({
      ...params,
      limit: 10000, // Max export limit
    });

    const data = result.data;

    switch (format) {
      case "json":
        return Buffer.from(JSON.stringify(data, null, 2), "utf-8");

      case "csv":
        if (data.length === 0) {
          return Buffer.from("", "utf-8");
        }

        // Get all unique keys from all records
        const allKeys = new Set<string>();
        data.forEach((record) => {
          Object.keys(record).forEach((key) => allKeys.add(key));
        });

        const headers = Array.from(allKeys);
        const rows = data.map((record) =>
          headers.map((header) => {
            const value = record[header];
            if (value === null || value === undefined) {
              return "";
            }
            if (typeof value === "object") {
              return JSON.stringify(value);
            }
            return String(value);
          })
        );

        const csvData = [headers, ...rows];
        const csvString = stringify(csvData, {
          header: true,
          quoted: true,
        });

        return Buffer.from(csvString, "utf-8");

      case "xlsx":
        if (data.length === 0) {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet([]);
          XLSX.utils.book_append_sheet(wb, ws, "Data");
          return Buffer.from(
            XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
          );
        }

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        return Buffer.from(
          XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
        );

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get MIME type for format
   */
  getMimeType(format: ExportFormat): string {
    switch (format) {
      case "json":
        return "application/json";
      case "csv":
        return "text/csv";
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Get file extension for format
   */
  getFileExtension(format: ExportFormat): string {
    return format;
  }
}
