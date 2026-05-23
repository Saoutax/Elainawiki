(() => {
    const { wgPageName, wgFormattedNamespaces } = mw.config.get([
        'wgPageName',
        'wgFormattedNamespaces',
    ]);

    if (
        !(
            wgPageName === 'MediaWiki:Gadgets-definition' &&
            document.querySelector('.mw-parser-output')
        )
    ) {
        return;
    }

    const link = document.createElement('a');
    const makeLink = (href: string, text: string): string => {
        link.href = href;
        link.textContent = text;
        return link.outerHTML;
    };

    const makeWikilink = (page: string, text?: string): string =>
        makeLink(mw.util.getUrl(page), text || page);

    const linkGadgetSource = (sourcePage: string): string =>
        makeWikilink(`MediaWiki:Gadget-${sourcePage}`, sourcePage);

    const gadgetNameRegex = /^(\s*)([\w_-]+)\s*/;

    const makeGadgetId = (gadgetName: string): string => `Gadget-${gadgetName}`;

    const linkGadgetAnchor = (gadgetName: string, text?: string): string =>
        makeLink(`#${makeGadgetId(gadgetName)}`, text || gadgetName);

    const getGadgetName = (innerHTML: string): string | null => {
        const match = gadgetNameRegex.exec(innerHTML);
        return match ? (match[2] ?? null) : null;
    };

    const mapValues = (value: string, transformer: (s: string) => string): string =>
        value.replace(/([^,\s](?:[^,]*[^,\s])*)(?=\s*(?:,|$))/g, transformer);

    const processOptionValue = (
        _wholeMatch: string,
        key: string,
        whitespace1: string,
        whitespace2: string,
        value: string,
    ): string => {
        let formattedValue = value;
        switch (key) {
            case 'dependencies':
                formattedValue = mapValues(value, (dependency: string): string => {
                    const gadgetName = /^ext\.gadget\.(.+)$/.exec(dependency);
                    if (gadgetName && gadgetName[1]) {
                        return linkGadgetAnchor(gadgetName[1], dependency);
                    }
                    return makeWikilink(`mw:ResourceLoader/Core modules#${dependency}`, dependency);
                });
                break;
            case 'rights':
                key = makeWikilink('mw:Manual:User_rights#List_of_permissions', key);
                break;
            case 'skins': {
                key = makeWikilink('mw:Manual:Skins', 'skins');
                formattedValue = mapValues(value, (skin: string): string =>
                    makeWikilink(`mw:Skin:${skin}`, skin),
                );
                break;
            }
            case 'peers':
                formattedValue = mapValues(value, linkGadgetAnchor);
                break;
            case 'namespaces': {
                formattedValue = mapValues(value, (namespaceId: string): string => {
                    const namespaceNumber = parseInt(namespaceId);
                    if (!isNaN(namespaceNumber)) {
                        const namespaceName = wgFormattedNamespaces[namespaceNumber];
                        if (namespaceName !== undefined) {
                            const abbr = document.createElement('abbr');
                            abbr.title = namespaceName === '' ? '(main)' : namespaceName;
                            abbr.textContent = namespaceId;
                            return abbr.outerHTML;
                        }
                    }
                    return namespaceId;
                });
                break;
            }
            case 'categories':
                formattedValue = mapValues(value, (categoryName: string): string =>
                    makeWikilink(`Category:${categoryName}`, categoryName),
                );
                break;
        }
        return `${key}${whitespace1}=${whitespace2}${formattedValue.replace(/\s*,\s*/g, ', ')}`;
    };

    const processGadgetDefinition = (innerHTML: string): string =>
        innerHTML
            .replace(
                gadgetNameRegex,
                (_wholeMatch: string, whitespace: string, gadgetName: string): string =>
                    `${whitespace}${linkGadgetSource(gadgetName)} `,
            )
            .replace(/([\w_\-.]+\.(?:css|js(?:on)?))/g, linkGadgetSource)
            .replace(/(\s*)\|(\s*)/g, ' | ')
            .replace(/([a-z]+)(\s*)=(\s*)(.+?)(?=\s*[|\]])/g, processOptionValue);

    $(() => {
        const $parserOutput = $('.mw-parser-output');

        $parserOutput
            .find('li:not(.gadgets-validation li)')
            .each((_i: number, element: Element): void => {
                const gadgetName = getGadgetName(element.innerHTML);
                if (gadgetName) {
                    element.id = makeGadgetId(gadgetName);
                }
                element.innerHTML = processGadgetDefinition(element.innerHTML);
            });

        $parserOutput
            .find('pre:not(.gadgets-validation pre)')
            .each((_i: number, element: Element): void => {
                element.innerHTML = element.innerHTML.replace(/[^\n]+/g, processGadgetDefinition);
            });
    });
})();
