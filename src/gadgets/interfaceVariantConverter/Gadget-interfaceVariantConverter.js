// WARNING: This script would break if source wikitext contains <pre> tags, won't fix.
$(() =>
    (async () => {
        const { wgPageName, wgUserName, wgArticleId } = mw.config.get([
            'wgPageName',
            'wgUserName',
            'wgArticleId',
        ]);

        const basepage = wgPageName.replace(/\/.*?$/, '');
        const api = new mw.Api();

        const lrAivc = {
            main: ['zh-cn', 'zh-tw', 'zh-hk'],
            dependent: {
                '(main)': 'zh-cn',
                'zh-hans': 'zh-cn',
                'zh-hant': 'zh-tw',
            },
            noteTA: { G1: 'MediaWiki' },
            autoPopulate: true,
            useOpenCC: true,
            manualAction: {
                'zh-hk': t => t.replaceAll('户', '戶'),
                'zh-tw': t => t.replaceAll('名稱空間', '命名空間').replaceAll('記憶體', '內存'),
            },
            watchlist: 'nochange',
            ...window.lr_aivc,
        };

        let prepopContent = '';
        if (lrAivc.autoPopulate) {
            try {
                const result = await api.get({
                    action: 'parse',
                    assertuser: wgUserName,
                    pageid: wgArticleId,
                    prop: 'wikitext',
                });
                prepopContent = result.parse.wikitext['*'];
            } catch {
                /* silent */
            }
        }

        const toParams = obj =>
            Object.entries(obj)
                .map(([k, v]) => `${k}=${v}`)
                .join('|');

        const variantPage = variant => (variant === '(main)' ? basepage : `${basepage}/${variant}`);

        const REGEXP = {
            lcMarker: /-{([\s\S]*?)}-/g,
            lcMarkerEsc: /-\\{([\s\S]*?)}\\-/g,
            nowiki: /<nowiki>([\s\S]*?)<\/nowiki>/g,
            link: /\[\[([\s\S]*?)(?:#([\s\S]*?))?(\|[\s\S]*?)?\]\]/g,
            extLink: /([^[])\[([^[]+?)( [\s\S]+?)?\]([^\]])/g,
            template: /\{\{([\s\S]*?)\}\}/g,
            htmlEntity: /&([a-zA-Z0-9#]+);/g,
            noOCC: /<!--noOCC-->([\s\S]*?)<!--\/noOCC-->/gi,
        };

        const escapeWikitext = original => {
            const nowikis = [];
            const mappings = [];
            const push = val => mappings.push(val) - 1;

            let t = original;

            // Preserve LC markers (including those within nowiki)
            t = t.replace(REGEXP.lcMarker, (_, c) => `-\\{${c}}\\-`);

            // Strip nowiki temporarily
            t = t.replace(REGEXP.nowiki, (_, c) => `<nowiki>${nowikis.push(c) - 1}</nowiki>`);

            // Replace link targets / anchors with IDs
            t = t.replace(REGEXP.link, (match, target, anchor, text) =>
                anchor || text
                    ? `[[${text ? push(target) : target}${anchor ? `#${push(anchor)}` : ''}${text ?? ''}]]`
                    : match,
            );

            // Replace external link targets with IDs
            t = t.replace(
                REGEXP.extLink,
                (_, before, target, text, after) =>
                    `${before}[${push(target)}${text ?? ''}]${after}`,
            );

            // Replace template names and named-parameter keys with IDs
            t = t.replace(REGEXP.template, (_, params) => {
                const [name, ...parts] = params.split('|');
                push(name);
                const restored = parts.reduce(
                    (acc, param) => {
                        const eqIdx = param.indexOf('=');
                        return eqIdx === -1
                            ? `${acc}|${param}`
                            : `${acc}|${push(param.slice(0, eqIdx))}=${param.slice(eqIdx + 1)}`;
                    },
                    `{{${mappings.length - 1}`,
                );
                return `${restored}}}`;
            });

            // Replace LC markers with IDs
            t = t.replace(REGEXP.lcMarkerEsc, (_, c) => `-\\{${push(c ?? '')}}\\-`);

            // Replace HTML entities with IDs
            t = t.replace(REGEXP.htmlEntity, (_, e) => `&${push(e)};`);

            // Restore nowiki
            t = t.replace(
                REGEXP.nowiki,
                (_, i) => `<nowiki><nowiki>${nowikis[i]}</nowiki></nowiki>`,
            );

            return { replaced: t, mappings };
        };

        const restoreWikitext = (original, mappings) => {
            const nowikis = [];
            let t = original;

            // Strip nowiki temporarily
            t = t.replace(REGEXP.nowiki, (_, c) => `<nowiki>${nowikis.push(c) - 1}</nowiki>`);

            // Restore HTML entities
            t = t.replace(REGEXP.htmlEntity, (_, i) => `&${mappings[i]};`);

            // Restore template names and named-parameter keys
            t = t.replace(REGEXP.template, (_, params) => {
                const [nameIdx, ...parts] = params.split('|');
                const restored = parts.reduce((acc, param) => {
                    const eqIdx = param.indexOf('=');
                    return eqIdx === -1
                        ? `${acc}|${param}`
                        : `${acc}|${mappings[param.slice(0, eqIdx)]}=${param.slice(eqIdx + 1)}`;
                }, `{{${mappings[nameIdx]}`);
                return `${restored}}}`;
            });

            // Restore external link targets
            t = t.replace(
                REGEXP.extLink,
                (_, before, target, text, after) =>
                    `${before}[${mappings[target]}${text ?? ''}]${after}`,
            );

            // Restore link targets
            t = t.replace(REGEXP.link, (match, target, anchor, text) =>
                anchor || text
                    ? `[[${text ? mappings[target] : target}${mappings[anchor] ? `#${mappings[anchor]}` : ''}${text ?? ''}]]`
                    : match,
            );

            // Restore nowiki
            t = t.replace(REGEXP.nowiki, (_, i) => `<nowiki>${nowikis[i]}</nowiki>`);

            // Restore LC markers
            t = t.replace(REGEXP.lcMarkerEsc, (_, i) => `-{${mappings[i] ?? i}}-`);

            return t;
        };

        class AIVCWindow extends OO.ui.ProcessDialog {
            static static = {
                ...OO.ui.ProcessDialog.static,
                tagName: 'div',
                name: 'lr-aivc',
                title: wgULS('自动繁简转换工具', '自動繁簡轉換工具'),
                actions: [
                    {
                        action: 'cancel',
                        label: '取消',
                        flags: ['safe', 'close', 'destructive'],
                        modes: 'config',
                    },
                    {
                        action: 'continue',
                        label: wgULS('继续', '繼續'),
                        flags: ['primary', 'progressive'],
                        modes: 'config',
                    },
                    {
                        action: 'back',
                        label: '返回',
                        flags: ['safe', 'back'],
                        modes: 'confirm',
                    },
                    {
                        action: 'submit',
                        label: wgULS('确认', '確認'),
                        flags: ['primary', 'progressive'],
                        modes: 'confirm',
                    },
                ],
            };

            constructor({ data, ...config }) {
                super({ data, ...config });
                this.config = data.config;
                this.prepopContent = data.prepopContent;
            }

            initialize() {
                super.initialize();

                this.configPanel = this.#makePanel();
                this.confirmPanel = this.#makePanel();

                this.ogText = new OO.ui.MultilineTextInputWidget({
                    value: this.prepopContent,
                    autosize: true,
                });
                this.mainVariants = new OO.ui.TextInputWidget({
                    value: this.config.main.join(';'),
                });
                this.depVariants = new OO.ui.TextInputWidget({
                    value: Object.entries(this.config.dependent)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(';'),
                });
                this.noteTAParams = new OO.ui.TextInputWidget({
                    value: toParams(this.config.noteTA),
                });
                this.occCheckbox = new OO.ui.CheckboxInputWidget({
                    selected: this.config.useOpenCC,
                });

                this.configPanel.$element.append(
                    this.#field(this.ogText, wgULS('原始内容', '原始內容'), 'top'),
                    this.#field(this.mainVariants, wgULS('主要变体', '主要變体'), 'top'),
                    this.#field(this.depVariants, wgULS('依赖变体', '依賴變体'), 'top'),
                    this.#field(this.noteTAParams, wgULS('NoteTA参数', 'NoteTA參數'), 'top'),
                    this.#field(this.occCheckbox, '使用OpenCC', 'inline'),
                );

                this.stackLayout = new OO.ui.StackLayout({
                    items: [this.configPanel, this.confirmPanel],
                });

                this.ogText.connect(this, { resize: 'updateSize' });
                this.$body.append(this.stackLayout.$element);
            }

            #makePanel() {
                return new OO.ui.PanelLayout({ scrollable: false, expanded: false, padded: true });
            }

            #field(widget, label, align) {
                return new OO.ui.FieldLayout(widget, { label, align }).$element;
            }

            #switchTo(mode, panel) {
                this.actions.setMode(mode);
                this.stackLayout.setItem(panel);
                this.updateSize();
            }

            getBodyHeight() {
                return this.stackLayout.getCurrentItem().$element.outerHeight(true);
            }

            getSetupProcess(data) {
                return super.getSetupProcess(data).next(() => {
                    this.#switchTo('config', this.configPanel);
                }, this);
            }

            getReadyProcess(data) {
                return super.getReadyProcess(data).next(() => {
                    this.ogText.focus();
                }, this);
            }

            getActionProcess(action) {
                const handlers = {
                    cancel: () => this.close({ action }),

                    continue: async () => {
                        this.#applyConfigFromUI();

                        if (this.config.main.includes('(main)')) {
                            throw new OO.ui.Error(
                                wgULS('主页面不得作为主要变体', '主頁面不得作為主要變体'),
                            );
                        }
                        this.#buildDependentInv();

                        this.textInputs = {};
                        this.confirmPanel.$element.empty();
                        await this.#getVariants(this.ogText.getValue());
                        this.#switchTo('confirm', this.confirmPanel);
                    },

                    back: () => {
                        this.#switchTo('config', this.configPanel);
                    },

                    submit: async () => {
                        await this.#saveChanges();
                        this.close({ action });
                        mw.notify('保存成功！', {
                            title: wgULS('自动繁简转换工具', '自動繁簡轉換工具'),
                            type: 'success',
                            tag: 'lr-aivc',
                        });
                        setTimeout(() => location.reload(), 730);
                    },
                };

                const handler = handlers[action];
                if (!handler) {
                    return super.getActionProcess(action);
                }

                return new OO.ui.Process(
                    (async () => {
                        try {
                            await handler();
                        } catch (e) {
                            if (e instanceof OO.ui.Error) {
                                throw e;
                            }
                            console.error('[VariantConverter] Error:', e);
                            throw new OO.ui.Error(String(e));
                        }
                    })(),
                    this,
                );
            }

            #applyConfigFromUI() {
                Object.assign(this.config, {
                    main: this.mainVariants.getValue().split(';'),
                    dependent: Object.fromEntries(
                        this.depVariants
                            .getValue()
                            .split(';')
                            .map(v => v.split(':')),
                    ),
                    noteTAStr: this.noteTAParams.getValue(),
                    useOpenCC: this.occCheckbox.isSelected(),
                    dependentInv: {},
                });
            }

            #buildDependentInv() {
                for (const v of this.config.main) {
                    this.config.dependentInv[v] = [v];
                }
                try {
                    for (const [k, v] of Object.entries(this.config.dependent)) {
                        this.config.dependentInv[v].push(k);
                    }
                } catch {
                    console.error(
                        '[VariantConverter] Error: Key not found in dependentInv. Config dump:',
                        this.config,
                    );
                    throw new OO.ui.Error(
                        wgULS('依赖变体格式错误，请检查控制台', '依賴變体格式錯誤，請檢查控制臺'),
                    );
                }
            }

            #addVariant(variant, text) {
                const input = new OO.ui.MultilineTextInputWidget({ value: text, autosize: true });
                this.textInputs[variant] = input;
                input.connect(this, { resize: 'updateSize' });
                this.confirmPanel.$element.append(this.#field(input, variant, 'top'));

                if (window?.InPageEdit?.quickDiff) {
                    const buttons = this.config.dependentInv[variant].map(v =>
                        new OO.ui.ButtonWidget({
                            label: `${wgULS('对比', '對比')}${v === '(main)' ? wgULS('主页面', '主頁面') : v}`,
                        }).on('click', () =>
                            window.InPageEdit.quickDiff({
                                fromtitle: variantPage(v),
                                totext: input.getValue(),
                                pageName: variantPage(v),
                                isPreview: true,
                            }),
                        ),
                    );
                    this.confirmPanel.$element.append(
                        new OO.ui.FieldLayout(
                            new OO.ui.Widget({
                                content: [new OO.ui.HorizontalLayout({ items: buttons })],
                            }),
                        ).$element,
                    );
                }
            }

            async #getVariants(original) {
                this.confirmPanel.$element.append(
                    `<p>${wgULS('请确认以下转换是否正确', '請確認以下轉換是否正確')}：</p>`,
                );

                if (this.config.useOpenCC && !window.OpenCC) {
                    await libCachedCode.injectCachedCode(
                        'https://fastly.jsdelivr.net/npm/opencc-js@latest',
                        'script',
                    );
                }

                const { replaced, mappings } = escapeWikitext(original);

                await Promise.all(
                    this.config.main
                        .filter(v => v !== '(main)')
                        .map(async variant => {
                            const wikitext = `{{NoteTA|${this.config.noteTAStr}}}<pre id="converted">-{}-${replaced}</pre>`;
                            const result = await api.post({
                                action: 'parse',
                                assertuser: wgUserName,
                                text: wikitext,
                                contentmodel: 'wikitext',
                                prop: 'text',
                                uselang: variant,
                                disablelimitreport: true,
                                pst: true,
                            });

                            const parsed = $($.parseHTML(result.parse.text['*']));
                            let converted = parsed.find('#converted').text();

                            if (this.config.useOpenCC) {
                                converted = this.#applyOpenCC(converted, variant);
                            }

                            const final =
                                this.config.manualAction[variant]?.(converted) ?? converted;
                            this.#addVariant(variant, restoreWikitext(final, mappings));
                        }),
                );
            }

            #applyOpenCC(text, variant) {
                const occMappings = [];
                let t = text.replace(
                    REGEXP.noOCC,
                    (_, c) => `<!--noOCC-->${occMappings.push(c) - 1}<!--/noOCC-->`,
                );

                const occVariant = variant
                    .replace('hans', 'cn')
                    .replace(/zh-(?:han)?/, '')
                    .replace('tw', 'twp');

                // eslint-disable-next-line no-undef
                t = OpenCC.Converter({ from: occVariant, to: occVariant })(t);

                return t.replace(
                    REGEXP.noOCC,
                    (_, i) => `<!--noOCC-->${occMappings[i]}<!--/noOCC-->`,
                );
            }

            async #saveChanges() {
                const editParams = (title, text, summary) => ({
                    action: 'edit',
                    assertuser: wgUserName,
                    title,
                    text,
                    summary,
                    tags: 'VariantConverter|Automation tool',
                    watchlist: this.config.watchlist,
                });

                const mainEdits = this.config.main.map(variant =>
                    api.postWithToken(
                        'csrf',
                        editParams(
                            variantPage(variant),
                            this.textInputs[variant].getValue(),
                            `自动转换自[[${wgPageName}]]`,
                        ),
                    ),
                );

                const depEdits = Object.entries(this.config.dependent).map(([variant, parent]) =>
                    api.postWithToken(
                        'csrf',
                        editParams(
                            variantPage(variant),
                            this.textInputs[parent].getValue(),
                            `自动转换自[[${wgPageName}]]（同步${parent}）`,
                        ),
                    ),
                );

                const results = await Promise.allSettled([...mainEdits, ...depEdits]);
                console.log('[VariantConverter] Saved changes', results);
            }
        }

        const windowManager = new OO.ui.WindowManager();
        $(document.body).append(windowManager.$element);

        const aivcDialog = new AIVCWindow({
            size: 'large',
            data: { config: lrAivc, prepopContent },
        });
        windowManager.addWindows([aivcDialog]);

        $(
            mw.util.addPortletLink(
                'p-cactions',
                '#',
                wgULS('自动繁简转换', '自動繁簡轉換'),
                'ca-VariantConverter',
                wgULS('自动同步界面消息的繁简版本', '自動同步介面消息的繁簡版本'),
            ),
        ).on('click', e => {
            e.preventDefault();
            $('#mw-notification-area').appendTo(document.body);
            windowManager.openWindow(aivcDialog);
        });
    })(),
);
