import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import Card from "../components/ui/Card";

interface Function {
  id: string;
  name: string;
  slug: string;
  description?: string;
  language: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ERROR";
  version: number;
  invocations: number;
  lastInvoked?: string;
  avgDuration?: number;
  errorRate?: number;
  timeout: number;
  memory: number;
  createdAt: string;
  updatedAt: string;
}

export function FunctionsPage() {
  const navigate = useNavigate();
  const { selectedProject } = useOutletContext<{ selectedProject: any }>();
  const projectId = selectedProject?.id;

  const [functions, setFunctions] = useState<Function[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    if (projectId) {
      loadFunctions();
    }
  }, [projectId, selectedStatus]);

  const loadFunctions = async () => {
    try {
      setLoading(true);
      const params: any = { projectId };
      if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }

      const response = await api.get("/functions", { params });
      setFunctions(response.data.data);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load functions");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this function?")) {
      return;
    }

    try {
      await api.delete(`/functions/${id}`);
      loadFunctions();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete function");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "INACTIVE":
        return "bg-yellow-100 text-yellow-800";
      case "ERROR":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
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
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Functions</h1>
            <p className="text-gray-600 mt-1">
              Create and manage serverless functions
            </p>
          </div>
          <Button onClick={() => navigate("/functions/new")}>
            + New Function
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {["all", "ACTIVE", "DRAFT", "INACTIVE", "ERROR"].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status === "all" ? "All" : status}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading functions...</p>
        </div>
      ) : functions.length === 0 ? (
        <Card>
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              No functions yet
            </h3>
            <p className="mt-1 text-gray-500">
              Get started by creating your first serverless function.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate("/functions/new")}>
                + Create Function
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {functions.map((func) => (
            <Card key={func.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {func.name}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        func.status
                      )}`}
                    >
                      {func.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      v{func.version}
                    </span>
                  </div>

                  {func.description && (
                    <p className="text-gray-600 mb-3">{func.description}</p>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Slug:</span>{" "}
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {func.slug}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium">Language:</span>{" "}
                      {func.language}
                    </div>
                    <div>
                      <span className="font-medium">Invocations:</span>{" "}
                      {func.invocations.toLocaleString()}
                    </div>
                    {func.avgDuration && (
                      <div>
                        <span className="font-medium">Avg Duration:</span>{" "}
                        {formatDuration(func.avgDuration)}
                      </div>
                    )}
                    {typeof func.errorRate === "number" && (
                      <div>
                        <span className="font-medium">Error Rate:</span>{" "}
                        <span
                          className={
                            func.errorRate > 10
                              ? "text-red-600"
                              : func.errorRate > 5
                              ? "text-yellow-600"
                              : "text-green-600"
                          }
                        >
                          {func.errorRate.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    {func.lastInvoked ? (
                      <span>Last invoked: {formatDate(func.lastInvoked)}</span>
                    ) : (
                      <span>Never invoked</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/functions/${func.id}/test`)}
                  >
                    Test
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/functions/${func.id}/logs`)}
                  >
                    Logs
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/functions/${func.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(func.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
