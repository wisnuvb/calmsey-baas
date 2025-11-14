import { FieldDefinition } from "../types";

/**
 * Generate meaningful text based on field name
 */
function generateMeaningfulText(fieldName: string, length?: number): string {
  const lowerName = fieldName.toLowerCase();

  // Common meaningful sentences/phrases
  const generalTexts = [
    "This is a sample text for testing purposes",
    "Example content that demonstrates functionality",
    "Sample data entry for validation testing",
    "Test content to verify system behavior",
    "Sample information for demonstration",
    "Example entry for testing purposes",
    "Test data to validate functionality",
    "Sample content for system testing",
  ];

  // Context-based texts based on field name patterns
  if (lowerName.includes("name") || lowerName.includes("title")) {
    const names = [
      "John Doe",
      "Jane Smith",
      "Product Name",
      "Sample Title",
      "Test Item",
      "Example Name",
      "Demo Product",
      "Sample Entry",
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  if (lowerName.includes("description") || lowerName.includes("desc")) {
    const descriptions = [
      "This is a sample description for testing purposes",
      "A detailed description of the item being tested",
      "Example description content for validation",
      "Sample descriptive text to demonstrate functionality",
      "Test description to verify system behavior",
      "Example content describing the test item",
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  if (lowerName.includes("content") || lowerName.includes("body")) {
    const contents = [
      "This is sample content for testing purposes. It contains multiple sentences to demonstrate text handling.",
      "Example content that shows how the system processes longer text entries. This helps validate functionality.",
      "Sample body content for testing. This text is used to verify that the system correctly handles content input.",
    ];
    return contents[Math.floor(Math.random() * contents.length)];
  }

  if (lowerName.includes("note") || lowerName.includes("comment")) {
    const notes = [
      "This is a sample note for reference",
      "Example comment for testing purposes",
      "Test note to verify functionality",
      "Sample comment entry",
    ];
    return notes[Math.floor(Math.random() * notes.length)];
  }

  if (lowerName.includes("address")) {
    const addresses = [
      "123 Main Street, City, Country",
      "456 Sample Avenue, Test City, 12345",
      "789 Example Road, Demo Town",
    ];
    return addresses[Math.floor(Math.random() * addresses.length)];
  }

  if (lowerName.includes("phone") || lowerName.includes("mobile")) {
    return `+1-555-${Math.floor(Math.random() * 9000) + 1000}-${
      Math.floor(Math.random() * 9000) + 1000
    }`;
  }

  if (lowerName.includes("status")) {
    const statuses = ["active", "pending", "completed", "inactive"];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  if (lowerName.includes("category") || lowerName.includes("type")) {
    const categories = ["General", "Standard", "Premium", "Basic", "Advanced"];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  if (lowerName.includes("tag") || lowerName.includes("label")) {
    const tags = ["sample", "test", "example", "demo", "trial"];
    return tags[Math.floor(Math.random() * tags.length)];
  }

  // Default: use general meaningful text
  const selected =
    generalTexts[Math.floor(Math.random() * generalTexts.length)];

  // If length is specified, truncate or pad
  if (length) {
    if (selected.length > length) {
      return selected.substring(0, length - 3) + "...";
    }
    if (selected.length < length) {
      return (
        selected + " " + selected.substring(0, length - selected.length - 1)
      );
    }
  }

  return selected;
}

/**
 * Generate random string (fallback for when meaningful text is not needed)
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
export function randomEmail(fieldName?: string): string {
  const domains = ["example.com", "test.com", "demo.org", "sample.net"];
  const usernames = [
    "john.doe",
    "jane.smith",
    "test.user",
    "sample.user",
    "demo.account",
  ];
  const username = fieldName
    ? fieldName.toLowerCase().replace(/[^a-z0-9]/g, ".") +
      Math.floor(Math.random() * 100)
    : usernames[Math.floor(Math.random() * usernames.length)];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username}@${domain}`;
}

/**
 * Generate random URL
 */
export function randomUrl(fieldName?: string): string {
  const protocols = ["https://", "http://"];
  const domains = ["example.com", "test.com", "demo.org", "sample.net"];
  const paths = ["", "/sample", "/test", "/example", "/demo"];
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
        // Use meaningful text instead of random string
        return generateMeaningfulText(field.name, max);
      }
      // Default: use meaningful text
      return generateMeaningfulText(field.name);

    case "text":
      if (field.validation?.min || field.validation?.max) {
        const min = field.validation.min || 10;
        const max = field.validation.max || 500;
        // Generate longer meaningful text
        const baseText = generateMeaningfulText(field.name);
        if (baseText.length < max) {
          // Repeat or extend text to meet length requirements
          const repeatCount = Math.ceil(max / baseText.length);
          return Array(repeatCount).fill(baseText).join(" ").substring(0, max);
        }
        return baseText.substring(0, max);
      }
      // Default: longer meaningful text
      return generateMeaningfulText(field.name, 100);

    case "email":
      return randomEmail(field.name);

    case "url":
      return randomUrl(field.name);

    case "number":
      if (
        field.validation?.min !== undefined ||
        field.validation?.max !== undefined
      ) {
        const min = field.validation.min ?? 0;
        const max = field.validation.max ?? 1000;
        return randomNumber(min, max);
      }
      // Use more realistic numbers based on field name
      const lowerName = field.name.toLowerCase();
      if (lowerName.includes("age")) {
        return randomNumber(18, 80);
      }
      if (
        lowerName.includes("price") ||
        lowerName.includes("cost") ||
        lowerName.includes("amount")
      ) {
        return randomNumber(10, 1000);
      }
      if (
        lowerName.includes("quantity") ||
        lowerName.includes("count") ||
        lowerName.includes("stock")
      ) {
        return randomNumber(1, 100);
      }
      return randomNumber(1, 100);

    case "boolean":
      return randomBoolean();

    case "date":
      return randomDate();

    case "datetime":
      return randomDateTime();

    case "json":
      // More meaningful JSON
      return {
        key: "sample",
        value: generateMeaningfulText(field.name, 20),
        active: true,
      };

    case "file":
      // Return a sample file path/URL
      return randomUrl(field.name) + "/sample-file.pdf";

    case "relation":
      // For relations, return a sample ID (in real scenario, this would be a valid ID from related collection)
      // Use a more realistic looking ID
      return "cm" + randomString(22); // CUID-like format

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
