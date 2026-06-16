import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RepositoriesComponent } from './repositories.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('RepositoriesComponent', () => {
  let component: RepositoriesComponent;
  let fixture: ComponentFixture<RepositoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RepositoriesComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(RepositoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle create form', () => {
    expect(component.showCreateForm()).toBe(false);
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(true);

    component.createRepoForm.controls.name.setValue('test');
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(false);
    expect(component.createRepoForm.value.name).toBeNull();
  });

  it('should create repo when form is valid', () => {
    const initialCount = component.repositories().length;
    component.createRepoForm.controls.name.setValue('new/repo');
    component.createRepoForm.controls.organization.setValue('Offscale');

    component.onCreateRepo();

    expect(component.repositories().length).toBe(initialCount + 1);
    expect(component.repositories()[initialCount].name).toBe('new/repo');
  });

  it('should handle onCreateRepo when form values are falsy', () => {
    component.createRepoForm.controls.name.clearValidators();
    component.createRepoForm.controls.organization.clearValidators();
    component.createRepoForm.setValue({ name: null, organization: null });

    const initialCount = component.repositories().length;
    component.onCreateRepo();

    expect(component.repositories().length).toBe(initialCount + 1);
    expect(component.repositories()[initialCount].name).toBe('');
    expect(component.repositories()[initialCount].organization).toBe('Offscale');
  });

  it('should not create repo when form is invalid', () => {
    const initialCount = component.repositories().length;
    component.createRepoForm.controls.name.setValue('');

    component.onCreateRepo();

    expect(component.repositories().length).toBe(initialCount);
  });

  it('should handle schema config', () => {
    const repo = component.repositories()[0];
    component.openSchemaConfig(repo);
    expect(component.selectedRepoForSchema()).toEqual(repo);

    component.schemaForm.controls.schemaUrl.setValue('http://new-schema');
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe('http://new-schema');
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should handle schema config when repo has no schemaUrl and schemaForm has falsy url', () => {
    const repo = component.repositories()[0];
    const repoWithoutSchema = { ...repo, schemaUrl: undefined };

    component.openSchemaConfig(repoWithoutSchema);
    expect(component.schemaForm.value.schemaUrl).toBe('');

    component.schemaForm.controls.schemaUrl.clearValidators();
    component.schemaForm.controls.schemaUrl.setValue(null);
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe('');
  });

  it('should handle schema config when selectedRepoForSchema is null', () => {
    component.schemaForm.controls.schemaUrl.setValue('http://new-schema');
    component.selectedRepoForSchema.set(null);
    component.onSaveSchema();
    // Should not throw
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should not save schema config if invalid', () => {
    const repo = component.repositories()[0];
    const origUrl = repo.schemaUrl;
    component.openSchemaConfig(repo);

    component.schemaForm.controls.schemaUrl.setValue('');
    component.onSaveSchema();

    expect(component.repositories()[0].schemaUrl).toBe(origUrl);
  });

  it('should close schema config', () => {
    const repo = component.repositories()[0];
    component.openSchemaConfig(repo);
    component.closeSchemaConfig();
    expect(component.selectedRepoForSchema()).toBeNull();
  });

  it('should handle language config open/close', () => {
    const repo = component.repositories()[0];
    component.openLangConfig(repo);
    expect(component.selectedRepoForLang()).toEqual(repo);

    component.closeLangConfig();
    expect(component.selectedRepoForLang()).toBeNull();
  });

  it('should toggle language', () => {
    const repo = component.repositories()[0]; // languages: ['TypeScript', 'Rust', 'Python']
    component.openLangConfig(repo);

    expect(component.isLangSelected('TypeScript')).toBe(true);
    expect(component.isLangSelected('Go')).toBe(false);

    component.toggleLang('Go'); // add Go
    expect(component.repositories()[0].languages).toContain('Go');
    expect(component.isLangSelected('Go')).toBe(true);

    component.toggleLang('TypeScript'); // remove TS
    expect(component.repositories()[0].languages).not.toContain('TypeScript');
    expect(component.isLangSelected('TypeScript')).toBe(false);
  });

  it('should safely handle toggleLang when no repo selected', () => {
    component.selectedRepoForLang.set(null);
    expect(() => component.toggleLang('Go')).not.toThrow();
  });

  it('should return false for isLangSelected when no repo selected', () => {
    component.selectedRepoForLang.set(null);
    expect(component.isLangSelected('Go')).toBe(false);
  });
});
