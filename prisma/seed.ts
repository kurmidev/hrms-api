import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// All permission strings used across the HRMS system.
// Import from here in any module that needs to reference permissions.
export const PERMISSIONS = {
  // Employee
  EMPLOYEE_READ: 'employee:read',
  EMPLOYEE_CREATE: 'employee:create',
  EMPLOYEE_UPDATE: 'employee:update',
  EMPLOYEE_DELETE: 'employee:delete',

  // Payroll
  PAYROLL_READ: 'payroll:read',
  PAYROLL_RUN: 'payroll:run',
  PAYROLL_APPROVE: 'payroll:approve',

  // Leave
  LEAVE_READ: 'leave:read',
  LEAVE_APPLY: 'leave:apply',
  LEAVE_APPROVE: 'leave:approve',

  // Loan
  LOAN_READ: 'loan:read',
  LOAN_APPLY: 'loan:apply',
  LOAN_APPROVE: 'loan:approve',

  // Todo / Tasks
  TODO_READ: 'todo:read',
  TODO_CREATE: 'todo:create',
  TODO_APPROVE: 'todo:approve',

  // Attendance
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_CHECKIN: 'attendance:checkin',
  ATTENDANCE_CORRECT: 'attendance:correct',

  // Organization
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',

  // Payroll (extended)
  PAYROLL_CREATE: 'payroll:create',
  PAYROLL_UPDATE: 'payroll:update',

  // Roles
  ROLE_READ: 'role:read',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',

  // Assets
  ASSET_READ: 'asset:read',
  ASSET_ASSIGN: 'asset:assign',
  ASSET_RETURN: 'asset:return',

  // Service requests
  SERVICE_REQUEST_READ: 'service_request:read',
  SERVICE_REQUEST_CREATE: 'service_request:create',
  SERVICE_REQUEST_MANAGE: 'service_request:manage',

  // Reports
  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',

  // Onboarding / Exit
  ONBOARDING_MANAGE: 'onboarding:manage',
  EXIT_MANAGE: 'exit:manage',

  // User management
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',

  // Profile
  PROFILE_READ: 'profile:read',
  PROFILE_UPDATE: 'profile:update',
} as const;

const SYSTEM_ROLES = [
  {
    name: 'super_admin',
    description: 'Full system access — can manage everything including organizations and system settings',
    permissions: ['*'],
  },
  {
    name: 'org_admin',
    description: 'Organization-level admin — manages users, roles, departments, and all modules',
    permissions: [
      PERMISSIONS.ORG_READ, PERMISSIONS.ORG_UPDATE,
      PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_CREATE, PERMISSIONS.EMPLOYEE_UPDATE, PERMISSIONS.EMPLOYEE_DELETE,
      PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_CREATE, PERMISSIONS.PAYROLL_UPDATE, PERMISSIONS.PAYROLL_RUN, PERMISSIONS.PAYROLL_APPROVE,
      PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_APPLY, PERMISSIONS.LEAVE_APPROVE,
      PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_APPLY, PERMISSIONS.LOAN_APPROVE,
      PERMISSIONS.TODO_READ, PERMISSIONS.TODO_CREATE, PERMISSIONS.TODO_APPROVE,
      PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_CHECKIN, PERMISSIONS.ATTENDANCE_CORRECT,
      PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_UPDATE, PERMISSIONS.ROLE_DELETE, PERMISSIONS.ROLE_ASSIGN,
      PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_ASSIGN, PERMISSIONS.ASSET_RETURN,
      PERMISSIONS.SERVICE_REQUEST_READ, PERMISSIONS.SERVICE_REQUEST_CREATE, PERMISSIONS.SERVICE_REQUEST_MANAGE,
      PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.ONBOARDING_MANAGE, PERMISSIONS.EXIT_MANAGE,
      PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE,
      PERMISSIONS.PROFILE_READ, PERMISSIONS.PROFILE_UPDATE,
    ],
  },
  {
    name: 'hr_manager',
    description: 'Manages employee records, leave, onboarding, exit processes, and HR reports',
    permissions: [
      PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.EMPLOYEE_CREATE, PERMISSIONS.EMPLOYEE_UPDATE,
      PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_APPROVE,
      PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_CORRECT,
      PERMISSIONS.ONBOARDING_MANAGE, PERMISSIONS.EXIT_MANAGE,
      PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.PROFILE_READ, PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.USER_READ,
    ],
  },
  {
    name: 'finance_manager',
    description: 'Manages payroll processing, loan approvals, and financial reports',
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.PAYROLL_READ, PERMISSIONS.PAYROLL_CREATE, PERMISSIONS.PAYROLL_UPDATE, PERMISSIONS.PAYROLL_RUN, PERMISSIONS.PAYROLL_APPROVE,
      PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_APPROVE,
      PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.PROFILE_READ,
    ],
  },
  {
    name: 'dept_manager',
    description: 'Department-level manager — approves leave and tasks for their team',
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_APPROVE,
      PERMISSIONS.TODO_READ, PERMISSIONS.TODO_APPROVE,
      PERMISSIONS.ATTENDANCE_READ,
      PERMISSIONS.PROFILE_READ,
    ],
  },
  {
    name: 'field_supervisor',
    description: 'Field operations supervisor — tracks attendance and approves field tasks',
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.ATTENDANCE_READ,
      PERMISSIONS.TODO_READ, PERMISSIONS.TODO_APPROVE,
      PERMISSIONS.PROFILE_READ,
    ],
  },
  {
    name: 'employee',
    description: 'Standard employee — can apply for leave, check in, and create tasks',
    permissions: [
      PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_APPLY,
      PERMISSIONS.TODO_READ, PERMISSIONS.TODO_CREATE,
      PERMISSIONS.ATTENDANCE_CHECKIN,
      PERMISSIONS.LOAN_READ, PERMISSIONS.LOAN_APPLY,
      PERMISSIONS.PROFILE_READ, PERMISSIONS.PROFILE_UPDATE,
    ],
  },
  {
    name: 'it_admin',
    description: 'IT administrator — manages assets, service requests, and user accounts',
    permissions: [
      PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_ASSIGN, PERMISSIONS.ASSET_RETURN,
      PERMISSIONS.SERVICE_REQUEST_READ, PERMISSIONS.SERVICE_REQUEST_CREATE, PERMISSIONS.SERVICE_REQUEST_MANAGE,
      PERMISSIONS.USER_READ,
      PERMISSIONS.PROFILE_READ,
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: 'igreen-technologies' },
    update: {},
    create: {
      name: 'IGreen Technologies',
      slug: 'igreen-technologies',
      email: 'admin@igreentec.in',
      isActive: true,
    },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  // Seed system roles
  for (const roleData of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { organizationId: org.id, name: roleData.name },
    });

    if (existing) {
      await prisma.role.update({
        where: { id: existing.id },
        data: { permissions: roleData.permissions, description: roleData.description },
      });
      console.log(`  Role updated: ${roleData.name}`);
    } else {
      await prisma.role.create({
        data: {
          organizationId: org.id,
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions,
          isSystemRole: true,
        },
      });
      console.log(`  Role created: ${roleData.name}`);
    }
  }

  // Create default super_admin user
  const superAdminRole = await prisma.role.findFirst({
    where: { organizationId: org.id, name: 'super_admin' },
  });

  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const adminUser = await prisma.user.upsert({
    where: {
      organizationId_email: { organizationId: org.id, email: 'admin@igreentec.in' },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@igreentec.in',
      phone: '9999999999',
      passwordHash,
      isActive: true,
    },
  });
  console.log(`Admin user: ${adminUser.email}`);

  // Assign super_admin role to admin user
  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id },
    });
    console.log(`  Assigned super_admin role to ${adminUser.email}`);
  }

  console.log('\nSeed complete.');
  console.log('Default login: admin@igreentec.in / Admin@1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
