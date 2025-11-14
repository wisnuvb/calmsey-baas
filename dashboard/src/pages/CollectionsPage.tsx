import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Collection, Project, ApiResponse, FieldDefinition } from "../types";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import { formatDate } from "../lib/utils";
import React from "react";
import { X, Copy, ExternalLink, Database, Code, Settings } from "lucide-react";

const FIELD_TYPES = [
  "string",
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "email",
  "url",
  "json",
  "file",
  "relation",
];

const RELATION_TYPES = [
  { value: "one-to-one", label: "One to One" },
  { value: "one-to-many", label: "One to Many" },
  { value: "many-to-many", label: "Many to Many" },
];

export default function CollectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    schema: {
      fields: [] as FieldDefinition[],
      timestamps: true,
      softDelete: false,
      idType: "uuid" as "uuid" | "autoincrement",
    },
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newField, setNewField] = useState<Partial<FieldDefinition>>({
    name: "",
    type: "string",
    required: false,
    unique: false,
    indexed: false,
  });
  const [showRelationConfig, setShowRelationConfig] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchCollections();
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const response = await api.get<ApiResponse<Project[]>>("/projects");
      if (response.data.success && response.data.data) {
        setProjects(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  };

  const fetchProject = async () => {
    if (!projectId) return;
    try {
      const response = await api.get<ApiResponse<Project>>(
        `/projects/${projectId}`
      );
      if (response.data.success && response.data.data) {
        setProject(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch project:", error);
    }
  };

  const fetchCollections = async () => {
    if (!projectId) return;
    try {
      const response = await api.get<ApiResponse<Collection[]>>(
        `/collections?projectId=${projectId}`
      );
      if (response.data.success && response.data.data) {
        setCollections(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = () => {
    if (!newField.name || !newField.type) return;

    if (newField.name.toLowerCase() === "id") {
      setError(
        "Field 'id' is automatically created. You don't need to add it manually."
      );
      return;
    }

    // If type is relation, make sure relation config is filled
    if (newField.type === "relation") {
      if (!newField.relation?.collection || !newField.relation?.type) {
        setError("Please configure relation settings");
        setShowRelationConfig(true);
        return;
      }
    }

    setFormData({
      ...formData,
      schema: {
        ...formData.schema,
        fields: [...formData.schema.fields, newField as FieldDefinition],
      },
    });
    setNewField({
      name: "",
      type: "string",
      required: false,
      unique: false,
      indexed: false,
    });
    setShowRelationConfig(false);
  };

  const handleRemoveField = (index: number) => {
    setFormData({
      ...formData,
      schema: {
        ...formData.schema,
        fields: formData.schema.fields.filter((_, i) => i !== index),
      },
    });
  };

  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection);
    const schema = collection.schema as any;
    setFormData({
      name: collection.name,
      schema: {
        fields: schema.fields || [],
        timestamps: schema.timestamps ?? true,
        softDelete: schema.softDelete ?? false,
        idType: schema.idType || "uuid",
      },
    });
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (formData.schema.fields.length === 0) {
      setError("Please add at least one field");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      if (editingCollection) {
        // Update collection
        const response = await api.patch<
          ApiResponse<Collection> & { migration?: any }
        >(`/collections/${editingCollection.id}`, formData);
        if (response.data.success && response.data.data) {
          // Show info migration if available
          if (response.data.migration?.applied) {
            const changes = response.data.migration.changes || 0;
            const warnings = response.data.migration.warnings || [];

            let message = `Collection updated successfully!`;
            if (changes > 0) {
              message += ` Database table migrated with ${changes} change(s).`;
            }
            if (warnings.length > 0) {
              message += ` Warnings: ${warnings.join(", ")}`;
            }

            alert(message); // Can be replaced with a better toast notification
          }

          setShowCreateModal(false);
          setEditingCollection(null);
          resetForm();
          fetchCollections();
        }
      } else {
        // Create collection
        const response = await api.post<ApiResponse<Collection>>(
          `/collections?projectId=${projectId}`,
          formData
        );
        if (response.data.success && response.data.data) {
          setShowCreateModal(false);
          resetForm();
          fetchCollections();
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.details?.error ||
          "Failed to save collection"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      schema: {
        fields: [],
        timestamps: true,
        softDelete: false,
        idType: "uuid",
      },
    });
    setNewField({
      name: "",
      type: "string",
      required: false,
      unique: false,
      indexed: false,
    });
    setShowRelationConfig(false);
    setError("");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return;
    try {
      await api.delete(`/collections/${id}`);
      fetchCollections();
    } catch (error) {
      alert("Failed to delete collection");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You can add a toast notification here
  };

  const getApiBaseUrl = () => {
    return import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  };

  const getCollectionApiUrl = (collectionSlug: string) => {
    if (!project?.slug) return "";
    return `${getApiBaseUrl()}/data/${project.slug}/${collectionSlug}`;
  };

  // Filter collections for relation dropdown (exclude current collection if editing)
  const availableCollections = collections.filter(
    (c) => !editingCollection || c.id !== editingCollection.id
  );

  const handleProjectSelect = (selectedProjectId: string) => {
    setSearchParams({ projectId: selectedProjectId });
  };

  if (!projectId) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="text-center py-12 px-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Database className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Select a Project
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Choose a project to view and manage its collections, or create a
              new project to get started.
            </p>

            {projects.length === 0 ? (
              <div className="space-y-4">
                <p className="text-gray-500">No projects found</p>
                <Button onClick={() => navigate("/projects")}>
                  Create Your First Project
                </Button>
              </div>
            ) : (
              <div className="max-w-md mx-auto space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 text-left">
                    Select Project
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a project...
                    </option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-200 flex flex-col items-center justify-center">
                  <p className="text-sm text-gray-500 mb-3">
                    Or create a new project
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/projects")}
                  >
                    Go to Projects
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Info */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">💡</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What are Collections?
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                Collections are like database tables where you define the
                structure of your data. Each collection can have fields,
                relations, and constraints.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Define custom fields and data types</li>
                <li>✓ Set up relations between collections</li>
                <li>✓ Auto-generated REST API endpoints</li>
                <li>✓ Built-in timestamps and soft delete</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Project Information Card */}
      {project && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {project.name}
                  </h1>
                  <p className="text-sm text-gray-600">/{project.slug}</p>
                </div>
              </div>
              {project.description && (
                <p className="text-gray-700 mt-2">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Code className="w-4 h-4" />
                  API Base: {getApiBaseUrl()}/data/{project.slug}
                </span>
                <span className="flex items-center gap-1">
                  <Database className="w-4 h-4" />
                  {collections.length} Collection
                  {collections.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingCollection(null);
                resetForm();
                setShowCreateModal(true);
              }}
            >
              Create Collection
            </Button>
          </div>
        </Card>
      )}

      {/* Collections Grid */}
      {collections.length === 0 ? (
        <Card>
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No collections yet</p>
            <Button
              onClick={() => {
                setEditingCollection(null);
                resetForm();
                setShowCreateModal(true);
              }}
            >
              Create Your First Collection
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {collections.map((collection) => {
            const schema = collection.schema as any;
            const apiUrl = getCollectionApiUrl(collection.slug);

            return (
              <Card
                key={collection.id}
                className="hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {collection.name}
                    </h3>
                    <p className="text-sm text-gray-500">/{collection.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/collections/${collection.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(collection)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(collection.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* API Endpoint Section */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      API Endpoint
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white px-3 py-2 rounded border border-gray-300 text-gray-800 font-mono break-all">
                      {apiUrl}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(apiUrl)}
                      className="shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>GET • POST • PATCH • DELETE</span>
                    </div>
                  </div>
                </div>

                {/* Schema Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Fields:</span>
                    <span className="font-medium">
                      {schema?.fields?.length || 0}
                    </span>
                  </div>
                  {schema?.timestamps && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Settings className="w-3 h-3" />
                      <span>Timestamps enabled</span>
                    </div>
                  )}
                  {schema?.softDelete && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Settings className="w-3 h-3" />
                      <span>Soft delete enabled</span>
                    </div>
                  )}
                </div>

                {/* Fields Preview */}
                {schema?.fields && schema.fields.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Fields Preview:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {schema.fields
                        .slice(0, 5)
                        .map((field: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200"
                          >
                            {field.name}
                            {field.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                            {field.unique && (
                              <span className="text-purple-500 ml-1">🔑</span>
                            )}
                            {field.indexed && !field.unique && (
                              <span className="text-green-500 ml-1">📇</span>
                            )}
                          </span>
                        ))}
                      {schema.fields.length > 5 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          +{schema.fields.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {formatDate(collection.createdAt)}
                  </span>
                  <a
                    href={`${apiUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    Try API
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingCollection(null);
          resetForm();
        }}
        title={editingCollection ? "Edit Collection" : "Create New Collection"}
        size="2xl"
      >
        <div className="p-6">
          <form onSubmit={handleCreate} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {!editingCollection && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">ℹ️ Automatic ID Field</p>
                <p>
                  Every collection automatically gets an{" "}
                  <code className="bg-blue-100 px-1 rounded">id</code> field as
                  primary key. You don't need to add it manually.
                </p>
              </div>
            )}

            <Input
              label="Collection Name"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Products, Users, Posts"
            />

            {!editingCollection && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  ID Type
                </label>
                <select
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  value={formData.schema.idType || "uuid"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schema: {
                        ...formData.schema,
                        idType: e.target.value as "uuid" | "autoincrement",
                      },
                    })
                  }
                >
                  <option value="uuid">
                    UUID (String) - Recommended for distributed systems
                  </option>
                  <option value="autoincrement">
                    Auto-increment (Integer) - Sequential numbers
                  </option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.schema.idType === "uuid"
                    ? 'UUID generates unique string IDs (e.g., "550e8400-e29b-41d4-a716-446655440000")'
                    : "Auto-increment generates sequential integer IDs (1, 2, 3, ...)"}
                </p>
              </div>
            )}

            {/* Add Field Section */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Add Fields</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    className="flex-1 min-w-[150px]"
                    placeholder="Field name"
                    value={newField.name || ""}
                    onChange={(e) =>
                      setNewField({ ...newField, name: e.target.value })
                    }
                  />
                  <select
                    className="px-4 py-2 border border-gray-300 rounded-lg min-w-[120px]"
                    value={newField.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setNewField({
                        ...newField,
                        type: newType,
                        relation:
                          newType === "relation"
                            ? newField.relation
                            : undefined,
                      });
                      setShowRelationConfig(newType === "relation");
                    }}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newField.required}
                      onChange={(e) =>
                        setNewField({
                          ...newField,
                          required: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm whitespace-nowrap">Required</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newField.unique}
                      onChange={(e) =>
                        setNewField({
                          ...newField,
                          unique: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm whitespace-nowrap">Unique</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newField.indexed}
                      onChange={(e) =>
                        setNewField({
                          ...newField,
                          indexed: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm whitespace-nowrap">Index</span>
                  </label>
                  <Button type="button" size="sm" onClick={handleAddField}>
                    +
                  </Button>
                </div>

                {/* Relation Configuration */}
                {showRelationConfig && newField.type === "relation" && (
                  <div className="bg-gray-50 p-3 rounded-lg space-y-3 border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">
                      Configure Relation
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Related Collection
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          value={newField.relation?.collection || ""}
                          onChange={(e) =>
                            setNewField({
                              ...newField,
                              relation: {
                                ...newField.relation,
                                collection: e.target.value,
                                type: newField.relation?.type || "one-to-many",
                              } as any,
                            })
                          }
                        >
                          <option value="">Select collection...</option>
                          {availableCollections.map((col) => (
                            <option key={col.id} value={col.slug}>
                              {col.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Relation Type
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          value={newField.relation?.type || "one-to-many"}
                          onChange={(e) =>
                            setNewField({
                              ...newField,
                              relation: {
                                ...newField.relation,
                                collection: newField.relation?.collection || "",
                                type: e.target.value as any,
                              } as any,
                            })
                          }
                        >
                          {RELATION_TYPES.map((rt) => (
                            <option key={rt.value} value={rt.value}>
                              {rt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {newField.relation?.type === "one-to-one" &&
                        "One record relates to exactly one other record"}
                      {newField.relation?.type === "one-to-many" &&
                        "One record can relate to many other records"}
                      {newField.relation?.type === "many-to-many" &&
                        "Many records can relate to many other records"}
                    </p>
                  </div>
                )}
              </div>

              {/* Fields List */}
              {formData.schema.fields.length > 0 && (
                <div className="space-y-2 mt-4">
                  {formData.schema.fields.map((field, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <span className="text-sm">
                        <span className="font-medium">{field.name}</span>
                        <span className="text-gray-500 ml-2">
                          ({field.type})
                        </span>
                        {field.relation && (
                          <span className="text-purple-500 ml-2">
                            → {field.relation.collection} ({field.relation.type}
                            )
                          </span>
                        )}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                        {field.unique && (
                          <span className="text-blue-500 ml-1">🔑</span>
                        )}
                        {field.indexed && !field.unique && (
                          <span className="text-green-500 ml-1">📇</span>
                        )}
                      </span>
                      <X
                        className="w-4 h-4 text-red-500 cursor-pointer"
                        onClick={() => handleRemoveField(index)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.schema.timestamps}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schema: {
                        ...formData.schema,
                        timestamps: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm">
                  Enable timestamps (createdAt, updatedAt)
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.schema.softDelete}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schema: {
                        ...formData.schema,
                        softDelete: e.target.checked,
                      },
                    })
                  }
                />
                <span className="text-sm">Enable soft delete</span>
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCollection(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" isLoading={submitting}>
                {editingCollection ? "Update Collection" : "Create Collection"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
