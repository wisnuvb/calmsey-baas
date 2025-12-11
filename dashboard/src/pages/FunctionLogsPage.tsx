import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/Button";
import Card from "../components/ui/Card";

interface FunctionLog {
  id: string;
  status: "SUCCESS" | "ERROR" | "TIMEOUT" | "MEMORY_EXCEEDED";
  duration?: number;
  memoryUsed?: number;
  requestBody?: any;
  requestHeaders?: any;
  requestMethod?: string;
  requestQuery?: any;
  responseBody?: any;
  responseStatus?: number;
  error?: string;
  errorStack?: string;
  logs?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface Function {
  id: string;
  name: string;
  slug: string;
}

export function FunctionLogsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { selectedProject } = useOutletContext<{ selectedProject: any }>();
  const projectId = selectedProject?.id;

  const [func, setFunc] = useState<Function | null>(null);
  const [logs, setLogs] = useState<FunctionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<FunctionLog | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (id) {
      loadFunction();
      loadLogs();
    }
  }, [id, selectedStatus, page]);

  const loadFunction = async () => {
    try {
      const response = await api.get(`/functions/${id}`);
      setFunc(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load function");
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20 };
      if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }

      const response = await api.get(`/functions/${id}/logs`, { params });
      setLogs(response.data.data);
      setTotalPages(response.data.meta.totalPages);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return "bg-green-100 text-green-800";
      case "ERROR":
        return "bg-red-100 text-red-800";
      case "TIMEOUT":
        return "bg-yellow-100 text-yellow-800";
      case "MEMORY_EXCEEDED":
        return "bg-orange-100 text-orange-800";
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

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  if (!selectedProject || !id) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            {!selectedProject
              ? "Please select a project from the sidebar first."
              : "Invalid function ID."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Button
          variant="secondary"
          onClick={() => navigate("/functions")}
          className="mb-4"
        >
          ← Back to Functions
        </Button>

        {func && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{func.name}</h1>
            <p className="text-gray-600 mt-1">Execution Logs</p>
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        {["all", "SUCCESS", "ERROR", "TIMEOUT", "MEMORY_EXCEEDED"].map(
          (status) => (
            <button
              key={status}
              onClick={() => {
                setSelectedStatus(status);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status === "all" ? "All" : status}
            </button>
          )
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">No logs found.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {logs.map((log) => (
              <Card
                key={log.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                // onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          log.status
                        )}`}
                      >
                        {log.status}
                      </span>
                      <span className="text-sm text-gray-600">
                        {formatDate(log.createdAt)}
                      </span>
                      {log.duration && (
                        <span className="text-sm text-gray-600">
                          ⏱️ {formatDuration(log.duration)}
                        </span>
                      )}
                      {log.requestMethod && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {log.requestMethod}
                        </span>
                      )}
                    </div>

                    {log.error && (
                      <p className="text-sm text-red-600 mb-2 font-mono">
                        {log.error}
                      </p>
                    )}

                    {log.logs && (
                      <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded mt-2">
                        {log.logs.split("\n").slice(0, 3).join("\n")}
                        {log.logs.split("\n").length > 3 && "..."}
                      </div>
                    )}
                  </div>

                  <Button variant="secondary" size="sm">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-gray-700">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Execution Details</h2>
                  <p className="text-gray-600">
                    {formatDate(selectedLog.createdAt)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </Button>
              </div>

              <div className="space-y-4">
                {/* Status */}
                <div>
                  <h3 className="font-semibold mb-2">Status</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      selectedLog.status
                    )}`}
                  >
                    {selectedLog.status}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Duration</h3>
                    <p className="text-gray-700">
                      {formatDuration(selectedLog.duration)}
                    </p>
                  </div>
                  {selectedLog.memoryUsed && (
                    <div>
                      <h3 className="font-semibold mb-2">Memory Used</h3>
                      <p className="text-gray-700">
                        {selectedLog.memoryUsed} MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Request */}
                <div>
                  <h3 className="font-semibold mb-2">Request</h3>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm mb-2">
                      <strong>Method:</strong> {selectedLog.requestMethod}
                    </p>
                    {selectedLog.requestBody && (
                      <div className="mb-2">
                        <strong className="text-sm">Body:</strong>
                        <pre className="mt-1 text-xs font-mono bg-white p-2 rounded overflow-auto">
                          {formatJSON(selectedLog.requestBody)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.requestQuery && (
                      <div>
                        <strong className="text-sm">Query:</strong>
                        <pre className="mt-1 text-xs font-mono bg-white p-2 rounded overflow-auto">
                          {formatJSON(selectedLog.requestQuery)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>

                {/* Response */}
                {selectedLog.responseBody && (
                  <div>
                    <h3 className="font-semibold mb-2">Response</h3>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm mb-2">
                        <strong>Status:</strong> {selectedLog.responseStatus}
                      </p>
                      <pre className="text-xs font-mono bg-white p-2 rounded overflow-auto max-h-64">
                        {formatJSON(selectedLog.responseBody)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Error */}
                {selectedLog.error && (
                  <div>
                    <h3 className="font-semibold mb-2 text-red-600">Error</h3>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-sm font-mono text-red-800 mb-2">
                        {selectedLog.error}
                      </p>
                      {selectedLog.errorStack && (
                        <pre className="text-xs font-mono text-red-700 bg-white p-2 rounded overflow-auto max-h-64">
                          {selectedLog.errorStack}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {/* Console Logs */}
                {selectedLog.logs && (
                  <div>
                    <h3 className="font-semibold mb-2">Console Output</h3>
                    <pre className="text-xs font-mono bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-64">
                      {selectedLog.logs}
                    </pre>
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-gray-500 pt-4 border-t">
                  <p>IP: {selectedLog.ipAddress || "N/A"}</p>
                  <p className="truncate">
                    User Agent: {selectedLog.userAgent || "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
