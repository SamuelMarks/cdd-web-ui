import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OrganizationsComponent } from './organizations.component';
import { ReactiveFormsModule } from '@angular/forms';

describe('OrganizationsComponent', () => {
  let component: OrganizationsComponent;
  let fixture: ComponentFixture<OrganizationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizationsComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationsComponent);
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

    component.createOrgForm.controls.name.setValue('test');
    component.toggleCreateForm();
    expect(component.showCreateForm()).toBe(false);
    expect(component.createOrgForm.value.name).toBeNull();
  });

  it('should create organization when form is valid', () => {
    const initialCount = component.organizations().length;
    component.createOrgForm.controls.name.setValue('New Org');

    component.onCreateOrg();

    expect(component.organizations().length).toBe(initialCount + 1);
    expect(component.organizations()[initialCount].name).toBe('New Org');
  });

  it('should handle onCreateOrg when form name is falsy', () => {
    // We bypass the required validator to test the || '' fallback
    component.createOrgForm.controls.name.clearValidators();
    component.createOrgForm.controls.name.setValue(null);
    const initialCount = component.organizations().length;
    component.onCreateOrg();
    expect(component.organizations().length).toBe(initialCount + 1);
    expect(component.organizations()[initialCount].name).toBe('');
  });

  it('should not create organization when form is invalid', () => {
    const initialCount = component.organizations().length;
    component.createOrgForm.controls.name.setValue('');

    component.onCreateOrg();

    expect(component.organizations().length).toBe(initialCount);
  });

  it('should handle invite process', () => {
    const org = component.organizations()[0];
    const initialMembers = org.members;

    component.openInvite(org);
    expect(component.selectedOrgForInvite()).toEqual(org);

    // invalid form submit
    component.inviteForm.controls.email.setValue('invalid');
    component.onInvite();
    expect(component.organizations()[0].members).toBe(initialMembers);

    // valid form submit
    component.inviteForm.controls.email.setValue('test@test.com');
    component.inviteForm.controls.role.setValue('Admin');

    component.onInvite();

    expect(component.organizations()[0].members).toBe(initialMembers + 1);
    expect(component.selectedOrgForInvite()).toBeNull();
  });

  it('should close invite modal', () => {
    const org = component.organizations()[0];
    component.openInvite(org);
    component.closeInvite();
    expect(component.selectedOrgForInvite()).toBeNull();
  });

  it('should handle onInvite when selectedOrgForInvite is null', () => {
    component.inviteForm.setValue({ email: 'test@test.com', role: 'Member' });
    component.selectedOrgForInvite.set(null);
    component.onInvite();
    // It should not throw and should close the invite
    expect(component.selectedOrgForInvite()).toBeNull();
  });
});
