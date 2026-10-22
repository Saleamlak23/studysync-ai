import { getIo, isIoInitialized } from './io.js';
import { boardRoom, channelRoom, userRoom } from './rooms.js';
export const emitToBoard = (id: string, event: string, payload: unknown) => getIo().to(boardRoom(id)).emit(event, payload);
export const emitToChannel = (id: string, event: string, payload: unknown) => getIo().to(channelRoom(id)).emit(event, payload);
export const emitToUser = (id: string, event: string, payload: unknown) => getIo().to(userRoom(id)).emit(event, payload);
export const disconnectUser = (id: string) => {
  if (!isIoInitialized()) return;
  for (const socket of getIo().sockets.sockets.values()) if (socket.data.userId === id) socket.disconnect(true);
};
