import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { HttpMethod, RequestHandler, Route, RouteParams, Router as RouterInterface } from './interface';
import { httpLogger as logger } from '../../common/logger';
import { NotFoundError, MethodNotAllowedError } from '../../common/errors/application-error';
import { sendError, setCorsHeaders } from '../../common/utils/http';

export class Router implements RouterInterface {
    private routes: Route[] = [];
    private routeCache: Map<string, Route> = new Map();

    public register(method: HttpMethod, path: string, handler: RequestHandler): void {
        const route = { method, path, handler };
        this.routes.push(route);

        if (!path.includes(':')) {
            this.routeCache.set(`${method}:${path}`, route);
        }

        logger.debug(`Registered route: ${method} ${path}`);
    }

    public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const startTime = process.hrtime();

        setCorsHeaders(res, req);

        if (req.method === 'OPTIONS') {
            this.handleOptions(req, res);
            return;
        }

        try {
            const method = req.method as HttpMethod;
            const url = this.parseUrl(req);
            const path = url.pathname;

            logger.debug(`Handling request: ${method} ${path}`);

            const { route, params } = this.findRoute(method, path);

            if (!route) {
                const routesForPath = this.findRoutesForPath(path);
                if (routesForPath.length > 0) {
                    throw new MethodNotAllowedError(
                        `Method ${method} not allowed for path ${path}. Allowed methods: ${routesForPath.map(r => r.method).join(', ')}`
                    );
                }
                throw new NotFoundError(`No route found for ${method} ${path}`);
            }

            await route.handler(req, res, params);
            const [seconds, nanoseconds] = process.hrtime(startTime);
            logger.debug(`Request handled in ${seconds}s ${nanoseconds / 1000000}ms`);
        } catch (error) {
            sendError(res, error as Error);
        }
    }

    private handleOptions(req: IncomingMessage, res: ServerResponse): void {
        const url = this.parseUrl(req);
        const path = url.pathname;
        const routesForPath = this.findRoutesForPath(path);
        const allowedMethods = routesForPath.map(r => r.method);
        res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
        res.statusCode = 204;
        res.end();
        logger.debug(`OPTIONS request handled for path: ${path}`);
    }

    private findRoutesForPath(path: string): Route[] {
        return this.routes.filter(route => {
            if (route.path === path) {
                return true;
            }

            if (route.path.includes(':')) {
                const pattern = this.pathToRegExp(route.path);
                return pattern.test(path);
            }

            return false;
        });
    }

    private findRoute(method: HttpMethod, path: string): { route: Route | null; params: RouteParams } {
        const cachedRoute = this.routeCache.get(`${method}:${path}`);
        if (cachedRoute) {
            return { route: cachedRoute, params: {} };
        }

        for (const route of this.routes) {
            if (route.method !== method) {
                continue;
            }

            if (route.path === path) {
                return { route, params: {} };
            }

            if (route.path.includes(':')) {
                const params = this.extractParams(route.path, path);
                if (params) {
                    return { route, params };
                }
            }
        }

        return { route: null, params: {} };
    }

    private extractParams(routePath: string, actualPath: string): RouteParams | null {
        const routeParts = routePath.split('/');
        const pathParts = actualPath.split('/');

        if (routeParts.length !== pathParts.length) {
            return null;
        }

        const params: RouteParams = {};

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const pathPart = pathParts[i];

            if (routePart.startsWith(':')) {
                const paramName = routePart.substring(1);
                params[paramName] = pathPart;
            }
            else if (routePart !== pathPart) {
                return null;
            }
        }

        return params;
    }

    private pathToRegExp(path: string): RegExp {
        const escapedPath = path
            .replace(/\//g, '\\/')
            .replace(/:\w+/g, '([^/]+)');

        return new RegExp(`^${escapedPath}$`);
    }

    private parseUrl(req: IncomingMessage): URL {
        const protocol = 'http';
        const host = req.headers.host || 'localhost';
        const url = new URL(`${protocol}://${host}${req.url || '/'}`);

        return url;
    }

    public get(path: string, handler: RequestHandler): void {
        this.register(HttpMethod.GET, path, handler);
    }

    public post(path: string, handler: RequestHandler): void {
        this.register(HttpMethod.POST, path, handler);
    }

    public put(path: string, handler: RequestHandler): void {
        this.register(HttpMethod.PUT, path, handler);
    }

    public delete(path: string, handler: RequestHandler): void {
        this.register(HttpMethod.DELETE, path, handler);
    }
}

export const router = new Router();
export default router; 