declare global {
    interface Window {
        LocalObjectStorage: typeof LocalObjectStorage;
    }
}
interface Moment {
    add(amount: number, unit: string): this;
    valueOf(): number;
}
declare const moment: () => Moment;
interface Transformer {
    type: string;
    match: (value: unknown) => boolean;
    encode: (value: unknown) => string;
    decode: (value: string) => unknown;
}

const builtinTransformers: Transformer[] = [
    {
        type: 'undefined',
        match: t => typeof t === 'undefined',
        encode: () => 'undefined',
        decode: () => undefined,
    },
    {
        type: 'bigint',
        match: t => typeof t === 'bigint',
        encode: b => String(b),
        decode: b => BigInt(b),
    },
    {
        type: 'date',
        match: t => t instanceof Date,
        encode: d => (d as Date).toISOString(),
        decode: d => new Date(d),
    },
    {
        type: 'set',
        match: t => t instanceof Set,
        encode: s => JSON.stringify([...(s as Set<unknown>).values()]),
        decode: s => new Set(JSON.parse(s)),
    },
    {
        type: 'map',
        match: t => t instanceof Map,
        encode: m => JSON.stringify([...(m as Map<unknown, unknown>).entries()]),
        decode: m => new Map(JSON.parse(m)),
    },
    {
        type: 'regexp',
        match: t => t instanceof RegExp,
        encode: r => String(r),
        decode: r => new RegExp(r.slice(1, r.length - 1)),
    },
];
const externalTransformers: Transformer[] = [];

class LocalObjectStorage {
    static #EXPIRES_PREFIX = '__EXPIRES__';
    #keyPrefix: string;
    #expires?: [number, string];

    static plugins: {
        transformers: {
            readonly list: Transformer[];
            add: (transformer: Transformer) => boolean;
        };
    } = {
        transformers: {
            get list(): Transformer[] {
                return externalTransformers.map(tf => Object.assign(Object.create(null), tf));
            },
            add: ({ type, match, decode, encode }: Transformer): boolean => {
                if (type.includes('|')) {
                    console.error(
                        `LocalObjectStorage can't accept type name "${type}" including "|", skip...`,
                    );
                    return false;
                }
                if (['JSON'].includes(type)) {
                    console.error(
                        `LocalObjectStorage can't accept type name "${type}" from custom transformers, skip...`,
                    );
                    return false;
                }
                if (
                    [...builtinTransformers, ...LocalObjectStorage.plugins.transformers.list].some(
                        ({ type: eType }) => eType === type,
                    )
                ) {
                    console.error(
                        `LocalObjectStorage can't accept duplicated type name "${type}" from custom transformers, skip...`,
                    );
                    return false;
                }
                if (
                    typeof match !== 'function' ||
                    typeof decode !== 'function' ||
                    typeof encode !== 'function'
                ) {
                    console.error(
                        `LocalObjectStorage can't accept broken transformer [ type: "${type}", match: ${typeof match}, decode: ${typeof decode}, encode: ${typeof encode} ], skip...`,
                    );
                    return false;
                }
                externalTransformers.push({ type, match, decode, encode });
                return true;
            },
        },
    };
    constructor(prefix = '', { expires }: { expires?: [number, string] } = {}) {
        if (prefix === 'default') {
            throw new Error(`LocalObjectStorage can't accept prefix "${prefix}".`);
        }
        if (prefix.includes('/')) {
            throw new Error(`LocalObjectStorage can't accept prefix "${prefix}" including "/".`);
        }
        this.#keyPrefix = `AnnTool-localObjectStorage/${prefix?.length > 0 ? `${prefix}/` : 'default/'}`;
        if (expires !== undefined) {
            if (!Array.isArray(expires) || expires.length !== 2) {
                throw new Error("LocalObjectStorage can't accept invalid expires option.");
            }
            this.#expires = expires;
        }
    }
    get _keyPrefix() {
        return this.#keyPrefix;
    }
    #calcExpiresAtPrefix = (expires?: [number, string]): string => {
        if (!this.#expires) {
            return '';
        }
        return (
            `${LocalObjectStorage.#EXPIRES_PREFIX}` +
            moment()
                .add(expires?.[0] ?? this.#expires[0], expires?.[1] ?? this.#expires[1])
                .valueOf() +
            `|`
        );
    };
    #getAllKeys = (): string[] =>
        Object.keys(localStorage).filter(key => key.startsWith(this.#keyPrefix));
    getAllKeys() {
        return this.#getAllKeys().map(n => n.replace(this.#keyPrefix, ''));
    }
    get length() {
        return this.#getAllKeys().length;
    }
    getItem(key: string, fallback?: unknown): unknown {
        let value = localStorage.getItem(`${this.#keyPrefix}${key}`);
        if (value === null) {
            return fallback ?? value;
        }
        if (value.startsWith(LocalObjectStorage.#EXPIRES_PREFIX)) {
            const separatorIndex = value.indexOf('|');
            if (separatorIndex !== -1) {
                try {
                    const expiresAt = +value.slice(
                        LocalObjectStorage.#EXPIRES_PREFIX.length,
                        separatorIndex,
                    );
                    const maxExpiresAt = this.#expires
                        ? moment().add(this.#expires[0], this.#expires[1]).valueOf()
                        : Number.MAX_SAFE_INTEGER;
                    if (Date.now() >= expiresAt) {
                        console.info(
                            `LocalObjectStorage key "${key}" is expired, removing item...`,
                        );
                        this.removeItem(key);
                        return fallback ?? null;
                    }
                    if (expiresAt > maxExpiresAt) {
                        console.warn(
                            `LocalObjectStorage key "${key}" exceeds max expires, removing item...`,
                        );
                        this.removeItem(key);
                        return fallback ?? null;
                    }
                    value = value.slice(separatorIndex + 1);
                } catch (e) {
                    console.error(
                        `LocalObjectStorage can't parse expires prefix of key ${key}, removing item...`,
                        e,
                    );
                    this.removeItem(key);
                    return fallback ?? null;
                }
            }
        } else if (this.#expires) {
            console.warn(
                `LocalObjectStorage key ${key} is missing expires prefix but the instance has expires option, removing item...`,
            );
            this.removeItem(key);
            return fallback ?? null;
        }
        for (const { type, decode } of builtinTransformers.concat(
            LocalObjectStorage.plugins.transformers.list,
        )) {
            if (type.includes('|')) {
                console.error(
                    `LocalObjectStorage can't accept type name ${type} including "|", skip...`,
                );
                continue;
            }
            if (type === 'JSON') {
                console.error(
                    `LocalObjectStorage can't accept type name ${type} from custom transformers, skip...`,
                );
                continue;
            }
            if (value.startsWith(`${type}|`)) {
                try {
                    return decode(value.replace(`${type}|`, ''));
                } catch {
                    console.error(
                        `LocalObjectStorage can's transform value of key ${key} to type ${type} and skip...`,
                    );
                }
            }
        }
        try {
            return JSON.parse(value.replace('JSON|', ''));
        } catch (e) {
            console.error(
                `LocalObjectStorage can's transform value of key ${key} to JSON and return \`undefined\`...`,
                e,
            );
            return undefined;
        }
    }
    setItem(key: string, value: unknown, { expires }: { expires?: [number, string] } = {}): void {
        for (const { type, match, encode } of builtinTransformers.concat(
            LocalObjectStorage.plugins.transformers.list,
        )) {
            if (type.includes('|')) {
                console.error(
                    `LocalObjectStorage can't accept type name ${type} including "|", skip...`,
                );
                continue;
            }
            if (type === 'JSON') {
                console.error(`LocalObjectStorage can't accept type name ${type}, skip...`);
                continue;
            }
            if (match(value)) {
                try {
                    localStorage.setItem(
                        `${this.#keyPrefix}${key}`,
                        `${this.#calcExpiresAtPrefix(expires)}${type}|${encode(value)}`,
                    );
                    return;
                } catch (e) {
                    console.error(
                        `LocalObjectStorage can's transform value of key ${key} from type ${type} and skip...`,
                        e,
                    );
                }
            }
        }
        try {
            localStorage.setItem(
                `${this.#keyPrefix}${key}`,
                `${this.#calcExpiresAtPrefix(expires)}JSON|${JSON.stringify(value)}`,
            );
        } catch (e) {
            console.error(
                `LocalObjectStorage can's transform value of key ${key} from JSON and skip...`,
                e,
            );
        }
    }
    removeItem(key: string): void {
        localStorage.removeItem(`${this.#keyPrefix}${key}`);
    }
    clear(): void {
        this.#getAllKeys().forEach(key => {
            localStorage.removeItem(key);
        });
    }
    key(index: number): string | undefined {
        return this.#getAllKeys()[index];
    }
}

(() => {
    window.LocalObjectStorage = LocalObjectStorage;
})();
