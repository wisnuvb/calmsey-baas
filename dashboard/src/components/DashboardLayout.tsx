import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { authService } from "../lib/auth";
import { useEffect, useState } from "react";
import { User, Project, ApiResponse } from "../types";
import api from "../lib/api";
import React from "react";

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    const storedUser = authService.getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    // Fetch fresh user data and projects
    Promise.all([
      api.get("/auth/me"),
      api.get<ApiResponse<Project[]>>("/projects"),
    ])
      .then(([userResponse, projectsResponse]) => {
        if (userResponse.data.success && userResponse.data.data) {
          setUser(userResponse.data.data);
        }
        if (projectsResponse.data.success && projectsResponse.data.data) {
          setProjects(projectsResponse.data.data);
          if (projectsResponse.data.data.length > 0) {
            setSelectedProject(projectsResponse.data.data[0]);
          }
        }
      })
      .catch(() => {
        authService.logout();
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    authService.logout();
  };

  const navigation = [
    {
      section: "General",
      items: [
        { name: "Home", href: "/", icon: "🏠" },
        { name: "Projects", href: "/projects", icon: "📁" },
      ],
    },
    {
      section: "Project",
      items: [
        {
          name: "Collections",
          href: "/collections",
          icon: "🗂️",
          projectRequired: true,
        },
        {
          name: "Functions",
          href: "/functions",
          icon: "⚡",
          projectRequired: true,
        },
        {
          name: "API Keys",
          href: "/api-keys",
          icon: "🔑",
          projectRequired: true,
        },
      ],
    },
    {
      section: "Resources",
      items: [{ name: "Documentation", href: "/help", icon: "📚" }],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Calmsey</h1>
              <p className="text-xs text-gray-500">Backend as a Service</p>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Active Project
            </label>
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full px-3 py-2 text-left bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {selectedProject?.name || "Select Project"}
                  </span>
                </div>
                <span className="text-gray-400">▼</span>
              </button>

              {showProjectDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => {
                        setSelectedProject(project);
                        setShowProjectDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                        selectedProject?.id === project.id
                          ? "bg-primary-50"
                          : ""
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {project.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {project.slug}
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-gray-200">
                    <Link
                      to="/projects"
                      className="block px-3 py-2 text-sm text-primary-600 hover:bg-gray-50"
                      onClick={() => setShowProjectDropdown(false)}
                    >
                      + Create New Project
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {navigation.map((section) => (
            <div key={section.section}>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {section.section}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  const isDisabled = item.projectRequired && !selectedProject;

                  return (
                    <Link
                      key={item.href}
                      to={isDisabled ? "#" : item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary-50 text-primary-700 font-medium"
                          : isDisabled
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={(e) => {
                        if (isDisabled) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm">{item.name}</span>
                      {isDisabled && (
                        <span className="ml-auto text-xs text-gray-400">
                          No project
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Info */}
        <div className="px-3 py-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase() ||
                  user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-medium text-gray-600">
                {location.pathname === "/" && "Dashboard"}
                {location.pathname === "/projects" && "Projects"}
                {location.pathname === "/collections" && "Collections"}
                {location.pathname === "/functions" && "Functions"}
                {location.pathname === "/api-keys" && "API Keys"}
                {location.pathname === "/help" && "Documentation"}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="http://localhost:3000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                📖 API Docs
              </a>
              {selectedProject && (
                <div className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                  ✓ {selectedProject.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8">
          <Outlet context={{ selectedProject }} />
        </div>
      </div>
    </div>
  );
}
