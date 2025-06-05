export function fatalError(...args: any[]): never {
    const message = args.join(' ');
    console.error('FATAL ERROR:', message);
    throw new Error(message);
}

export class OperationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OperationError';
    }
}