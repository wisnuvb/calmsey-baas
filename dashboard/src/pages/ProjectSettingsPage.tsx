import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import api from "../lib/api";
import {
  ApiResponse,
  Project,
  ProjectSettings as ProjectSettingsType,
} from "../types";
import { formatDateTime } from "../lib/utils";
import React from "react";

type ProjectWithSettings = Project & {
  settings?: ProjectSettingsType | null;
};

interface FormState {
  name: string;
  description: string;
}

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectWithSettings | null>(null);
  const [formState, setFormState] = useState<FormState>({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Project ID not found");
      setLoading(false);
      return;
    }
    fetchProject(id);
  }, [id]);

  useEffect(() => {
    if (project) {
      setFormState({
        name: project.name,
        description: project.description || "",
      });
    }
  }, [project]);

  const fetchProject = async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse<ProjectWithSettings>>(
        `/projects/${projectId}`
      );
      if (response.data.success && response.data.data) {
        setProject(response.data.data);
      } else {
        setError("Failed to load project data");
      }
    } catch (err: any) {
      console.error("Failed to fetch project:", err);
      setError(err?.response?.data?.error || "Failed to load project data");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneralSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!project || !id) {
      return;
    }

    const payload: Record<string, string> = {};
    if (formState.name !== project.name) {
      payload.name = formState.name;
    }
    if ((formState.description || "") !== (project.description || "")) {
      payload.description = formState.description;
    }

    if (Object.keys(payload).length === 0) {
      setSuccessMessage("No changes to save");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.patch<ApiResponse<ProjectWithSettings>>(
        `/projects/${id}`,
        payload
      );

      if (response.data.success && response.data.data) {
        setProject(response.data.data);
        setSuccessMessage("Project settings saved successfully");
      } else {
        setError("Failed to save project settings.");
      }
    } catch (err: any) {
      console.error("Failed to update project:", err);
      setError(err?.response?.data?.error || "Failed to save project settings");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
    if (!project) return;
    setFormState({
      name: project.name,
      description: project.description || "",
    });
    setSuccessMessage(null);
    setError(null);
  };

  const settings = useMemo(() => project?.settings, [project]);

  if (loading) {
    return <div className="text-center py-12">Loading project settings...</div>;
  }

  if (error && !project) {
    return (
      <div className="max-w-3xl mx-auto mt-12 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          Failed to load project
        </h1>
        <p className="text-gray-600">{error}</p>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          Back to project list
        </Button>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">
            <button
              type="button"
              className="text-primary-600 hover:underline"
              onClick={() => navigate("/projects")}
            >
              Projects
            </button>{" "}
            / Settings
          </p>
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          <p className="mt-1 text-gray-600">
            Manage information and configuration for this project.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchProject(project.id)}>
          Reload
        </Button>
      </div>

      {(error || successMessage) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || successMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Project Information"
          actions={
            <span className="text-xs text-gray-500">
              Last updated: {formatDateTime(project.updatedAt)}
            </span>
          }
        >
          <form className="space-y-4" onSubmit={handleGeneralSubmit}>
            <Input
              label="Project Name"
              required
              value={formState.name}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Project name"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                rows={4}
                value={formState.description}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Add a short description about the project"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleResetForm}
              >
                Reset
              </Button>
              <Button type="submit" isLoading={submitting}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Project Summary">
          <dl className="space-y-3 text-sm text-gray-600">
            <div>
              <dt className="font-medium text-gray-900">Project ID</dt>
              <dd className="mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {project.id}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Slug</dt>
              <dd className="mt-1 font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {project.slug}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Dibuat</dt>
              <dd className="mt-1">{formatDateTime(project.createdAt)}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Total Collections</dt>
              <dd className="mt-1">
                {project._count?.collections ?? 0} collections
              </dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Total API Key</dt>
              <dd className="mt-1">{project._count?.apiKeys ?? 0} API keys</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Autentikasi">
          {settings ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Authentication</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    settings.authEnabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {settings.authEnabled ? "Active" : "Inactive"}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">JWT Expiry</p>
                <p className="text-gray-600">
                  {settings.jwtExpiry / 3600} hours ({settings.jwtExpiry}{" "}
                  seconds)
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Authentication settings are not available.
            </p>
          )}
        </Card>

        <Card title="Email Settings">
          {settings ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span>Email Settings</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    settings.emailEnabled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {settings.emailEnabled ? "Active" : "Inactive"}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Provider</p>
                <p className="text-gray-600">
                  {settings.emailProvider || "Not configured"}
                </p>
              </div>
              {settings.emailConfig && (
                <div>
                  <p className="font-medium text-gray-900">Configuration</p>
                  <pre className="mt-1 rounded bg-gray-50 p-3 text-xs text-gray-600 overflow-auto">
                    {JSON.stringify(settings.emailConfig, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Email settings are not available.
            </p>
          )}
        </Card>

        <Card title="Storage Settings">
          {settings ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">Storage Type</p>
                <p className="text-gray-600">{settings.storageType}</p>
              </div>
              {settings.storageConfig ? (
                <div>
                  <p className="font-medium text-gray-900">Configuration</p>
                  <pre className="mt-1 rounded bg-gray-50 p-3 text-xs text-gray-600 overflow-auto">
                    {JSON.stringify(settings.storageConfig, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-500">
                  No additional storage configuration.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Storage settings are not available.
            </p>
          )}
        </Card>
      </div>

      {/* Database Configuration - Only show if using dedicated database */}
      {project.useDedicatedDb && (
        <Card title="Database Configuration">
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <p className="font-medium mb-1">⚠️ Sensitive Information</p>
              <p>
                Database configuration is displayed for reference only. Changing
                these settings may break database connectivity. Contact support
                if you need to modify database settings.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Database Status
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    project.dbStatus === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : project.dbStatus === "ERROR"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {project.dbStatus || "UNKNOWN"}
                </span>
              </div>

              {project.dbHost && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Host</p>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                    {project.dbHost}
                  </p>
                </div>
              )}

              {project.dbPort && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Port</p>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                    {project.dbPort}
                  </p>
                </div>
              )}

              {project.dbName && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Database Name
                  </p>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                    {project.dbName}
                  </p>
                </div>
              )}

              {project.dbUser && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Username
                  </p>
                  <p className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                    {project.dbUser}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
