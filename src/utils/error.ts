export function fatalError(...args: any[]): never {
    const message = args.join(' ');
    console.error('FATAL ERROR:', message);
    throw new Error(message);
}