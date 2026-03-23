import { routes } from './app.routes';

describe('AppRoutes', () => {
  it('should create routes', () => {
    expect(routes).toBeTruthy();
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should lazy load workspace component', async () => {
    const route = routes.find(r => r.path === '');
    expect(route).toBeDefined();
    if (route && route.loadComponent) {
      const component = await (route.loadComponent as Function)();
      expect(component).toBeTruthy();
    }
  });
});

