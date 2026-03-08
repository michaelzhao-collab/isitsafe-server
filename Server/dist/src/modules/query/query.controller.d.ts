import { QueryService } from './query.service';
export declare class QueryController {
    private query;
    constructor(query: QueryService);
    phone(content: string, userId?: string): Promise<any>;
    url(content: string, userId?: string): Promise<any>;
    company(content: string, userId?: string): Promise<any>;
    tags(): Promise<any>;
}
