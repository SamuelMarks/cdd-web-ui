import { routes } from './app.routes';

describe('AppRoutes', () => {
  it('should create routes', () => {
    expect(routes).toBeTruthy();
    expect(routes.length).toBeGreaterThan(0);
  });

  it('should lazy load workspace component', async () => {
    const route = routes.find((r) => r.path === '');
    expect(route).toBeDefined();
    if (route && route.loadComponent) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
  });

  it('should lazy load login component', async () => {
    const route = routes.find((r) => r.path === 'login');
    expect(route).toBeDefined();
    if (route && route.loadComponent) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
  });

  it('should lazy load auth callback component', async () => {
    const route = routes.find((r) => r.path === 'auth-callback');
    expect(route).toBeDefined();
    if (route && route.loadComponent) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
  });

  it('should lazy load dashboard component and have authGuard', async () => {
    const route = routes.find((r) => r.path === 'dashboard');
    expect(route).toBeDefined();
    expect(route?.canActivate).toBeTruthy();
    if (route && route.loadComponent) {
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
  });

  it('should lazy load dashboard child routes', async () => {
    const route = routes.find((r) => r.path === 'dashboard');
    const children = route?.children || [];

    const orgRoute = children.find((r) => r.path === 'organizations');
    expect(orgRoute).toBeDefined();
    if (orgRoute && orgRoute.loadComponent) {
      const component = await (orgRoute.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }

    const repRoute = children.find((r) => r.path === 'repositories');
    expect(repRoute).toBeDefined();
    if (repRoute && repRoute.loadComponent) {
      const component = await (repRoute.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
  });
});
