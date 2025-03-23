export interface Repository<T> {

    save(entity: T): Promise<T>;

    findById(id: string): Promise<T | null>;

    deleteById(id: string): Promise<boolean>;

    find(query: Record<string, unknown>, options?: QueryOptions): Promise<T[]>;

    count(query: Record<string, unknown>): Promise<number>;
}

export interface QueryOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
} 