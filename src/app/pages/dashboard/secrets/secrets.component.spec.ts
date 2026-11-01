import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecretsComponent } from './secrets.component';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('SecretsComponent', () => {
  let component: SecretsComponent;
  let fixture: ComponentFixture<SecretsComponent>;
  let mockApi: {
    listTokens: ReturnType<typeof vi.fn>;
    storeToken: ReturnType<typeof vi.fn>;
    deleteToken: ReturnType<typeof vi.fn>;
    createGithubSecret: ReturnType<typeof vi.fn>;
    triggerGithubWorkflow: ReturnType<typeof vi.fn>;
    createOrgRelease: ReturnType<typeof vi.fn>;
  };
  let mockConfig: {
    isOnline: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    mockApi = {
      listTokens: vi.fn(),
      storeToken: vi.fn(),
      deleteToken: vi.fn(),
      createGithubSecret: vi.fn(),
      triggerGithubWorkflow: vi.fn(),
      createOrgRelease: vi.fn(),
    };
    mockConfig = {
      isOnline: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [SecretsComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: ApiService, useValue: mockApi },
        { provide: BackendConfigService, useValue: mockConfig },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecretsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save tokens in offline mode', () => {
    expect(component.tokensState().status).toBe('idle');

    component.onSaveTokens();
    expect(component.tokensState().status).toBe('loading');

    vi.advanceTimersByTime(1000);
    expect(component.tokensState().status).toBe('success');
    expect(component.tokensForm.pristine).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(component.tokensState().status).toBe('idle');
  });

  it('should trigger generate action success in offline mode', () => {
    component.triggerAction('generate');
    expect(component.generateState().status).toBe('loading');

    vi.advanceTimersByTime(1500);
    expect(component.generateState().status).toBe('success');

    vi.advanceTimersByTime(5000);
    expect(component.generateState().status).toBe('idle');
  });

  it('should trigger publish action success in offline mode', () => {
    component.triggerAction('publish');
    expect(component.publishState().status).toBe('loading');

    vi.advanceTimersByTime(1500);
    expect(component.publishState().status).toBe('success');

    vi.advanceTimersByTime(5000);
    expect(component.publishState().status).toBe('idle');
  });

  it('should handle deleteToken and uploadGithubSecret in offline mode', () => {
    component.configuredProviders.set(['npm', 'pypi']);
    component.onDeleteToken('npm');
    expect(component.configuredProviders()).toEqual(['pypi']);

    // Invalid form does nothing
    component.onUploadGithubSecret();
    expect(component.githubSecretState().status).toBe('idle');

    component.githubSecretForm.setValue({
      owner: 'offscale',
      repo: 'cdd-ctl',
      secret_name: 'NPM_TOKEN',
      secret_value: 'secret',
    });
    component.onUploadGithubSecret();
    expect(component.githubSecretState().status).toBe('success');
  });

  describe('when online', () => {
    beforeEach(() => {
      mockConfig.isOnline.set(true);
    });

    it('should load vault tokens on ngOnInit and handle errors', () => {
      mockApi.listTokens.mockReturnValue(of(['github', 'npm']));
      component.ngOnInit();
      expect(component.configuredProviders()).toEqual(['github', 'npm']);

      mockApi.listTokens.mockReturnValue(throwError(() => new Error('Unauth')));
      component.loadVaultTokens();
    });

    it('should store tokens via ApiService when online and handle empty or error cases', () => {
      // Empty form when online
      component.onSaveTokens();
      expect(component.tokensState().status).toBe('success');

      // Populated form success (including additionalProvider / PGP key)
      mockApi.storeToken.mockReturnValue(of({ status: 'ok' }));
      mockApi.listTokens.mockReturnValue(of(['npm', 'cargo', 'pgp_private_key']));
      component.tokensForm.setValue({
        github: '',
        npm: 'npm_123',
        pypi: '',
        cargo: 'cio_456',
        additionalProvider: 'pgp_private_key',
        additionalToken: '-----BEGIN PGP PRIVATE KEY BLOCK-----',
      });
      component.onSaveTokens();
      expect(mockApi.storeToken).toHaveBeenCalledTimes(3);
      expect(component.tokensState().status).toBe('success');

      // Error branch
      mockApi.storeToken.mockReturnValue(throwError(() => new Error('Vault err')));
      component.tokensForm.patchValue({ npm: 'npm_fail' });
      component.onSaveTokens();
      expect(component.tokensState().status).toBe('error');
    });

    it('should delete token via ApiService when online and handle error', () => {
      component.configuredProviders.set(['npm', 'pypi']);
      mockApi.deleteToken.mockReturnValue(of(undefined));
      component.onDeleteToken('npm');
      expect(mockApi.deleteToken).toHaveBeenCalledWith('npm');
      expect(component.configuredProviders()).toEqual(['pypi']);

      mockApi.deleteToken.mockReturnValue(throwError(() => new Error('Del err')));
      component.onDeleteToken('pypi');
      expect(component.tokensState().status).toBe('error');
    });

    it('should upload GitHub Actions secret via ApiService when online and handle error', () => {
      mockApi.createGithubSecret.mockReturnValue(of({ message: 'Saved!' }));
      component.githubSecretForm.setValue({
        owner: 'offscale',
        repo: 'cdd-ctl',
        secret_name: 'NPM_TOKEN',
        secret_value: 'secret',
      });
      component.onUploadGithubSecret();
      expect(mockApi.createGithubSecret).toHaveBeenCalledWith({
        owner: 'offscale',
        repo: 'cdd-ctl',
        secret_name: 'NPM_TOKEN',
        secret_value: 'secret',
      });
      expect(component.githubSecretState().message).toBe('Saved!');

      // Also test default message fallback and falsy form fields when validators cleared
      mockApi.createGithubSecret.mockReturnValue(of({}));
      for (const ctrl of Object.values(component.githubSecretForm.controls)) {
        ctrl.clearValidators();
        ctrl.setValue(null);
      }
      component.onUploadGithubSecret();
      expect(component.githubSecretState().message).toBe('GitHub Actions secret saved.');

      // Error branch
      mockApi.createGithubSecret.mockReturnValue(throwError(() => new Error('GH err')));
      component.onUploadGithubSecret();
      expect(component.githubSecretState().status).toBe('error');
    });

    it('should trigger generate and publish actions via ApiService when online', () => {
      mockApi.triggerGithubWorkflow.mockReturnValue(of({ message: 'Workflow dispatched' }));
      component.triggerAction('generate');
      expect(mockApi.triggerGithubWorkflow).toHaveBeenCalled();
      expect(component.generateState().status).toBe('success');

      // Default message fallback on generate
      mockApi.triggerGithubWorkflow.mockReturnValue(of({}));
      component.triggerAction('generate');
      expect(component.generateState().message).toBe('Generate completed successfully.');

      // Error on generate
      mockApi.triggerGithubWorkflow.mockReturnValue(throwError(() => new Error('Err')));
      component.triggerAction('generate');
      expect(component.generateState().status).toBe('error');

      // Publish online success & error
      mockApi.createOrgRelease.mockReturnValue(of({ id: 1, repository_id: 1, tag_name: 'v1.0.0' }));
      component.triggerAction('publish');
      expect(mockApi.createOrgRelease).toHaveBeenCalled();
      expect(component.publishState().status).toBe('success');

      mockApi.createOrgRelease.mockReturnValue(throwError(() => new Error('Err')));
      component.triggerAction('publish');
      expect(component.publishState().status).toBe('error');
    });
  });
});
