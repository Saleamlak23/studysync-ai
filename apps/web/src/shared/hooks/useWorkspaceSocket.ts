import { useEffect } from 'react';
import { getSocket } from '../lib/socket.js';

export function useWorkspaceSocket(workspaceId: string): void {
  useEffect(() => {
    const socket = getSocket();
    const joinWorkspace = () => {
      socket.emit('workspace:join', { workspaceId });
    };

    socket.on('connect', joinWorkspace);
    if (socket.connected) joinWorkspace();

    return () => {
      socket.off('connect', joinWorkspace);
    };
  }, [workspaceId]);
}
