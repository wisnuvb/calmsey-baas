import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import api from "../lib/api";
import { Project, ApiResponse, Collection } from "../types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { formatDate } from "../lib/utils";
import React from "react";

interface OutletContext {
  selectedProject: Project | null;
}

export default function DashboardPage() {
  const { selectedProject } = useOutletContext<OutletContext>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalCollections: 0,
    totalApiKeys: 0,
    totalRecords: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProject]);

  const fetchDashboardData = async () => {
    try {
      const [projectsRes, collectionsRes] = await Promise.all([
        api.get<ApiResponse<Project[]>>("/projects"),
        selectedProject
          ? api.get<ApiResponse<Collection[]>>(
              `/collections?projectId=${selectedProject.id}`
            )
          : Promise.resolve({ data: { success: true, data: [] } }),
      ]);

      if (projectsRes.data.success && projectsRes.data.data) {
        const projectsData = projectsRes.data.data;
        setProjects(projectsData);

        const totalCollections = projectsData.reduce(
          (acc, p) => acc + (p._count?.collections || 0),
          0
        );
        const totalApiKeys = projectsData.reduce(
          (acc, p) => acc + (p._count?.apiKeys || 0),
          0
        );

        setStats({
          totalProjects: projectsData.length,
          totalCollections,
          totalApiKeys,
          totalRecords: 0, // Can be fetched from aggregation API if needed
        });
      }

      if (collectionsRes.data.success && collectionsRes.data.data) {
        setCollections(collectionsRes.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{" "}
          <span role="img" aria-label="wave">
            👋
          </span>
        </h1>
        <p className="mt-2 text-gray-600">
          Here's an overview of your Backend as a Service projects
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Projects
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalProjects}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Active backend projects
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="text-2xl">📁</span>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Collections
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalCollections}
              </p>
              <p className="text-xs text-gray-500 mt-2">Database collections</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <span className="text-2xl">🗂️</span>
            </div>
          </div>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">API Keys</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalApiKeys}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Active authentication keys
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="text-2xl">🔑</span>
            </div>
          </div>
        </Card>

        {/* <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                Features
              </p>
              <p className="text-3xl font-bold text-gray-900">15+</p>
              <p className="text-xs text-gray-500 mt-2">
                Enterprise capabilities
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
          </div>
        </Card> */}
        <Card className="hover:shadow-lg transition-shadow relative">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">Features</p>
              <p className="text-3xl font-bold text-gray-900">15+</p>
              <p className="text-xs text-gray-500 mt-2">
                Enterprise capabilities
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFeaturesModal(true)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                title="View all features"
              >
                <svg
                  className="w-4 h-4 text-gray-600 group-hover:text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Getting Started / Quick Actions */}
      {projects.length === 0 ? (
        <Card>
          <div className="text-center flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🚀</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Get Started with Calmsey BaaS
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first project to start building your backend API with
              enterprise features
            </p>
            <Link to="/projects">
              <Button size="lg">Create Your First Project</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card title="Quick Actions" className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                to="/projects"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center group-hover:bg-primary-200">
                    <span className="text-xl">➕</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      New Project
                    </h4>
                    <p className="text-sm text-gray-600">
                      Create a new backend project
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                to="/collections"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200">
                    <span className="text-xl">🗂️</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Add Collection
                    </h4>
                    <p className="text-sm text-gray-600">
                      Create database tables
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                to="/api-keys"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200">
                    <span className="text-xl">🔑</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Generate API Key
                    </h4>
                    <p className="text-sm text-gray-600">
                      Create authentication keys
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                to="/help"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200">
                    <span className="text-xl">📚</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      View Documentation
                    </h4>
                    <p className="text-sm text-gray-600">
                      Learn about features
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </Card>

          {/* Key Features */}
          <Card title="Enterprise Features">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    ACID Transactions
                  </p>
                  <p className="text-xs text-gray-600">
                    Atomic database operations
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Real-time Subscriptions
                  </p>
                  <p className="text-xs text-gray-600">
                    WebSocket live updates
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Webhooks</p>
                  <p className="text-xs text-gray-600">
                    Event-driven callbacks
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Multi-Database
                  </p>
                  <p className="text-xs text-gray-600">
                    Dedicated DB per project
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-green-500 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Audit Logging
                  </p>
                  <p className="text-xs text-gray-600">Complete trail</p>
                </div>
              </div>
              <Link
                to="/help"
                className="block text-sm text-primary-600 hover:text-primary-700 font-medium mt-4"
              >
                View all features →
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card
            title="Recent Projects"
            actions={
              <Link
                to="/projects"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View all →
              </Link>
            }
          >
            <div className="space-y-3">
              {projects.slice(0, 5).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects`}
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {project.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {project._count?.collections || 0} collections •{" "}
                          {project._count?.apiKeys || 0} keys
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 ml-2">
                      {formatDate(project.createdAt)}
                    </div>
                  </div>
                </Link>
              ))}
              {projects.length === 0 && (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center justify-center">
                  <p>No projects yet</p>
                  <Link
                    to="/projects"
                    className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block"
                  >
                    Create your first project →
                  </Link>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Collections (if project selected) */}
          {selectedProject && (
            <Card
              title={`${selectedProject.name} - Collections`}
              actions={
                <Link
                  to="/collections"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Manage →
                </Link>
              }
            >
              <div className="space-y-3">
                {collections.length > 0 ? (
                  collections.slice(0, 5).map((collection) => (
                    <Link
                      key={collection.id}
                      to={`/collections/${collection.id}`}
                      className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-xl">🗂️</span>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {collection.name}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {collection.slug}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No collections yet</p>
                    <Link
                      to="/collections"
                      className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block"
                    >
                      Create your first collection →
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* API Resources */}
          {!selectedProject && (
            <Card title="API Resources">
              <div className="space-y-4">
                <a
                  href="http://localhost:3000/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📖</span>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        API Documentation
                      </h4>
                      <p className="text-sm text-gray-600">
                        Interactive Swagger/OpenAPI docs
                      </p>
                    </div>
                  </div>
                </a>

                <Link
                  to="/help"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📚</span>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Feature Guides
                      </h4>
                      <p className="text-sm text-gray-600">
                        Learn about enterprise features
                      </p>
                    </div>
                  </div>
                </Link>

                <a
                  href="https://github.com/wisnuvb/calmsey-baas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💻</span>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        GitHub Repository
                      </h4>
                      <p className="text-sm text-gray-600">
                        Source code and examples
                      </p>
                    </div>
                  </div>
                </a>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Help Section */}
      <Card>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">💡</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Need Help Getting Started?
            </h3>
            <p className="text-gray-600 mb-4">
              Calmsey BaaS provides a complete backend solution with enterprise
              features like transactions, real-time subscriptions, webhooks, and
              more. Check out our documentation to learn how to build powerful
              applications.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/help">
                <Button variant="outline">View Documentation</Button>
              </Link>
              <a
                href="http://localhost:3000/docs"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline">API Reference</Button>
              </a>
              <a
                href="https://github.com/wisnuvb/calmsey-baas/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline">Report Issue</Button>
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* Features Modal */}
      {showFeaturesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Enterprise Features
              </h2>
              <button
                onClick={() => setShowFeaturesModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: "ACID Transactions",
                  description:
                    "Atomic database operations with rollback support",
                  icon: "🔒",
                },
                {
                  name: "Real-time Subscriptions",
                  description: "WebSocket live updates for instant data sync",
                  icon: "⚡",
                },
                {
                  name: "Webhooks",
                  description: "Event-driven callbacks for integrations",
                  icon: "🔔",
                },
                {
                  name: "Multi-Database",
                  description: "Dedicated database per project",
                  icon: "🗄️",
                },
                {
                  name: "Audit Logging",
                  description: "Complete trail of all operations",
                  icon: "📝",
                },
                {
                  name: "Dynamic API",
                  description: "Auto-generated REST API from schema",
                  icon: "🚀",
                },
                {
                  name: "Relations & Populate",
                  description: "One-to-one, one-to-many, many-to-many support",
                  icon: "🔗",
                },
                {
                  name: "Advanced Filtering",
                  description: "Complex queries with operators ($gt, $in, etc)",
                  icon: "🔍",
                },
                {
                  name: "Bulk Operations",
                  description: "Create, update, delete multiple records",
                  icon: "📦",
                },
                {
                  name: "Data Export/Import",
                  description: "JSON, CSV, XLSX format support",
                  icon: "📊",
                },
                {
                  name: "Rate Limiting",
                  description: "API throttling per API key",
                  icon: "⏱️",
                },
                {
                  name: "Soft Delete",
                  description: "Optional soft delete with deletedAt",
                  icon: "🗑️",
                },
                {
                  name: "Auto Timestamps",
                  description: "Automatic createdAt and updatedAt",
                  icon: "⏰",
                },
                {
                  name: "File Upload",
                  description: "Local and S3 storage support",
                  icon: "📁",
                },
                {
                  name: "Schema Validation",
                  description: "Automatic validation based on schema",
                  icon: "✅",
                },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{feature.icon}</span>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {feature.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex gap-3">
                <Link to="/help" className="flex-1">
                  <Button className="w-full" variant="outline">
                    View Documentation
                  </Button>
                </Link>
                <Button
                  className="flex-1"
                  onClick={() => setShowFeaturesModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
