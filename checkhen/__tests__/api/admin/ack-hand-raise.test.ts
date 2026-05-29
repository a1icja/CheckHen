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
    handRaise: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/admin/ack-hand-raise';
import * as nextAuth from 'next-auth';
import { prisma } from '@/lib/prisma';

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    ADMIN_EMAILS: 'prof',
    NEXT_PUBLIC_EMAIL_DOMAIN: 'bu.edu',
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

const mockAdminSession = () =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'prof@bu.edu' } });

const mockStudentSession = () =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue({ user: { email: 'student@bu.edu' } });

const mockNoSession = () =>
  (nextAuth.getServerSession as jest.Mock).mockResolvedValue(null);

describe('POST /api/admin/ack-hand-raise', () => {
  it('returns 405 for non-POST requests', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 401 if no session', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'POST', body: { email: 'student@bu.edu' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 403 if session user is not admin', async () => {
    mockStudentSession();
    const { req, res } = createMocks({ method: 'POST', body: { email: 'student@bu.edu' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
  });

  it('returns 404 if no unacknowledged hand raise found', async () => {
    mockAdminSession();
    (prisma.handRaise.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: { email: 'student@bu.edu' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(404);
  });

  it('acknowledges hand raise and returns 200', async () => {
    mockAdminSession();
    (prisma.handRaise.findFirst as jest.Mock).mockResolvedValue({ id: 'hr-1', user: { email: 'student@bu.edu' } });
    (prisma.handRaise.update as jest.Mock).mockResolvedValue({});
    const { req, res } = createMocks({ method: 'POST', body: { email: 'student@bu.edu' } });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(prisma.handRaise.update).toHaveBeenCalledWith({
      where: { id: 'hr-1' },
      data: { isAcknowledged: true },
    });
  });

  it('queries hand raise by the email from request body', async () => {
    mockAdminSession();
    (prisma.handRaise.findFirst as jest.Mock).mockResolvedValue({ id: 'hr-1' });
    (prisma.handRaise.update as jest.Mock).mockResolvedValue({});
    const { req, res } = createMocks({ method: 'POST', body: { email: 'target@bu.edu' } });
    await handler(req as any, res as any);
    const callArgs = (prisma.handRaise.findFirst as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.user.email).toBe('target@bu.edu');
    expect(callArgs.where.isAcknowledged).toBe(false);
  });

  // BUG: no validation that 'email' is present in request body — undefined is passed to Prisma
  it('(bug exposure) proceeds without 400 when no email in request body', async () => {
    mockAdminSession();
    (prisma.handRaise.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'POST', body: {} });
    await handler(req as any, res as any);
    // Returns 404 (not 400) because Prisma gets undefined email and finds nothing — missing input validation
    expect(res._getStatusCode()).toBe(404);
  });
});
