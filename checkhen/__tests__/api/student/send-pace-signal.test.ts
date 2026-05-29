jest.mock('next-auth', () => {
  const mockGetServerSession = jest.fn();
  return {
    __esModule: true,
    default: () => jest.fn(),
    getServerSession: mockGetServerSession,
  };
});

jest.mock('@/pages/api/auth/[...nextauth]', () => ({
  authOptions: {},
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    checkIn: { findFirst: jest.fn() },
    paceSignal: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/student/send-pace-signal';
import * as nextAuth from 'next-auth';
import { prisma } from '@/lib/prisma';

const mockUser = { id: 'user-1', email: 'student@bu.edu' };
const mockActiveCheckIn = () => ({
  userId: 'user-1',
  isPresent: true,
  class: { id: 'class-1' },
});

const mockSession = (email = 'student@bu.edu') =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue({ user: { email } });

const mockNoSession = () =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue(null);

afterEach(() => jest.clearAllMocks());

describe('POST /api/student/send-pace-signal', () => {
  it('returns 405 for non-POST requests', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 401 if no session', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'slow_down' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 400 if signalType is missing', async () => {
    mockSession();
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 400 if signalType is invalid', async () => {
    mockSession();
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'speed_up' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 404 if user not found in database', async () => {
    mockSession();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'slow_down' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(404);
  });

  it('returns 400 if user has no active check-in', async () => {
    mockSession();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.checkIn.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'slow_down' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('records slow_down signal and returns 200', async () => {
    mockSession();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.checkIn.findFirst as jest.Mock).mockResolvedValue(mockActiveCheckIn());
    (prisma.paceSignal.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.paceSignal.create as jest.Mock).mockResolvedValue({});
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'slow_down' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.signalType).toBe('slow_down');
  });

  it('records ready_to_move_on signal and returns 200', async () => {
    mockSession();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.checkIn.findFirst as jest.Mock).mockResolvedValue(mockActiveCheckIn());
    (prisma.paceSignal.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.paceSignal.create as jest.Mock).mockResolvedValue({});
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'ready_to_move_on' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.signalType).toBe('ready_to_move_on');
  });

  it('deletes existing signal before creating new one', async () => {
    mockSession();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.checkIn.findFirst as jest.Mock).mockResolvedValue(mockActiveCheckIn());
    (prisma.paceSignal.deleteMany as jest.Mock).mockResolvedValue({});
    (prisma.paceSignal.create as jest.Mock).mockResolvedValue({});
    const { req, res } = createMocks({ method: 'POST', body: { signalType: 'slow_down' } });
    await handler(req as any, res as any);
    expect(prisma.paceSignal.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', classId: 'class-1' },
    });
    expect(prisma.paceSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          classId: 'class-1',
          signalType: 'slow_down',
        }),
      })
    );
    // deleteMany invocation order must precede create
    const deleteManyOrder = (prisma.paceSignal.deleteMany as jest.Mock).mock.invocationCallOrder[0];
    const createOrder = (prisma.paceSignal.create as jest.Mock).mock.invocationCallOrder[0];
    expect(deleteManyOrder).toBeLessThan(createOrder);
  });
});
