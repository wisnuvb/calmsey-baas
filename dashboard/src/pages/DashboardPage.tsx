import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Project, ApiResponse } from "../types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { formatDate } from "../lib/utils";
import React from "react";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalCollections: 0,
    totalApiKeys: 0,
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get<ApiResponse<Project[]>>("/projects");
      if (response.data.success && response.data.data) {
        setProjects(response.data.data);
        setStats({
          totalProjects: response.data.data.length,
          totalCollections: response.data.data.reduce(
            (acc, p) => acc + (p._count?.collections || 0),
            0
          ),
          totalApiKeys: response.data.data.reduce(
            (acc, p) => acc + (p._count?.apiKeys || 0),
            0
          ),
        });
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Welcome back! Here's your overview.
          </p>
        </div>
        <Link to="/projects">
          <Button>Create Project</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalProjects}
              </p>
            </div>
            <div className="text-4xl">📁</div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Collections</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalCollections}
              </p>
            </div>
            <div className="text-4xl">🗂️</div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total API Keys</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {stats.totalApiKeys}
              </p>
            </div>
            <div className="text-4xl">🔑</div>
          </div>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card title="Recent Projects">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No projects yet</p>
            <Link to="/projects">
              <Button>Create Your First Project</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                to={`/projects`}
                className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {project._count?.collections || 0} collections •{" "}
                      {project._count?.apiKeys || 0} API keys
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(project.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
