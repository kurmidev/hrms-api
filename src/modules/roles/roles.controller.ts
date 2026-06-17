import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ── POST /roles ───────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('role:create')
  @ApiOperation({
    summary: 'Create a new role',
    description: 'Creates a custom role with a set of permissions. System roles cannot be created via this API.',
  })
  @ApiResponse({ status: 201, description: 'Role created', type: RoleResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Role name already exists in this organization',
    schema: {
      example: {
        statusCode: 409,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/v1/roles',
        method: 'POST',
        error: 'Role "branch_manager" already exists in this organization',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: role:create' })
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(organizationId, dto);
  }

  // ── GET /roles ────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('role:read')
  @ApiOperation({
    summary: 'List all roles',
    description: 'Returns all roles for the organization, including system roles. System roles are listed first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles list',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            organizationId: 'org-uuid',
            name: 'hr_manager',
            description: 'Manages all HR operations',
            permissions: ['employee:read', 'leave:approve'],
            isSystemRole: true,
            userCount: 3,
            createdAt: '2024-01-15T10:30:00.000Z',
            updatedAt: '2024-01-15T10:30:00.000Z',
          },
        ],
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: role:read' })
  findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.rolesService.findAll(organizationId);
  }

  // ── GET /roles/:id ────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('role:read')
  @ApiOperation({ summary: 'Get role by ID', description: 'Returns a single role with its full permission list and user count.' })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role details', type: RoleResponseDto })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: role:read' })
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.rolesService.findOne(organizationId, id);
  }

  // ── PUT /roles/:id ────────────────────────────────────────────────────────

  @Put(':id')
  @RequirePermissions('role:update')
  @ApiOperation({
    summary: 'Update role',
    description: 'Updates the name, description, or permissions of a custom role. System roles cannot be modified.',
  })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({ status: 200, description: 'Role updated', type: RoleResponseDto })
  @ApiResponse({ status: 403, description: 'System roles cannot be modified or missing permission: role:update' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Role name already taken' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(organizationId, id, dto);
  }

  // ── DELETE /roles/:id ─────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('role:delete')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Deletes a custom role. Fails if the role has any users currently assigned to it, or if it is a system role.',
  })
  @ApiParam({ name: 'id', description: 'Role UUID' })
  @ApiResponse({
    status: 200,
    description: 'Role deleted',
    schema: { example: { success: true, data: { deleted: true, message: 'Role "branch_manager" deleted successfully' }, timestamp: '2024-01-15T10:30:00.000Z' } },
  })
  @ApiResponse({ status: 400, description: 'Role has assigned users — remove assignments first' })
  @ApiResponse({ status: 403, description: 'System roles cannot be deleted or missing permission: role:delete' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.rolesService.remove(organizationId, id);
  }

  // ── POST /roles/assign ────────────────────────────────────────────────────

  @Post('assign')
  @RequirePermissions('role:assign')
  @ApiOperation({
    summary: 'Assign role to user',
    description: 'Assigns a role to a user in the same organization. If the user already has this role, the request is idempotent.',
  })
  @ApiResponse({
    status: 201,
    description: 'Role assigned',
    schema: { example: { success: true, data: { assigned: true, message: 'Role "hr_manager" assigned to user' }, timestamp: '2024-01-15T10:30:00.000Z' } },
  })
  @ApiResponse({ status: 404, description: 'User or role not found in this organization' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: role:assign' })
  assignRole(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignRole(organizationId, dto);
  }

  // ── DELETE /roles/assign/:userId/:roleId ──────────────────────────────────

  @Delete('assign/:userId/:roleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('role:assign')
  @ApiOperation({
    summary: 'Remove role from user',
    description: 'Removes a role assignment from a user. The role itself is not deleted.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiParam({ name: 'roleId', description: 'Role UUID' })
  @ApiResponse({
    status: 200,
    description: 'Role removed from user',
    schema: { example: { success: true, data: { removed: true, message: 'Role removed from user' }, timestamp: '2024-01-15T10:30:00.000Z' } },
  })
  @ApiResponse({ status: 404, description: 'Role assignment not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: role:assign' })
  removeRole(
    @CurrentUser('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.removeRole(organizationId, userId, roleId);
  }

  // ── GET /roles/users/:userId ──────────────────────────────────────────────

  @Get('users/:userId')
  @RequirePermissions('role:read')
  @ApiOperation({
    summary: 'Get all roles for a user',
    description: 'Returns every role assigned to the specified user, including their full permission lists.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'User roles list',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'role-uuid',
            name: 'hr_manager',
            description: 'Manages all HR operations',
            permissions: ['employee:read', 'leave:approve'],
            isSystemRole: true,
            assignedAt: '2024-01-10T09:00:00.000Z',
          },
        ],
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found in this organization' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Missing permission: role:read' })
  getUserRoles(
    @CurrentUser('organizationId') organizationId: string,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.getUserRoles(organizationId, userId);
  }
}
