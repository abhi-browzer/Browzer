
export interface InternalPage {
    title: string;
    path: string;
}

export const INTERNAL_PAGES: InternalPage[] = [
    {
        title: 'Authentication',
        path: 'auth',
    },
    {
        title: 'Settings',
        path: 'settings',
    },
    {
        title: 'History',
        path: 'history',
    },
    {
        title: 'Recordings',
        path: 'recordings',
    },
    {
        title: 'Automation',
        path: 'automation',
    }
];
