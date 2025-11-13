import { FieldDefinition } from "../types";

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function randomEmail(): string {
  const domains = ["example.com", "test.com", "demo.org", "sample.net"];
  const username = randomString(8).toLowerCase();
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}@${domain}`;
}

/**
 * Generate random URL
 */
export function randomUrl(): string {
  const protocols = ["https://", "http://"];
  const domains = ["example.com", "test.com", "demo.org"];
  const paths = ["", "/path", "/api", "/users", "/products"];
  const protocol = protocols[Math.floor(Math.random() * protocols.length)];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const path = paths[Math.floor(Math.random() * paths.length)];
  return `${protocol}${domain}${path}`;
}

/**
 * Generate random number
 */
export function randomNumber(min: number = 0, max: number = 1000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random boolean
 */
export function randomBoolean(): boolean {
  return Math.random() > 0.5;
}

/**
 * Generate random date
 */
export function randomDate(start?: Date, end?: Date): string {
  const startDate = start || new Date(2020, 0, 1);
  const endDate = end || new Date();
  const randomTime =
    startDate.getTime() +
    Math.random() * (endDate.getTime() - startDate.getTime());
  return new Date(randomTime).toISOString().split("T")[0];
}

/**
 * Generate random datetime
 */
export function randomDateTime(start?: Date, end?: Date): string {
  const startDate = start || new Date(2020, 0, 1);
  const endDate = end || new Date();
  const randomTime =
    startDate.getTime() +
    Math.random() * (endDate.getTime() - startDate.getTime());
  return new Date(randomTime).toISOString();
}

/**
 * Generate random JSON object
 */
export function randomJson(): any {
  const types = ["object", "array", "string", "number", "boolean"];
  const type = types[Math.floor(Math.random() * types.length)];

  switch (type) {
    case "object":
      return {
        key1: randomString(5),
        key2: randomNumber(1, 100),
        key3: randomBoolean(),
      };
    case "array":
      return [randomString(5), randomNumber(1, 100), randomBoolean()];
    case "string":
      return randomString(10);
    case "number":
      return randomNumber(1, 100);
    case "boolean":
      return randomBoolean();
    default:
      return {};
  }
}

/**
 * Generate random value based on field definition
 */
export function generateRandomValue(field: FieldDefinition): any {
  // If field has default value, use it
  if (field.default !== undefined && field.default !== null) {
    return field.default;
  }

  // If field has enum validation, pick random from enum
  if (field.validation?.enum && field.validation.enum.length > 0) {
    const randomIndex = Math.floor(
      Math.random() * field.validation.enum.length
    );
    return field.validation.enum[randomIndex];
  }

  // Generate based on field type
  switch (field.type) {
    case "string":
      if (field.validation?.min || field.validation?.max) {
        const min = field.validation.min || 1;
        const max = field.validation.max || 255;
        const length = randomNumber(min, max);
        return randomString(length);
      }
      return randomString(10);

    case "text":
      if (field.validation?.min || field.validation?.max) {
        const min = field.validation.min || 10;
        const max = field.validation.max || 500;
        const length = randomNumber(min, max);
        return randomString(length);
      }
      return randomString(50);

    case "email":
      return randomEmail();

    case "url":
      return randomUrl();

    case "number":
      if (
        field.validation?.min !== undefined ||
        field.validation?.max !== undefined
      ) {
        const min = field.validation.min ?? 0;
        const max = field.validation.max ?? 1000;
        return randomNumber(min, max);
      }
      return randomNumber(1, 100);

    case "boolean":
      return randomBoolean();

    case "date":
      return randomDate();

    case "datetime":
      return randomDateTime();

    case "json":
      return randomJson();

    case "file":
      // Return a sample file path/URL
      return randomUrl() + "/file.pdf";

    case "relation":
      // For relations, return a sample ID (in real scenario, this would be a valid ID from related collection)
      return randomString(24); // CUID-like length

    default:
      return null;
  }
}

/**
 * Generate payload object from collection fields
 */
export function generatePayloadFromFields(
  fields: FieldDefinition[],
  includeOptional: boolean = false
): Record<string, any> {
  const payload: Record<string, any> = {};

  fields.forEach((field) => {
    // Skip system fields
    if (
      field.name === "id" ||
      field.name.startsWith("createdAt") ||
      field.name.startsWith("updatedAt") ||
      field.name.startsWith("deletedAt")
    ) {
      return;
    }

    // Include required fields or all fields if includeOptional is true
    if (field.required || includeOptional) {
      payload[field.name] = generateRandomValue(field);
    }
  });

  return payload;
}
