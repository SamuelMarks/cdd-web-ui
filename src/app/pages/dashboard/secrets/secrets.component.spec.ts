import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecretsComponent } from './secrets.component';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from '../../../services/auth.service';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('SecretsComponent', () => {
  let component: SecretsComponent;
  let fixture: ComponentFixture<SecretsComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [SecretsComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: {} }
      ]
    })
    .compileComponents();
    
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

  it('should save tokens', () => {
    expect(component.tokensState().status).toBe('idle');
    
    component.onSaveTokens();
    expect(component.tokensState().status).toBe('loading');
    
    vi.advanceTimersByTime(1000);
    expect(component.tokensState().status).toBe('success');
    expect(component.tokensForm.pristine).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(component.tokensState().status).toBe('idle');
  });

  it('should trigger generate action success', () => {
    component.triggerAction('generate');
    expect(component.generateState().status).toBe('loading');
    
    vi.advanceTimersByTime(1500);
    expect(component.generateState().status).toBe('success');
    
    vi.advanceTimersByTime(5000);
    expect(component.generateState().status).toBe('idle');
  });

  it('should trigger publish action success', () => {
    component.triggerAction('publish');
    expect(component.publishState().status).toBe('loading');
    
    vi.advanceTimersByTime(1500);
    expect(component.publishState().status).toBe('success');
    
    vi.advanceTimersByTime(5000);
    expect(component.publishState().status).toBe('idle');
  });
});
