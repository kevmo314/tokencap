import { useState } from 'react'
import { Card } from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import { useApiKeys, useCreateApiKey } from '../hooks/useApi'
import type { ApiKey } from '../types'

export default function Settings() {
  const { data: apiKeys, loading, refetch } = useApiKeys()
  const { createApiKey, loading: creating } = useCreateApiKey()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newKeyName) return

    try {
      const result = await createApiKey(newKeyName)
      setNewKey(result.key)
      setNewKeyName('')
      refetch()
    } catch (err) {
      console.error('Failed to create API key:', err)
    }
  }

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setNewKey(null)
    setNewKeyName('')
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your API keys and preferences</p>
      </div>

      {/* API Keys Section */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">API Keys</h2>
            <p className="text-sm text-zinc-400">
              Create and manage your API keys for accessing the Tokencap proxy
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Key
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <ApiKeyRow key={key.id} apiKey={key} onRevoke={() => refetch()} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-400">
            <svg className="w-12 h-12 mx-auto mb-4 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            <p>No API keys yet. Create your first key to get started.</p>
          </div>
        )}
      </Card>

      {/* Alerts Section (Placeholder) */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Alerts & Webhooks</h2>
            <p className="text-sm text-zinc-400">
              Configure notifications when budget thresholds are reached
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-full">
            Coming Soon
          </span>
        </div>

        <div className="space-y-4 opacity-50 pointer-events-none">
          <div className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">Email Alerts</p>
                <p className="text-sm text-zinc-400">Receive alerts via email</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Configure
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">Webhook</p>
                <p className="text-sm text-zinc-400">Send alerts to a custom URL</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Configure
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-[#4A154B]/20">
                <svg className="w-5 h-5 text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">Slack</p>
                <p className="text-sm text-zinc-400">Get alerts in your Slack workspace</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Connect
            </Button>
          </div>
        </div>
      </Card>

      {/* Create API Key Modal */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={newKey ? 'API Key Created' : 'Create API Key'}>
        {newKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-bg-tertiary rounded-lg">
              <p className="text-sm text-zinc-400 mb-2">Your new API key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-bg rounded-lg text-sm font-mono text-accent break-all">
                  {newKey}
                </code>
                <Button variant="secondary" size="sm" onClick={handleCopyKey}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </Button>
              </div>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-500">
                Make sure to copy this key now. You will not be able to see it again.
              </p>
            </div>
            <Button className="w-full" onClick={handleCloseModal}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Key Name"
              placeholder="e.g., Production API Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <p className="text-sm text-zinc-400">
              Give your key a descriptive name to identify it later.
            </p>
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" className="flex-1" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                loading={creating}
                disabled={!newKeyName}
              >
                Create Key
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// API Key Row Component
function ApiKeyRow({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleRevoke = () => {
    // TODO: Implement actual revoke API call
    setShowConfirm(false)
    onRevoke()
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${apiKey.status === 'active' ? 'bg-accent/10' : 'bg-zinc-800'}`}>
            <svg
              className={`w-5 h-5 ${apiKey.status === 'active' ? 'text-accent' : 'text-zinc-500'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{apiKey.name}</p>
              {apiKey.status === 'revoked' && (
                <span className="px-2 py-0.5 text-xs font-medium text-red-500 bg-red-500/10 rounded">
                  Revoked
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 font-mono">{apiKey.keyPrefix}...</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-zinc-400">Created {new Date(apiKey.createdAt).toLocaleDateString()}</p>
            <p className="text-zinc-500">
              {apiKey.lastUsed
                ? `Last used ${new Date(apiKey.lastUsed).toLocaleDateString()}`
                : 'Never used'}
            </p>
          </div>
          {apiKey.status === 'active' && (
            <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)}>
              Revoke
            </Button>
          )}
        </div>
      </div>

      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Revoke API Key">
        <div className="space-y-4">
          <p className="text-zinc-300">
            Are you sure you want to revoke <strong>{apiKey.name}</strong>? This action cannot be undone.
          </p>
          <p className="text-sm text-zinc-400">
            Any applications using this key will no longer be able to authenticate.
          </p>
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleRevoke}>
              Revoke Key
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
