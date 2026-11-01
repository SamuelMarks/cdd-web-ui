/**
 * Dashboard repositories configuration page component with GitHub Organization &
 * Monorepo (`${GITHUB_ORG_NAME}-sdk`) vs. Polyrepo (`${GITHUB_ORG_NAME}-sdk-${LANGUAGE}`) Wizard,
 * Multi-Specification configuration (OpenAPI 3.2.0, Swagger 2.0, Arazzo 1.1.0, Google Discovery),
 * 13-language per-ecosystem options, and PGP-signed Registry & Documentation Releases.
 * @module app/pages/dashboard/repositories/repositories.component
 */
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { GLOBAL_DATE } from '../../../tokens';
import { ApiService } from '../../../services/api.service';
import { BackendConfigService } from '../../../services/backend-config.service';
import {
  DocHostTarget,
  DocsPublishConfig,
  GitHubOrg,
  LanguageOptions,
  PackageRegistryId,
  Release,
  RepoTopologyConfig,
  RepoTopologyMode,
  SpecFormat,
} from '../../../models/types';
import {
  buildDefaultPolyrepoMap,
  getDefaultMonorepoName,
  getDefaultPolyrepoName,
  reconcileTopologyConfig,
} from '../../../models/topology.util';
import * as WorkspaceActions from '../../../store/actions';

/**
 * Represents a linked repository for SDK generation.
 */
interface Repository {
  /** The unique identifier of the repository */
  id: string;
  /** The GitHub path or name of the repository */
  name: string;
  /** The organization that owns the repository */
  organization: string;
  /** Optional numeric organization ID from backend */
  organizationId?: number;
  /** Repository topology mode (`'monorepo'` or `'polyrepo'`) */
  topologyMode?: RepoTopologyMode;
  /** The URL to the API schema, if linked */
  schemaUrl?: string;
  /** Detected or configured specification format (`openapi`, `swagger`, `arazzo`, `google_discovery`) */
  specFormat?: SpecFormat;
  /** The list of languages configured for SDK generation */
  languages: string[];
  /** Per-language code generation options (`CLI`, `MCP`, etc.) */
  languageOptions?: Record<string, LanguageOptions>;
}

/**
 * Component to display and configure linked repositories, Monorepo vs. Polyrepo topology wizard,
 * schemas, 13 SDK languages, and PGP-signed registry/documentation releases.
 */
@Component({
  selector: 'app-repositories',
  imports: [ReactiveFormsModule, A11yModule, MatButtonModule],
  template: `
    <div class="page-container">
      <div class="header-actions">
        <h1 i18n="@@repositoriesTitle">Repositories</h1>
        <div class="header-btns">
          <button
            type="button"
            mat-stroked-button
            class="btn btn-secondary topology-wizard-btn"
            (click)="toggleTopologyWizard()"
          >
            @if (showTopologyWizard()) {
              <span i18n="@@cancelWizardBtn">Close Topology Wizard</span>
            } @else {
              <span i18n="@@openWizardBtn">Monorepo / Polyrepo Wizard</span>
            }
          </button>
          <button
            type="button"
            mat-flat-button
            class="btn btn-primary"
            (click)="toggleCreateForm()"
          >
            @if (showCreateForm()) {
              <span i18n="@@cancelRepoBtn">Cancel</span>
            } @else {
              <span i18n="@@linkRepoBtn">Link Repository</span>
            }
          </button>
        </div>
      </div>

      @if (statusMessage()) {
        <div class="status-banner" role="status" aria-live="polite">
          {{ statusMessage() }}
        </div>
      }
      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          {{ errorMessage() }}
        </div>
      }

      <!-- GitHub Organization & Monorepo vs. Individual Repositories Wizard -->
      @if (showTopologyWizard()) {
        <section class="card wizard-card" aria-labelledby="topology-wizard-heading">
          <h2 id="topology-wizard-heading" i18n="@@topologyWizardHeading">
            GitHub Organization &amp; Repository Topology Wizard
          </h2>

          <!-- Step 0: Specify GitHub Org -->
          <div class="wizard-step">
            <div class="step-header">
              <h3 i18n="@@step0GithubOrgHeading">0. Specify GitHub Organization</h3>
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary btn-sm sync-orgs-btn"
                (click)="onSyncGithubOrgs()"
              >
                Sync GitHub Orgs
              </button>
            </div>
            <div class="wizard-org-grid">
              <div class="form-group">
                <label for="wizardGithubOrgSelect" i18n="@@wizardGithubOrgSelectLabel">
                  Synced GitHub Namespaces
                </label>
                <select
                  id="wizardGithubOrgSelect"
                  class="form-control"
                  [value]="topologyConfig().githubOrgName"
                  (change)="onGithubOrgChange($any($event.target).value)"
                >
                  @for (ghOrg of githubOrgs(); track ghOrg.login) {
                    <option [value]="ghOrg.login">{{ ghOrg.login }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label for="wizardGithubOrgInput" i18n="@@wizardGithubOrgInputLabel">
                  GitHub Organization / User Handle ($&#123;GITHUB_ORG_NAME&#125;)
                </label>
                <input
                  id="wizardGithubOrgInput"
                  type="text"
                  class="form-control"
                  [value]="topologyConfig().githubOrgName"
                  (input)="onGithubOrgChange($any($event.target).value)"
                  placeholder="e.g. offscale"
                />
              </div>
            </div>
          </div>

          <!-- Step 1: Choose Between Monorepo and Many Individual Repos -->
          <div class="wizard-step">
            <h3 i18n="@@step1TopologyModeHeading">
              1. Choose Repository Layout (Monorepo vs. Individual Polyrepos)
            </h3>
            <div
              class="topology-mode-toggle"
              role="radiogroup"
              aria-label="Repository Topology Mode"
            >
              <label
                class="mode-card"
                [class.selected]="topologyConfig().topologyMode === 'monorepo'"
              >
                <input
                  type="radio"
                  name="topologyMode"
                  value="monorepo"
                  [checked]="topologyConfig().topologyMode === 'monorepo'"
                  (change)="onSetTopologyMode('monorepo')"
                />
                <div>
                  <strong>1.a. Monorepo</strong>
                  <span class="mode-desc">
                    Single repository (<code>{{ defaultMonorepoPreview() }}</code
                    >) containing all target languages
                  </span>
                </div>
              </label>

              <label
                class="mode-card"
                [class.selected]="topologyConfig().topologyMode === 'polyrepo'"
              >
                <input
                  type="radio"
                  name="topologyMode"
                  value="polyrepo"
                  [checked]="topologyConfig().topologyMode === 'polyrepo'"
                  (change)="onSetTopologyMode('polyrepo')"
                />
                <div>
                  <strong>1.b. Many Individual Repos (Polyrepo)</strong>
                  <span class="mode-desc">
                    Dedicated repository per language (<code
                      >{{ topologyConfig().githubOrgName }}-sdk-&lt;lang&gt;</code
                    >)
                  </span>
                </div>
              </label>
            </div>

            <!-- 1.a. Monorepo Name Configuration -->
            @if (topologyConfig().topologyMode === 'monorepo') {
              <div class="monorepo-config-box">
                <div class="form-group">
                  <label for="wizardMonorepoName" i18n="@@wizardMonorepoNameLabel">
                    Monorepo Name (defaults to <code>$&#123;GITHUB_ORG_NAME&#125;-sdk</code>)
                  </label>
                  <div class="input-with-action">
                    <input
                      id="wizardMonorepoName"
                      type="text"
                      class="form-control"
                      [value]="topologyConfig().monorepoName"
                      (input)="onMonorepoNameChange($any($event.target).value)"
                    />
                    <button
                      type="button"
                      mat-stroked-button
                      class="btn btn-secondary reset-mono-btn"
                      (click)="resetMonorepoName()"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- 1.b. Individual Polyrepo Names Configuration -->
            @if (topologyConfig().topologyMode === 'polyrepo') {
              <div class="polyrepo-config-box">
                <div class="step-header">
                  <span class="mode-desc">
                    Customize repository names per language (defaults to
                    <code>$&#123;GITHUB_ORG_NAME&#125;-sdk-$&#123;LANGUAGE&#125;</code>):
                  </span>
                  <button
                    type="button"
                    mat-stroked-button
                    class="btn btn-secondary btn-sm reset-poly-btn"
                    (click)="resetPolyrepoNames()"
                  >
                    Reset All Defaults
                  </button>
                </div>
                <div class="polyrepo-grid">
                  @for (lang of wizardLanguages(); track lang) {
                    <div class="polyrepo-row">
                      <label [for]="'polyrepo-' + lang" class="polyrepo-lang-label">
                        {{ lang }}
                      </label>
                      <input
                        [id]="'polyrepo-' + lang"
                        type="text"
                        class="form-control"
                        [value]="getPolyrepoNameForLanguage(lang)"
                        (input)="onPolyrepoNameChange(lang, $any($event.target).value)"
                      />
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Target Languages Selection for Provisioning -->
          <div class="wizard-step">
            <div class="step-header">
              <h3 i18n="@@wizardTargetLanguagesHeading">
                Target SDK Languages ({{ wizardLanguages().length }} /
                {{ availableLanguages.length }})
              </h3>
              <div class="header-btns">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary btn-sm select-all-wizard-langs"
                  (click)="selectAllWizardLanguages()"
                >
                  Select All 13
                </button>
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary btn-sm clear-wizard-langs"
                  (click)="clearWizardLanguages()"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div class="lang-options">
              @for (lang of availableLanguages; track lang) {
                <label class="lang-option">
                  <input
                    type="checkbox"
                    [checked]="wizardLanguages().includes(lang)"
                    (change)="toggleWizardLanguage(lang)"
                  />
                  {{ lang }}
                </label>
              }
            </div>
          </div>

          <div class="wizard-footer">
            <button
              type="button"
              mat-flat-button
              class="btn btn-primary provision-btn"
              [disabled]="wizardLanguages().length === 0"
              (click)="onProvisionTopologyRepos()"
            >
              Provision
              {{
                topologyConfig().topologyMode === 'monorepo'
                  ? 'Monorepo'
                  : wizardLanguages().length + ' Repositories'
              }}
            </button>
          </div>
        </section>
      }

      @if (showCreateForm()) {
        <div class="card create-repo-card">
          <h2 i18n="@@linkNewRepoHeading">Link New Repository</h2>
          <form [formGroup]="createRepoForm" (ngSubmit)="onCreateRepo()">
            <div class="form-group">
              <label for="repoName" i18n="@@repoNameLabel">Repository Name (GitHub path)</label>
              <input
                type="text"
                id="repoName"
                formControlName="name"
                class="form-control"
                placeholder="org/repo-name"
                i18n-placeholder="@@repoNamePlaceholder"
              />
            </div>
            <div class="form-group">
              <label for="orgId" i18n="@@repoOrgLabel">Organization</label>
              <select id="orgId" formControlName="organization" class="form-control">
                @for (orgOption of availableOrgs(); track orgOption.name) {
                  <option [value]="orgOption.name">{{ orgOption.name }}</option>
                }
              </select>
            </div>
            <button
              type="submit"
              mat-flat-button
              class="btn btn-primary"
              [disabled]="createRepoForm.invalid"
              i18n="@@linkSubmitBtn"
            >
              Link
            </button>
          </form>
        </div>
      }

      <div class="repo-list">
        @for (repo of repositories(); track repo.id) {
          <div class="card repo-card">
            <div class="repo-header">
              <div class="repo-title-group">
                <h3>{{ repo.name }}</h3>
                <span class="badge">{{ repo.organization }}</span>
                @if (repo.topologyMode) {
                  <span class="badge topology-badge">{{ repo.topologyMode }}</span>
                }
              </div>
              <div class="repo-header-actions">
                @if (repo.schemaUrl) {
                  <button
                    type="button"
                    mat-stroked-button
                    class="btn btn-secondary open-workspace-btn"
                    (click)="openInWorkspace(repo)"
                    i18n="@@openInWorkspaceBtn"
                  >
                    Open in Workspace
                  </button>
                }
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary create-release-btn"
                  (click)="openReleaseModal(repo)"
                  i18n="@@createReleaseBtn"
                >
                  Create Release
                </button>
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary delete-repo-btn"
                  aria-label="Delete repository"
                  (click)="onDeleteRepo(repo)"
                  i18n="@@deleteRepoBtn"
                >
                  Delete Repository
                </button>
              </div>
            </div>

            <div class="repo-config">
              <div class="config-section">
                <h4 i18n="@@openApiSchemaHeading">
                  API Specification (OpenAPI / Swagger / Arazzo / Discovery)
                </h4>
                <div class="schema-info">
                  @if (repo.schemaUrl) {
                    <a
                      [href]="repo.schemaUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="schema-link"
                      >{{ repo.schemaUrl }}</a
                    >
                    @if (repo.specFormat) {
                      <span class="lang-badge spec-format-badge">{{ repo.specFormat }}</span>
                    }
                  } @else {
                    <span class="text-muted" i18n="@@noSchemaLinked">No schema linked</span>
                  }
                  <button
                    type="button"
                    class="btn btn-link"
                    (click)="openSchemaConfig(repo)"
                    i18n="@@configureSchemaBtn"
                  >
                    Configure
                  </button>
                </div>
              </div>

              <div class="config-section">
                <h4 i18n="@@configuredLanguagesHeading">Configured Languages</h4>
                <div class="languages-list">
                  @if (repo.languages.length) {
                    @for (lang of repo.languages; track lang) {
                      <span class="lang-badge">{{ lang }}</span>
                    }
                  } @else {
                    <span class="text-muted" i18n="@@noLanguagesConfigured"
                      >No languages configured</span
                    >
                  }
                  <button
                    type="button"
                    class="btn btn-link"
                    (click)="openLangConfig(repo)"
                    i18n="@@configureLanguagesBtn"
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>

            @if (repoReleases()[repo.id]?.length) {
              <div class="releases-section">
                <h4 i18n="@@repoReleasesHeading">Releases</h4>
                <div class="languages-list">
                  @for (rel of repoReleases()[repo.id]; track rel.id) {
                    <span class="lang-badge">{{ rel.tag_name }}</span>
                  }
                </div>
              </div>
            }
          </div>
        } @empty {
          <div class="empty-state">
            <p i18n="@@noRepositoriesLinkedMsg">No repositories linked yet.</p>
          </div>
        }
      </div>

      <!-- Schema Config Modal -->
      @if (selectedRepoForSchema(); as selectedRepo) {
        <div
          class="modal-backdrop"
          (click)="closeSchemaConfig()"
          (keydown.escape)="closeSchemaConfig()"
          tabindex="-1"
        >
          <div
            class="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schema-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="schema-dialog-title" i18n="@@configureSchemaDialogTitle">
              Configure Specification for {{ selectedRepo.name }}
            </h2>
            <form [formGroup]="schemaForm" (ngSubmit)="onSaveSchema()">
              <div class="form-group">
                <label for="schemaUrl" i18n="@@schemaUrlLabel">Specification URL</label>
                <input
                  type="url"
                  id="schemaUrl"
                  formControlName="schemaUrl"
                  class="form-control"
                  (input)="onSchemaUrlInput($any($event.target).value)"
                  placeholder="https://api.example.com/openapi.json"
                  i18n-placeholder="@@schemaUrlPlaceholder"
                />
              </div>
              <div class="form-group">
                <label for="specFormatSelect" i18n="@@specFormatSelectLabel">
                  Specification Format
                </label>
                <select id="specFormatSelect" formControlName="specFormat" class="form-control">
                  <option value="openapi">OpenAPI 3.x (3.2.0 / 3.1 / 3.0)</option>
                  <option value="swagger">Swagger 2.0</option>
                  <option value="arazzo">Arazzo 1.x Workflow</option>
                  <option value="google_discovery">Google Discovery Document v1</option>
                </select>
              </div>
              <div class="modal-actions">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary"
                  (click)="closeSchemaConfig()"
                  i18n="@@cancelSchemaBtn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  mat-flat-button
                  class="btn btn-primary"
                  i18n="@@saveSchemaBtn"
                >
                  Save Schema
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Language & Ecosystem Options Config Modal -->
      @if (selectedRepoForLang(); as selectedLangRepo) {
        <div
          class="modal-backdrop"
          (click)="closeLangConfig()"
          (keydown.escape)="closeLangConfig()"
          tabindex="-1"
        >
          <div
            class="modal modal-wide card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <div class="step-header">
              <h2 id="lang-dialog-title" i18n="@@configureLangDialogTitle">
                Configure Languages for {{ selectedLangRepo.name }}
              </h2>
              <div class="header-btns">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary btn-sm select-all-repo-langs"
                  (click)="selectAllRepoLanguages()"
                >
                  Select All 13
                </button>
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary btn-sm clear-repo-langs"
                  (click)="clearRepoLanguages()"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div class="lang-options">
              @for (lang of availableLanguages; track lang) {
                <div class="lang-option-card">
                  <label class="lang-option">
                    <input
                      type="checkbox"
                      [checked]="isLangSelected(lang)"
                      (change)="toggleLang(lang)"
                    />
                    <strong>{{ lang }}</strong>
                  </label>
                  @if (isLangSelected(lang)) {
                    <div class="lang-sub-options">
                      <label class="sub-opt">
                        <input
                          type="checkbox"
                          [checked]="getRepoLangOption(lang, 'cli')"
                          (change)="toggleRepoLangOption(lang, 'cli')"
                        />
                        CLI
                      </label>
                      <label class="sub-opt">
                        <input
                          type="checkbox"
                          [checked]="getRepoLangOption(lang, 'mcp')"
                          (change)="toggleRepoLangOption(lang, 'mcp')"
                        />
                        MCP
                      </label>
                    </div>
                  }
                </div>
              }
            </div>
            <div class="modal-actions">
              <button
                type="button"
                mat-stroked-button
                class="btn btn-secondary"
                (click)="closeLangConfig()"
                i18n="@@closeLangBtn"
              >
                Close
              </button>
              <button
                type="button"
                mat-flat-button
                class="btn btn-primary save-lang-btn"
                (click)="onSaveLangConfig()"
              >
                Save Languages
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Create Release Modal (App Stores + PGP Signing + Docs Hosting) -->
      @if (selectedRepoForRelease(); as selectedReleaseRepo) {
        <div
          class="modal-backdrop"
          (click)="closeReleaseModal()"
          (keydown.escape)="closeReleaseModal()"
          tabindex="-1"
        >
          <div
            class="modal modal-wide card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-dialog-title"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            (click)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
          >
            <h2 id="release-dialog-title" i18n="@@createReleaseDialogTitle">
              Create Release for {{ selectedReleaseRepo.name }}
            </h2>
            <form [formGroup]="releaseForm" (ngSubmit)="onCreateRelease()">
              <div class="form-group">
                <label for="releaseTag" i18n="@@releaseTagLabel">Tag Name</label>
                <input
                  type="text"
                  id="releaseTag"
                  formControlName="tag_name"
                  class="form-control"
                  placeholder="v1.0.0"
                />
              </div>
              <div class="form-group">
                <label for="releaseName" i18n="@@releaseNameLabel">Release Title</label>
                <input
                  type="text"
                  id="releaseName"
                  formControlName="name"
                  class="form-control"
                  placeholder="Initial Release"
                />
              </div>
              <div class="form-group">
                <label for="releaseBody" i18n="@@releaseBodyLabel">Release Notes</label>
                <input
                  type="text"
                  id="releaseBody"
                  formControlName="body"
                  class="form-control"
                  placeholder="Generated SDKs for all configured languages"
                />
              </div>

              <!-- Target Package Registries / App Stores -->
              <div class="form-group">
                <label i18n="@@releaseRegistriesLabel"
                  >Target App Stores &amp; Package Registries</label
                >
                <div class="registry-chips">
                  @for (reg of availableRegistries; track reg) {
                    <label class="lang-option">
                      <input
                        type="checkbox"
                        [checked]="selectedReleaseRegistries().includes(reg)"
                        (change)="toggleReleaseRegistry(reg)"
                      />
                      {{ reg }}
                    </label>
                  }
                </div>
              </div>

              <!-- PGP Signing & Documentation Publishing -->
              <div class="release-security-options">
                <label class="lang-option">
                  <input
                    type="checkbox"
                    [checked]="enablePgpSigning()"
                    (change)="togglePgpSigning()"
                  />
                  <strong>Sign release artifacts with PGP (<code>.asc</code>)</strong>
                </label>

                <div class="docs-publish-row">
                  <label class="lang-option">
                    <input
                      type="checkbox"
                      [checked]="docsPublishEnabled()"
                      (change)="toggleDocsPublish()"
                    />
                    <strong>Publish API &amp; SDK Documentation</strong>
                  </label>
                  @if (docsPublishEnabled()) {
                    <select
                      class="form-control docs-target-select"
                      aria-label="Documentation Hosting Target"
                      [value]="docsPublishTarget()"
                      (change)="onDocsTargetChange($any($event.target).value)"
                    >
                      <option value="github_pages">GitHub Pages</option>
                      <option value="official">Official CDD Docs UI</option>
                      <option value="readthedocs">Read the Docs</option>
                      <option value="docs_rs">docs.rs</option>
                      <option value="pkg_go_dev">pkg.go.dev</option>
                      <option value="javadoc_io">javadoc.io</option>
                      <option value="rubydoc">RubyDoc.info</option>
                      <option value="spi_docc">Swift Package Index (DocC)</option>
                      <option value="custom">Custom URL</option>
                    </select>
                  }
                </div>
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  mat-stroked-button
                  class="btn btn-secondary"
                  (click)="closeReleaseModal()"
                  i18n="@@cancelReleaseBtn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  mat-flat-button
                  class="btn btn-primary"
                  [disabled]="releaseForm.invalid"
                  i18n="@@submitReleaseBtn"
                >
                  Publish Release
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .page-container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
      h1 {
        margin: 0;
        color: var(--text-primary);
      }
    }
    .header-btns {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .status-banner {
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 6px;
      background: var(--primary-hover);
      color: var(--primary-color);
      font-size: 0.875rem;
    }
    .error-banner {
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      border-radius: 6px;
      background: var(--error-bg);
      color: var(--error-text);
      font-size: 0.875rem;
    }
    .card {
      background: var(--surface-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .wizard-card {
      margin-bottom: 2rem;
      border-left: 4px solid var(--primary-color);
      h2 {
        margin-top: 0;
        font-size: 1.25rem;
      }
    }
    .wizard-step {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      h3 {
        margin: 0 0 0.75rem 0;
        font-size: 1rem;
        color: var(--text-primary);
      }
    }
    .step-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }
    .wizard-org-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .topology-mode-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .mode-card {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      background: var(--bg-color);
      &.selected {
        border-color: var(--primary-color);
        background: var(--primary-hover);
      }
    }
    .mode-desc {
      display: block;
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }
    .input-with-action {
      display: flex;
      gap: 0.5rem;
    }
    .polyrepo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 1rem;
      margin-top: 0.5rem;
    }
    .polyrepo-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .polyrepo-lang-label {
      min-width: 85px;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .wizard-footer {
      margin-top: 1.25rem;
      display: flex;
      justify-content: flex-end;
    }
    .create-repo-card {
      margin-bottom: 2rem;
      h2 {
        margin-top: 0;
        font-size: 1.25rem;
      }
    }
    .repo-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .repo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
      flex-wrap: wrap;
      h3 {
        margin: 0;
        font-size: 1.25rem;
      }
    }
    .repo-title-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .repo-header-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .badge {
      background: var(--bg-color);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
      padding: 0.25rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .topology-badge {
      background: var(--primary-hover);
      color: var(--primary-color);
      border-color: var(--primary-color);
    }
    .repo-config {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    .config-section,
    .releases-section {
      h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.875rem;
        color: var(--text-secondary);
      }
    }
    .schema-info,
    .languages-list {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .schema-link {
      color: var(--primary-color);
      text-decoration: none;
      word-break: break-all;
      &:hover {
        text-decoration: underline;
      }
    }
    .lang-badge {
      background: var(--primary-hover);
      color: var(--primary-color);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .text-muted {
      color: var(--text-secondary);
      font-style: italic;
      font-size: 0.875rem;
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      font-size: 0.875rem;
    }
    .btn-sm {
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
    }
    .btn-primary {
      background-color: var(--primary-color);
      color: var(--mat-sys-on-primary, #ffffff);
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .btn-secondary {
      background-color: var(--bg-color);
      color: var(--text-primary);
      border-color: var(--border-color);
    }
    .btn-link {
      background: none;
      color: var(--primary-color);
      padding: 0.25rem 0.5rem;
      &:hover {
        text-decoration: underline;
      }
    }
    .form-group {
      margin-bottom: 1rem;
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--text-primary);
      }
    }
    .form-control {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 0.875rem;
      box-sizing: border-box;
      background-color: var(--surface-color);
      color: var(--text-primary);
      &:focus {
        outline: 2px solid var(--primary-color);
        outline-offset: 1px;
        border-color: var(--primary-color);
      }
    }
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      width: 100%;
      max-width: 450px;
      max-height: 90vh;
      overflow-y: auto;
      h2 {
        margin-top: 0;
      }
    }
    .modal-wide {
      max-width: 640px;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1.5rem;
    }
    .lang-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin: 1rem 0;
    }
    .lang-option-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.35rem 0.5rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
    }
    .lang-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .lang-sub-options {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;
    }
    .sub-opt {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      cursor: pointer;
    }
    .registry-chips {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.4rem;
      font-size: 0.8125rem;
    }
    .release-security-options {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }
    .docs-publish-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .docs-target-select {
      max-width: 240px;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      background: var(--surface-color);
      border: 1px dashed var(--border-color);
      border-radius: 6px;
      color: var(--text-secondary);
    }
  `,
})
/**
 * Component to display and configure linked repositories, Monorepo/Polyrepo wizard, schemas, and SDK languages.
 */
export class RepositoriesComponent implements OnInit {
  /** Global Date constructor. */
  private readonly globalDate = inject(GLOBAL_DATE);
  /** Backend API service. */
  private readonly api = inject(ApiService);
  /** Backend configuration service. */
  private readonly config = inject(BackendConfigService);
  /** Angular Router instance. */
  private readonly router = inject(Router);
  /** NgRx Store instance. */
  private readonly store = inject(Store);

  /**
   * List of available organizations for linking repositories.
   */
  readonly availableOrgs = signal<
    {
      /** Numeric organization ID. */
      id: number;
      /** Display name or login of the organization. */
      name: string;
    }[]
  >([
    { id: 1, name: 'Offscale' },
    { id: 2, name: 'Demo Team' },
  ]);

  /**
   * Synced GitHub organizations and user namespaces (`GET /github/orgs`).
   */
  readonly githubOrgs = signal<GitHubOrg[]>([
    { id: 1, login: 'offscale', name: 'OffScale' },
    { id: 2, login: 'demo-org', name: 'Demo Organization' },
  ]);

  /**
   * Available languages for SDK generation across all 13 CDD ecosystems.
   */
  availableLanguages = [
    'TypeScript',
    'Rust',
    'Python',
    'Go',
    'Java',
    'C#',
    'C++',
    'C',
    'Kotlin',
    'PHP',
    'Ruby',
    'Swift',
    'Shell',
  ];

  /** Available package registries for automated release publishing. */
  readonly availableRegistries: readonly PackageRegistryId[] = [
    'npm',
    'pypi',
    'cargo',
    'maven',
    'nuget',
    'rubygems',
    'packagist',
    'pkggodev',
    'swift',
    'vcpkg',
    'conan',
    'homebrew',
    'github_releases',
  ];

  /** Whether the Monorepo vs. Polyrepo Topology Wizard is visible. */
  readonly showTopologyWizard = signal<boolean>(false);

  /** Selected languages inside the Monorepo/Polyrepo Wizard. */
  readonly wizardLanguages = signal<string[]>(['TypeScript', 'Rust', 'Python']);

  /** Reactive repository topology configuration (`githubOrgName`, `topologyMode`, `monorepoName`, `polyrepoNames`). */
  readonly topologyConfig = signal<RepoTopologyConfig>({
    githubOrgName: 'offscale',
    topologyMode: 'monorepo',
    monorepoName: getDefaultMonorepoName('offscale'),
    polyrepoNames: buildDefaultPolyrepoMap('offscale', ['TypeScript', 'Rust', 'Python']),
  });

  /** Computed preview of the default monorepo name `${GITHUB_ORG_NAME}-sdk`. */
  readonly defaultMonorepoPreview = computed(() =>
    getDefaultMonorepoName(this.topologyConfig().githubOrgName),
  );

  /**
   * List of linked repositories
   */
  repositories = signal<Repository[]>([
    {
      id: 'repo-1',
      name: 'offscale/cdd-ctl',
      organization: 'Offscale',
      organizationId: 1,
      topologyMode: 'monorepo',
      schemaUrl: 'https://raw.githubusercontent.com/offscale/cdd-ctl/main/openapi.yaml',
      specFormat: 'openapi',
      languages: ['TypeScript', 'Rust', 'Python'],
    },
    {
      id: 'repo-2',
      name: 'demo/payment-service',
      organization: 'Demo Team',
      organizationId: 2,
      topologyMode: 'polyrepo',
      languages: ['Go', 'Java'],
    },
  ]);

  /** Map of repository IDs to their published releases. */
  readonly repoReleases = signal<Record<string, Release[]>>({});

  /** Selected package registries in the Create Release modal. */
  readonly selectedReleaseRegistries = signal<PackageRegistryId[]>([
    'npm',
    'pypi',
    'cargo',
    'github_releases',
  ]);
  /** Whether PGP signing (`.asc`) is enabled for the release. */
  readonly enablePgpSigning = signal<boolean>(true);
  /** Whether documentation generation and publishing are enabled for the release. */
  readonly docsPublishEnabled = signal<boolean>(true);
  /** Selected documentation hosting provider for the release. */
  readonly docsPublishTarget = signal<DocHostTarget>('github_pages');

  /**
   * Whether the create form is visible
   */
  showCreateForm = signal(false);
  /**
   * Repository selected for schema configuration
   */
  selectedRepoForSchema = signal<Repository | null>(null);
  /**
   * Repository selected for language configuration
   */
  selectedRepoForLang = signal<Repository | null>(null);
  /**
   * Repository selected for creating a release
   */
  selectedRepoForRelease = signal<Repository | null>(null);

  /** Status message signal for backend actions. */
  readonly statusMessage = signal<string | null>(null);
  /** Error message signal for backend actions. */
  readonly errorMessage = signal<string | null>(null);

  /**
   * Form group for linking a new repository
   */
  createRepoForm = new FormGroup({
    name: new FormControl('', Validators.required),
    organization: new FormControl('Offscale', Validators.required),
  });

  /**
   * Form group for configuring a schema URL and specification format
   */
  schemaForm = new FormGroup({
    schemaUrl: new FormControl('', Validators.required),
    specFormat: new FormControl<SpecFormat>('openapi'),
  });

  /**
   * Form group for creating a release
   */
  releaseForm = new FormGroup({
    tag_name: new FormControl('', Validators.required),
    name: new FormControl(''),
    body: new FormControl(''),
  });

  /**
   * Initializes the component and loads organizations and repositories when online.
   */
  ngOnInit(): void {
    if (this.config.isOnline()) {
      this.loadRemoteRepositories();
      this.onSyncGithubOrgs();
    }
  }

  /**
   * Toggles the visibility of the Monorepo vs. Polyrepo Topology Wizard.
   */
  toggleTopologyWizard(): void {
    this.showTopologyWizard.update((v) => !v);
  }

  /**
   * Synchronizes GitHub organizations (`GET /github/orgs`) when online.
   */
  onSyncGithubOrgs(): void {
    if (!this.config.isOnline()) {
      this.statusMessage.set('Loaded local GitHub organization presets.');
      return;
    }
    this.api.listGithubOrgs().subscribe({
      next: (orgs) => {
        if (orgs.length > 0) {
          this.githubOrgs.set(orgs);
          this.onGithubOrgChange(orgs[0].login);
        }
      },
      error: () => {
        // Keep existing org presets if /github/orgs fails
      },
    });
  }

  /**
   * Updates `${GITHUB_ORG_NAME}` in the wizard and reconciles default monorepo (`${ORG}-sdk`)
   * and polyrepo (`${ORG}-sdk-${LANG}`) names while preserving custom user edits.
   * @param nextOrgName New GitHub organization or user handle.
   */
  onGithubOrgChange(nextOrgName: string): void {
    this.topologyConfig.update((prev) =>
      reconcileTopologyConfig(prev, nextOrgName, this.wizardLanguages()),
    );
  }

  /**
   * Sets the repository topology mode (`'monorepo'` or `'polyrepo'`).
   * @param mode Selected topology mode.
   */
  onSetTopologyMode(mode: RepoTopologyMode): void {
    this.topologyConfig.update((prev) => ({
      ...prev,
      topologyMode: mode,
    }));
  }

  /**
   * Updates the customizable Monorepo name input.
   * @param name Custom monorepo repository name.
   */
  onMonorepoNameChange(name: string): void {
    this.topologyConfig.update((prev) => ({
      ...prev,
      monorepoName: name,
    }));
  }

  /**
   * Resets the Monorepo name to `${GITHUB_ORG_NAME}-sdk`.
   */
  resetMonorepoName(): void {
    this.topologyConfig.update((prev) => ({
      ...prev,
      monorepoName: getDefaultMonorepoName(prev.githubOrgName),
    }));
  }

  /**
   * Returns the configured or default polyrepo name for a specific language.
   * @param lang Language display name or identifier.
   * @returns Repository name string (`${GITHUB_ORG_NAME}-sdk-${LANGUAGE}`).
   */
  getPolyrepoNameForLanguage(lang: string): string {
    const cfg = this.topologyConfig();
    return cfg.polyrepoNames[lang] || getDefaultPolyrepoName(cfg.githubOrgName, lang);
  }

  /**
   * Updates a specific language's repository name in Polyrepo mode.
   * @param lang Language display name or identifier.
   * @param repoName Custom repository name for this language.
   */
  onPolyrepoNameChange(lang: string, repoName: string): void {
    this.topologyConfig.update((prev) => ({
      ...prev,
      polyrepoNames: {
        ...prev.polyrepoNames,
        [lang]: repoName,
      },
    }));
  }

  /**
   * Resets all Polyrepo language repository names to `${GITHUB_ORG_NAME}-sdk-${LANGUAGE}`.
   */
  resetPolyrepoNames(): void {
    this.topologyConfig.update((prev) => ({
      ...prev,
      polyrepoNames: buildDefaultPolyrepoMap(prev.githubOrgName, this.wizardLanguages()),
    }));
  }

  /**
   * Toggles a language inside the Monorepo/Polyrepo Wizard.
   * @param lang Language display name to toggle.
   */
  toggleWizardLanguage(lang: string): void {
    const current = this.wizardLanguages();
    const next = current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang];
    this.wizardLanguages.set(next);
    this.topologyConfig.update((prev) => reconcileTopologyConfig(prev, prev.githubOrgName, next));
  }

  /**
   * Selects all 13 target languages in the Monorepo/Polyrepo Wizard.
   */
  selectAllWizardLanguages(): void {
    const all = [...this.availableLanguages];
    this.wizardLanguages.set(all);
    this.topologyConfig.update((prev) => reconcileTopologyConfig(prev, prev.githubOrgName, all));
  }

  /**
   * Clears all selected languages in the Monorepo/Polyrepo Wizard.
   */
  clearWizardLanguages(): void {
    this.wizardLanguages.set([]);
  }

  /**
   * Provisions either a single Monorepo (`${GITHUB_ORG_NAME}-sdk`) or per-language Polyrepos (`${GITHUB_ORG_NAME}-sdk-${LANGUAGE}`)
   * via `POST /github/provision` when online, or in local state when in offline demo mode.
   */
  onProvisionTopologyRepos(): void {
    const cfg = this.topologyConfig();
    const langs = this.wizardLanguages();
    if (langs.length === 0) {
      return;
    }

    const payload = {
      github_org_name: cfg.githubOrgName,
      topology_mode: cfg.topologyMode,
      monorepo_name: cfg.monorepoName,
      polyrepo_names: cfg.polyrepoNames,
      languages: langs,
    };

    if (this.config.isOnline()) {
      this.api.provisionGithubRepos(payload).subscribe({
        next: (createdRepos) => {
          const mapped: Repository[] = createdRepos.map((r) => ({
            id: String(r.id),
            name: r.name,
            organization: cfg.githubOrgName,
            organizationId: r.organization_id ?? 1,
            topologyMode: cfg.topologyMode,
            languages: r.languages ?? [...langs],
          }));
          this.repositories.update((existing) => [...existing, ...mapped]);
          this.statusMessage.set(
            `Provisioned ${mapped.length} ${cfg.topologyMode === 'monorepo' ? 'monorepo' : 'polyrepo'} repository(s) under ${cfg.githubOrgName}.`,
          );
          this.errorMessage.set(null);
          this.showTopologyWizard.set(false);
        },
        error: () => {
          this.errorMessage.set('Failed to provision GitHub repositories on backend.');
        },
      });
      return;
    }

    const now = this.globalDate.now();
    if (cfg.topologyMode === 'monorepo') {
      const monoName = cfg.monorepoName.trim() || getDefaultMonorepoName(cfg.githubOrgName);
      const newRepo: Repository = {
        id: `repo-mono-${now}`,
        name: `${cfg.githubOrgName}/${monoName}`,
        organization: cfg.githubOrgName,
        organizationId: 1,
        topologyMode: 'monorepo',
        languages: [...langs],
      };
      this.repositories.update((existing) => [...existing, newRepo]);
      this.statusMessage.set(
        `Provisioned monorepo ${newRepo.name} with ${langs.length} languages.`,
      );
    } else {
      const createdPoly: Repository[] = langs.map((lang, idx) => {
        const polyName = this.getPolyrepoNameForLanguage(lang);
        return {
          id: `repo-poly-${now}-${idx}`,
          name: `${cfg.githubOrgName}/${polyName}`,
          organization: cfg.githubOrgName,
          organizationId: 1,
          topologyMode: 'polyrepo',
          languages: [lang],
        };
      });
      this.repositories.update((existing) => [...existing, ...createdPoly]);
      this.statusMessage.set(
        `Provisioned ${createdPoly.length} individual repositories under ${cfg.githubOrgName}.`,
      );
    }
    this.showTopologyWizard.set(false);
  }

  /**
   * Loads organizations and their repositories from `cdd-control-plane`.
   */
  loadRemoteRepositories(): void {
    this.api.listOrgs().subscribe({
      next: (orgs) => {
        if (orgs.length > 0) {
          this.availableOrgs.set(
            orgs.map((o) => ({
              id: Number(o.id),
              name: o.name || o.login,
            })),
          );
          this.repositories.set([]);
          this.errorMessage.set(null);
          const loadedRepos: Repository[] = [];
          for (const org of orgs) {
            const orgId = Number(org.id);
            const orgName = org.name || org.login;
            this.api.listRepos(orgId).subscribe({
              next: (repos) => {
                for (const r of repos) {
                  loadedRepos.push({
                    id: String(r.id),
                    name: r.name,
                    organization: orgName,
                    organizationId: orgId,
                    topologyMode: r.topologyMode,
                    schemaUrl: r.schemaUrl ?? r.specUrl,
                    specFormat: r.specFormat,
                    languages: r.languages ?? ['TypeScript', 'Rust'],
                  });
                }
                this.repositories.set([...loadedRepos]);
              },
              error: () => {
                this.errorMessage.set(`Failed to load repositories for ${orgName}.`);
              },
            });
          }
        } else {
          this.availableOrgs.set([]);
          this.repositories.set([]);
          this.errorMessage.set(null);
        }
      },
      error: () => {
        this.errorMessage.set('Failed to load organizations from backend.');
      },
    });
  }

  /**
   * Toggles the visibility of the create form
   */
  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    if (!this.showCreateForm()) {
      this.createRepoForm.reset({ organization: 'Offscale' });
    }
  }

  /**
   * Handles linking a new repository
   */
  onCreateRepo(): void {
    if (this.createRepoForm.valid) {
      const repoName = this.createRepoForm.value.name || '';
      const orgName = this.createRepoForm.value.organization || 'Offscale';
      const matchingOrg = this.availableOrgs().find((o) => o.name === orgName);
      const orgId = matchingOrg?.id ?? 1;

      if (this.config.isOnline()) {
        this.api.createOrgRepo(orgId, { name: repoName }).subscribe({
          next: (created) => {
            const newRepo: Repository = {
              id: String(created.id),
              name: created.name,
              organization: orgName,
              organizationId: orgId,
              languages: created.languages ?? [],
            };
            this.repositories.update((repos) => [...repos, newRepo]);
            this.errorMessage.set(null);
            this.toggleCreateForm();
          },
          error: () => {
            this.errorMessage.set('Failed to create repository on backend.');
          },
        });
        return;
      }

      const newRepo: Repository = {
        id: `repo-${this.globalDate.now()}`,
        name: repoName,
        organization: orgName,
        organizationId: orgId,
        languages: [],
      };
      this.repositories.update((repos) => [...repos, newRepo]);
      this.toggleCreateForm();
    }
  }

  /**
   * Deletes/unlinks a repository on the backend (when online) and removes it from the list.
   * @param repo The repository to delete.
   */
  onDeleteRepo(repo: Repository): void {
    const orgId = repo.organizationId ?? 1;
    if (this.config.isOnline()) {
      this.api.deleteRepo(orgId, repo.id).subscribe({
        next: () => {
          this.repositories.update((repos) => repos.filter((r) => r.id !== repo.id));
          this.statusMessage.set(`Deleted repository ${repo.name}.`);
          this.errorMessage.set(null);
        },
        error: () => {
          this.errorMessage.set(`Failed to delete repository ${repo.name}.`);
        },
      });
      return;
    }
    this.repositories.update((repos) => repos.filter((r) => r.id !== repo.id));
  }

  /**
   * Opens the repository's linked OpenAPI specification in the interactive Workspace.
   * @param repo The repository whose schema URL should be opened.
   */
  openInWorkspace(repo: Repository): void {
    if (repo.schemaUrl) {
      this.store.dispatch(
        WorkspaceActions.addOpenApiUrl({
          url: repo.schemaUrl,
        }),
      );
      void this.router.navigate(['/']);
    }
  }

  /**
   * Opens the Create Release modal for a repository and loads existing releases when online.
   * @param repo The repository to create a release for.
   */
  openReleaseModal(repo: Repository): void {
    this.selectedRepoForRelease.set(repo);
    this.releaseForm.reset({ tag_name: 'v1.0.0', name: '', body: '' });
    if (this.config.isOnline()) {
      const orgId = repo.organizationId ?? 1;
      const repoId = Number(repo.id) || 1;
      this.api.listReleases(orgId, repoId).subscribe({
        next: (releases) => {
          this.repoReleases.update((map) => ({ ...map, [repo.id]: releases }));
        },
        error: () => {
          // Ignore error if no releases exist yet
        },
      });
    }
  }

  /**
   * Closes the Create Release modal.
   */
  closeReleaseModal(): void {
    this.selectedRepoForRelease.set(null);
  }

  /**
   * Toggles a target package registry in the Create Release modal.
   * @param registry Package registry identifier to toggle.
   */
  toggleReleaseRegistry(registry: PackageRegistryId): void {
    this.selectedReleaseRegistries.update((current) =>
      current.includes(registry) ? current.filter((r) => r !== registry) : [...current, registry],
    );
  }

  /**
   * Toggles PGP signing (`.asc`) for the release.
   */
  togglePgpSigning(): void {
    this.enablePgpSigning.update((v) => !v);
  }

  /**
   * Toggles documentation publishing for the release.
   */
  toggleDocsPublish(): void {
    this.docsPublishEnabled.update((v) => !v);
  }

  /**
   * Updates the documentation hosting target for the release.
   * @param target Selected documentation host target.
   */
  onDocsTargetChange(target: DocHostTarget): void {
    this.docsPublishTarget.set(target);
  }

  /**
   * Submits the Create Release form (`POST /api/v1/orgs/{org_id}/repos/{repo_id}/releases`).
   */
  onCreateRelease(): void {
    if (this.releaseForm.valid) {
      const repo = this.selectedRepoForRelease();
      if (repo) {
        const tag_name = this.releaseForm.value.tag_name || 'v1.0.0';
        const name = this.releaseForm.value.name || undefined;
        const body = this.releaseForm.value.body || undefined;
        const orgId = repo.organizationId ?? 1;
        const repoId = Number(repo.id) || 1;
        const docsConfig: DocsPublishConfig = {
          enabled: this.docsPublishEnabled(),
          target: this.docsPublishTarget(),
        };

        if (this.config.isOnline()) {
          this.api
            .createOrgRelease(orgId, repoId, {
              tag_name,
              name,
              body,
              target_languages: repo.languages,
              release_registries: this.selectedReleaseRegistries(),
              enable_pgp_signing: this.enablePgpSigning(),
              docs_config: docsConfig,
            })
            .subscribe({
              next: (created) => {
                this.repoReleases.update((map) => ({
                  ...map,
                  [repo.id]: [...(map[repo.id] ?? []), created],
                }));
                this.statusMessage.set(`Release ${created.tag_name} created and queued.`);
                this.errorMessage.set(null);
                this.closeReleaseModal();
              },
              error: () => {
                this.errorMessage.set('Failed to create release on backend.');
              },
            });
          return;
        }

        const localRelease: Release = {
          id: this.globalDate.now(),
          repository_id: repoId,
          tag_name,
          name: name ?? null,
          body: body ?? null,
        };
        this.repoReleases.update((map) => ({
          ...map,
          [repo.id]: [...(map[repo.id] ?? []), localRelease],
        }));
      }
      this.closeReleaseModal();
    }
  }

  /**
   * Infers a `SpecFormat` from a URL path or query string.
   * @param url Remote specification URL.
   * @returns Detected `SpecFormat`.
   */
  detectSpecFormatFromUrl(url: string): SpecFormat {
    const lower = url.toLowerCase();
    if (lower.includes('arazzo')) {
      return 'arazzo';
    }
    if (lower.includes('discovery') || lower.includes('googleapis.com/$discovery')) {
      return 'google_discovery';
    }
    if (lower.includes('swagger')) {
      return 'swagger';
    }
    return 'openapi';
  }

  /**
   * Auto-updates the selected specification format when the user types a schema URL.
   * @param url Schema URL string.
   */
  onSchemaUrlInput(url: string): void {
    this.schemaForm.controls.specFormat.setValue(this.detectSpecFormatFromUrl(url));
  }

  /**
   * Opens the schema configuration modal for a repository
   * @param repo The repository to configure
   */
  openSchemaConfig(repo: Repository): void {
    this.selectedRepoForSchema.set(repo);
    this.schemaForm.setValue({
      schemaUrl: repo.schemaUrl || '',
      specFormat: repo.specFormat || 'openapi',
    });
  }

  /**
   * Closes the schema configuration modal
   */
  closeSchemaConfig(): void {
    this.selectedRepoForSchema.set(null);
  }

  /**
   * Saves the configured schema URL and specification format for the selected repository
   */
  onSaveSchema(): void {
    if (this.schemaForm.valid) {
      const repo = this.selectedRepoForSchema();
      if (repo) {
        const nextUrl = this.schemaForm.value.schemaUrl || '';
        const nextFormat = this.schemaForm.value.specFormat || 'openapi';
        this.repositories.update((repos) =>
          repos.map((r) =>
            r.id === repo.id ? { ...r, schemaUrl: nextUrl, specFormat: nextFormat } : r,
          ),
        );
        if (this.config.isOnline()) {
          const orgId = repo.organizationId ?? 1;
          this.api
            .updateOrgRepo(orgId, repo.id, {
              schema_url: nextUrl,
              spec_format: nextFormat,
            })
            .subscribe({
              next: () => {
                this.statusMessage.set(`Updated specification for ${repo.name}.`);
              },
              error: () => {
                this.errorMessage.set(`Failed to update specification for ${repo.name}.`);
              },
            });
        }
      }
      this.closeSchemaConfig();
    }
  }

  /**
   * Opens the language configuration modal for a repository
   * @param repo The repository to configure
   */
  openLangConfig(repo: Repository): void {
    this.selectedRepoForLang.set(repo);
  }

  /**
   * Closes the language configuration modal
   */
  closeLangConfig(): void {
    this.selectedRepoForLang.set(null);
  }

  /**
   * Selects all 13 target languages for the currently active repository.
   */
  selectAllRepoLanguages(): void {
    const repo = this.selectedRepoForLang();
    if (!repo) return;
    const all = [...this.availableLanguages];
    this.repositories.update((repos) =>
      repos.map((r) => (r.id === repo.id ? { ...r, languages: all } : r)),
    );
    this.selectedRepoForLang.set({ ...repo, languages: all });
  }

  /**
   * Clears all target languages for the currently active repository.
   */
  clearRepoLanguages(): void {
    const repo = this.selectedRepoForLang();
    if (!repo) return;
    this.repositories.update((repos) =>
      repos.map((r) => (r.id === repo.id ? { ...r, languages: [] } : r)),
    );
    this.selectedRepoForLang.set({ ...repo, languages: [] });
  }

  /**
   * Checks whether a per-language option (`cli` or `mcp`) is enabled on the selected repository.
   * @param lang Language display name.
   * @param key Option key (`'cli'` or `'mcp'`).
   * @returns `true` if the option is enabled.
   */
  getRepoLangOption(lang: string, key: 'cli' | 'mcp'): boolean {
    const repo = this.selectedRepoForLang();
    return Boolean(repo?.languageOptions?.[lang]?.[key]);
  }

  /**
   * Toggles a per-language option (`cli` or `mcp`) on the selected repository.
   * @param lang Language display name.
   * @param key Option key (`'cli'` or `'mcp'`).
   */
  toggleRepoLangOption(lang: string, key: 'cli' | 'mcp'): void {
    const repo = this.selectedRepoForLang();
    if (!repo) return;
    const currentOpts = repo.languageOptions ?? {};
    const langOpts = currentOpts[lang] ?? {};
    const updatedOpts: Record<string, LanguageOptions> = {
      ...currentOpts,
      [lang]: {
        ...langOpts,
        [key]: !langOpts[key],
      },
    };
    this.repositories.update((repos) =>
      repos.map((r) => (r.id === repo.id ? { ...r, languageOptions: updatedOpts } : r)),
    );
    this.selectedRepoForLang.set({ ...repo, languageOptions: updatedOpts });
  }

  /**
   * Persists the configured languages and per-language options to the backend when online and closes the modal.
   */
  onSaveLangConfig(): void {
    const repo = this.selectedRepoForLang();
    if (repo && this.config.isOnline()) {
      const orgId = repo.organizationId ?? 1;
      this.api
        .updateOrgRepo(orgId, repo.id, {
          languages: repo.languages,
          language_options: repo.languageOptions,
        })
        .subscribe({
          next: () => {
            this.statusMessage.set(`Saved language configuration for ${repo.name}.`);
          },
          error: () => {
            this.errorMessage.set(`Failed to save language configuration for ${repo.name}.`);
          },
        });
    }
    this.closeLangConfig();
  }

  /**
   * Checks if a language is selected for the currently active repository
   * @param lang The language to check
   * @returns True if the language is selected, false otherwise
   */
  isLangSelected(lang: string): boolean {
    const repo = this.selectedRepoForLang();
    return repo ? repo.languages.includes(lang) : false;
  }

  /**
   * Toggles a language selection for the currently active repository
   * @param lang The language to toggle
   */
  toggleLang(lang: string): void {
    const repo = this.selectedRepoForLang();
    if (!repo) return;

    const currentLangs = repo.languages;
    const updatedLanguages = currentLangs.includes(lang)
      ? currentLangs.filter((l) => l !== lang)
      : [...currentLangs, lang];

    this.repositories.update((repos) =>
      repos.map((r) => (r.id === repo.id ? { ...r, languages: updatedLanguages } : r)),
    );

    // Update local selected state to refresh view immediately
    this.selectedRepoForLang.set({
      ...repo,
      languages: updatedLanguages,
    });
  }
}
