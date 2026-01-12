export interface CalmseyConfig {
  url: string;
  apiKey: string;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  filter?: Record<string, any>;
  populate?: string | string[];
  fields?: string | string[];
}

export class CalmseyClient {
  private url: string;
  private apiKey: string;

  constructor(config: CalmseyConfig) {
    this.url = config.url.replace(/\/$/, ""); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  /**
   * Select a collection to query
   * @param collectionSlug Format: "project-slug/collection-slug" or just "collection-slug" if project is configured
   */
  from(collectionSlug: string) {
    return new QueryBuilder(this.url, this.apiKey, collectionSlug);
  }

  /**
   * Upload file(s)
   */
  async upload(projectSlug: string, file: File | File[]) {
    const formData = new FormData();
    if (Array.isArray(file)) {
      file.forEach((f) => formData.append("file", f));
      return this.request(
        `/api/upload/${projectSlug}/multiple`,
        "POST",
        formData
      );
    } else {
      formData.append("file", file);
      return this.request(`/api/upload/${projectSlug}`, "POST", formData);
    }
  }

  /**
   * Invoke a custom function
   */
  async invoke(projectSlug: string, functionSlug: string, data?: any) {
    return this.request(
      `/api/functions/${projectSlug}/${functionSlug}/invoke`,
      "POST",
      data
    );
  }

  private async request(path: string, method: string, body?: any) {
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
    };

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.url}${path}`, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body
          ? JSON.stringify(body)
          : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        message: json.error || json.message || "Unknown error",
        data: json,
      };
    }

    return json;
  }
}

class QueryBuilder {
  private url: string;
  private apiKey: string;
  private collection: string;
  private params: QueryOptions = {};
  private filterState: Record<string, any> = {};

  constructor(url: string, apiKey: string, collection: string) {
    this.url = url;
    this.apiKey = apiKey;
    this.collection = collection;
  }

  select(fields: string | string[]) {
    this.params.fields = fields;
    return this;
  }

  page(page: number) {
    this.params.page = page;
    return this;
  }

  limit(limit: number) {
    this.params.limit = limit;
    return this;
  }

  sort(field: string, order: "asc" | "desc" = "asc") {
    this.params.sort = field;
    this.params.order = order;
    return this;
  }

  populate(relations: string | string[]) {
    this.params.populate = relations;
    return this;
  }

  // Filters
  eq(field: string, value: any) {
    this.filterState[field] = value;
    return this;
  }

  neq(field: string, value: any) {
    this.setFilter(field, "$ne", value);
    return this;
  }

  gt(field: string, value: any) {
    this.setFilter(field, "$gt", value);
    return this;
  }

  gte(field: string, value: any) {
    this.setFilter(field, "$gte", value);
    return this;
  }

  lt(field: string, value: any) {
    this.setFilter(field, "$lt", value);
    return this;
  }

  lte(field: string, value: any) {
    this.setFilter(field, "$lte", value);
    return this;
  }

  in(field: string, values: any[]) {
    this.setFilter(field, "$in", values);
    return this;
  }

  like(field: string, pattern: string) {
    this.setFilter(field, "$ilike", pattern);
    return this;
  }

  private setFilter(field: string, op: string, value: any) {
    if (
      !this.filterState[field] ||
      typeof this.filterState[field] !== "object"
    ) {
      this.filterState[field] = {};
    }
    this.filterState[field][op] = value;
  }

  // Execution
  async find() {
    this.params.filter = this.filterState;
    const query = new URLSearchParams();

    Object.entries(this.params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, String(value));
      }
    });

    // Handle project/collection slug split if user passed "project/collection"
    const path = this.collection.includes("/")
      ? `/api/data/${this.collection}`
      : `/api/data/${this.collection}`; // Assumes simple path, might need adjustment based on route structure

    return this.request(`${path}?${query.toString()}`, "GET");
  }

  async findById(id: string) {
    const path = this.collection.includes("/")
      ? `/api/data/${this.collection}/${id}`
      : `/api/data/${this.collection}/${id}`;

    // Add populate params if exists
    const query = new URLSearchParams();
    if (this.params.populate) {
      query.append("populate", String(this.params.populate));
    }

    return this.request(`${path}?${query.toString()}`, "GET");
  }

  async insert(data: any) {
    const path = this.collection.includes("/")
      ? `/api/data/${this.collection}`
      : `/api/data/${this.collection}`;
    return this.request(path, "POST", data);
  }

  async update(id: string, data: any) {
    const path = this.collection.includes("/")
      ? `/api/data/${this.collection}/${id}`
      : `/api/data/${this.collection}/${id}`;
    return this.request(path, "PATCH", data);
  }

  async delete(id: string) {
    const path = this.collection.includes("/")
      ? `/api/data/${this.collection}/${id}`
      : `/api/data/${this.collection}/${id}`;
    return this.request(path, "DELETE");
  }

  private async request(path: string, method: string, body?: any) {
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${this.url}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        message: json.error || json.message || "Unknown error",
        data: json,
      };
    }

    return json;
  }
}
