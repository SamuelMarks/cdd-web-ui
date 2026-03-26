import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { LanguageSelectorComponent } from './language-selector.component';
import { Component, signal } from '@angular/core';
import { LanguageService } from '../../services/language.service';
import { OfflineService } from '../../services/offline.service';
import { StorageService } from '../../services/storage.service';
import { LanguageConfig, Target, LanguageOptions } from '../../models/types';
import { By } from '@angular/platform-browser';
import { MatSelectModule } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';

@Component({
  template: `
    <app-language-selector
      [selectedLanguageId]="selectedLanguageId()"
      [target]="target()"
      [options]="options()"
      (languageChanged)="onLanguageChanged($event)"
    >
    </app-language-selector>
  `,
  imports: [LanguageSelectorComponent],
})
class TestHostComponent {
  selectedLanguageId = signal('typescript');
  target = signal<Target>('to_sdk');
  options = signal<LanguageOptions>({});
  lastLanguageChanged = '';

  onLanguageChanged(langId: string) {
    this.lastLanguageChanged = langId;
    this.selectedLanguageId.set(langId);
  }
}

describe('LanguageSelectorComponent', () => {
  let component: LanguageSelectorComponent;
  let fixture: ComponentFixture<LanguageSelectorComponent>;
  let hostComponent: TestHostComponent;
  let hostFixture: ComponentFixture<TestHostComponent>;

  let mockLanguageService: Record<string, import('vitest').Mock>;
  let mockOfflineService: Record<string, import('vitest').Mock>;
  let mockStorageService: Record<string, import('vitest').Mock>;

  beforeEach(async () => {
    mockLanguageService = {
      languages: signal<LanguageConfig[]>([
        {
          id: 'typescript',
          name: 'TypeScript',
          repo: 'cdd-ts',
          availableInWasm: true,
          selectedByDefault: true,
        },
        {
          id: 'java',
          name: 'Java',
          repo: 'cdd-java',
          availableInWasm: false,
          selectedByDefault: false,
        },
        {
          id: 'python',
          name: 'Python',
          repo: 'cdd-python',
          availableInWasm: true,
          selectedByDefault: false,
        },
      ]),
    };

    mockOfflineService = {
      isOnline: signal<boolean>(true),
    };

    mockStorageService = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        LanguageSelectorComponent,
        TestHostComponent,
        MatSelectModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: LanguageService, useValue: mockLanguageService },
        { provide: OfflineService, useValue: mockOfflineService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    hostComponent = hostFixture.componentInstance;
  });

  it('should create', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;
    expect(component).toBeTruthy();
  });

  it('should compute processed languages based on online state', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    // Online: everything enabled
    let langs = component.processedLanguages();
    expect(
      langs.find((l: import('../../models/types').LanguageConfig) => l.id === 'java')?.isDisabled,
    ).toBe(false);

    // Offline
    mockOfflineService.isOnline.set(false);
    hostFixture.detectChanges();

    langs = component.processedLanguages();
    expect(
      langs.find((l: import('../../models/types').LanguageConfig) => l.id === 'typescript')
        ?.isDisabled,
    ).toBe(false); // has WASM
    expect(
      langs.find((l: import('../../models/types').LanguageConfig) => l.id === 'java')?.isDisabled,
    ).toBe(true); // no WASM
  });

  it('should emit languageChanged and update storage on manual selection', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    component.onSelectionChange('python');
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    expect(hostComponent.lastLanguageChanged).toBe('python');
    expect(mockStorageService.setItem).toHaveBeenCalledWith('lastSelectedLanguage', 'python');
  });

  it('should not emit if selecting the already selected language', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    hostComponent.lastLanguageChanged = '';
    component.onSelectionChange('typescript'); // already typescript

    expect(hostComponent.lastLanguageChanged).toBe('');
    expect(mockStorageService.setItem).not.toHaveBeenCalled();
  });

  it('should load last selected language from storage on init if valid', async () => {
    // Recreate fixture specifically for this test so storage returns python on component construction
    mockStorageService.getItem.mockReturnValue('python');

    const newFixture = TestBed.createComponent(TestHostComponent);
    const newHost = newFixture.componentInstance;
    newFixture.detectChanges();

    await new Promise((r) => setTimeout(r, 10)); // wait for setTimeout inside constructor

    expect(newHost.lastLanguageChanged).toBe('python');
  });

  it('should not emit languageChanged if last selected language is invalid or disabled', async () => {
    mockStorageService.getItem.mockReturnValue('non-existent');

    const newFixture = TestBed.createComponent(TestHostComponent);
    const newHost = newFixture.componentInstance;
    newFixture.detectChanges();

    await new Promise((r) => setTimeout(r, 10));

    expect(newHost.lastLanguageChanged).toBe('');
  });

  it('should not emit languageChanged if last selected language is disabled', async () => {
    mockOfflineService.isOnline.set(false);
    mockStorageService.getItem.mockReturnValue('java'); // Java is not available in WASM, disabled offline

    const newFixture = TestBed.createComponent(TestHostComponent);
    const newHost = newFixture.componentInstance;
    newFixture.detectChanges();

    await new Promise((r) => setTimeout(r, 10));

    expect(newHost.lastLanguageChanged).toBe('');
  });

  it('should auto-switch language if currently selected becomes disabled (e.g. going offline)', async () => {
    // Start online, with java selected
    hostComponent.selectedLanguageId.set('java');
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    // Go offline
    mockOfflineService.isOnline.set(false);
    hostFixture.detectChanges();
    await new Promise((r) => setTimeout(r, 10)); // wait for setTimeout inside effect

    // Should have auto-switched to the first available (typescript)
    expect(hostComponent.lastLanguageChanged).toBe('typescript');
  });

  it('should not switch if all languages are disabled (edge case)', async () => {
    mockLanguageService.languages.set([
      {
        id: 'java',
        name: 'Java',
        repo: 'cdd-java',
        availableInWasm: false,
        selectedByDefault: false,
      },
    ]);
    const newFixture = TestBed.createComponent(TestHostComponent);
    const newHost = newFixture.componentInstance;
    newHost.selectedLanguageId.set('java');
    newFixture.detectChanges();
    await newFixture.whenStable();

    mockOfflineService.isOnline.set(false);
    newFixture.detectChanges();
    await new Promise((r) => setTimeout(r, 10));

    expect(newHost.lastLanguageChanged).toBe('');
  });

  it('should emit targetChanged when onTargetChange is called', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    const emitSpy = vi.spyOn(component.targetChanged, 'emit');
    component.onTargetChange('to_server');
    expect(emitSpy).toHaveBeenCalledWith('to_server');
  });

  it('should switch framework to fetch if target changes to to_sdk_cli and language is typescript and framework is unset/angular', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    const emitSpy = vi.spyOn(component.optionsChanged, 'emit');
    hostComponent.selectedLanguageId.set('typescript');
    hostComponent.options.set({ framework: 'angular' });
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    component.onTargetChange('to_sdk_cli');
    expect(emitSpy).toHaveBeenCalledWith({
      languageId: 'typescript',
      options: { framework: 'fetch' },
    });
  });

  it('should not switch framework if framework is already set to something else', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    const emitSpy = vi.spyOn(component.optionsChanged, 'emit');
    hostComponent.selectedLanguageId.set('typescript');
    hostComponent.options.set({ framework: 'axios' });
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    component.onTargetChange('to_sdk_cli');
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit optionsChanged when onOptionsChange is called', async () => {
    hostFixture.detectChanges();
    await hostFixture.whenStable();
    component = hostFixture.debugElement.query(
      By.directive(LanguageSelectorComponent),
    ).componentInstance;

    const emitSpy = vi.spyOn(component.optionsChanged, 'emit');
    hostComponent.selectedLanguageId.set('typescript');
    hostComponent.options.set({ framework: 'fetch' });
    hostFixture.detectChanges();
    await hostFixture.whenStable();

    component.onOptionsChange('autoAdmin', true);
    expect(emitSpy).toHaveBeenCalledWith({
      languageId: 'typescript',
      options: { framework: 'fetch', autoAdmin: true },
    });
  });
});
