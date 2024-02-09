export type DisplayHost = {
    print: () => {
        prefix: string;
        suffix?: string;
        lines?: string[];
    };
    inputChanged?: (input: string) => void;
    handleKey?: (key: string, display: Display) => boolean;
};
export type Display = {
    promise: Promise<string>;
    stop: () => void;
    update: () => void;
    setInput: (input: string) => void;
    isStopped: () => boolean;
};
export declare function startDisplay(host: DisplayHost): Display;
