import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Chat module (M13b) end-to-end coverage:
 *  - REST: room create/dedupe (DIRECT), list-my-rooms membership scoping,
 *    membership-gated message history (403 for non-members), send+history
 *    round-trip, multipart attachment upload producing a `messageType:'file'`
 *    row, DEPARTMENT room creation with no `memberEmployeeIds` (regression
 *    guard for the DTO `@ArrayNotEmpty` bug on DEPARTMENT rooms).
 *  - Socket.io (`/chat` namespace): reject connections without/with a bad
 *    JWT, `chat:join` ack true/false based on membership, two-client
 *    same-room `chat:message` -> `chat:message:new` fan-out + persistence.
 *  - Auto-revocation: EXITED/SUSPENDED employees have all ChatRoomMember rows
 *    revoked, and subsequently fail both REST membership checks and
 *    `chat:join`.
 *
 * Runs against the real dev MySQL/Redis instance (same as `npm run start:dev`).
 */
describe('Chat module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  const PASSWORD = 'Test@1234';
  const createdOrgIds: string[] = [];
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
    const server = await app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    for (const socket of openSockets) {
      if (socket.connected) socket.disconnect();
    }
    for (const organizationId of createdOrgIds) {
      const rooms = await prisma.chatRoom.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const roomIds = rooms.map((r) => r.id);
      await prisma.chatMessage.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.chatRoomMember.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.chatRoom.deleteMany({ where: { organizationId } });
      await prisma.userRole.deleteMany({ where: { user: { organizationId } } });
      await prisma.loginHistory.deleteMany({ where: { user: { organizationId } } });
      await prisma.user.deleteMany({ where: { organizationId } });
      await prisma.employee.deleteMany({ where: { organizationId } });
      await prisma.designation.deleteMany({ where: { organizationId } });
      await prisma.department.deleteMany({ where: { organizationId } });
      await prisma.role.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await app.close();
  });

  interface EmployeeFixture {
    employeeId: string;
    userId: string;
    token: string;
  }

  interface OrgFixture {
    organizationId: string;
    deptId: string;
    a: EmployeeFixture; // dept member, manager permissions (employee:update)
    b: EmployeeFixture; // dept member
    outsider: EmployeeFixture; // different department, not a member of A/B's rooms
  }

  async function createOrgFixture(label: string): Promise<OrgFixture> {
    const slug = `chat-e2e-${label}-${uuid()}`;
    const org = await prisma.organization.create({
      data: { name: `Chat E2E ${label}`, slug, isActive: true },
    });
    createdOrgIds.push(org.id);

    const managerRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `chat-e2e-manager-${label}`,
        description: 'Test manager role (can patch employee status)',
        permissions: ['employee:read', 'employee:update'],
        isSystemRole: false,
      },
    });
    const employeeRole = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `chat-e2e-employee-${label}`,
        description: 'Test plain employee role',
        permissions: ['employee:read'],
        isSystemRole: false,
      },
    });

    const dept = await prisma.department.create({
      data: { organizationId: org.id, name: `Dept ${label}` },
    });
    const otherDept = await prisma.department.create({
      data: { organizationId: org.id, name: `Other Dept ${label}` },
    });
    const designation = await prisma.designation.create({
      data: { organizationId: org.id, departmentId: dept.id, name: `Designation ${label}` },
    });
    const otherDesignation = await prisma.designation.create({
      data: {
        organizationId: org.id,
        departmentId: otherDept.id,
        name: `Other Designation ${label}`,
      },
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    async function makeUser(
      empCode: string,
      departmentId: string,
      designationId: string,
      roleId: string,
      phone: string,
    ): Promise<EmployeeFixture> {
      const employee = await prisma.employee.create({
        data: {
          organizationId: org.id,
          empCode,
          firstName: empCode,
          lastName: label,
          phone,
          departmentId,
          designationId,
          status: 'ACTIVE',
        },
      });
      const user = await prisma.user.create({
        data: {
          organizationId: org.id,
          employeeId: employee.id,
          email: `${empCode.toLowerCase()}-${label}@chat-e2e.test`,
          passwordHash,
          isActive: true,
        },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      return { employeeId: employee.id, userId: user.id, token: login.body.data.accessToken };
    }

    const a = await makeUser('CHA', dept.id, designation.id, managerRole.id, '9300000001');
    const b = await makeUser('CHB', dept.id, designation.id, employeeRole.id, '9300000002');
    const outsider = await makeUser(
      'CHO',
      otherDept.id,
      otherDesignation.id,
      employeeRole.id,
      '9300000003',
    );

    return { organizationId: org.id, deptId: dept.id, a, b, outsider };
  }

  function authed(token: string, organizationId: string) {
    return {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
    };
  }

  function connectSocket(token: string | undefined): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/chat`, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      openSockets.push(socket);
      const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // The chat namespace rejects bad/missing auth via a Socket.io namespace
  // MIDDLEWARE (`server.use`), which runs before the connection is accepted.
  // A rejected client therefore never sees `connect` — it gets `connect_error`
  // instead (never `disconnect`, since it was never connected in the first
  // place). See the class comment on `ChatGateway` for why middleware
  // (not `handleConnection`) is used for auth.
  function waitForConnectError(socket: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect_error timeout')), 5000);
      socket.on('connect_error', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect', () => {
        clearTimeout(timer);
        reject(new Error('expected connect_error but got connect'));
      });
    });
  }

  // ─── REST: room creation + dedupe ───────────────────────────────────────

  describe('POST /chat/rooms — DIRECT create + dedupe', () => {
    it('creates a DIRECT room, and re-POSTing for the same two members returns the SAME room id', async () => {
      const org = await createOrgFixture('direct-dedupe');

      const first = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      expect(first.body.data.type).toBe('DIRECT');
      const roomId = first.body.data.id;

      const second = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      expect(second.body.data.id).toBe(roomId);

      // Dedupe is symmetric — B creating a DIRECT room with A also finds the same room.
      const third = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.b.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.a.employeeId] })
        .expect(201);
      expect(third.body.data.id).toBe(roomId);
    });
  });

  // ─── REST: list my rooms ────────────────────────────────────────────────

  describe('GET /chat/rooms', () => {
    it('returns an array; the created room is present for a member, absent for a non-member', async () => {
      const org = await createOrgFixture('list-rooms');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      const memberList = await request(app.getHttpServer())
        .get('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .expect(200);
      expect(Array.isArray(memberList.body.data)).toBe(true);
      expect(memberList.body.data.some((r: any) => r.id === roomId)).toBe(true);

      const nonMemberList = await request(app.getHttpServer())
        .get('/api/v1/chat/rooms')
        .set(authed(org.outsider.token, org.organizationId))
        .expect(200);
      expect(nonMemberList.body.data.some((r: any) => r.id === roomId)).toBe(false);
    });
  });

  // ─── REST: message history membership gate + round-trip ────────────────

  describe('GET/POST /chat/rooms/:id/messages', () => {
    it('GET returns 403 for a non-member (membership check first)', async () => {
      const org = await createOrgFixture('history-403');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.outsider.token, org.organizationId))
        .expect(403);
    });

    it('POST a text message then GET history: the sent text round-trips with correct senderId/senderName', async () => {
      const org = await createOrgFixture('history-roundtrip');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      const sent = await request(app.getHttpServer())
        .post(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.a.token, org.organizationId))
        .send({ content: 'Hello from A' })
        .expect(201);
      expect(sent.body.data.content).toBe('Hello from A');
      expect(sent.body.data.senderId).toBe(org.a.employeeId);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.b.token, org.organizationId))
        .expect(200);
      expect(Array.isArray(history.body.data.data)).toBe(true);
      expect(history.body.data.meta).toBeDefined();
      const row = history.body.data.data.find((m: any) => m.id === sent.body.data.id);
      expect(row).toBeDefined();
      expect(row.content).toBe('Hello from A');
      expect(row.senderId).toBe(org.a.employeeId);
      expect(row.senderName).toBe(`CHA history-roundtrip`);
    });
  });

  // ─── REST: attachment upload ─────────────────────────────────────────────

  describe('POST /chat/rooms/:id/attachment', () => {
    it('multipart upload produces a messageType:file row with fileUrl + fileName populated', async () => {
      const org = await createOrgFixture('attachment');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      const uploaded = await request(app.getHttpServer())
        .post(`/api/v1/chat/rooms/${roomId}/attachment`)
        .set(authed(org.a.token, org.organizationId))
        .attach('file', Buffer.from('dummy file content'), 'test-doc.txt')
        .expect(201);

      expect(uploaded.body.data.messageType).toBe('file');
      expect(uploaded.body.data.fileUrl).toBeTruthy();
      expect(uploaded.body.data.fileName).toBe('test-doc.txt');
    });
  });

  // ─── REST: DEPARTMENT room, no memberEmployeeIds (DTO regression guard) ──

  describe('POST /chat/rooms — DEPARTMENT with no memberEmployeeIds', () => {
    it('succeeds with departmentId and NO memberEmployeeIds, auto-enrolling active department employees', async () => {
      const org = await createOrgFixture('department-room');

      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DEPARTMENT', departmentId: org.deptId })
        .expect(201);

      expect(created.body.data.type).toBe('DEPARTMENT');
      const memberIds = created.body.data.members.map((m: any) => m.employeeId);
      // a and b are both ACTIVE members of org.deptId; outsider is in a different department.
      expect(memberIds).toEqual(expect.arrayContaining([org.a.employeeId, org.b.employeeId]));
      expect(memberIds).not.toContain(org.outsider.employeeId);
    });
  });

  // ─── Socket.io ────────────────────────────────────────────────────────────

  describe('Socket.io /chat namespace', () => {
    it('connecting without a token is rejected (connect_error, never connect)', async () => {
      const socket = io(`${baseUrl}/chat`, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      openSockets.push(socket);
      await expect(waitForConnectError(socket)).resolves.toBeUndefined();
    });

    it('connecting with a bad token is rejected (connect_error, never connect)', async () => {
      const socket = io(`${baseUrl}/chat`, {
        auth: { token: 'not-a-real-jwt' },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      openSockets.push(socket);
      await expect(waitForConnectError(socket)).resolves.toBeUndefined();
    });

    it('valid JWT: chat:join a room the user belongs to acks ok:true; a room they do not belong to acks ok:false', async () => {
      const org = await createOrgFixture('socket-join');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      const socketA = await connectSocket(org.a.token);

      const joinOk = await new Promise<{ roomId: string; ok: boolean }>((resolve) => {
        socketA.emit('chat:join', { roomId }, resolve);
      });
      expect(joinOk.ok).toBe(true);

      const otherRoom = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.b.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.outsider.employeeId] })
        .expect(201);

      const socketOutsider = await connectSocket(org.a.token); // reuse A's token but try to join B/outsider's room
      const joinBad = await new Promise<{ roomId: string; ok: boolean }>((resolve) => {
        socketOutsider.emit('chat:join', { roomId: otherRoom.body.data.id }, resolve);
      });
      expect(joinBad.ok).toBe(false);
    });

    it('two clients in the same room: A emits chat:message, B receives chat:message:new (and it is persisted)', async () => {
      const org = await createOrgFixture('socket-message');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      const socketA = await connectSocket(org.a.token);
      const socketB = await connectSocket(org.b.token);

      await new Promise((resolve) => socketA.emit('chat:join', { roomId }, resolve));
      await new Promise((resolve) => socketB.emit('chat:join', { roomId }, resolve));

      const received = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('chat:message:new timeout')), 5000);
        socketB.once('chat:message:new', (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });

      socketA.emit('chat:message', { roomId, content: 'Live socket message' });
      const payload = await received;
      expect(payload.roomId).toBe(roomId);
      expect(payload.content).toBe('Live socket message');
      expect(payload.senderId).toBe(org.a.employeeId);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.b.token, org.organizationId))
        .expect(200);
      expect(history.body.data.data.some((m: any) => m.id === payload.id)).toBe(true);
    });
  });

  // ─── Auto-revocation on EXITED / SUSPENDED ───────────────────────────────

  describe('Auto-revocation on employee status change', () => {
    it('EXITED: ChatRoomMember.revokedAt is set on all rooms; GET history -> 403; chat:join -> ok:false', async () => {
      const org = await createOrgFixture('revoke-exited');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      // sanity: b can read before revocation
      await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.b.token, org.organizationId))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${org.b.employeeId}/status`)
        .set(authed(org.a.token, org.organizationId))
        .send({ status: 'EXITED', reason: 'Voluntary resignation' })
        .expect(200);

      const membership = await prisma.chatRoomMember.findFirst({
        where: { roomId, employeeId: org.b.employeeId },
      });
      expect(membership?.revokedAt).not.toBeNull();

      await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.b.token, org.organizationId))
        .expect(403);

      const socketB = await connectSocket(org.b.token);
      const joinResult = await new Promise<{ roomId: string; ok: boolean }>((resolve) => {
        socketB.emit('chat:join', { roomId }, resolve);
      });
      expect(joinResult.ok).toBe(false);
    });

    it('SUSPENDED: ChatRoomMember.revokedAt is set on all rooms; GET history -> 403; chat:join -> ok:false', async () => {
      const org = await createOrgFixture('revoke-suspended');
      const created = await request(app.getHttpServer())
        .post('/api/v1/chat/rooms')
        .set(authed(org.a.token, org.organizationId))
        .send({ type: 'DIRECT', memberEmployeeIds: [org.b.employeeId] })
        .expect(201);
      const roomId = created.body.data.id;

      await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.b.token, org.organizationId))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${org.b.employeeId}/status`)
        .set(authed(org.a.token, org.organizationId))
        .send({ status: 'SUSPENDED', reason: 'Under investigation' })
        .expect(200);

      const membership = await prisma.chatRoomMember.findFirst({
        where: { roomId, employeeId: org.b.employeeId },
      });
      expect(membership?.revokedAt).not.toBeNull();

      await request(app.getHttpServer())
        .get(`/api/v1/chat/rooms/${roomId}/messages`)
        .set(authed(org.b.token, org.organizationId))
        .expect(403);

      const socketB = await connectSocket(org.b.token);
      const joinResult = await new Promise<{ roomId: string; ok: boolean }>((resolve) => {
        socketB.emit('chat:join', { roomId }, resolve);
      });
      expect(joinResult.ok).toBe(false);
    });
  });
});
