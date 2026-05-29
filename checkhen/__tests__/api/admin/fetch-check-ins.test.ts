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
    class: { findFirst: jest.fn() },
    checkIn: { findMany: jest.fn() },
    handRaise: { findMany: jest.fn() },
  },
}));

import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/admin/fetch-check-ins';
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

const activeClass = () => ({
  id: 'class-1',
  createdAt: new Date(),
  duration: 9999,
});

const expiredClass = () => ({
  id: 'class-old',
  createdAt: new Date(0),
  duration: 1,
});

const makeCheckIn = (userId = 'user-1', email = 'student@bu.edu') => ({
  id: 'ci-1',
  userId,
  anonymousName: 'Brave Panda',
  createdAt: new Date('2024-01-01T10:00:00Z'),
  user: {
    email,
    profilePicture: null,
    foodAllergies: null,
    displayName: null,
    namePronunciation: null,
    pronouns: null,
    bio: null,
  },
});

describe('GET /api/admin/fetch-check-ins', () => {
  it('returns 405 for non-GET requests', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('returns 401 if no session', async () => {
    mockNoSession();
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns 403 if session user is not admin', async () => {
    mockStudentSession();
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(403);
  });

  it('returns 500 if no class found', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
  });

  it('returns 500 if class has ended', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(expiredClass());
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
  });

  it('returns 200 with empty array when no check-ins', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClass());
    (prisma.checkIn.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.handRaise.findMany as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const result = JSON.parse(JSON.parse(res._getData()).message);
    expect(result).toEqual([]);
  });

  it('returns correct handRaiseCount for a student with 2 hand raises', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClass());
    (prisma.checkIn.findMany as jest.Mock).mockResolvedValue([makeCheckIn('user-1')]);
    (prisma.handRaise.findMany as jest.Mock).mockResolvedValue([
      { userId: 'user-1', classId: 'class-1' },
      { userId: 'user-1', classId: 'class-1' },
    ]);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    const result = JSON.parse(JSON.parse(res._getData()).message);
    expect(result[0].handRaiseCount).toBe(2);
  });

  it('returns handRaiseCount of 0 for a student with no hand raises', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClass());
    (prisma.checkIn.findMany as jest.Mock).mockResolvedValue([makeCheckIn('user-1')]);
    (prisma.handRaise.findMany as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    const result = JSON.parse(JSON.parse(res._getData()).message);
    expect(result[0].handRaiseCount).toBe(0);
  });

  it('derives name from email username portion', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClass());
    (prisma.checkIn.findMany as jest.Mock).mockResolvedValue([makeCheckIn('user-1', 'jsmith@bu.edu')]);
    (prisma.handRaise.findMany as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    const result = JSON.parse(JSON.parse(res._getData()).message);
    expect(result[0].name).toBe('jsmith');
  });

  it('response includes all expected fields', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClass());
    (prisma.checkIn.findMany as jest.Mock).mockResolvedValue([makeCheckIn()]);
    (prisma.handRaise.findMany as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    const result = JSON.parse(JSON.parse(res._getData()).message);
    const entry = result[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('email');
    expect(entry).toHaveProperty('name');
    expect(entry).toHaveProperty('anonymousName');
    expect(entry).toHaveProperty('joinTime');
    expect(entry).toHaveProperty('handRaiseCount');
    expect(entry).toHaveProperty('userId');
    expect(entry).toHaveProperty('user');
  });

  it('passes admin email exclusion in checkIn.findMany where clause', async () => {
    mockAdminSession();
    (prisma.class.findFirst as jest.Mock).mockResolvedValue(activeClass());
    (prisma.checkIn.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.handRaise.findMany as jest.Mock).mockResolvedValue([]);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req as any, res as any);
    const callArgs = (prisma.checkIn.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.user.email.notIn).toContain('prof@bu.edu');
  });
});
