import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SplitPaneComponent } from './split-pane.component';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';

describe('SplitPaneComponent', () => {
  let component: SplitPaneComponent;
  let fixture: ComponentFixture<SplitPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitPaneComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SplitPaneComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('orientation', 'openapi-left');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize split position to 50%', () => {
    expect(component.splitPos()).toBe(50);
  });

  it('should set isDragging to true on mousedown', () => {
    const resizer = fixture.debugElement.query(By.css('.resizer'));
    resizer.triggerEventHandler('mousedown', new MouseEvent('mousedown'));
    expect(component.isDragging()).toBe(true);
  });

  it('should set isDragging to false on mouseup/mouseleave', () => {
    component.isDragging.set(true);
    
    const container = fixture.debugElement.query(By.css('.split-pane-container'));
    container.triggerEventHandler('mouseup', new MouseEvent('mouseup'));
    expect(component.isDragging()).toBe(false);
  });

  it('should set isDragging to false on mouseleave', () => {
    component.isDragging.set(true);
    const container = fixture.debugElement.query(By.css('.split-pane-container'));
    container.triggerEventHandler('mouseleave', new MouseEvent('mouseleave'));
    expect(component.isDragging()).toBe(false);
  });

  it('should not update split position if not dragging', () => {
    component.isDragging.set(false);
    component.onDrag(new MouseEvent('mousemove', { clientX: 100 }));
    expect(component.splitPos()).toBe(50);
  });

  it('should return early if container is missing during drag', () => {
     component.isDragging.set(true);
     const container = fixture.nativeElement.querySelector('.split-pane-container');
     container.parentNode.removeChild(container);
     
     component.onDrag(new MouseEvent('mousemove'));
     expect(component.splitPos()).toBe(50);
  });

  it('should update splitPos vertically if mobile', () => {
    component.isDragging.set(true);
    component.isMobile.set(true);
    
    const containerDebug = fixture.debugElement.query(By.css('.split-pane-container'));
    containerDebug.nativeElement.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 1000 });
    
    component.onDrag(new MouseEvent('mousemove', { clientY: 600 }));
    expect(component.splitPos()).toBe(60);
  });

  it('should update splitPos horizontally if not mobile', () => {
    component.isDragging.set(true);
    component.isMobile.set(false);
    
    const containerDebug = fixture.debugElement.query(By.css('.split-pane-container'));
    containerDebug.nativeElement.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 1000 });
    
    component.onDrag(new MouseEvent('mousemove', { clientX: 700 }));
    expect(component.splitPos()).toBe(70);
  });

  it('should clamp splitPos to 20% and 80%', () => {
    component.isDragging.set(true);
    component.isMobile.set(false);
    
    const containerDebug = fixture.debugElement.query(By.css('.split-pane-container'));
    containerDebug.nativeElement.getBoundingClientRect = () => ({ left: 0, width: 1000, top: 0, height: 1000 });
    
    component.onDrag(new MouseEvent('mousemove', { clientX: 100 })); // 10%
    expect(component.splitPos()).toBe(20); // Clamped

    component.onDrag(new MouseEvent('mousemove', { clientX: 900 })); // 90%
    expect(component.splitPos()).toBe(80); // Clamped
  });



  it('should checkMobile safely', () => {
    window.innerWidth = 500;
    component.checkMobile();
    expect(component.isMobile()).toBe(true);

    window.innerWidth = 1000;
    component.checkMobile();
    expect(component.isMobile()).toBe(false);
  });



  it('should emit swapClicked on shift+s shortcut', () => {
     let emitted = false;
     component.swapClicked.subscribe(() => emitted = true);

     const event = new KeyboardEvent('keydown', { key: 'S', shiftKey: true });
     component.handleKeydown(event);
     expect(emitted).toBe(true);
  });

  it('should not emit swapClicked if isExecuting is true', () => {
     let emitted = false;
     component.swapClicked.subscribe(() => emitted = true);
     fixture.componentRef.setInput('isExecuting', true);

     const event = new KeyboardEvent('keydown', { key: 's', shiftKey: true });
     component.handleKeydown(event);
     expect(emitted).toBe(false);
  });

  it('should not emit swapClicked if shiftKey is not pressed', () => {
     let emitted = false;
     component.swapClicked.subscribe(() => emitted = true);

     const event = new KeyboardEvent('keydown', { key: 's', shiftKey: false });
     component.handleKeydown(event);
     expect(emitted).toBe(false);
  });

  it('should ignore other keys', () => {
     let emitted = false;
     component.swapClicked.subscribe(() => emitted = true);

     const event = new KeyboardEvent('keydown', { key: 'a', shiftKey: true });
     component.handleKeydown(event);
     expect(emitted).toBe(false);
  });


  it('should compute runTooltip correctly', () => {
    fixture.componentRef.setInput('orientation', 'openapi-left');
    fixture.detectChanges();
    expect(component.runTooltip()).toBe('Generate Code (from_openapi)');

    fixture.componentRef.setInput('orientation', 'openapi-right');
    fixture.detectChanges();
    expect(component.runTooltip()).toBe('Generate OpenAPI (to_openapi)');
  });

});
