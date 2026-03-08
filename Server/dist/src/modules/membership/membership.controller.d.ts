import { MembershipService } from './membership.service';
export declare class MembershipController {
    private membership;
    constructor(membership: MembershipService);
    plans(): Promise<{
        name: string;
        productId: string;
        price: number;
        currency: string;
        period: string;
        isRecommended: boolean;
    }[]>;
}
