import { IncomingMessage, ServerResponse } from 'http';

export type RouteParams = Record<string, string>;

export type RequestHandler = (req: IncomingMessage, res: ServerResponse, params: RouteParams) => Promise<void>;


export enum HttpMethod {
    GET = 'GET',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    OPTIONS = 'OPTIONS'
}

export interface Route {
    path: string;
    method: HttpMethod;
    handler: RequestHandler;
}


export interface Router {
    register(method: HttpMethod, path: string, handler: RequestHandler): void;

    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
} 