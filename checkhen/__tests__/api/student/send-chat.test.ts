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
    user: { upsert: jest.fn() },
    class: { findFirst: jest.fn() },
    chatMessage: { create: jest.fn() },
  },
}));

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/student/send-chat';
import * as nextAuth from 'next-auth';
import { prisma } from '@/lib/prisma';

const activeClassWithCheckIn = (userId = 'user-1') => ({
  id: 'class-1',
  createdAt: new Date(),
  duration: 9999,
  checkIns: [{ userId, anonymousName: 'Brave Panda' }],
});

const expiredClassWithCheckIn = (userId = 'user-1') => ({
  id: 'class-old',
  createdAt: new Date(0),
  duration: 1,
  checkIns: [{ userId, anonymousName: 'Brave Panda' }],
});

const mockSession = (email = 'student@bu.edu') =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue({ user: { email } });

const mockNoSession = () =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue(null);

afterEach(() => jest.clearAllMocks());

describe('POST /api/student/send-chat', () => {
  it('returns 405 for non-POST requests', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 401 if no session', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'POST', body: { message: 'hello' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 400 if message is missing', async () => {
    mockSession();
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 400 if message is empty string', async () => {
    mockSession();
    const { req, res } = createMocks({ method: 'POST', body: { message: '' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 400 if message is whitespace only', async () => {
    mockSession();
    const { req, res } = createMocks({ method: 'POST', body: { message: '   ' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('returns 400 if message exceeds 1000 characters', async () => {
    mockSession();
    const { req, res } = createMocks({ method: 'POST', body: { message: 'x'.repeat(1001) } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
  });

  it('accepts a message of exactly 1000 characters', async () => {
    mockSession();
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClassWithCheckIn());
    (prisma.chatMessage.create as jest.Mock).mockResolvedValue({ id: 'msg-1', message: 'x'.repeat(1000) });
    const { req, res } = createMocks({ method: 'POST', body: { message: 'x'.repeat(1000) } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
  });

  it('returns 500 if no class found', async () => {
    mockSession();
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { message: 'hello' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
  });

  it('returns 500 if class has ended', async () => {
    mockSession();
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(expiredClassWithCheckIn());
    const { req, res } = createMocks({ method: 'POST', body: { message: 'hello' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
  });

  it('returns 500 if user has no check-in in the class', async () => {
    mockSession();
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.class.findFirst as jest.Mock).mockResolvedValue({
      id: 'class-1',
      createdAt: new Date(),
      duration: 9999,
      checkIns: [], // no check-ins
    });
    const { req, res } = createMocks({ method: 'POST', body: { message: 'hello' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
  });

  it('creates chat message and returns 200 with message body', async () => {
    mockSession();
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: 'user-1' });
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClassWithCheckIn());
    const createdMsg = { id: 'msg-1', message: 'hello', anonymousName: 'Brave Panda' };
    (prisma.chatMessage.create as jest.Mock).mockResolvedValue(createdMsg);
    const { req, res } = createMocks({ method: 'POST', body: { message: 'hello' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'hello',
          anonymousName: 'Brave Panda',
          user: { connect: { id: 'user-1' } },
          class: { connect: { id: 'class-1' } },
        }),
      })
    );
    const body = JSON.parse(res._getData());
    expect(JSON.parse(body.message)).toMatchObject({ id: 'msg-1' });
  });
});
