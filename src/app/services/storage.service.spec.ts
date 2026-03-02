import '@angular/localize/init';
import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create user and store it', () => {
    const user = service.createUser('alice');
    expect(user.login).toBe('alice');
    expect(user.id).toBeTruthy();
    expect(service.user()?.id).toBe(user.id);
    expect(JSON.parse(localStorage.getItem('cdd_user')!)).toEqual(user);
  });

  it('should fail to create organization if no user exists', () => {
    expect(() => service.createOrganization('my-org')).toThrowError(
      'User required to create organization',
    );
  });

  it('should create organization when user exists', () => {
    service.createUser('alice');
    const org = service.createOrganization('my-org');
    expect(org.login).toBe('my-org');
    expect(org.userId).toBe(service.user()!.id);
    expect(service.organizations().length).toBe(1);
    expect(service.organizations()[0]).toEqual(org);
  });

  it('should create repository under organization', () => {
    service.createUser('alice');
    const org = service.createOrganization('my-org');
    const repo = service.createRepository(org.id, 'my-repo');

    expect(repo.name).toBe('my-repo');
    expect(repo.full_name).toBe('my-org/my-repo');
    expect(repo.organizationId).toBe(org.id);
    expect(service.repositories().length).toBe(1);
    expect(service.repositories()[0]).toEqual(repo);
  });

  it('should update repository', () => {
    service.createUser('alice');
    const org = service.createOrganization('my-org');
    const repo = service.createRepository(org.id, 'my-repo');

    const updatedRepo = { ...repo, openApiSpec: 'test-spec' };
    service.updateRepository(updatedRepo);

    expect(service.repositories()[0].openApiSpec).toBe('test-spec');
    expect(JSON.parse(localStorage.getItem('cdd_repositories')!)[0].openApiSpec).toBe('test-spec');
  });

  it('should get repositories by organization id', () => {
    service.createUser('alice');
    const org1 = service.createOrganization('org1');
    const org2 = service.createOrganization('org2');

    service.createRepository(org1.id, 'repo1');
    service.createRepository(org1.id, 'repo2');
    service.createRepository(org2.id, 'repo3');

    const org1Repos = service.getOrganizationRepositories(org1.id);
    expect(org1Repos.length).toBe(2);
    expect(org1Repos[0].name).toBe('repo1');
  });

  it('should gracefully handle corrupt localStorage data', () => {
    localStorage.setItem('cdd_user', '{ invalid json ');

    const serviceInstance = new StorageService();

    expect(serviceInstance.user()).toBeNull();
  });
});
