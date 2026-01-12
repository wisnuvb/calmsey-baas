import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Project, Function, ApiKey, ApiResponse } from "../types";
import { Button } from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  ArrowLeft,
  Play,
  Copy,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  Code,
} from "lucide-react";

export function FunctionPlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [func, setFunc] = useState<Function | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKey, setApiKey] = useState<string>("");

  // Test State
  const [method, setMethod] = useState<"POST" | "GET">("POST");
  const [requestBody, setRequestBody] = useState<string>("{\n  \n}");
  const [queryParams, setQueryParams] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [response, setResponse] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadFunction();
    }
  }, [id]);

  const loadFunction = async () => {
    try {
      setLoading(true);
      const response = await api.get<ApiResponse<Function>>(`/functions/${id}`);
      if (response.data.data) {
        const functionData = response.data.data;
        setFunc(functionData);

        if (functionData.project) {
          setProject(functionData.project);
          // Fetch API keys for this project
          fetchApiKeys(functionData.project.id);
        } else if (functionData.projectId) {
          // Fallback if project is not included
          fetchProject(functionData.projectId);
        }
      }
    } catch (err) {
      console.error("Failed to load function:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProject = async (projectId: string) => {
    try {
      const response = await api.get<ApiResponse<Project>>(
        `/projects/${projectId}`
      );
      if (response.data.data) {
        setProject(response.data.data);
        fetchApiKeys(projectId);
      }
    } catch (err) {
      console.error("Failed to load project:", err);
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

  const getInvokeUrl = () => {
    if (!func || !project) return "";
    return `${getApiBaseUrl()}/invoke/${project.slug}/${func.slug}`;
  };

  const handleTest = async () => {
    if (!apiKey) {
      alert("Please select an API Key");
      return;
    }

    setTesting(true);
    setResponse(null);

    try {
      let url = getInvokeUrl();
      if (queryParams) {
        url += `?${queryParams}`;
      }

      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      };

      if (method === "POST") {
        try {
          // Validate JSON
          JSON.parse(requestBody);
          options.body = requestBody;
        } catch (e) {
          alert("Invalid JSON in Request Body");
          setTesting(false);
          return;
        }
      }

      const startTime = performance.now();
      const res = await fetch(url, options);
      const endTime = performance.now();

      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = await res.text();
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        duration: Math.round(endTime - startTime),
        headers: Object.fromEntries(res.headers.entries()),
      });
    } catch (err: any) {
      setResponse({
        status: 0,
        statusText: "Network Error",
        data: { error: err.message },
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(requestBody);
      setRequestBody(JSON.stringify(parsed, null, 2));
    } catch (e) {
      alert("Invalid JSON");
    }
  };

  const getCurlExample = () => {
    try {
      let body = "";
      if (method === "POST") {
        try {
          // Try to parse and format to ensure valid JSON in curl
          body = JSON.stringify(JSON.parse(requestBody), null, 2);
        } catch {
          // If invalid JSON, just use raw string but escape quotes
          body = requestBody;
        }
      }

      return `curl -X ${method} \\
  ${getInvokeUrl()}${queryParams ? "?" + queryParams : ""} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY"${
    body
      ? ` \\
  -d '${body}'`
      : ""
  }`;
    } catch (e) {
      return "Error generating curl example";
    }
  };

  const getJsExample = () => {
    const url = `${getInvokeUrl()}${queryParams ? "?" + queryParams : ""}`;
    return `const response = await fetch(
  '${url}',
  {
    method: '${method}',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'YOUR_API_KEY'
    }${
      method === "POST"
        ? `,
    body: JSON.stringify(${requestBody})`
        : ""
    }
  }
);

const data = await response.json();`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!func || !project) {
    return (
      <div className="p-8 text-center">
        <p>Function not found</p>
        <Button onClick={() => navigate("/functions")} className="mt-4">
          Back to Functions
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/functions")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Test Function: {func.name}
              <span
                className={`px-2 py-1 rounded text-xs font-normal ${
                  func.status === "ACTIVE"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {func.status}
              </span>
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {func.description || "No description"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => navigate(`/functions/${func.id}/edit`)}
          >
            Edit Code
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(`/functions/${func.id}/logs`)}
          >
            View Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Request Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold mb-4">
              Request Configuration
            </h2>

            {/* API Key Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key (x-api-key)
              </label>
              {apiKeys.length > 0 ? (
                <select
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {apiKeys.map((key) => (
                    <option key={key.id} value={key.key}>
                      {key.name} ({key.key.substring(0, 8)}...)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-red-600 text-sm">
                  No API keys found for this project. Please create one in
                  Settings.
                </div>
              )}
            </div>

            {/* Method & URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint
              </label>
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as "POST" | "GET")}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                </select>
                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                  <code className="flex-1 text-sm text-gray-800 font-mono break-all">
                    {getInvokeUrl()}
                  </code>
                  <button
                    onClick={() => copyToClipboard(getInvokeUrl())}
                    className="text-gray-500 hover:text-gray-700"
                    title="Copy URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Query Params */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Query Parameters (Optional)
              </label>
              <input
                type="text"
                value={queryParams}
                onChange={(e) => setQueryParams(e.target.value)}
                placeholder="e.g. search=hello&limit=10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            {/* Body */}
            {method === "POST" && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Request Body (JSON)
                  </label>
                  <button
                    onClick={formatJson}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm bg-gray-50"
                  spellCheck={false}
                />
              </div>
            )}

            <Button
              onClick={handleTest}
              disabled={testing || !apiKey}
              className="w-full flex items-center justify-center"
            >
              {testing ? (
                <>Running...</>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" /> Run Function
                </>
              )}
            </Button>
          </Card>

          {/* Response */}
          {response && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Response</h2>
                <div className="flex items-center gap-4 text-sm">
                  <span
                    className={`flex items-center gap-1 font-medium ${
                      response.status >= 200 && response.status < 300
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {response.status >= 200 && response.status < 300 ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    {response.status} {response.statusText}
                  </span>
                  <span className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    {response.duration}ms
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96">
                  <pre className="text-xs font-mono">
                    {typeof response.data === "object"
                      ? JSON.stringify(response.data, null, 2)
                      : response.data}
                  </pre>
                </div>

                {/* Response Metadata/Logs if available */}
                {response.data?.meta?.logs &&
                  Array.isArray(response.data.meta.logs) &&
                  response.data.meta.logs.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Execution Logs
                      </h3>
                      <div className="bg-gray-100 p-3 rounded border border-gray-200 text-xs font-mono text-gray-800 max-h-40 overflow-y-auto">
                        {response.data.meta.logs.map(
                          (log: string, i: number) => (
                            <div key={i} className="mb-1">
                              {log}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Helper Info */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold mb-4">How to use</h3>
            <div className="space-y-4 text-sm text-gray-600">
              <p>
                You can invoke this function using any HTTP client. Make sure to
                include the <code>x-api-key</code> header.
              </p>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">cURL Example</h4>
                <div className="bg-gray-900 text-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
                  <pre>{getCurlExample()}</pre>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(
                      getCurlExample().replace(
                        "YOUR_API_KEY",
                        apiKey || "YOUR_API_KEY"
                      )
                    )
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy cURL
                </button>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  JavaScript Example
                </h4>
                <div className="bg-gray-900 text-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
                  <pre>{getJsExample()}</pre>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
