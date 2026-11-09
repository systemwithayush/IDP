import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketServer(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}
