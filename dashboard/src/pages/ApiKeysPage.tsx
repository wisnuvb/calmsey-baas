import { useEffect, useState } from "react";
import api from "../lib/api";
import { ApiKey, Project, ApiResponse } from "../types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { formatDateTime } from "../lib/utils";
import React from "react";

export default function ApiKeysPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchApiKeys();
    } else {
      setApiKeys([]);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const response = await api.get<ApiResponse<Project[]>>("/projects");
      if (response.data.success && response.data.data) {
        setProjects(response.data.data);
        if (response.data.data.length > 0 && !selectedProject) {
          setSelectedProject(response.data.data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    if (!selectedProject) return;
    try {
      const response = await api.get<ApiResponse<Project>>(
        `/projects/${selectedProject}`
      );
      if (response.data.success && response.data.data) {
        setApiKeys(response.data.data.apiKeys || []);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setError("");
    setSubmitting(true);

    try {
      const response = await api.post<ApiResponse<ApiKey>>(
        `/projects/${selectedProject}/api-keys`,
        formData
      );
      if (response.data.success && response.data.data) {
        setShowCreateModal(false);
        setFormData({ name: "" });
        fetchApiKeys();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create API key");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!selectedProject) return;
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      await api.delete(`/projects/${selectedProject}/api-keys/${keyId}`);
      fetchApiKeys();
    } catch (error) {
      alert("Failed to delete API key");
    }
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedProjectData = projects.find((p) => p.id === selectedProject);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-1 text-gray-600">
            Manage API keys for your projects
          </p>
        </div>
        {selectedProject && (
          <Button onClick={() => setShowCreateModal(true)}>
            Create API Key
          </Button>
        )}
      </div>

      {/* Project Selector */}
      {projects.length > 0 && (
        <Card>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Project
          </label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              No projects yet. Create a project first.
            </p>
          </div>
        </Card>
      ) : !selectedProject ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">Please select a project</p>
          </div>
        </Card>
      ) : apiKeys.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No API keys for this project</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First API Key
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {apiKey.name}
                    </h3>
                    {apiKey.lastUsed && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 font-mono text-sm">
                    {apiKey.key}
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Created: {formatDateTime(apiKey.createdAt)}</p>
                    {apiKey.lastUsed && (
                      <p>Last used: {formatDateTime(apiKey.lastUsed)}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(apiKey.key)}
                  >
                    {copiedKey === apiKey.key ? "✓ Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(apiKey.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New API Key</h2>
            <p className="text-sm text-gray-600 mb-4">
              For project:{" "}
              <span className="font-medium">{selectedProjectData?.name}</span>
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <Input
                label="API Key Name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Production Key, Development Key"
              />
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 hidden">
                ⚠️ Make sure to copy your API key after creation. You won't be
                able to see it again!
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: "" });
                    setError("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>
                  Create
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
