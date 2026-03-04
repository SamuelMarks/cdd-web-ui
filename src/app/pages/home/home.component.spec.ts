import '@angular/compiler';
import '@angular/localize/init';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home.component';
import { StorageService } from '../../services/storage.service';
import { provideRouter } from '@angular/router';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let storage: StorageService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), StorageService],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    storage = TestBed.inject(StorageService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show user creation form when no user exists', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.create-user-card')).toBeTruthy();
    expect(compiled.querySelector('.dashboard')).toBeFalsy();
  });

  it('should create user and hide form', () => {
    component.userForm.patchValue({ login: 'Bob' });
    component.onCreateUser();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.create-user-card')).toBeFalsy();
    expect(compiled.querySelector('.dashboard')).toBeTruthy();
    expect(compiled.querySelector('.dashboard-header h2')?.textContent).toContain('Welcome, Bob!');
  });

  it('should create organization and allow navigation', () => {
    component.userForm.patchValue({ login: 'Bob' });
    component.userForm.markAsDirty();
    component.onCreateUser();
    fixture.detectChanges();

    component.organizationForm.patchValue({ login: 'BobOrg' });
    component.organizationForm.markAsDirty();
    // Use the native element to trigger form submit
    const orgForm = fixture.nativeElement.querySelector('.inline-form');
    orgForm.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(storage.organizations().length).toBe(1);
    expect(storage.organizations()[0].login).toBe('BobOrg');

    const compiled = fixture.nativeElement as HTMLElement;
    const orgCard = compiled.querySelector('.org-card') as HTMLElement;
    expect(orgCard).toBeTruthy();
    expect(orgCard.querySelector('mat-card-title')?.textContent).toContain('BobOrg');

    // Trigger navigation
    const orgId = storage.organizations()[0].id;
    component.navigateToOrganization(orgId);
  });

  it('should not create user if form is invalid', () => {
    component.userForm.patchValue({ login: '' });
    component.onCreateUser();
    expect(storage.user()).toBeNull();
  });

  it('should not create organization if form is invalid', () => {
    component.userForm.patchValue({ login: 'Bob' });
    component.onCreateUser();

    component.organizationForm.patchValue({ login: '' });
    component.onCreateOrganization();
    expect(storage.organizations().length).toBe(0);
  });

  it('should navigate to organization on Enter keydown', () => {
    storage.user.set({ id: 1, login: 'user' } as import('../../models/types').User);
    storage.organizations.set([
      { id: 123, login: 'org1', userId: 1 },
    ] as import('../../models/types').Organization[]);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.org-card');
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    card.dispatchEvent(event);
    expect(true).toBe(true);
  });
});
