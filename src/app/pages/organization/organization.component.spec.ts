import '@angular/compiler';
import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrganizationComponent } from './organization.component';
import { StorageService } from '../../services/storage.service';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

describe('OrganizationComponent', () => {
  let component: OrganizationComponent;
  let fixture: ComponentFixture<OrganizationComponent>;
  let storage: StorageService;

  const mockRoute = {
    paramMap: of(new Map([['id', 'prog-1']])),
  };

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [OrganizationComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: mockRoute },
        StorageService,
      ],
    }).compileComponents();

    storage = TestBed.inject(StorageService);
    // Setup test data
    storage.createUser('Alice');
    const prog = storage.createOrganization('Test Prog');
    // Force ID to match route
    storage.organizations.set([{ ...prog, id: 'prog-1' }]);

    fixture = TestBed.createComponent(OrganizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display organization name', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Organization: Test Prog');
  });

  it('should return empty repositories if no org id', () => {
    component.organizationId.set(null);
    expect(component.repositories()).toEqual([]);
  });

  it('should create a repository', () => {
    component.repositoryForm.patchValue({ name: 'New Repository' });
    component.onCreateRepository();
    fixture.detectChanges();

    expect(storage.repositories().length).toBe(1);
    expect(storage.repositories()[0].name).toBe('New Repository');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.repo-card').length).toBe(1);
    expect(compiled.querySelector('.repo-card mat-card-title')?.textContent).toContain(
      'New Repository',
    );
  });

  it('should not create repository if form is invalid', () => {
    component.repositoryForm.patchValue({ name: '' });
    component.onCreateRepository();
    expect(storage.repositories().length).toBe(0);
  });

  it('should show not found when organization id does not match', async () => {
    // Reconfigure route with bad id
    const badRoute = { paramMap: of(new Map([['id', 'bad-id']])) };
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OrganizationComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: badRoute },
        StorageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Organization not found');
  });

  it('should trigger onCreateRepository on form submit', () => {
    storage.organizations.set([{ id: '123', login: 'org1', userId: 1 }]);
    component.repositoryForm.setValue({ name: 'test-repo' });
    fixture.detectChanges();
    const spy = vi.spyOn(storage, 'createRepository').mockImplementation(() => ({}) as never);
    component.onCreateRepository();
    expect(spy).toHaveBeenCalledWith('prog-1', 'test-repo');
  });
});
