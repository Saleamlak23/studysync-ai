export const WorkspaceRole = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER' } as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];
export const SystemRole = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];
export const Priority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
export const NotificationType = { ASSIGNED: 'ASSIGNED', MENTION: 'MENTION', DEADLINE: 'DEADLINE' } as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];
