(() => {
    interface GroupConfig {
        label: string;
        color: string;
        name: string;
    }

    interface CacheEntry {
        groups: Array<string>;
        ts: number;
    }

    interface UserQueryResponse {
        query?: {
            users?: Array<{
                name?: string;
                missing?: boolean;
                groups?: Array<string>;
            }>;
        };
    }

    const USER_GROUPS: Record<string, GroupConfig> = {
        bureaucrat: { label: '政', color: '#6610f2', name: '行政员' },
        sysop: { label: '管', color: '#ec407a', name: '管理员' },
        'interface-admin': {
            label: '界',
            color: '#f55b42',
            name: '界面管理员',
        },
        patoller: { label: '巡', color: '#f77f38', name: '巡查员' },
        autoreviewer: { label: '免', color: '#1aa179', name: '巡查豁免者' },
        bot: { label: '机', color: '#1e88e5', name: '机器人' },
        flood: { label: '机', color: '#1e88e5', name: '机器用户' },
        confirmed: { label: '确', color: '#009688', name: '确认用户' },
    };

    const GROUP_ORDER = Object.keys(USER_GROUPS);
    const cache = new Map<string, CacheEntry>();
    const CACHE_TTL = 5 * 60 * 1000;

    const getUserGroups = async (
        usernames: Array<string>,
    ): Promise<Record<string, Array<string>>> => {
        const uncached: Array<string> = [];
        const result: Record<string, Array<string>> = {};

        for (const name of usernames) {
            const entry = cache.get(name);
            if (entry && Date.now() - entry.ts < CACHE_TTL) {
                result[name] = entry.groups;
            } else {
                uncached.push(name);
            }
        }

        if (!uncached.length) {
            return result;
        }

        try {
            const data = (await new mw.Api().get({
                action: 'query',
                list: 'users',
                ususers: uncached.join('|'),
                usprop: 'groups',
                formatversion: 2,
            })) as UserQueryResponse;

            for (const user of data.query?.users ?? []) {
                if (!user.missing && user.groups) {
                    const groups = user.groups.filter(g => USER_GROUPS[g]);
                    result[user.name!] = groups;
                    cache.set(user.name!, { groups, ts: Date.now() });
                }
            }
        } catch (e) {
            console.warn('获取用户组信息失败:', e);
        }

        return result;
    };

    const createIndicator = (
        groups: Array<string>,
    ): HTMLElement | null => {
        if (!groups?.length) {
            return null;
        }

        const sup = document.createElement('sup');
        sup.style.cssText =
            'font-size:85%;vertical-align:super;margin-left:2px;line-height:1';

        groups
            .sort(
                (a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b),
            )
            .forEach((group, i) => {
                const cfg = USER_GROUPS[group];
                if (!cfg) {
                    return;
                }
                const span = Object.assign(
                    document.createElement('span'),
                    {
                        textContent: cfg.label,
                        title: cfg.name,
                    },
                );
                span.style.cssText = `color:${cfg.color};cursor:help${
                    i ? ';margin-left:1px' : ''
                }`;
                sup.appendChild(span);
            });

        return sup;
    };

    const processUserLinks = async (): Promise<void> => {
        const links = Array.from(
            document.querySelectorAll<HTMLAnchorElement>(
                '.mw-userlink:not([data-gp]), .plainlinks .userlink:not([data-gp])',
            ),
        );
        if (!links.length) {
            return;
        }

        const linkMap = new Map<string, Array<HTMLAnchorElement>>();

        for (const link of links) {
            link.dataset['gp'] = '1';
            let name = '';

            if (link.classList.contains('mw-userlink')) {
                const m = link
                    .getAttribute('href')
                    ?.match(/User:([^/?#]+)/);
                if (m?.[1]) {
                    name = decodeURIComponent(m[1]).replace(/_/g, ' ');
                }
            } else {
                name = link.textContent!.trim();
            }

            if (!name) {
                continue;
            }
            if (!linkMap.has(name)) {
                linkMap.set(name, []);
            }
            linkMap.get(name)!.push(link);
        }

        const groups = await getUserGroups(Array.from(linkMap.keys()));

        for (const [name, userLinks] of Array.from(linkMap)) {
            const indicator = createIndicator(groups[name] ?? []);
            if (!indicator) {
                continue;
            }
            for (const link of userLinks) {
                if (link.nextElementSibling?.tagName !== 'SUP') {
                    link.after(indicator.cloneNode(true));
                }
            }
        }
    };

    const init = (): void => {
        void processUserLinks();

        new MutationObserver(mutations => {
            if (
                mutations.some(m =>
                    Array.from(m.addedNodes).some(
                        n =>
                            n.nodeType === 1 &&
                            (n as Element).querySelector?.(
                                '.mw-userlink, .plainlinks .userlink',
                            ),
                    ),
                )
            ) {
                setTimeout(() => void processUserLinks(), 100);
            }
        }).observe(document.body, { childList: true, subtree: true });
    };

    init();
})();
