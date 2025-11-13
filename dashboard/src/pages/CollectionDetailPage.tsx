import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
  Collection,
  Project,
  ApiResponse,
  FieldDefinition,
  ApiKey,
} from "../types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { formatDate } from "../lib/utils";
import {
  ArrowLeft,
  Copy,
  Play,
  Code,
  Database,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Upload,
} from "lucide-react";
import React from "react";
import { generatePayloadFromFields } from "../lib/random-generator";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type ApiEndpoint = {
  method: HttpMethod;
  path: string;
  description: string;
  requiresId?: boolean;
  queryParams?: string[];
};

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(
    null
  );
  const [requestPayload, setRequestPayload] = useState<string>("");
  const [response, setResponse] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [itemId, setItemId] = useState<string>("");
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchCollection();
    }
  }, [id]);

  const fetchCollection = async () => {
    if (!id) return;
    try {
      const response = await api.get<ApiResponse<Collection>>(
        `/collections/${id}`
      );
      if (response.data.success && response.data.data) {
        const coll = response.data.data;
        setCollection(coll);
        fetchProject(coll.projectId);
      }
    } catch (error) {
      console.error("Failed to fetch collection:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProject = async (projectId: string) => {
    try {
      const response = await api.get<ApiResponse<Project>>(
        `/projects/${projectId}`
      );
      if (response.data.success && response.data.data) {
        const proj = response.data.data;
        setProject(proj);
        // Fetch API keys for this project
        fetchApiKeys(projectId);
      }
    } catch (error) {
      console.error("Failed to fetch project:", error);
    }
  };

  const fetchApiKeys = async (projectId: string) => {
    try {
      const response = await api.get<ApiResponse<Project>>(
        `/projects/${projectId}`
      );
      if (response.data.success && response.data.data) {
        const keys = response.data.data.apiKeys || [];
        setApiKeys(keys);
        // Auto-set first API key if available
        if (keys.length > 0 && !apiKey) {
          setApiKey(keys[0].key);
        }
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    }
  };

  const getApiBaseUrl = () => {
    // @ts-ignore
    return import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  };

  const getCollectionApiUrl = (endpoint?: string) => {
    if (!project?.slug || !collection?.slug) return "";
    const base = `${getApiBaseUrl()}/data/${project.slug}/${collection.slug}`;
    return endpoint ? `${base}/${endpoint}` : base;
  };

  const endpoints: ApiEndpoint[] = [
    {
      method: "GET",
      path: getCollectionApiUrl(),
      description: "List all items with pagination and filtering",
      requiresId: false,
      queryParams: [
        "page",
        "limit",
        "sort",
        "order",
        "search",
        "filter",
        "populate",
        "fields",
      ],
    },
    {
      method: "GET",
      path: getCollectionApiUrl(":id"),
      description: "Get a single item by ID",
      requiresId: true,
      queryParams: ["populate"],
    },
    {
      method: "GET",
      path: getCollectionApiUrl("count"),
      description: "Count items matching filter",
      requiresId: false,
      queryParams: ["filter"],
    },
    {
      method: "GET",
      path: getCollectionApiUrl("aggregate"),
      description: "Aggregate data with grouping and functions",
      requiresId: false,
      queryParams: ["filter", "groupBy", "sum", "avg", "min", "max", "count"],
    },
    {
      method: "GET",
      path: getCollectionApiUrl("stats"),
      description: "Get collection statistics",
      requiresId: false,
      queryParams: ["filter"],
    },
    {
      method: "POST",
      path: getCollectionApiUrl(),
      description: "Create a new item",
      requiresId: false,
    },
    {
      method: "POST",
      path: getCollectionApiUrl("bulk"),
      description: "Bulk create multiple items",
      requiresId: false,
    },
    {
      method: "PATCH",
      path: getCollectionApiUrl(":id"),
      description: "Update an existing item",
      requiresId: true,
    },
    {
      method: "PATCH",
      path: getCollectionApiUrl("bulk"),
      description: "Bulk update items matching filter",
      requiresId: false,
    },
    {
      method: "DELETE",
      path: getCollectionApiUrl(":id"),
      description: "Delete an item",
      requiresId: true,
    },
    {
      method: "DELETE",
      path: getCollectionApiUrl("bulk"),
      description: "Bulk delete items matching filter",
      requiresId: false,
      queryParams: ["filter"],
    },
    {
      method: "GET",
      path: getCollectionApiUrl("export"),
      description: "Export data to JSON, CSV, or XLSX",
      requiresId: false,
      queryParams: ["format", "filter", "fields"],
    },
    {
      method: "POST",
      path: getCollectionApiUrl("import"),
      description: "Import data from file (JSON, CSV, or XLSX)",
      requiresId: false,
    },
  ];

  const getExamplePayload = (method: HttpMethod, endpoint?: ApiEndpoint) => {
    if (!collection) return "";
    const schema = collection.schema as any;
    const fields = schema?.fields || [];

    if (method === "POST") {
      if (endpoint?.path.includes("bulk")) {
        // Bulk create payload
        const includeOptional = false;
        const payload1 = generatePayloadFromFields(fields, includeOptional);
        const payload2 = generatePayloadFromFields(fields, includeOptional);
        return JSON.stringify({ data: [payload1, payload2] }, null, 2);
      } else {
        // Single create
        const includeOptional = false;
        const payload = generatePayloadFromFields(fields, includeOptional);
        return JSON.stringify(payload, null, 2);
      }
    }

    if (method === "PATCH") {
      if (endpoint?.path.includes("bulk")) {
        // Bulk update payload
        return JSON.stringify(
          {
            where: { status: "pending" },
            data: { status: "active", updatedAt: new Date().toISOString() },
          },
          null,
          2
        );
      } else {
        // Single update
        const includeOptional = true;
        const payload = generatePayloadFromFields(fields, includeOptional);
        return JSON.stringify(payload, null, 2);
      }
    }

    return "";
  };

  const buildUrlWithParams = (endpoint: ApiEndpoint): string => {
    let url = endpoint.path;

    // Replace :id placeholder if needed
    if (endpoint.requiresId && itemId) {
      url = url.replace(":id", itemId);
    } else if (endpoint.requiresId && !itemId) {
      url = url.replace(":id", "YOUR_ITEM_ID");
    }

    // Add query parameters
    const params = new URLSearchParams();

    // Handle special aggregation params
    if (endpoint.path.includes("aggregate")) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value && value.trim()) {
          params.append(key, value.trim());
        }
      });
    } else {
      // Standard query params
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value && value.trim()) {
          // For filter, keep as JSON string
          if (key === "filter") {
            try {
              // Validate it's valid JSON
              JSON.parse(value);
              params.append(key, value);
            } catch {
              // If not valid JSON, try to parse as object notation
              params.append(key, value);
            }
          } else {
            params.append(key, value.trim());
          }
        }
      });
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  };

  const handleTestApi = async () => {
    if (!selectedEndpoint || !apiKey) {
      alert("Please select an endpoint and provide API key");
      return;
    }

    if (selectedEndpoint.requiresId && !itemId) {
      alert("Please provide an item ID");
      return;
    }

    setTesting(true);
    setResponse(null);

    try {
      const url = buildUrlWithParams(selectedEndpoint);

      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
      };

      if (
        (selectedEndpoint.method === "POST" ||
          selectedEndpoint.method === "PATCH") &&
        requestPayload
      ) {
        options.body = requestPayload;
      }

      const res = await fetch(url, options);
      const data = await res.json();

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        url: url, // Include URL in response for reference
      });
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: "Error",
        data: { error: error.message },
        url: buildUrlWithParams(selectedEndpoint),
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Add export handler
  const handleExport = async (format: "json" | "csv" | "xlsx") => {
    if (!apiKey) {
      alert("Please provide API key");
      return;
    }

    try {
      const url = `${getCollectionApiUrl("export")}?format=${format}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Export failed");
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${collection?.slug || "data"}_${
        new Date().toISOString().split("T")[0]
      }.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      alert(`Export failed: ${error.message}`);
    }
  };

  // Add import handler
  const handleImport = async (file: File) => {
    if (!apiKey) {
      alert("Please provide API key");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(getCollectionApiUrl("import"), {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        alert(
          `Import completed! ${result.imported} imported, ${result.failed} failed.`
        );
        if (result.errors && result.errors.length > 0) {
          console.error("Import errors:", result.errors);
        }
      } else {
        alert(result.error || "Import failed");
      }
    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!collection || !project) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Collection not found</p>
          <Button onClick={() => navigate("/collections")}>Go Back</Button>
        </div>
      </Card>
    );
  }

  const schema = collection.schema as any;
  const fields = schema?.fields || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            className="flex items-center justify-center"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/collections?projectId=${project.id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {collection.name}
            </h1>
            <p className="text-gray-600 mt-1">/{collection.slug}</p>
          </div>
        </div>
      </div>

      {/* Collection Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Collection Info</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Fields:</span>
              <span className="font-medium">{fields.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Timestamps:</span>
              <span className="font-medium">
                {schema?.timestamps ? (
                  <CheckCircle className="w-4 h-4 text-green-500 inline" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 inline" />
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Soft Delete:</span>
              <span className="font-medium">
                {schema?.softDelete ? (
                  <CheckCircle className="w-4 h-4 text-green-500 inline" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 inline" />
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created:</span>
              <span className="font-medium">
                {formatDate(collection.createdAt)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Code className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">API Base URL</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-50 px-3 py-2 rounded border border-gray-200 text-gray-800 font-mono break-all">
                {getCollectionApiUrl()}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(getCollectionApiUrl())}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {apiKey && (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-gray-50 px-3 py-2 rounded border border-gray-200 text-gray-800 font-mono break-all">
                  {apiKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(apiKey)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-gray-500">
              All endpoints require X-API-Key header
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Fields</h3>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {fields.map((field: FieldDefinition, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1"
              >
                <span className="font-mono text-gray-800">{field.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{field.type}</span>
                  {field.required && (
                    <span className="text-xs text-red-500">*</span>
                  )}
                  {field.unique && (
                    <span className="text-xs text-purple-500">🔑</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* API Documentation */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          API Documentation
        </h2>

        {/* Advanced Filter Examples */}
        <div className="my-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-sm text-blue-900 mb-2">
            Advanced Filter Examples
          </h4>
          <div className="space-y-2 text-xs text-blue-800">
            <div>
              <code className="bg-blue-100 px-2 py-1 rounded">
                filter[price][$gt]=100
              </code>
              <span className="ml-2">Greater than</span>
            </div>
            <div>
              <code className="bg-blue-100 px-2 py-1 rounded">
                filter[status][$in]=active,pending
              </code>
              <span className="ml-2">In array</span>
            </div>
            <div>
              <code className="bg-blue-100 px-2 py-1 rounded">
                filter[$or][0][status]=active&filter[$or][1][status]=pending
              </code>
              <span className="ml-2">OR condition</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Endpoints List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 mb-4">
              Available Endpoints
            </h3>
            <div className="space-y-2 max-h-screen overflow-y-auto">
              {endpoints.map((endpoint, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedEndpoint === endpoint
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    setSelectedEndpoint(endpoint);
                    if (
                      endpoint.method === "POST" ||
                      endpoint.method === "PATCH"
                    ) {
                      setRequestPayload(
                        getExamplePayload(endpoint.method, endpoint)
                      );
                    } else {
                      setRequestPayload("");
                    }
                    // Reset query params for new endpoint
                    setQueryParams({});
                    setItemId("");
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        endpoint.method === "GET"
                          ? "bg-blue-100 text-blue-700"
                          : endpoint.method === "POST"
                          ? "bg-green-100 text-green-700"
                          : endpoint.method === "PATCH"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {endpoint.method}
                    </span>
                    <code className="text-sm font-mono text-gray-800 flex-1">
                      {endpoint.path}
                    </code>
                  </div>
                  <p className="text-xs text-gray-600">
                    {endpoint.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* API Tester */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Test API</h3>

            {selectedEndpoint && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {apiKeys.length > 1 && (
                    <select
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {apiKeys.map((key) => (
                        <option key={key.id} value={key.key}>
                          {key.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Item ID Input for endpoints that require ID */}
                {selectedEndpoint.requiresId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Item ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={itemId}
                      onChange={(e) => setItemId(e.target.value)}
                      placeholder="Enter item ID"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Query Parameters */}
                {selectedEndpoint.queryParams &&
                  selectedEndpoint.queryParams.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Query Parameters
                      </label>
                      <div className="space-y-2">
                        {selectedEndpoint.queryParams.map((param) => (
                          <div key={param} className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 w-24">
                              {param}:
                            </label>
                            <input
                              type="text"
                              value={queryParams[param] || ""}
                              onChange={(e) =>
                                setQueryParams({
                                  ...queryParams,
                                  [param]: e.target.value,
                                })
                              }
                              placeholder={
                                param === "populate"
                                  ? "e.g., field1,field2"
                                  : param === "filter"
                                  ? 'JSON: {"field":"value"}'
                                  : param === "groupBy"
                                  ? "e.g., status,category"
                                  : param === "sum" ||
                                    param === "avg" ||
                                    param === "min" ||
                                    param === "max"
                                  ? "e.g., price,amount"
                                  : param === "count"
                                  ? "e.g., * or field1,field2"
                                  : param === "page"
                                  ? "1"
                                  : param === "limit"
                                  ? "10"
                                  : param === "fields"
                                  ? "e.g., id,name,email"
                                  : ""
                              }
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedEndpoint.queryParams.includes("groupBy") &&
                          "Group by: comma-separated field names"}
                        {selectedEndpoint.queryParams.includes("sum") &&
                          "Sum: comma-separated numeric fields"}
                        {selectedEndpoint.queryParams.includes("avg") &&
                          "Avg: comma-separated numeric fields"}
                        {selectedEndpoint.queryParams.includes("filter") &&
                          "Filter: JSON object for filtering"}
                      </p>
                    </div>
                  )}

                {/* Request URL Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Request URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-50 px-3 py-2 rounded border border-gray-200 text-gray-800 font-mono break-all">
                      {buildUrlWithParams(selectedEndpoint)}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(buildUrlWithParams(selectedEndpoint))
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {(selectedEndpoint.method === "POST" ||
                  selectedEndpoint.method === "PATCH") && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Request Payload (JSON)
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newPayload = getExamplePayload(
                            selectedEndpoint.method,
                            selectedEndpoint
                          );
                          setRequestPayload(newPayload);
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Regenerate
                      </Button>
                    </div>
                    <textarea
                      value={requestPayload}
                      onChange={(e) => setRequestPayload(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter JSON payload"
                    />
                  </div>
                )}

                <Button
                  onClick={handleTestApi}
                  isLoading={testing}
                  disabled={!apiKey || (selectedEndpoint.requiresId && !itemId)}
                  className="w-full flex items-center justify-center"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test API
                </Button>

                {response && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Response
                    </label>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            response.status >= 200 && response.status < 300
                              ? "bg-green-600"
                              : "bg-red-600"
                          }`}
                        >
                          {response.status} {response.statusText}
                        </span>
                        {response.url && (
                          <code className="text-xs text-gray-400">
                            {response.url}
                          </code>
                        )}
                      </div>
                      <pre className="text-xs">
                        {JSON.stringify(response.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            )}

            {!selectedEndpoint && (
              <div className="text-center py-8 text-gray-500">
                Select an endpoint to test
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Export/Import Section */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Export & Import
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Export Data</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("json")}
                disabled={!apiKey}
              >
                <Download className="w-4 h-4 mr-2" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                disabled={!apiKey}
              >
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={!apiKey}
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Export all data in selected format
            </p>
          </div>

          {/* Import */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Import Data</h4>
            <div>
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImport(file);
                  }
                }}
                className="hidden"
                id="import-file-input"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  document.getElementById("import-file-input")?.click()
                }
                disabled={!apiKey}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Import from JSON, CSV, or Excel file
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
