declare global {
  namespace Express {
    interface Request {
      user?: { id: string; systemRole: 'USER' | 'ADMIN' };
      membership?: { workspaceId: string; role: 'MEMBER' | 'ADMIN' | 'OWNER'; aiEnabled: boolean };
    }
  }
}
export {};
