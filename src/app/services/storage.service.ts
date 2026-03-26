import { Injectable, signal, computed, inject } from '@angular/core';
import { User, Organization, Repository } from '../models/types';
import { ApiService } from './api.service';
import { BackendConfigService } from './backend-config.service';

/**
 * Service to manage local storage persistence for users, organizations, and repositories,
 * with cloud synchronization capability when online mode is active.
 */
@Injectable({
  providedIn: 'root',
})
/** StorageService */
export class StorageService {
  /** The local storage key for the current user. */
  private readonly USER_KEY = 'cdd_user';
  /** The local storage key for the organizations array. */
  private readonly ORGS_KEY = 'cdd_organizations';
  /** The local storage key for the repositories array. */
  private readonly REPOS_KEY = 'cdd_repositories';

  /** The API service instance. */
  private readonly api = inject(ApiService);
  /** The backend configuration service instance. */
  private readonly config = inject(BackendConfigService);

  /** Current active user signal. */
  readonly user = signal<User | null>(this.loadFromStorage<User>(this.USER_KEY));

  /** Signal containing all organizations belonging to the user. */
  readonly organizations = signal<Organization[]>(
    this.loadFromStorage<Organization[]>(this.ORGS_KEY) || [],
  );

  /** Signal containing all repositories. */
  readonly repositories = signal<Repository[]>(
    this.loadFromStorage<Repository[]>(this.REPOS_KEY) || [],
  );

  /**
   * Initializes the storage service.
   */
  constructor() {}

  /**
   * Retrieves and parses data from local storage.
   * @param key The local storage key to read.
   * @returns The parsed data of type T, or null if missing or invalid.
   */
  private loadFromStorage<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Serializes and saves data to local storage.
   * @param key The local storage key to write to.
   * @param data The data to save.
   */
  private saveToStorage<T>(key: string, data: T): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  /**
   * Generic method to get a raw item from localStorage directly.
   * @param key The key to retrieve.
   * @returns The parsed item or null.
   */
  getItem<T>(key: string): T | null {
    return this.loadFromStorage<T>(key);
  }

  /**
   * Generic method to set a raw item into localStorage directly.
   * @param key The key to set.
   * @param data The data to save.
   */
  setItem<T>(key: string, data: T): void {
    this.saveToStorage(key, data);
  }

  /**
   * Creates a new user and persists it.
   * @param login - The username/login of the user.
   * @returns The created User object.
   */
  createUser(login: string): User {
    const newUser: User = { id: crypto.randomUUID(), login, name: login };
    this.user.set(newUser);
    this.saveToStorage(this.USER_KEY, newUser);

    if (this.config.isOnline()) {
      this.api.register({ username: login, email: `${login}@example.com` }).subscribe({
        next: (res) => localStorage.setItem('cdd_token', res.token),
        error: (err) => console.error('Background cloud sync failed for user creation:', err),
      });
    }

    return newUser;
  }

  /**
   * Creates a new organization for the current user.
   * @param login - The name/login of the organization.
   * @returns The created Organization object.
   * @throws Error if no current user exists.
   */
  createOrganization(login: string): Organization {
    const currentUser = this.user();
    if (!currentUser) throw new Error('User required to create organization');

    const newOrg: Organization = { id: crypto.randomUUID(), userId: currentUser.id, login };
    const updated = [...this.organizations(), newOrg];
    this.organizations.set(updated);
    this.saveToStorage(this.ORGS_KEY, updated);

    if (this.config.isOnline()) {
      const token = localStorage.getItem('cdd_token') || '';
      this.api
        .createOrg({ login, description: 'Created via offline-first StorageService' }, token)
        .subscribe({
          next: (serverOrg) => {
            // Replace local org ID with server org ID
            this.updateOrganizationId(newOrg.id, serverOrg.id);
          },
          error: (err) =>
            console.error('Background cloud sync failed for organization creation:', err),
        });
    }

    return newOrg;
  }

  /**
   * Creates a new repository under a specific organization.
   * @param organizationId - The ID of the parent organization.
   * @param name - The name of the repository.
   * @returns The created Repository object.
   */
  createRepository(organizationId: string | number, name: string): Repository {
    const org = this.organizations().find((o) => o.id === organizationId);
    const full_name = org ? `${org.login}/${name}` : name;

    const newRepo: Repository = { id: crypto.randomUUID(), organizationId, name, full_name };
    const updated = [...this.repositories(), newRepo];
    this.repositories.set(updated);
    this.saveToStorage(this.REPOS_KEY, updated);

    if (this.config.isOnline() && typeof organizationId === 'number') {
      const token = localStorage.getItem('cdd_token') || '';
      this.api
        .createRepo(
          {
            organization_id: organizationId,
            name,
            description: 'Created via offline-first StorageService',
          },
          token,
        )
        .subscribe({
          next: (serverRepo) => {
            // Replace local repo ID with server repo ID
            this.updateRepositoryId(newRepo.id, serverRepo.id);
          },
          error: (err) =>
            console.error('Background cloud sync failed for repository creation:', err),
        });
    }

    return newRepo;
  }

  /**
   * Updates an existing repository with new data.
   * @param repository - The repository to update.
   */
  updateRepository(repository: Repository): void {
    const updated = this.repositories().map((r) => (r.id === repository.id ? repository : r));
    this.repositories.set(updated);
    this.saveToStorage(this.REPOS_KEY, updated);
  }

  /**
   * Retrieves all repositories belonging to a given organization.
   * @param organizationId - The organization ID.
   * @returns An array of Repositories.
   */
  getOrganizationRepositories(organizationId: string | number): Repository[] {
    return this.repositories().filter((r) => r.organizationId === organizationId);
  }

  /**
   * Updates a local organization ID with a server-assigned ID.
   * @param oldId The local offline ID.
   * @param newId The new server ID.
   */
  private updateOrganizationId(oldId: string | number, newId: string | number): void {
    const updatedOrgs = this.organizations().map((org) =>
      org.id === oldId ? { ...org, id: newId } : org,
    );
    this.organizations.set(updatedOrgs);
    this.saveToStorage(this.ORGS_KEY, updatedOrgs);

    // Cascade update to repositories
    const updatedRepos = this.repositories().map((repo) =>
      repo.organizationId === oldId ? { ...repo, organizationId: newId } : repo,
    );
    this.repositories.set(updatedRepos);
    this.saveToStorage(this.REPOS_KEY, updatedRepos);
  }

  /**
   * Updates a local repository ID with a server-assigned ID.
   * @param oldId The local offline ID.
   * @param newId The new server ID.
   */
  private updateRepositoryId(oldId: string | number, newId: string | number): void {
    const updatedRepos = this.repositories().map((repo) =>
      repo.id === oldId ? { ...repo, id: newId } : repo,
    );
    this.repositories.set(updatedRepos);
    this.saveToStorage(this.REPOS_KEY, updatedRepos);
  }
}
