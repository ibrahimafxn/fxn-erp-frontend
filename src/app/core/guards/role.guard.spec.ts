import {RoleGuard} from './role.guard';

describe('RoleGuard', () => {
  it('should be created', () => {
    const guard = RoleGuard([]);
    expect(typeof guard).toBe('function');
  });
});
