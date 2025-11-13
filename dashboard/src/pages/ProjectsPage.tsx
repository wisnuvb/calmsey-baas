import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Project, ApiResponse } from "../types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { formatDate, truncate } from "../lib/utils";
import React from "react";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    useDedicatedDb: false,
    useSameServer: true,
    dbConfig: {
      host: "",
      port: 5432,
      database: "",
      username: "",
      password: "",
      type: "postgresql" as "postgresql" | "mysql"
    }
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get<ApiResponse<Project[]>>("/projects");
      if (response.data.success && response.data.data) {
        setProjects(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        useDedicatedDb: formData.useDedicatedDb
      };

      if (formData.useDedicatedDb) {
        payload.useSameServer = formData.useSameServer;
        if (!formData.useSameServer) {
          payload.dbConfig = formData.dbConfig;
        }
      }

      const response = await api.post<ApiResponse<Project>>("/projects", payload);
      if (response.data.success && response.data.data) {
        setShowCreateModal(false);
        setFormData({
          name: "",
          description: "",
          useDedicatedDb: false,
          useSameServer: true,
          dbConfig: {
            host: "",
            port: 5432,
            database: "",
            username: "",
            password: "",
            type: "postgresql"
          }
        });
        fetchProjects();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project? This will delete all collections and API keys.")) {
      return;
    }

    try {
      await api.delete(`/projects/${id}`);
      fetchProjects();
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("Failed to delete project");
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-gray-600">
            Manage your projects and collections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/help')}>
            📚 Documentation
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>Create Project</Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">New Features Available!</h3>
            <p className="text-sm text-blue-700">
              • Multi-Database support for tenant isolation<br/>
              • Real-time subscriptions (WebSocket)<br/>
              • Webhooks for event-driven workflows<br/>
              • Email service with templates<br/>
              • Transactions & audit logging
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate('/help')}>
              Learn More →
            </Button>
          </div>
        </div>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Project
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-500">/{project.slug}</p>
                  {(project as any).useDedicatedDb && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                      Dedicated DB
                    </span>
                  )}
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-gray-600 mb-4">
                  {truncate(project.description, 100)}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span>{project._count?.collections || 0} Collections</span>
                <span>•</span>
                <span>{project._count?.apiKeys || 0} API Keys</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  {formatDate(project.createdAt)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/projects/${project.id}/settings`)}
                  >
                    Settings
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/collections?projectId=${project.id}`)}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(project.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Enhanced Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                label="Project Name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Project"
              />

              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />

              {/* Multi-Database Options */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="useDedicatedDb"
                    checked={formData.useDedicatedDb}
                    onChange={(e) => setFormData({ ...formData, useDedicatedDb: e.target.checked })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <label htmlFor="useDedicatedDb" className="font-medium text-gray-900 cursor-pointer">
                      Use Dedicated Database
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      Create a separate database for this project (recommended for production & enterprise use)
                    </p>
                  </div>
                </div>

                {formData.useDedicatedDb && (
                  <div className="pl-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        id="useSameServer"
                        checked={formData.useSameServer}
                        onChange={() => setFormData({ ...formData, useSameServer: true })}
                        className="mt-1"
                      />
                      <div>
                        <label htmlFor="useSameServer" className="font-medium text-sm cursor-pointer">
                          Use Main Database Server
                        </label>
                        <p className="text-xs text-gray-600">Create database on the same server (easier setup)</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        id="useCustomServer"
                        checked={!formData.useSameServer}
                        onChange={() => setFormData({ ...formData, useSameServer: false })}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="useCustomServer" className="font-medium text-sm cursor-pointer">
                          Use Custom Database Server
                        </label>
                        <p className="text-xs text-gray-600 mb-3">Connect to external database (for compliance, geo-distribution)</p>

                        {!formData.useSameServer && (
                          <div className="space-y-3 pl-6">
                            <Input
                              label="Host"
                              value={formData.dbConfig.host}
                              onChange={(e) => setFormData({
                                ...formData,
                                dbConfig: { ...formData.dbConfig, host: e.target.value }
                              })}
                              placeholder="db.example.com"
                              size="sm"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                label="Port"
                                type="number"
                                value={formData.dbConfig.port}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  dbConfig: { ...formData.dbConfig, port: parseInt(e.target.value) }
                                })}
                                size="sm"
                              />
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                <select
                                  value={formData.dbConfig.type}
                                  onChange={(e) => setFormData({
                                    ...formData,
                                    dbConfig: { ...formData.dbConfig, type: e.target.value as any }
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                  <option value="postgresql">PostgreSQL</option>
                                  <option value="mysql">MySQL</option>
                                </select>
                              </div>
                            </div>
                            <Input
                              label="Database Name"
                              value={formData.dbConfig.database}
                              onChange={(e) => setFormData({
                                ...formData,
                                dbConfig: { ...formData.dbConfig, database: e.target.value }
                              })}
                              placeholder="my_database"
                              size="sm"
                            />
                            <Input
                              label="Username"
                              value={formData.dbConfig.username}
                              onChange={(e) => setFormData({
                                ...formData,
                                dbConfig: { ...formData.dbConfig, username: e.target.value }
                              })}
                              size="sm"
                            />
                            <Input
                              label="Password"
                              type="password"
                              value={formData.dbConfig.password}
                              onChange={(e) => setFormData({
                                ...formData,
                                dbConfig: { ...formData.dbConfig, password: e.target.value }
                              })}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      name: "",
                      description: "",
                      useDedicatedDb: false,
                      useSameServer: true,
                      dbConfig: {
                        host: "",
                        port: 5432,
                        database: "",
                        username: "",
                        password: "",
                        type: "postgresql"
                      }
                    });
                    setError("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" isLoading={submitting}>
                  Create Project
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
