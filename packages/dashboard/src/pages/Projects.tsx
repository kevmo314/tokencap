import { useState } from 'react'
import { Card } from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import { useProjects, useCreateProject } from '../hooks/useApi'
import type { Project } from '../types'

export default function Projects() {
  const { data: projects, loading, refetch } = useProjects()
  const { createProject, loading: creating } = useCreateProject()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', budget: '' })
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const handleCreate = async () => {
    if (!newProject.name || !newProject.budget) return

    try {
      await createProject({
        name: newProject.name,
        budget: parseFloat(newProject.budget),
      })
      setIsModalOpen(false)
      setNewProject({ name: '', budget: '' })
      refetch()
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  const getBudgetUtilization = (spent: number, budget: number) => {
    if (budget === 0) return 0
    return Math.min((spent / budget) * 100, 100)
  }

  const getBudgetColor = (spent: number, budget: number) => {
    const util = getBudgetUtilization(spent, budget)
    if (util >= 90) return 'bg-red-500'
    if (util >= 75) return 'bg-yellow-500'
    return 'bg-accent'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-zinc-400 mt-1">Manage your projects and budgets</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="hover:border-zinc-600 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                  <p className="text-sm text-zinc-500">
                    {project.requestCount.toLocaleString()} requests
                  </p>
                </div>
                <button
                  onClick={() => setEditingProject(project)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>

              {/* Budget Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Budget Usage</span>
                  <span className="text-white">
                    ${project.spent.toFixed(2)} / ${project.budget.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getBudgetColor(project.spent, project.budget)} transition-all duration-500`}
                    style={{ width: `${getBudgetUtilization(project.spent, project.budget)}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  {(100 - getBudgetUtilization(project.spent, project.budget)).toFixed(1)}% remaining
                </p>
              </div>

              {/* Quick Stats */}
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Avg Cost/Request</p>
                  <p className="text-sm font-medium text-white">
                    ${project.requestCount > 0 ? (project.spent / project.requestCount).toFixed(4) : '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Last Updated</p>
                  <p className="text-sm font-medium text-white">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-zinc-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
          <p className="text-zinc-400 mb-4">Create your first project to start tracking costs</p>
          <Button onClick={() => setIsModalOpen(true)}>Create Project</Button>
        </Card>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setNewProject({ name: '', budget: '' })
        }}
        title="Create New Project"
      >
        <div className="space-y-4">
          <Input
            label="Project Name"
            placeholder="e.g., Production API"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
          />
          <Input
            label="Monthly Budget"
            type="number"
            placeholder="e.g., 100"
            value={newProject.budget}
            onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
          />
          <p className="text-sm text-zinc-400">
            Requests will be blocked when the budget is exceeded.
          </p>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsModalOpen(false)
                setNewProject({ name: '', budget: '' })
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              loading={creating}
              disabled={!newProject.name || !newProject.budget}
            >
              Create Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        title="Edit Project"
      >
        {editingProject && (
          <div className="space-y-4">
            <Input
              label="Project Name"
              value={editingProject.name}
              onChange={(e) =>
                setEditingProject({ ...editingProject, name: e.target.value })
              }
            />
            <Input
              label="Monthly Budget"
              type="number"
              value={editingProject.budget.toString()}
              onChange={(e) =>
                setEditingProject({
                  ...editingProject,
                  budget: parseFloat(e.target.value) || 0,
                })
              }
            />
            <div className="flex gap-3 pt-4">
              <Button
                variant="danger"
                onClick={() => {
                  // TODO: Implement delete
                  setEditingProject(null)
                }}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEditingProject(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  // TODO: Implement save
                  setEditingProject(null)
                  refetch()
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
