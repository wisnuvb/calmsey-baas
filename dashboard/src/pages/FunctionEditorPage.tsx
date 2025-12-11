import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";

const DEFAULT_FUNCTION_CODE = `// Example function: Fetch data from a dynamic collection
export async function handler(context) {
  const { prisma, request, project, log } = context;
  
  log('Function invoked with payload:', request.body);
  
  // Dynamic table name based on project and collection
  // Format: "data_{project_slug}_{collection_slug}"
  // You can find the exact table name in your database or Collections page
  const collectionSlug = 'your_collection'; // CHANGE THIS
  const tableName = \`data_\${project.slug}_\${collectionSlug}\`;
  
  try {
    // Raw SQL query to fetch data (Prisma doesn't support dynamic models easily in raw mode)
    const data = await prisma.$queryRawUnsafe(
      \`SELECT * FROM "\${tableName}" LIMIT 10\`
    );
    
    return {
      success: true,
      message: \`Fetched \${data.length} items from \${tableName}\`,
      data: data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    log('Error fetching data:', error.message);
    return {
      success: false,
      error: \`Failed to fetch from \${tableName}. Make sure the collection exists.\`,
      details: error.message
    };
  }
}`;

export function FunctionEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { selectedProject } = useOutletContext<{ selectedProject: any }>();
  const projectId = selectedProject?.id;
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sourceCode: DEFAULT_FUNCTION_CODE,
    language: "typescript",
    entrypoint: "handler",
    timeout: 30000,
    memory: 256,
    status: "DRAFT" as "DRAFT" | "ACTIVE",
  });

  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "light">(
    "vs-dark"
  );

  useEffect(() => {
    if (isEditMode && id) {
      loadFunction();
    }
  }, [id]);

  const loadFunction = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/functions/${id}`);
      const func = response.data.data;

      setFormData({
        name: func.name,
        description: func.description || "",
        sourceCode: func.sourceCode,
        language: func.language,
        entrypoint: func.entrypoint,
        timeout: func.timeout,
        memory: func.memory,
        status: func.status,
      });

      // Convert envVars object to array
      if (func.envVars) {
        const vars = Object.entries(func.envVars).map(([key, value]) => ({
          key,
          value: value as string,
        }));
        setEnvVars(vars);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load function");
    } finally {
      setLoading(false);
    }
  };

  const validateCode = async () => {
    try {
      setValidating(true);
      setValidationError("");

      const response = await api.post("/functions/validate", {
        sourceCode: formData.sourceCode,
      });

      if (response.data.valid) {
        alert("✅ Code is valid!");
      } else {
        setValidationError(response.data.error || "Validation failed");
      }
    } catch (err: any) {
      setValidationError(err.response?.data?.error || "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!projectId) {
      setError("Project ID is required");
      return;
    }

    try {
      setLoading(true);

      // Convert envVars array to object
      const envVarsObj: Record<string, string> = {};
      envVars.forEach((v) => {
        if (v.key) {
          envVarsObj[v.key] = v.value;
        }
      });

      const payload = {
        ...formData,
        projectId,
        envVars: envVarsObj,
      };

      if (isEditMode) {
        await api.patch(`/functions/${id}`, payload);
      } else {
        await api.post("/functions", payload);
      }

      navigate("/functions");
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.details ||
          `Failed to ${isEditMode ? "update" : "create"} function`
      );
    } finally {
      setLoading(false);
    }
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const newVars = [...envVars];
    newVars[index][field] = value;
    setEnvVars(newVars);
  };

  if (!selectedProject) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Please select a project from the sidebar first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <Button
          variant="secondary"
          onClick={() => navigate("/functions")}
          className="mb-4"
        >
          ← Back to Functions
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? "Edit Function" : "Create New Function"}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode
            ? "Update your serverless function"
            : "Create a new serverless function with TypeScript"}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Function Name *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="my-function"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be converted to URL-friendly slug
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="What does this function do?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "DRAFT" | "ACTIVE",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entrypoint Function
                </label>
                <Input
                  type="text"
                  value={formData.entrypoint}
                  onChange={(e) =>
                    setFormData({ ...formData, entrypoint: e.target.value })
                  }
                  placeholder="handler"
                  required
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Code Editor */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Function Code</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setEditorTheme(
                    editorTheme === "vs-dark" ? "light" : "vs-dark"
                  )
                }
              >
                {editorTheme === "vs-dark" ? "☀️ Light" : "🌙 Dark"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={validateCode}
                disabled={validating}
              >
                {validating ? "Validating..." : "✓ Validate"}
              </Button>
            </div>
          </div>

          {validationError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-mono">
                {validationError}
              </p>
            </div>
          )}

          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <Editor
              height="500px"
              defaultLanguage="typescript"
              value={formData.sourceCode}
              onChange={(value) =>
                setFormData({ ...formData, sourceCode: value || "" })
              }
              theme={editorTheme}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: true,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                parameterHints: { enabled: true },
                folding: true,
                bracketPairColorization: { enabled: true },
              }}
              loading={
                <div className="flex items-center justify-center h-[500px] bg-gray-900 text-white">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                    <p>Loading editor...</p>
                  </div>
                </div>
              }
            />
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">Available Context:</h3>
            <ul className="text-sm text-gray-700 space-y-1 font-mono">
              <li>
                • <strong>context.prisma</strong> - Database client (scoped to
                your project)
              </li>
              <li>
                • <strong>context.request</strong> - Request data (body,
                headers, query, params)
              </li>
              <li>
                • <strong>context.project</strong> - Project info (id, slug)
              </li>
              <li>
                • <strong>context.env</strong> - Environment variables
              </li>
              <li>
                • <strong>context.log(...)</strong> - Log messages
              </li>
              <li>
                • <strong>context.error(...)</strong> - Log errors
              </li>
            </ul>
          </div>
        </Card>

        {/* Runtime Configuration */}
        <Card>
          <h2 className="text-xl font-semibold mb-4">Runtime Configuration</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timeout (ms)
              </label>
              <Input
                type="number"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    timeout: parseInt(e.target.value),
                  })
                }
                min={1000}
                max={300000}
                step={1000}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Max execution time (1-300 seconds)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Memory (MB)
              </label>
              <Input
                type="number"
                value={formData.memory}
                onChange={(e) =>
                  setFormData({ ...formData, memory: parseInt(e.target.value) })
                }
                min={128}
                max={2048}
                step={128}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Memory limit (128-2048 MB)
              </p>
            </div>
          </div>
        </Card>

        {/* Environment Variables */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Environment Variables</h2>
            <Button type="button" variant="secondary" onClick={addEnvVar}>
              + Add Variable
            </Button>
          </div>

          {envVars.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No environment variables yet.
            </p>
          ) : (
            <div className="space-y-2">
              {envVars.map((envVar, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    type="text"
                    value={envVar.key}
                    onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                    placeholder="KEY"
                    className="flex-1"
                  />
                  <Input
                    type="text"
                    value={envVar.value}
                    onChange={(e) =>
                      updateEnvVar(index, "value", e.target.value)
                    }
                    placeholder="value"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeEnvVar(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : isEditMode
              ? "Update Function"
              : "Create Function"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/functions")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
