export const accessLevels = ['member', 'moderator', 'admin'] as const;
export type AccessLevel = typeof accessLevels[number];
export const capabilities = ['community.read', 'catalog.manage', 'content.manage', 'analytics.read', 'members.manage'] as const;
export type Capability = typeof capabilities[number];

/** Safe client summary. Telegram group IDs and external user IDs remain server-side. */
export interface AccessSummary {
  level: AccessLevel;
  capabilities: Capability[];
  source: 'telegram' | 'demo';
}

export const levelCapabilities: Readonly<Record<AccessLevel, readonly Capability[]>> = {
  member: ['community.read'],
  moderator: ['community.read', 'catalog.manage', 'content.manage'],
  admin: capabilities,
};
