import { Injectable, signal, computed } from '@angular/core';
import { User, Organization, Repository } from '../models/types';

/**
 * Service to manage local storage persistence for users, organizations, and repositories.
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  /** The local storage key for the current user. */
  private readonly USER_KEY = 'cdd_user';
  /** The local storage key for the organizations array. */
  private readonly ORGS_KEY = 'cdd_organizations';
  /** The local storage key for the repositories array. */
  private readonly REPOS_KEY = 'cdd_repositories';

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
   * Creates a new user and persists it.
   * @param login - The username/login of the user.
   * @returns The created User object.
   */
  createUser(login: string): User {
    const newUser: User = { id: crypto.randomUUID(), login, name: login };
    this.user.set(newUser);
    this.saveToStorage(this.USER_KEY, newUser);
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
    return newOrg;
  }

  /**
   * Creates a new repository under a specific organization.
   * @param organizationId - The ID of the parent organization.
   * @param name - The name of the repository.
   * @returns The created Repository object.
   */
  createRepository(organizationId: string, name: string): Repository {
    const org = this.organizations().find((o) => o.id === organizationId);
    const full_name = org ? `${org.login}/${name}` : name;

    const newRepo: Repository = { id: crypto.randomUUID(), organizationId, name, full_name };
    const updated = [...this.repositories(), newRepo];
    this.repositories.set(updated);
    this.saveToStorage(this.REPOS_KEY, updated);
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
  getOrganizationRepositories(organizationId: string): Repository[] {
    return this.repositories().filter((r) => r.organizationId === organizationId);
  }
}
