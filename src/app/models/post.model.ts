// 1. USER MODEL
export interface User {
    uid: string;
    email: string;
    displayName: string;
    phone: string;
    favorites: string[]; // ['post_id_1', 'post_id_2']
    createdAt: any;
}

export interface Association{
    id: string;
    encargado:string;
    nameAssociation:string;
    description:string;
    categoria:string;
    email: string;
    phone: string;
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    verificationStatus: 'pending' | 'verified' | 'rejected';
}

// 2. POST MODEL
export interface Post {
    id?: string;
    authorId: string;
    authorName: string;
    authorPhone:string;
    type: 'request' | 'offer';
    title: string;
    description: string;
    suppliesList: string[];
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    schedule: string;
    status: 'open' | 'in_progress' | 'solved' | 'closed';
    applicantsCount: number;
    createdAt: any;
}

// 3. APPLICANT MODEL
export interface PostApplicant {
    uid: string;
    applicantId: string;
    postId: string;
    helperName: string;
    helperPhone: string;
    helperEmail: string;
    message: string;
    status: 'pending' | 'accepted' | 'rejected' | 'completed';
    timestamp: any;
}